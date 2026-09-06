const { query, withTransaction } = require('../../database');
const { APIError } = require('../../errors/apiError');
const { getPaginationParams, formatPaginationMetadata } = require('../../utils/pagination');
const { PURCHASE_STATUS, ROLES } = require('../../config/constants');

class PurchasesService {
  /**
   * Create an inbound purchase order from external supplier
   */
  async createPurchase(data, currentUser) {
    const distributorId = currentUser.distributorId;
    if (!distributorId) {
      throw APIError.forbidden('Only distributors can record supplier purchases.');
    }

    const { supplierName, invoiceNumber, purchaseDate = new Date().toISOString().split('T')[0], items } = data;

    // Check duplicate invoice number for this distributor
    const dupCheck = await query(
      'SELECT purchase_id FROM distributor_purchases WHERE distributor_id = $1 AND invoice_number = $2',
      [distributorId, invoiceNumber]
    );
    if (dupCheck.rows.length > 0) {
      throw APIError.conflict(`Invoice number '${invoiceNumber}' has already been recorded for this distributor.`);
    }

    // Verify all products exist
    const productIds = items.map((i) => i.productId);
    const prodRes = await query(
      'SELECT product_id FROM products WHERE product_id = ANY($1::uuid[]) AND status = $2',
      [productIds, 'active']
    );
    if (prodRes.rows.length !== productIds.length) {
      throw APIError.badRequest('One or more products are invalid or inactive.');
    }

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return await withTransaction(async (client) => {
      const purchaseRes = await client.query(
        `INSERT INTO distributor_purchases (
          distributor_id, supplier_name, invoice_number, purchase_date, total_amount, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING purchase_id, distributor_id, supplier_name, invoice_number, purchase_date, total_amount, status, created_at;`,
        [distributorId, supplierName, invoiceNumber, purchaseDate, totalAmount, PURCHASE_STATUS.PENDING]
      );

      const purchase = purchaseRes.rows[0];

      // Insert purchase items
      const itemInserts = items.map((item) => {
        const itemTotal = item.quantity * item.unitPrice;
        return client.query(
          `INSERT INTO distributor_purchase_items (
            purchase_id, product_id, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING purchase_item_id, product_id, quantity, unit_price, total_price;`,
          [purchase.purchase_id, item.productId, item.quantity, item.unitPrice, itemTotal]
        );
      });

      const insertedItems = await Promise.all(itemInserts);
      purchase.items = insertedItems.map((r) => r.rows[0]);

      return purchase;
    });
  }

  /**
   * Update Purchase Status (e.g. mark 'received' or 'cancelled')
   */
  async updatePurchaseStatus(purchaseId, status, currentUser) {
    return await withTransaction(async (client) => {
      // Fetch purchase with lock
      const pRes = await client.query(
        'SELECT * FROM distributor_purchases WHERE purchase_id = $1 FOR UPDATE',
        [purchaseId]
      );

      if (pRes.rows.length === 0) {
        throw APIError.notFound('Purchase order not found.');
      }

      const purchase = pRes.rows[0];

      // Authorization check
      if (!currentUser.isPlatformOwner && currentUser.distributorId !== purchase.distributor_id) {
        throw APIError.forbidden('You do not have access to this purchase record.');
      }

      // Terminal-State Guard
      if (purchase.status === PURCHASE_STATUS.RECEIVED || purchase.status === PURCHASE_STATUS.CANCELLED) {
        throw APIError.conflict(
          `Purchase order ${purchase.invoice_number} is already in terminal state '${purchase.status}' and cannot be modified.`,
          'ILLEGAL_STATE_TRANSITION'
        );
      }

      if (status === PURCHASE_STATUS.RECEIVED) {
        // Fetch purchase items
        const itemsRes = await client.query(
          'SELECT product_id, quantity FROM distributor_purchase_items WHERE purchase_id = $1',
          [purchaseId]
        );

        for (const item of itemsRes.rows) {
          // Upsert distributor inventory
          await client.query(
            `INSERT INTO distributor_inventory (distributor_id, product_id, quantity_available, quantity_in_transit, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (distributor_id, product_id)
             DO UPDATE SET quantity_available = distributor_inventory.quantity_available + EXCLUDED.quantity_available,
                           updated_at = NOW()`,
            [purchase.distributor_id, item.product_id, item.quantity]
          );

          // Log inventory movement
          await client.query(
            `INSERT INTO inventory_movements (owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              'distributor',
              purchase.distributor_id,
              item.product_id,
              item.quantity,
              'distributor_purchase',
              'distributor_purchase',
              purchaseId,
            ]
          );
        }
      }

      // Update purchase status
      const updatedRes = await client.query(
        `UPDATE distributor_purchases
         SET status = $1, received_at = (CASE WHEN $1::varchar = 'received' THEN NOW() ELSE NULL END), updated_at = NOW()
         WHERE purchase_id = $2
         RETURNING purchase_id, distributor_id, supplier_name, invoice_number, total_amount, status, received_at, updated_at;`,
        [status, purchaseId]
      );

      return updatedRes.rows[0];
    });
  }

  /**
   * List Purchases with Scoping
   */
  async listPurchases(queryParams, currentUser) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params = [];

    let countSql = 'SELECT COUNT(*) FROM distributor_purchases p WHERE 1=1';
    let dataSql = `
      SELECT p.purchase_id, p.distributor_id, p.supplier_name, p.invoice_number,
             p.purchase_date, p.total_amount, p.status, p.received_at, p.created_at,
             d.company_name AS distributor_name
      FROM distributor_purchases p
      JOIN distributors d ON p.distributor_id = d.distributor_id
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        params.push(currentUser.distributorId);
        const clause = ` AND p.distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Access denied to distributor purchases.');
      }
    } else if (queryParams.distributorId) {
      params.push(queryParams.distributorId);
      const clause = ` AND p.distributor_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND p.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const clause = ` AND (p.invoice_number ILIKE $${params.length} OR p.supplier_name ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY p.purchase_date DESC, p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      purchases: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Get single Purchase Order with Items
   */
  async getPurchaseById(purchaseId, currentUser) {
    const pRes = await query(
      `SELECT p.purchase_id, p.distributor_id, p.supplier_name, p.invoice_number,
              p.purchase_date, p.total_amount, p.status, p.received_at, p.created_at,
              d.company_name AS distributor_name
       FROM distributor_purchases p
       JOIN distributors d ON p.distributor_id = d.distributor_id
       WHERE p.purchase_id = $1`,
      [purchaseId]
    );

    if (pRes.rows.length === 0) {
      throw APIError.notFound('Purchase not found');
    }

    const purchase = pRes.rows[0];

    if (!currentUser.isPlatformOwner && currentUser.distributorId !== purchase.distributor_id) {
      throw APIError.forbidden('Access denied to this purchase order.');
    }

    const itemsRes = await query(
      `SELECT i.purchase_item_id, i.product_id, i.quantity, i.unit_price, i.total_price,
              p.variant_name, p.unit, b.brand_name, c.category_name
       FROM distributor_purchase_items i
       JOIN products p ON i.product_id = p.product_id
       JOIN brands b ON p.brand_id = b.brand_id
       JOIN product_categories c ON p.category_id = c.category_id
       WHERE i.purchase_id = $1`,
      [purchaseId]
    );

    purchase.items = itemsRes.rows;
    return purchase;
  }
}

module.exports = new PurchasesService();
