const { query } = require('../../database');
const { APIError } = require('../../errors/apiError');
const { getPaginationParams, formatPaginationMetadata } = require('../../utils/pagination');
const { ROLES } = require('../../config/constants');

class UsersService {
  /**
   * List Distributors (Platform Owner only)
   */
  async listDistributors(queryParams, currentUser) {
    if (!currentUser.isPlatformOwner) {
      throw APIError.forbidden('Only the Platform Owner can list distributors.');
    }

    const { page, limit, offset } = getPaginationParams(queryParams);
    const search = queryParams.search ? `%${queryParams.search}%` : null;

    let countSql = 'SELECT COUNT(*) FROM distributors WHERE 1=1';
    let dataSql = `
      SELECT distributor_id, mobile_number, is_platform_owner, parent_distributor_id,
             company_name, owner_name, email, gst_number, invite_code, status, created_at
      FROM distributors
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(search);
      const clause = ` AND (company_name ILIKE $${params.length} OR owner_name ILIKE $${params.length} OR mobile_number ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      distributors: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * List Dealers with strict scoping
   */
  async listDealers(queryParams, currentUser) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const search = queryParams.search ? `%${queryParams.search}%` : null;
    const params = [];

    let countSql = 'SELECT COUNT(*) FROM dealers d WHERE 1=1';
    let dataSql = `
      SELECT d.dealer_id, d.distributor_id, d.parent_dealer_id, d.mobile_number,
             d.shop_name, d.owner_name, d.dealer_type, d.invite_code, d.gst_number,
             d.city, d.state, d.pincode, d.latitude, d.longitude, d.source, d.status, d.created_at,
             dist.company_name AS distributor_name
      FROM dealers d
      JOIN distributors dist ON d.distributor_id = dist.distributor_id
      WHERE 1=1
    `;

    // Scoping rules
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        // Distributor can ONLY see dealers under him
        params.push(currentUser.distributorId);
        const clause = ` AND d.distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER) {
        // Dealer can only see themselves
        params.push(currentUser.dealerId);
        const clause = ` AND d.dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Access denied to dealer records');
      }
    } else if (queryParams.distributorId) {
      // Platform owner can filter by specific distributor
      params.push(queryParams.distributorId);
      const clause = ` AND d.distributor_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND d.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (search) {
      params.push(search);
      const clause = ` AND (d.shop_name ILIKE $${params.length} OR d.owner_name ILIKE $${params.length} OR d.mobile_number ILIKE $${params.length} OR d.city ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      dealers: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * List Customers with strict scoping
   */
  async listCustomers(queryParams, currentUser) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const search = queryParams.search ? `%${queryParams.search}%` : null;
    const params = [];

    let countSql = 'SELECT COUNT(*) FROM customers c WHERE 1=1';
    let dataSql = `
      SELECT c.customer_id, c.mobile_number, c.name, c.email, c.city, c.state, c.pincode,
             c.referral_code, c.referred_by_customer_id, c.onboarding_dealer_id, c.status, c.created_at,
             d.shop_name AS dealer_name
      FROM customers c
      LEFT JOIN dealers d ON c.onboarding_dealer_id = d.dealer_id
      WHERE 1=1
    `;

    // Scoping rules
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        // Customers belonging to dealers under this distributor
        params.push(currentUser.distributorId);
        const clause = ` AND (d.distributor_id = $${params.length} OR (c.created_by_type = 'distributor' AND c.created_by_id = $${params.length}))`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER) {
        // Dealer only sees their customers
        params.push(currentUser.dealerId);
        const clause = ` AND c.onboarding_dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.CUSTOMER) {
        // Customer only sees themselves
        params.push(currentUser.id);
        const clause = ` AND c.customer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Access denied to customer records');
      }
    }

    if (queryParams.dealerId) {
      params.push(queryParams.dealerId);
      const clause = ` AND c.onboarding_dealer_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND c.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (search) {
      params.push(search);
      const clause = ` AND (c.name ILIKE $${params.length} OR c.mobile_number ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      customers: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * List Influencers
   */
  async listInfluencers(queryParams, currentUser) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const search = queryParams.search ? `%${queryParams.search}%` : null;
    const params = [];

    let countSql = 'SELECT COUNT(*) FROM influencers inf WHERE 1=1';
    let dataSql = `
      SELECT inf.influencer_id, inf.distributor_id, inf.dealer_id, inf.mobile_number,
             inf.name, inf.referral_code, inf.city, inf.state, inf.source, inf.status, inf.created_at,
             d.shop_name AS dealer_name
      FROM influencers inf
      JOIN dealers d ON inf.dealer_id = d.dealer_id
      WHERE 1=1
    `;

    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        params.push(currentUser.distributorId);
        const clause = ` AND (inf.distributor_id = $${params.length} OR d.distributor_id = $${params.length})`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER) {
        params.push(currentUser.dealerId);
        const clause = ` AND inf.dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.INFLUENCER) {
        params.push(currentUser.id);
        const clause = ` AND inf.influencer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Access denied to influencer records');
      }
    }

    if (search) {
      params.push(search);
      const clause = ` AND (inf.name ILIKE $${params.length} OR inf.mobile_number ILIKE $${params.length} OR inf.referral_code ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY inf.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      influencers: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Change Mobile Number with Aadhar Identity Verification
   */
  async changeMobileNumber(currentUser, { aadharNumber, newMobileNumber }) {
    let tableName;
    let idCol;

    if (currentUser.role === ROLES.PLATFORM_OWNER_DISTRIBUTOR || currentUser.role === ROLES.DISTRIBUTOR) {
      tableName = 'distributors';
      idCol = 'distributor_id';
    } else if (currentUser.role === ROLES.DEALER) {
      tableName = 'dealers';
      idCol = 'dealer_id';
    } else if (currentUser.role === ROLES.CUSTOMER) {
      tableName = 'customers';
      idCol = 'customer_id';
    } else {
      throw APIError.badRequest('Mobile number change not supported for this role.');
    }

    // Verify Aadhar matches
    const userRes = await query(`SELECT aadhar_number FROM ${tableName} WHERE ${idCol} = $1`, [currentUser.id]);
    if (userRes.rows.length === 0 || !userRes.rows[0].aadhar_number) {
      throw APIError.badRequest('No Aadhar number is registered on your profile. Please contact support.');
    }

    if (userRes.rows[0].aadhar_number !== aadharNumber) {
      throw APIError.forbidden('Aadhar verification failed. Number does not match your registered identity.', 'AADHAR_VERIFICATION_FAILED');
    }

    // Check if new mobile is already taken
    const [dRes, dlRes, cRes, iRes] = await Promise.all([
      query('SELECT distributor_id FROM distributors WHERE mobile_number = $1', [newMobileNumber]),
      query('SELECT dealer_id FROM dealers WHERE mobile_number = $1', [newMobileNumber]),
      query('SELECT customer_id FROM customers WHERE mobile_number = $1', [newMobileNumber]),
      query('SELECT influencer_id FROM influencers WHERE mobile_number = $1', [newMobileNumber]),
    ]);

    if (dRes.rows.length || dlRes.rows.length || cRes.rows.length || iRes.rows.length) {
      throw APIError.conflict(`Mobile number ${newMobileNumber} is already in use by another user.`);
    }

    // Update mobile
    await query(`UPDATE ${tableName} SET mobile_number = $1, updated_at = NOW() WHERE ${idCol} = $2`, [newMobileNumber, currentUser.id]);

    return {
      message: 'Mobile number updated successfully after identity verification',
      newMobileNumber,
    };
  }
}

module.exports = new UsersService();
