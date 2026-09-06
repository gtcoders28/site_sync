const { query, withTransaction } = require('../../database');
const { APIError } = require('../../errors/apiError');
const { getPaginationParams, formatPaginationMetadata } = require('../../utils/pagination');
const { ROLES } = require('../../config/constants');

class InventoryService {
  /**
   * Get Distributor Inventory with Scoping
   */
  async getDistributorInventory(queryParams, currentUser) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params = [];

    let targetDistributorId = currentUser.distributorId;
    if (currentUser.isPlatformOwner && queryParams.distributorId) {
      targetDistributorId = queryParams.distributorId;
    }

    if (!targetDistributorId) {
      throw APIError.forbidden('Distributor context required to view distributor inventory.');
    }

    params.push(targetDistributorId);

    let countSql = 'SELECT COUNT(*) FROM distributor_inventory inv WHERE inv.distributor_id = $1';
    let dataSql = `
      SELECT inv.distributor_id, inv.product_id, inv.quantity_available, inv.quantity_in_transit, inv.updated_at,
             p.variant_name, p.unit, p.unit_price, b.brand_name, c.category_name
      FROM distributor_inventory inv
      JOIN products p ON inv.product_id = p.product_id
      JOIN brands b ON p.brand_id = b.brand_id
      JOIN product_categories c ON p.category_id = c.category_id
      WHERE inv.distributor_id = $1
    `;

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const clause = ` AND (p.variant_name ILIKE $${params.length} OR b.brand_name ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY p.variant_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      inventory: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Get Dealer Inventory with Scoping
   */
  async getDealerInventory(queryParams, currentUser) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params = [];

    let countSql = 'SELECT COUNT(*) FROM dealer_inventory inv JOIN dealers d ON inv.dealer_id = d.dealer_id WHERE 1=1';
    let dataSql = `
      SELECT inv.dealer_id, inv.product_id, inv.quantity_available, inv.quantity_in_transit, inv.updated_at,
             p.variant_name, p.unit, p.unit_price, b.brand_name, c.category_name, d.shop_name AS dealer_name
      FROM dealer_inventory inv
      JOIN dealers d ON inv.dealer_id = d.dealer_id
      JOIN products p ON inv.product_id = p.product_id
      JOIN brands b ON p.brand_id = b.brand_id
      JOIN product_categories c ON p.category_id = c.category_id
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        // Only dealers under this distributor
        params.push(currentUser.distributorId);
        const clause = ` AND d.distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER) {
        // Only own inventory
        params.push(currentUser.dealerId);
        const clause = ` AND inv.dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Access denied to dealer inventory.');
      }
    }

    if (queryParams.dealerId) {
      params.push(queryParams.dealerId);
      const clause = ` AND inv.dealer_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const clause = ` AND (p.variant_name ILIKE $${params.length} OR b.brand_name ILIKE $${params.length} OR d.shop_name ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY d.shop_name ASC, p.variant_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      inventory: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Get Inventory Movements Audit Trail
   */
  async getInventoryMovements(queryParams, currentUser) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params = [];

    let countSql = 'SELECT COUNT(*) FROM inventory_movements m WHERE 1=1';
    let dataSql = `
      SELECT m.movement_id, m.owner_type, m.owner_id, m.product_id, m.quantity_change,
             m.reason, m.reference_type, m.reference_id, m.created_at,
             p.variant_name, p.unit, b.brand_name
      FROM inventory_movements m
      JOIN products p ON m.product_id = p.product_id
      JOIN brands b ON p.brand_id = b.brand_id
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        params.push('distributor');
        params.push(currentUser.distributorId);
        const clause = ` AND (m.owner_type = $${params.length - 1} AND m.owner_id = $${params.length})`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER) {
        params.push('dealer');
        params.push(currentUser.dealerId);
        const clause = ` AND (m.owner_type = $${params.length - 1} AND m.owner_id = $${params.length})`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Access denied to inventory movements audit log.');
      }
    } else {
      if (queryParams.ownerType && queryParams.ownerId) {
        params.push(queryParams.ownerType);
        params.push(queryParams.ownerId);
        const clause = ` AND (m.owner_type = $${params.length - 1} AND m.owner_id = $${params.length})`;
        countSql += clause;
        dataSql += clause;
      }
    }

    if (queryParams.reason) {
      params.push(queryParams.reason);
      const clause = ` AND m.reason = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.productId) {
      params.push(queryParams.productId);
      const clause = ` AND m.product_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      movements: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Manual Inventory Adjustment
   */
  async manualAdjustment({ productId, quantityChange, notes }, currentUser) {
    const isDistributor = currentUser.role === ROLES.DISTRIBUTOR || currentUser.isPlatformOwner;
    const isDealer = currentUser.role === ROLES.DEALER;

    if (!isDistributor && !isDealer) {
      throw APIError.forbidden('Only distributors and dealers can perform manual stock adjustments.');
    }

    const ownerType = isDistributor ? 'distributor' : 'dealer';
    const ownerId = isDistributor ? currentUser.distributorId : currentUser.dealerId;
    const table = isDistributor ? 'distributor_inventory' : 'dealer_inventory';
    const idCol = isDistributor ? 'distributor_id' : 'dealer_id';

    return await withTransaction(async (client) => {
      // Fetch current stock
      const invRes = await client.query(
        `SELECT quantity_available FROM ${table} WHERE ${idCol} = $1 AND product_id = $2 FOR UPDATE`,
        [ownerId, productId]
      );

      const currentAvailable = invRes.rows.length > 0 ? parseFloat(invRes.rows[0].quantity_available) : 0;
      const newAvailable = currentAvailable + quantityChange;

      if (newAvailable < 0) {
        throw APIError.badRequest(
          `Adjustment of ${quantityChange} would result in negative available stock (${newAvailable}). Action aborted.`
        );
      }

      // Upsert
      await client.query(
        `INSERT INTO ${table} (${idCol}, product_id, quantity_available, quantity_in_transit, updated_at)
         VALUES ($1, $2, $3, 0, NOW())
         ON CONFLICT (${idCol}, product_id)
         DO UPDATE SET quantity_available = ${table}.quantity_available + $4, updated_at = NOW()`,
        [ownerId, productId, newAvailable, quantityChange]
      );

      // Log movement
      await client.query(
        `INSERT INTO inventory_movements (owner_type, owner_id, product_id, quantity_change, reason, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, 'manual_adjustment', 'manual_adjustment', $5)`,
        [ownerType, ownerId, productId, quantityChange, ownerId]
      );

      return {
        ownerType,
        ownerId,
        productId,
        quantityChange,
        previousAvailable: currentAvailable,
        newAvailable,
        notes,
      };
    });
  }
}

module.exports = new InventoryService();
