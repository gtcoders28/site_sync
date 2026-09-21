import { query, withTransaction } from '../../database';
import { APIError } from '../../errors/apiError';
import { getPaginationParams, formatPaginationMetadata } from '../../utils/pagination';
import { parseDateRange } from '../../utils/dateFilter';
import { INVOICE_STATUS, TERMINAL_INVOICE_STATUSES, ROLES } from '../../config/constants';
import { UserContext } from '../../middlewares/auth.middleware';

export class InvoicesService {
  // ==========================================================================
  // DISTRIBUTOR INVOICES (Distributor -> Dealer)
  // ==========================================================================

  /**
   * Create Distributor-to-Dealer Invoice with In-Transit Stock Reservation
   */
  async createDistributorInvoice(data: any, currentUser: UserContext) {
    const distributorId = currentUser.distributorId;
    if (!distributorId) {
      throw APIError.forbidden('Only distributors can issue B2B invoices to dealers.');
    }

    const { dealerId, invoiceNumber, invoiceDate = new Date().toISOString().split('T')[0], items } = data;

    // Verify dealer belongs to this distributor
    const dealerRes = await query('SELECT dealer_id, distributor_id, status FROM dealers WHERE dealer_id = $1', [dealerId]);
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

    const totalAmount = items.reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);

    return await withTransaction(async (client) => {
      // 1. INVENTORY RESERVATION: Lock and verify available stock for each product
      for (const item of items) {
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

        // Decrement quantity_available, increment quantity_in_transit
        await client.query(
          `UPDATE distributor_inventory
           SET quantity_available = quantity_available - $1,
               quantity_in_transit = quantity_in_transit + $1,
               updated_at = NOW()
           WHERE distributor_id = $2 AND product_id = $3`,
          [item.quantity, distributorId, item.productId]
        );
      }

      // 2. Create distributor invoice
      const invRes = await client.query(
        `INSERT INTO distributor_invoices (
          distributor_id, dealer_id, invoice_number, invoice_date, total_amount, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING invoice_id, distributor_id, dealer_id, invoice_number, invoice_date, total_amount, status, created_at;`,
        [distributorId, dealerId, invoiceNumber, invoiceDate, totalAmount, INVOICE_STATUS.PENDING]
      );
      const invoice = invRes.rows[0];

      // 3. Insert items and log in_transit_hold movement
      const itemInserts = items.map((item: any) => {
        const itemTotal = item.quantity * item.unitPrice;
        return client.query(
          `INSERT INTO distributor_invoice_items (
            invoice_id, product_id, quantity, unit_price, total_amount
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING item_id, product_id, quantity, unit_price, total_amount;`,
          [invoice.invoice_id, item.productId, item.quantity, item.unitPrice, itemTotal]
        );
      });
      const insertedItems = await Promise.all(itemInserts);
      invoice.items = insertedItems.map((r) => r.rows[0]);

      // 4. Log inventory movement for reservation
      for (const item of items) {
        await client.query(
          `INSERT INTO inventory_movements (
            owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['distributor', distributorId, item.productId, -item.quantity, 'in_transit_hold', 'distributor_invoice', invoice.invoice_id]
        );
      }

      return invoice;
    });
  }

  /**
   * Update Distributor Invoice Status (delivered or cancelled)
   */
  async updateDistributorInvoiceStatus(invoiceId: string, targetStatus: string, currentUser: UserContext) {
    return await withTransaction(async (client) => {
      // Lock invoice row
      const invRes = await client.query(
        'SELECT * FROM distributor_invoices WHERE invoice_id = $1 FOR UPDATE',
        [invoiceId]
      );

      if (invRes.rows.length === 0) {
        throw APIError.notFound('Distributor invoice not found.');
      }

      const invoice = invRes.rows[0];

      // Authorization
      if (!currentUser.isPlatformOwner && currentUser.distributorId !== invoice.distributor_id) {
        throw APIError.forbidden('Access denied to this distributor invoice.');
      }

      // Terminal-State Guard
      if ((TERMINAL_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) {
        throw APIError.conflict(
          `Distributor invoice ${invoice.invoice_number} is already in terminal state '${invoice.status}' and cannot be modified.`,
          'ILLEGAL_STATE_TRANSITION'
        );
      }

      // Fetch items
      const itemsRes = await client.query(
        'SELECT product_id, quantity FROM distributor_invoice_items WHERE invoice_id = $1',
        [invoiceId]
      );

      if (targetStatus === INVOICE_STATUS.DELIVERED) {
        // Clear quantity_in_transit on distributor, increment dealer quantity_available
        for (const item of itemsRes.rows) {
          // Decrement distributor's in-transit
          await client.query(
            `UPDATE distributor_inventory
             SET quantity_in_transit = GREATEST(0, quantity_in_transit - $1),
                 updated_at = NOW()
             WHERE distributor_id = $2 AND product_id = $3`,
            [item.quantity, invoice.distributor_id, item.product_id]
          );

          // Increment dealer's available inventory
          await client.query(
            `INSERT INTO dealer_inventory (dealer_id, product_id, quantity_available, quantity_in_transit, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (dealer_id, product_id)
             DO UPDATE SET quantity_available = dealer_inventory.quantity_available + EXCLUDED.quantity_available,
                           updated_at = NOW()`,
            [invoice.dealer_id, item.product_id, item.quantity]
          );

          // Log dealer_sale inventory movement
          await client.query(
            `INSERT INTO inventory_movements (
              owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['dealer', invoice.dealer_id, item.product_id, item.quantity, 'dealer_sale', 'distributor_invoice', invoiceId]
          );
        }
      } else if (targetStatus === INVOICE_STATUS.CANCELLED) {
        // Release quantity_in_transit back to quantity_available on distributor
        for (const item of itemsRes.rows) {
          await client.query(
            `UPDATE distributor_inventory
             SET quantity_in_transit = GREATEST(0, quantity_in_transit - $1),
                 quantity_available = quantity_available + $1,
                 updated_at = NOW()
             WHERE distributor_id = $2 AND product_id = $3`,
            [item.quantity, invoice.distributor_id, item.product_id]
          );

          // Log in_transit_cancelled movement
          await client.query(
            `INSERT INTO inventory_movements (
              owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['distributor', invoice.distributor_id, item.product_id, item.quantity, 'in_transit_cancelled', 'distributor_invoice', invoiceId]
          );
        }
      }

      // Update invoice record
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
             inv.invoice_date, inv.total_amount, inv.status, inv.delivered_at, inv.created_at,
             dist.company_name AS distributor_name, dlr.shop_name AS dealer_name
      FROM distributor_invoices inv
      JOIN distributors dist ON inv.distributor_id = dist.distributor_id
      JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        params.push(currentUser.distributorId);
        const clause = ` AND inv.distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER) {
        params.push(currentUser.dealerId);
        const clause = ` AND inv.dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
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

    // Dynamic date range
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
  // DEALER INVOICES (Dealer -> Customer, with optional Influencer)
  // ==========================================================================

  /**
   * Create and deliver Dealer-to-Customer Invoice (triggers stock deduction and loyalty points)
   */
  async createDealerInvoice(data: any, currentUser: UserContext) {
    const dealerId = currentUser.dealerId;
    if (!dealerId) {
      throw APIError.forbidden('Only dealers can issue customer invoices.');
    }

    const { customerId, influencerId = null, invoiceNumber, invoiceDate = new Date().toISOString().split('T')[0], items } = data;

    // Verify customer exists
    const custRes = await query(
      'SELECT customer_id, name, onboarding_dealer_id, referred_by_customer_id, status FROM customers WHERE customer_id = $1',
      [customerId]
    );
    if (custRes.rows.length === 0) {
      throw APIError.notFound('Customer not found');
    }
    const customer = custRes.rows[0];

    // Verify influencer if tagged
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

    const totalAmount = items.reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);

    return await withTransaction(async (client) => {
      // 1. Lock and verify dealer inventory stock
      for (const item of items) {
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

        // Deduct available stock
        await client.query(
          `UPDATE dealer_inventory
           SET quantity_available = quantity_available - $1,
               updated_at = NOW()
           WHERE dealer_id = $2 AND product_id = $3`,
          [item.quantity, dealerId, item.productId]
        );
      }

      // 2. Create dealer invoice (created directly as delivered)
      const invRes = await client.query(
        `INSERT INTO dealer_invoices (
          dealer_id, customer_id, influencer_id, invoice_number, invoice_date, total_amount, status, delivered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING invoice_id, dealer_id, customer_id, influencer_id, invoice_number, invoice_date, total_amount, status, delivered_at, created_at;`,
        [dealerId, customerId, influencerId || null, invoiceNumber, invoiceDate, totalAmount, INVOICE_STATUS.DELIVERED]
      );
      const invoice = invRes.rows[0];

      // 3. Insert invoice items and movements
      const itemInserts = items.map((item: any) => {
        const itemTotal = item.quantity * item.unitPrice;
        return client.query(
          `INSERT INTO dealer_invoice_items (
            invoice_id, product_id, quantity, unit_price, total_amount
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING item_id, product_id, quantity, unit_price, total_amount;`,
          [invoice.invoice_id, item.productId, item.quantity, item.unitPrice, itemTotal]
        );
      });
      const insertedItems = await Promise.all(itemInserts);
      invoice.items = insertedItems.map((r) => r.rows[0]);

      for (const item of items) {
        await client.query(
          `INSERT INTO inventory_movements (
            owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['dealer', dealerId, item.productId, -item.quantity, 'customer_sale', 'dealer_invoice', invoice.invoice_id]
        );
      }

      // 4. LOYALTY POINTS ENGINE
      // A. Points to customer (1 point per 10 currency units, minimum 1)
      const customerPoints = Math.max(1, Math.floor(totalAmount / 10));
      await client.query(
        `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['customer', customerId, customerPoints, 'order_purchase', 'dealer_invoice', invoice.invoice_id, `Points for invoice #${invoiceNumber}`]
      );

      // B. Referral points to referrer if customer was referred
      if (customer.referred_by_customer_id) {
        const referralBonus = Math.max(5, Math.floor(customerPoints * 0.1));
        await client.query(
          `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'customer',
            customer.referred_by_customer_id,
            referralBonus,
            'referral_bonus',
            'dealer_invoice',
            invoice.invoice_id,
            `Referral bonus from customer ${customer.name}'s order`,
          ]
        );
      }

      // C. Commission points to tagged influencer
      if (influencerId) {
        const influencerBonus = Math.max(10, Math.floor(customerPoints * 0.15));
        await client.query(
          `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'influencer',
            influencerId,
            influencerBonus,
            'influencer_commission',
            'dealer_invoice',
            invoice.invoice_id,
            `Commission points on order #${invoiceNumber}`,
          ]
        );
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
      SELECT inv.invoice_id, inv.dealer_id, inv.customer_id, inv.influencer_id,
             inv.invoice_number, inv.invoice_date, inv.total_amount, inv.status, inv.delivered_at, inv.created_at,
             dlr.shop_name AS dealer_name, cust.name AS customer_name, cust.mobile_number AS customer_mobile,
             inf.name AS influencer_name
      FROM dealer_invoices inv
      JOIN dealers dlr ON inv.dealer_id = dlr.dealer_id
      JOIN customers cust ON inv.customer_id = cust.customer_id
      LEFT JOIN influencers inf ON inv.influencer_id = inf.influencer_id
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        // Distributor can see invoices of dealers under this distributor
        params.push(currentUser.distributorId);
        const clause = ` AND dlr.distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER) {
        params.push(currentUser.dealerId);
        const clause = ` AND inv.dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
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

    // Dynamic date range
    params.push(fromDate);
    params.push(toDate);
    const dateClause = ` AND inv.invoice_date >= $${params.length - 1}::date AND inv.invoice_date <= $${params.length}::date`;
    countSql += dateClause;
    dataSql += dateClause;

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const searchClause = ` AND (inv.invoice_number ILIKE $${params.length} OR cust.name ILIKE $${params.length})`;
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
}

export const invoicesService = new InvoicesService();
export default invoicesService;
