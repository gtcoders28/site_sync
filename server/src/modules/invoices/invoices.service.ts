import { query, withTransaction } from '../../database';
import { APIError } from '../../errors/apiError';
import { getPaginationParams, formatPaginationMetadata } from '../../utils/pagination';
import { parseDateRange } from '../../utils/dateFilter';
import { INVOICE_STATUS, TERMINAL_INVOICE_STATUSES, ROLES } from '../../config/constants';
import { UserContext } from '../../middlewares/auth.middleware';

export class InvoicesService {
  /**
   * Helper to compute GST breakdown (taxable amount, CGST, SGST, IGST, total) for line items
   */
  private _computeTaxes(items: any[]) {
    let sumTaxable = 0;
    let sumCgst = 0;
    let sumSgst = 0;
    let sumIgst = 0;

    const enrichedItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxableAmount = Math.round(quantity * unitPrice * 100) / 100;
      const gstRate = item.gstRate !== undefined && item.gstRate !== null ? Number(item.gstRate) : 18.0;

      // Standard intra-state split: half CGST, half SGST
      const cgstRate = gstRate / 2;
      const cgstAmount = Math.round(taxableAmount * (cgstRate / 100) * 100) / 100;
      const sgstRate = gstRate / 2;
      const sgstAmount = Math.round(taxableAmount * (sgstRate / 100) * 100) / 100;
      const igstRate = 0;
      const igstAmount = 0;
      const totalAmount = Math.round((taxableAmount + cgstAmount + sgstAmount + igstAmount) * 100) / 100;

      sumTaxable += taxableAmount;
      sumCgst += cgstAmount;
      sumSgst += sgstAmount;
      sumIgst += igstAmount;

      return {
        productId: item.productId,
        quantity,
        unitPrice,
        hsnSacCode: item.hsnSacCode || '6802',
        taxableAmount,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        totalAmount,
      };
    });

    const subtotal = sumTaxable + sumCgst + sumSgst + sumIgst;
    const roundedTotal = Math.round(subtotal);
    const roundOff = Math.round((roundedTotal - subtotal) * 100) / 100;

    return {
      enrichedItems,
      taxableAmount: Math.round(sumTaxable * 100) / 100,
      cgstAmount: Math.round(sumCgst * 100) / 100,
      sgstAmount: Math.round(sumSgst * 100) / 100,
      igstAmount: Math.round(sumIgst * 100) / 100,
      roundOffAmount: roundOff,
      totalAmount: roundedTotal,
    };
  }

  // ==========================================================================
  // DISTRIBUTOR INVOICES (Distributor -> Dealer)
  // ==========================================================================

  /**
   * Create Distributor-to-Dealer Invoice (by Owner or Staff)
   */
  async createDistributorInvoice(data: any, currentUser: UserContext) {
    let distributorId: string;
    let isStaffDraft = false;
    let isDealerOrder = false;
    let createdByStaffId: string | null = null;
    let approvalStatus = 'approved';
    let invoiceStatus: string = INVOICE_STATUS.PENDING;

    let targetDealerId = data.dealerId;

    if (currentUser.role === ROLES.STAFF) {
      if (currentUser.employerType !== 'distributor' || !currentUser.employerId) {
        throw APIError.forbidden('Only staff members employed by a distributor can create B2B distributor invoices.');
      }
      if (!currentUser.permissions?.canCreateInvoices) {
        throw APIError.forbidden('You do not have permission to draft invoices.');
      }
      distributorId = currentUser.employerId;
      isStaffDraft = true;
      createdByStaffId = currentUser.id;
      approvalStatus = 'pending_approval';
      invoiceStatus = INVOICE_STATUS.PENDING_APPROVAL;
    } else if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
      // Dealer/Retailer placing a wholesale order to their upstream distributor
      isDealerOrder = true;
      targetDealerId = currentUser.dealerId || currentUser.id;

      // Find the upstream distributor for this dealer
      if (currentUser.distributorId) {
        distributorId = currentUser.distributorId;
      } else {
        const dealerLookup = await query('SELECT distributor_id, parent_dealer_id FROM dealers WHERE dealer_id = $1', [targetDealerId]);
        if (dealerLookup.rows.length === 0) {
          throw APIError.notFound('Dealer profile not found.');
        }
        distributorId = dealerLookup.rows[0].distributor_id;
        if (!distributorId) {
          throw APIError.badRequest('No upstream distributor assigned to your dealer profile.');
        }
      }
      approvalStatus = 'approved';
      invoiceStatus = INVOICE_STATUS.PENDING;
    } else {
      distributorId = currentUser.distributorId || currentUser.id;
      if (!distributorId) {
        throw APIError.forbidden('Only distributors or dealers can create B2B wholesale invoices.');
      }
    }

    const {
      invoiceNumber,
      invoiceDate = new Date().toISOString().split('T')[0],
      sellerGstin = null,
      buyerGstin = null,
      billingAddress = null,
      shippingAddress = null,
      ewayBillNumber = null,
      vehicleNumber = null,
      items,
    } = data;

    if (!targetDealerId) {
      throw APIError.badRequest('Dealer ID is required for distributor invoice.');
    }

    // Verify dealer belongs to this distributor
    const dealerRes = await query('SELECT dealer_id, distributor_id, status FROM dealers WHERE dealer_id = $1', [targetDealerId]);
    if (dealerRes.rows.length === 0) {
      throw APIError.notFound('Target dealer not found.');
    }
    if (!currentUser.isPlatformOwner && dealerRes.rows[0].distributor_id !== distributorId) {
      throw APIError.forbidden('You can only issue invoices to dealers registered under your distributorship.');
    }
    if (dealerRes.rows[0].status !== 'active') {
      throw APIError.badRequest(`Dealer account is currently ${dealerRes.rows[0].status}. Invoicing not allowed.`);
    }

    // Check duplicate invoice number
    const dupRes = await query(
      'SELECT invoice_id FROM distributor_invoices WHERE distributor_id = $1 AND invoice_number = $2',
      [distributorId, invoiceNumber]
    );
    if (dupRes.rows.length > 0) {
      throw APIError.conflict(`Invoice number '${invoiceNumber}' already exists for this distributor.`);
    }

    const taxData = this._computeTaxes(items);

    return await withTransaction(async (client) => {
      // If confirmed by distributor owner directly (NOT staff draft, NOT dealer purchase order), reserve stock in distributor_inventory
      const shouldReserveStockImmediately = !isStaffDraft && !isDealerOrder;
      if (shouldReserveStockImmediately) {
        for (const item of taxData.enrichedItems) {
          const invRes = await client.query(
            `SELECT quantity_available, quantity_in_transit 
             FROM distributor_inventory 
             WHERE distributor_id = $1 AND product_id = $2 
             FOR UPDATE`,
            [distributorId, item.productId]
          );

          const currentAvailable = invRes.rows.length > 0 ? parseFloat(invRes.rows[0].quantity_available) : 0;
          if (currentAvailable < item.quantity) {
            throw APIError.badRequest(
              `Insufficient available stock for product ID ${item.productId}. Available: ${currentAvailable}, Requested: ${item.quantity}`,
              null,
              'INSUFFICIENT_STOCK'
            );
          }

          await client.query(
            `UPDATE distributor_inventory
             SET quantity_available = quantity_available - $1,
                 quantity_in_transit = quantity_in_transit + $1,
                 updated_at = NOW()
             WHERE distributor_id = $2 AND product_id = $3`,
            [item.quantity, distributorId, item.productId]
          );
        }
      }

      // Create distributor invoice with full tax snapshot
      const invRes = await client.query(
        `INSERT INTO distributor_invoices (
          distributor_id, dealer_id, invoice_number, invoice_date, total_amount, status,
          created_by_staff_id, approval_status, seller_gstin, buyer_gstin,
          taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off_amount,
          billing_address, shipping_address, eway_bill_number, vehicle_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING invoice_id, distributor_id, dealer_id, invoice_number, invoice_date, total_amount, status,
                  created_by_staff_id, approval_status, taxable_amount, cgst_amount, sgst_amount, igst_amount,
                  round_off_amount, created_at;`,
        [
          distributorId,
          targetDealerId,
          invoiceNumber,
          invoiceDate,
          taxData.totalAmount,
          invoiceStatus,
          createdByStaffId,
          approvalStatus,
          sellerGstin,
          buyerGstin,
          taxData.taxableAmount,
          taxData.cgstAmount,
          taxData.sgstAmount,
          taxData.igstAmount,
          taxData.roundOffAmount,
          billingAddress,
          shippingAddress,
          ewayBillNumber,
          vehicleNumber,
        ]
      );
      const invoice = invRes.rows[0];

      // Insert line items with tax breakdown
      const itemInserts = taxData.enrichedItems.map((item) => {
        return client.query(
          `INSERT INTO distributor_invoice_items (
            invoice_id, product_id, quantity, unit_price, total_amount,
            hsn_sac_code, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING item_id, product_id, quantity, unit_price, total_amount, hsn_sac_code,
                    taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount;`,
          [
            invoice.invoice_id,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.totalAmount,
            item.hsnSacCode,
            item.taxableAmount,
            item.cgstRate,
            item.cgstAmount,
            item.sgstRate,
            item.sgstAmount,
            item.igstRate,
            item.igstAmount,
          ]
        );
      });
      const insertedItems = await Promise.all(itemInserts);
      invoice.items = insertedItems.map((r) => r.rows[0]);

      // If owner created directly (stock reserved), log inventory movements
      if (shouldReserveStockImmediately) {
        for (const item of taxData.enrichedItems) {
          await client.query(
            `INSERT INTO inventory_movements (
              owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['distributor', distributorId, item.productId, -item.quantity, 'in_transit_hold', 'distributor_invoice', invoice.invoice_id]
          );
        }
      }

      return invoice;
    });
  }

  /**
   * Update Distributor Invoice Status (delivered or cancelled)
   */
  async updateDistributorInvoiceStatus(invoiceId: string, targetStatus: string, currentUser: UserContext) {
    return await withTransaction(async (client) => {
      const invRes = await client.query(
        'SELECT * FROM distributor_invoices WHERE invoice_id = $1 FOR UPDATE',
        [invoiceId]
      );

      if (invRes.rows.length === 0) {
        throw APIError.notFound('Distributor invoice not found.');
      }

      const invoice = invRes.rows[0];

      const isDistributorOwner = currentUser.isPlatformOwner || currentUser.distributorId === invoice.distributor_id;
      const isDealerRecipient = (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) &&
        (currentUser.dealerId === invoice.dealer_id || currentUser.id === invoice.dealer_id);

      if (!isDistributorOwner && !isDealerRecipient) {
        throw APIError.forbidden('Access denied to this distributor invoice.');
      }

      if ((TERMINAL_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) {
        throw APIError.conflict(
          `Distributor invoice ${invoice.invoice_number} is already in terminal state '${invoice.status}' and cannot be modified.`,
          'ILLEGAL_STATE_TRANSITION'
        );
      }

      const itemsRes = await client.query(
        'SELECT product_id, quantity FROM distributor_invoice_items WHERE invoice_id = $1',
        [invoiceId]
      );

      if (targetStatus === INVOICE_STATUS.DELIVERED) {
        for (const item of itemsRes.rows) {
          // If invoice was already dispatched/in-transit, decrement quantity_in_transit.
          // If it was still pending (e.g. accepted directly upon delivery), check and decrement distributor stock.
          if (invoice.status === INVOICE_STATUS.DISPATCHED) {
            await client.query(
              `UPDATE distributor_inventory
               SET quantity_in_transit = GREATEST(0, quantity_in_transit - $1),
                   updated_at = NOW()
               WHERE distributor_id = $2 AND product_id = $3`,
              [item.quantity, invoice.distributor_id, item.product_id]
            );
          } else {
            // Deduct directly from quantity_available if not previously placed in transit
            await client.query(
              `UPDATE distributor_inventory
               SET quantity_available = GREATEST(0, quantity_available - $1),
                   updated_at = NOW()
               WHERE distributor_id = $2 AND product_id = $3`,
              [item.quantity, invoice.distributor_id, item.product_id]
            );

            await client.query(
              `INSERT INTO inventory_movements (
                owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              ['distributor', invoice.distributor_id, item.product_id, -item.quantity, 'dealer_sale', 'distributor_invoice', invoiceId]
            );
          }

          await client.query(
            `INSERT INTO dealer_inventory (dealer_id, product_id, quantity_available, quantity_in_transit, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (dealer_id, product_id)
             DO UPDATE SET quantity_available = dealer_inventory.quantity_available + EXCLUDED.quantity_available,
                           updated_at = NOW()`,
            [invoice.dealer_id, item.product_id, item.quantity]
          );

          await client.query(
            `INSERT INTO inventory_movements (
              owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['dealer', invoice.dealer_id, item.product_id, item.quantity, 'dealer_sale', 'distributor_invoice', invoiceId]
          );
        }
      } else if (targetStatus === INVOICE_STATUS.DISPATCHED) {
        // Transition to dispatched: reserve stock in distributor_inventory as in-transit if not already reserved
        for (const item of itemsRes.rows) {
          const invRes = await client.query(
            `SELECT quantity_available, quantity_in_transit 
             FROM distributor_inventory 
             WHERE distributor_id = $1 AND product_id = $2 
             FOR UPDATE`,
            [invoice.distributor_id, item.product_id]
          );

          const currentAvailable = invRes.rows.length > 0 ? parseFloat(invRes.rows[0].quantity_available) : 0;
          if (currentAvailable < item.quantity) {
            throw APIError.badRequest(
              `Insufficient distributor stock to dispatch product ${item.product_id}. Available: ${currentAvailable}, Requested: ${item.quantity}`,
              null,
              'INSUFFICIENT_STOCK'
            );
          }

          await client.query(
            `UPDATE distributor_inventory
             SET quantity_available = quantity_available - $1,
                 quantity_in_transit = quantity_in_transit + $1,
                 updated_at = NOW()
             WHERE distributor_id = $2 AND product_id = $3`,
            [item.quantity, invoice.distributor_id, item.product_id]
          );

          await client.query(
            `INSERT INTO inventory_movements (
              owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['distributor', invoice.distributor_id, item.product_id, -item.quantity, 'in_transit_hold', 'distributor_invoice', invoiceId]
          );
        }
      } else if (targetStatus === INVOICE_STATUS.CANCELLED) {
        if (invoice.status === INVOICE_STATUS.DISPATCHED) {
          for (const item of itemsRes.rows) {
            await client.query(
              `UPDATE distributor_inventory
               SET quantity_in_transit = GREATEST(0, quantity_in_transit - $1),
                   quantity_available = quantity_available + $1,
                   updated_at = NOW()
               WHERE distributor_id = $2 AND product_id = $3`,
              [item.quantity, invoice.distributor_id, item.product_id]
            );

            await client.query(
              `INSERT INTO inventory_movements (
                owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              ['distributor', invoice.distributor_id, item.product_id, item.quantity, 'in_transit_cancelled', 'distributor_invoice', invoiceId]
            );
          }
        }
      }

      const updatedRes = await client.query(
        `UPDATE distributor_invoices
         SET status = $1,
             delivered_at = (CASE WHEN $1::varchar = 'delivered' THEN NOW() ELSE delivered_at END),
             updated_at = NOW()
         WHERE invoice_id = $2
         RETURNING invoice_id, distributor_id, dealer_id, invoice_number, total_amount, status, delivered_at, updated_at;`,
        [targetStatus, invoiceId]
      );

      return updatedRes.rows[0];
    });
  }

  /**
   * List Distributor Invoices
   */
  async listDistributorInvoices(queryParams: any, currentUser: UserContext) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const { fromDate, toDate } = parseDateRange(queryParams);
    const params: any[] = [];

    let countSql = 'SELECT COUNT(*) FROM distributor_invoices inv WHERE 1=1';
    let dataSql = `
      SELECT inv.invoice_id, inv.distributor_id, inv.dealer_id, inv.invoice_number,
             inv.invoice_date, inv.total_amount, inv.status, inv.approval_status, inv.delivered_at, inv.created_at,
             inv.taxable_amount, inv.cgst_amount, inv.sgst_amount, inv.igst_amount, inv.round_off_amount,
             dist.company_name AS distributor_name, dlr.shop_name AS dealer_name,
             st.full_name AS staff_name
      FROM distributor_invoices inv
      JOIN distributors dist ON inv.distributor_id = dist.distributor_id
      JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
      LEFT JOIN staff st ON inv.created_by_staff_id = st.staff_id
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        params.push(currentUser.distributorId);
        const clause = ` AND inv.distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
        params.push(currentUser.dealerId || currentUser.id);
        const clause = ` AND inv.dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.STAFF) {
        if (currentUser.employerType === 'distributor') {
          params.push(currentUser.employerId);
          const clause = ` AND inv.distributor_id = $${params.length}`;
          countSql += clause;
          dataSql += clause;
        } else {
          params.push(currentUser.employerId);
          const clause = ` AND inv.dealer_id = $${params.length}`;
          countSql += clause;
          dataSql += clause;
        }
      } else {
        throw APIError.forbidden('Access denied to distributor invoices.');
      }
    } else if (queryParams.distributorId) {
      params.push(queryParams.distributorId);
      const clause = ` AND inv.distributor_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.dealerId) {
      params.push(queryParams.dealerId);
      const clause = ` AND inv.dealer_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND inv.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.approvalStatus) {
      params.push(queryParams.approvalStatus);
      const clause = ` AND inv.approval_status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    params.push(fromDate);
    params.push(toDate);
    const dateClause = ` AND inv.invoice_date >= $${params.length - 1}::date AND inv.invoice_date <= $${params.length}::date`;
    countSql += dateClause;
    dataSql += dateClause;

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const searchClause = ` AND (inv.invoice_number ILIKE $${params.length} OR dlr.shop_name ILIKE $${params.length})`;
      countSql += searchClause;
      dataSql += searchClause;
    }

    dataSql += ` ORDER BY inv.invoice_date DESC, inv.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      invoices: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  // ==========================================================================
  // DEALER INVOICES (Dealer -> Customer or Downstream Retailer)
  // ==========================================================================

  /**
   * Create Dealer Invoice (Dealer to Customer OR Dealer to Retailer)
   */
  async createDealerInvoice(data: any, currentUser: UserContext) {
    let dealerId: string;
    let isStaffDraft = false;
    let createdByStaffId: string | null = null;
    let approvalStatus = 'approved';
    let invoiceStatus: string = INVOICE_STATUS.DELIVERED;

    if (currentUser.role === ROLES.STAFF) {
      if (currentUser.employerType !== 'dealer' || !currentUser.employerId) {
        throw APIError.forbidden('Only staff members employed by a dealer/retailer can draft sales invoices.');
      }
      if (!currentUser.permissions?.canCreateInvoices) {
        throw APIError.forbidden('You do not have permission to draft invoices.');
      }
      dealerId = currentUser.employerId;
      isStaffDraft = true;
      createdByStaffId = currentUser.id;
      approvalStatus = 'pending_approval';
      invoiceStatus = INVOICE_STATUS.PENDING_APPROVAL;
    } else {
      dealerId = currentUser.dealerId || currentUser.id;
      if (!dealerId) {
        throw APIError.forbidden('Only dealers or retailers can issue sales invoices.');
      }
    }

    const {
      customerId = null,
      buyerDealerId = null,
      influencerId = null,
      invoiceNumber,
      invoiceDate = new Date().toISOString().split('T')[0],
      sellerGstin = null,
      buyerGstin = null,
      billingAddress = null,
      shippingAddress = null,
      ewayBillNumber = null,
      vehicleNumber = null,
      items,
    } = data;

    if (!customerId && !buyerDealerId) {
      throw APIError.badRequest('Either customerId or buyerDealerId must be specified as recipient.');
    }

    let customer: any = null;
    if (customerId) {
      const custRes = await query(
        'SELECT customer_id, name, onboarding_dealer_id, referred_by_customer_id, status FROM customers WHERE customer_id = $1',
        [customerId]
      );
      if (custRes.rows.length === 0) {
        throw APIError.notFound('Customer not found');
      }
      customer = custRes.rows[0];
    }

    if (buyerDealerId) {
      const buyerRes = await query('SELECT dealer_id, shop_name, status FROM dealers WHERE dealer_id = $1', [buyerDealerId]);
      if (buyerRes.rows.length === 0) {
        throw APIError.notFound('Downstream retailer/dealer not found');
      }
    }

    if (influencerId) {
      const infRes = await query('SELECT influencer_id, dealer_id, status FROM influencers WHERE influencer_id = $1', [influencerId]);
      if (infRes.rows.length === 0) {
        throw APIError.badRequest('Tagged influencer does not exist.');
      }
    }

    // Check duplicate invoice number
    const dupRes = await query('SELECT invoice_id FROM dealer_invoices WHERE dealer_id = $1 AND invoice_number = $2', [
      dealerId,
      invoiceNumber,
    ]);
    if (dupRes.rows.length > 0) {
      throw APIError.conflict(`Invoice number '${invoiceNumber}' already exists for this dealer.`);
    }

    const taxData = this._computeTaxes(items);

    return await withTransaction(async (client) => {
      // If confirmed by owner (NOT draft), lock and deduct available stock immediately
      if (!isStaffDraft) {
        for (const item of taxData.enrichedItems) {
          const invRes = await client.query(
            `SELECT quantity_available FROM dealer_inventory 
             WHERE dealer_id = $1 AND product_id = $2 
             FOR UPDATE`,
            [dealerId, item.productId]
          );

          const available = invRes.rows.length > 0 ? parseFloat(invRes.rows[0].quantity_available) : 0;
          if (available < item.quantity) {
            throw APIError.badRequest(
              `Insufficient stock for product ID ${item.productId}. Available: ${available}, Requested: ${item.quantity}`,
              null,
              'INSUFFICIENT_STOCK'
            );
          }

          await client.query(
            `UPDATE dealer_inventory
             SET quantity_available = quantity_available - $1,
                 updated_at = NOW()
             WHERE dealer_id = $2 AND product_id = $3`,
            [item.quantity, dealerId, item.productId]
          );
        }
      }

      // Insert dealer invoice
      const invRes = await client.query(
        `INSERT INTO dealer_invoices (
          dealer_id, customer_id, buyer_dealer_id, influencer_id, invoice_number, invoice_date,
          total_amount, status, delivered_at, created_by_staff_id, approval_status,
          seller_gstin, buyer_gstin, taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off_amount,
          billing_address, shipping_address, eway_bill_number, vehicle_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (CASE WHEN $8::varchar = 'delivered' THEN NOW() ELSE NULL END), $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING invoice_id, dealer_id, customer_id, buyer_dealer_id, influencer_id, invoice_number,
                  invoice_date, total_amount, status, delivered_at, created_by_staff_id, approval_status,
                  taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off_amount, created_at;`,
        [
          dealerId,
          customerId || null,
          buyerDealerId || null,
          influencerId || null,
          invoiceNumber,
          invoiceDate,
          taxData.totalAmount,
          invoiceStatus,
          createdByStaffId,
          approvalStatus,
          sellerGstin,
          buyerGstin,
          taxData.taxableAmount,
          taxData.cgstAmount,
          taxData.sgstAmount,
          taxData.igstAmount,
          taxData.roundOffAmount,
          billingAddress,
          shippingAddress,
          ewayBillNumber,
          vehicleNumber,
        ]
      );
      const invoice = invRes.rows[0];

      // Insert line items with tax breakdown
      const itemInserts = taxData.enrichedItems.map((item) => {
        return client.query(
          `INSERT INTO dealer_invoice_items (
            invoice_id, product_id, quantity, unit_price, total_amount,
            hsn_sac_code, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING item_id, product_id, quantity, unit_price, total_amount, hsn_sac_code,
                    taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount;`,
          [
            invoice.invoice_id,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.totalAmount,
            item.hsnSacCode,
            item.taxableAmount,
            item.cgstRate,
            item.cgstAmount,
            item.sgstRate,
            item.sgstAmount,
            item.igstRate,
            item.igstAmount,
          ]
        );
      });
      const insertedItems = await Promise.all(itemInserts);
      invoice.items = insertedItems.map((r) => r.rows[0]);

      // If owner confirmed invoice, log movements and loyalty points
      if (!isStaffDraft) {
        for (const item of taxData.enrichedItems) {
          await client.query(
            `INSERT INTO inventory_movements (
              owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['dealer', dealerId, item.productId, -item.quantity, 'customer_sale', 'dealer_invoice', invoice.invoice_id]
          );
        }

        // Loyalty engine (when invoicing a customer)
        if (customerId && customer) {
          const customerPoints = Math.max(1, Math.floor(taxData.totalAmount / 10));
          await client.query(
            `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              'customer',
              customerId,
              customerPoints,
              'order_purchase',
              'dealer_invoice',
              invoice.invoice_id,
              `Points for invoice #${invoiceNumber}`,
              `order_points_${invoice.invoice_id}`,
            ]
          );

          if (customer.referred_by_customer_id) {
            const referralBonus = Math.max(5, Math.floor(customerPoints * 0.1));
            await client.query(
              `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes, idempotency_key)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (idempotency_key) DO NOTHING`,
              [
                'customer',
                customer.referred_by_customer_id,
                referralBonus,
                'referral_bonus',
                'dealer_invoice',
                invoice.invoice_id,
                `Referral bonus from customer ${customer.name}'s order`,
                `ref_points_${invoice.invoice_id}`,
              ]
            );
          }

          if (influencerId) {
            const influencerBonus = Math.max(10, Math.floor(customerPoints * 0.15));
            await client.query(
              `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes, idempotency_key)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (idempotency_key) DO NOTHING`,
              [
                'influencer',
                influencerId,
                influencerBonus,
                'influencer_commission',
                'dealer_invoice',
                invoice.invoice_id,
                `Commission points on order #${invoiceNumber}`,
                `inf_points_${invoice.invoice_id}`,
              ]
            );
          }
        }
      }

      return invoice;
    });
  }

  /**
   * List Dealer Invoices with Scoping
   */
  async listDealerInvoices(queryParams: any, currentUser: UserContext) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const { fromDate, toDate } = parseDateRange(queryParams);
    const params: any[] = [];

    let countSql = 'SELECT COUNT(*) FROM dealer_invoices inv JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id WHERE 1=1';
    let dataSql = `
      SELECT inv.invoice_id, inv.dealer_id, inv.customer_id, inv.buyer_dealer_id, inv.influencer_id,
             inv.invoice_number, inv.invoice_date, inv.total_amount, inv.status, inv.approval_status,
             inv.taxable_amount, inv.cgst_amount, inv.sgst_amount, inv.igst_amount, inv.round_off_amount,
             inv.delivered_at, inv.created_at,
             dlr.shop_name AS dealer_name, cust.name AS customer_name, cust.mobile_number AS customer_mobile,
             buyer_dlr.shop_name AS buyer_dealer_name, inf.name AS influencer_name,
             st.full_name AS staff_name
      FROM dealer_invoices inv
      JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
      LEFT JOIN customers cust ON inv.customer_id = cust.customer_id
      LEFT JOIN dealers buyer_dlr ON inv.buyer_dealer_id = buyer_dlr.dealer_id
      LEFT JOIN influencers inf ON inv.influencer_id = inf.influencer_id
      LEFT JOIN staff st ON inv.created_by_staff_id = st.staff_id
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        params.push(currentUser.distributorId);
        const clause = ` AND dlr.distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
        params.push(currentUser.dealerId);
        const clause = ` AND inv.dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.STAFF) {
        if (currentUser.employerType === 'distributor') {
          params.push(currentUser.employerId);
          const clause = ` AND dlr.distributor_id = $${params.length}`;
          countSql += clause;
          dataSql += clause;
        } else {
          params.push(currentUser.employerId);
          const clause = ` AND inv.dealer_id = $${params.length}`;
          countSql += clause;
          dataSql += clause;
        }
      } else if (currentUser.role === ROLES.CUSTOMER) {
        params.push(currentUser.id);
        const clause = ` AND inv.customer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.INFLUENCER) {
        params.push(currentUser.id);
        const clause = ` AND inv.influencer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Access denied to invoices.');
      }
    } else if (queryParams.dealerId) {
      params.push(queryParams.dealerId);
      const clause = ` AND inv.dealer_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.customerId) {
      params.push(queryParams.customerId);
      const clause = ` AND inv.customer_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND inv.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.approvalStatus) {
      params.push(queryParams.approvalStatus);
      const clause = ` AND inv.approval_status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    params.push(fromDate);
    params.push(toDate);
    const dateClause = ` AND inv.invoice_date >= $${params.length - 1}::date AND inv.invoice_date <= $${params.length}::date`;
    countSql += dateClause;
    dataSql += dateClause;

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const searchClause = ` AND (inv.invoice_number ILIKE $${params.length} OR cust.name ILIKE $${params.length} OR buyer_dlr.shop_name ILIKE $${params.length})`;
      countSql += searchClause;
      dataSql += searchClause;
    }

    dataSql += ` ORDER BY inv.invoice_date DESC, inv.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      invoices: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  // ==========================================================================
  // STAFF DRAFTS & APPROVAL PIPELINE
  // ==========================================================================

  /**
   * List staff-drafted invoices awaiting review by parent organization
   */
  async listPendingApprovals(currentUser: UserContext) {
    if (currentUser.isPlatformOwner || currentUser.role === ROLES.DISTRIBUTOR) {
      const distId = currentUser.distributorId || currentUser.id;
      const res = await query(
        `SELECT inv.*, dist.company_name AS distributor_name, dlr.shop_name AS dealer_name,
                st.full_name AS staff_name, st.mobile_number AS staff_mobile, 'distributor' AS invoice_kind
         FROM distributor_invoices inv
         JOIN distributors dist ON inv.distributor_id = dist.distributor_id
         JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
         LEFT JOIN staff st ON inv.created_by_staff_id = st.staff_id
         WHERE (inv.distributor_id = $1 OR $2) AND inv.approval_status = 'pending_approval'
         ORDER BY inv.created_at DESC`,
        [distId, currentUser.isPlatformOwner]
      );
      return res.rows;
    }

    if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
      const dealerId = currentUser.dealerId || currentUser.id;
      const res = await query(
        `SELECT inv.*, dlr.shop_name AS dealer_name, cust.name AS customer_name,
                cust.mobile_number AS customer_mobile, buyer_dlr.shop_name AS buyer_dealer_name,
                st.full_name AS staff_name, st.mobile_number AS staff_mobile, 'dealer' AS invoice_kind
         FROM dealer_invoices inv
         JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
         LEFT JOIN customers cust ON inv.customer_id = cust.customer_id
         LEFT JOIN dealers buyer_dlr ON inv.buyer_dealer_id = buyer_dlr.dealer_id
         LEFT JOIN staff st ON inv.created_by_staff_id = st.staff_id
         WHERE inv.dealer_id = $1 AND inv.approval_status = 'pending_approval'
         ORDER BY inv.created_at DESC`,
        [dealerId]
      );
      return res.rows;
    }

    throw APIError.forbidden('Only parent distributors or dealers can view pending invoice approvals.');
  }

  /**
   * List drafts created by the authenticated staff member
   */
  async listMyDrafts(currentUser: UserContext) {
    if (currentUser.role !== ROLES.STAFF) {
      throw APIError.forbidden('Only staff members can list their personal drafted invoices.');
    }

    const staffId = currentUser.id;

    if (currentUser.employerType === 'distributor') {
      const res = await query(
        `SELECT inv.*, dist.company_name AS distributor_name, dlr.shop_name AS dealer_name, 'distributor' AS invoice_kind
         FROM distributor_invoices inv
         JOIN distributors dist ON inv.distributor_id = dist.distributor_id
         JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
         WHERE inv.created_by_staff_id = $1
         ORDER BY inv.created_at DESC`,
        [staffId]
      );
      return res.rows;
    }

    const res = await query(
      `SELECT inv.*, dlr.shop_name AS dealer_name, cust.name AS customer_name,
              buyer_dlr.shop_name AS buyer_dealer_name, 'dealer' AS invoice_kind
       FROM dealer_invoices inv
       JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
       LEFT JOIN customers cust ON inv.customer_id = cust.customer_id
       LEFT JOIN dealers buyer_dlr ON inv.buyer_dealer_id = buyer_dlr.dealer_id
       WHERE inv.created_by_staff_id = $1
       ORDER BY inv.created_at DESC`,
      [staffId]
    );
    return res.rows;
  }

  /**
   * Approve a staff draft invoice and deduct/reserve stock atomically
   */
  async approveInvoice(invoiceId: string, currentUser: UserContext) {
    // 1. Check dealer_invoices first
    const dlrInvRes = await query('SELECT * FROM dealer_invoices WHERE invoice_id = $1', [invoiceId]);
    if (dlrInvRes.rows.length > 0) {
      const invoice = dlrInvRes.rows[0];

      // Authority check: parent dealer owner or platform owner
      const isDealerOrRetailer = currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER;
      if (!currentUser.isPlatformOwner && (!isDealerOrRetailer || currentUser.dealerId !== invoice.dealer_id)) {
        throw APIError.forbidden('You do not have authority to approve invoices for this dealer.');
      }

      // Execute live stored procedure: public.approve_dealer_invoice(p_invoice_id, p_approved_by_id)
      const procRes = await query(
        'SELECT public.approve_dealer_invoice($1, $2) as result',
        [invoiceId, invoice.dealer_id]
      );

      // Award loyalty points to customer if applicable
      if (invoice.customer_id) {
        const customerPoints = Math.max(1, Math.floor(Number(invoice.total_amount) / 10));
        await query(
          `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            'customer',
            invoice.customer_id,
            customerPoints,
            'order_purchase',
            'dealer_invoice',
            invoice.invoice_id,
            `Points for approved invoice #${invoice.invoice_number}`,
            `order_points_${invoice.invoice_id}`,
          ]
        );
      }

      return procRes.rows[0].result;
    }

    // 2. Check distributor_invoices
    const distInvRes = await query('SELECT * FROM distributor_invoices WHERE invoice_id = $1', [invoiceId]);
    if (distInvRes.rows.length > 0) {
      const invoice = distInvRes.rows[0];

      if (!currentUser.isPlatformOwner && (currentUser.role !== ROLES.DISTRIBUTOR || currentUser.distributorId !== invoice.distributor_id)) {
        throw APIError.forbidden('You do not have authority to approve invoices for this distributor.');
      }

      if (invoice.approval_status !== 'pending_approval') {
        throw APIError.conflict(`Invoice is already ${invoice.approval_status}`);
      }

      return await withTransaction(async (client) => {
        const itemsRes = await client.query(
          'SELECT product_id, quantity FROM distributor_invoice_items WHERE invoice_id = $1',
          [invoiceId]
        );

        for (const item of itemsRes.rows) {
          const invCheck = await client.query(
            `SELECT quantity_available FROM distributor_inventory 
             WHERE distributor_id = $1 AND product_id = $2 
             FOR UPDATE`,
            [invoice.distributor_id, item.product_id]
          );

          const avail = invCheck.rows.length > 0 ? parseFloat(invCheck.rows[0].quantity_available) : 0;
          if (avail < item.quantity) {
            throw APIError.badRequest(`Insufficient stock for product ID ${item.product_id}. Available: ${avail}, Requested: ${item.quantity}`);
          }

          await client.query(
            `UPDATE distributor_inventory
             SET quantity_available = quantity_available - $1,
                 quantity_in_transit = quantity_in_transit + $1,
                 updated_at = NOW()
             WHERE distributor_id = $2 AND product_id = $3`,
            [item.quantity, invoice.distributor_id, item.product_id]
          );

          await client.query(
            `INSERT INTO inventory_movements (
              owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id, created_by_staff_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              'distributor',
              invoice.distributor_id,
              item.product_id,
              -item.quantity,
              'in_transit_hold',
              'distributor_invoice',
              invoice.invoice_id,
              invoice.created_by_staff_id,
            ]
          );
        }

        const updateRes = await client.query(
          `UPDATE distributor_invoices
           SET approval_status = 'approved',
               status = 'pending',
               approved_by_id = $1,
               approved_at = NOW(),
               updated_at = NOW()
           WHERE invoice_id = $2
           RETURNING *;`,
          [currentUser.id, invoiceId]
        );

        return {
          success: true,
          invoiceId,
          message: 'Distributor invoice approved and stock reserved in transit.',
          invoice: updateRes.rows[0],
        };
      });
    }

    throw APIError.notFound('Invoice not found.');
  }

  /**
   * Reject a staff-drafted invoice
   */
  async rejectInvoice(invoiceId: string, rejectionReason: string | null = null, currentUser: UserContext) {
    // Check dealer invoices
    const dlrInv = await query('SELECT * FROM dealer_invoices WHERE invoice_id = $1', [invoiceId]);
    if (dlrInv.rows.length > 0) {
      const invoice = dlrInv.rows[0];
      const isDealerOrRetailer = currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER;
      if (!currentUser.isPlatformOwner && (!isDealerOrRetailer || currentUser.dealerId !== invoice.dealer_id)) {
        throw APIError.forbidden('You do not have authority to reject invoices for this dealer.');
      }

      await query(
        `UPDATE dealer_invoices
         SET approval_status = 'rejected',
             status = 'cancelled',
             updated_at = NOW()
         WHERE invoice_id = $1`,
        [invoiceId]
      );

      return {
        success: true,
        invoiceId,
        status: 'cancelled',
        approvalStatus: 'rejected',
        message: 'Draft invoice rejected.',
      };
    }

    // Check distributor invoices
    const distInv = await query('SELECT * FROM distributor_invoices WHERE invoice_id = $1', [invoiceId]);
    if (distInv.rows.length > 0) {
      const invoice = distInv.rows[0];
      if (!currentUser.isPlatformOwner && (currentUser.role !== ROLES.DISTRIBUTOR || currentUser.distributorId !== invoice.distributor_id)) {
        throw APIError.forbidden('You do not have authority to reject invoices for this distributor.');
      }

      await query(
        `UPDATE distributor_invoices
         SET approval_status = 'rejected',
             status = 'cancelled',
             updated_at = NOW()
         WHERE invoice_id = $1`,
        [invoiceId]
      );

      return {
        success: true,
        invoiceId,
        status: 'cancelled',
        approvalStatus: 'rejected',
        message: 'Draft invoice rejected.',
      };
    }

    throw APIError.notFound('Invoice not found.');
  }
}

export const invoicesService = new InvoicesService();
export default invoicesService;
