const { query, withTransaction } = require('../../database');
const { hashPassword, comparePassword } = require('../../utils/password.utils');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt.utils');
const { generateUniqueCode } = require('../../utils/codeGenerator');
const { APIError } = require('../../errors/apiError');
const { ROLES, DISTRIBUTOR_STATUS, DEALER_STATUS, CUSTOMER_STATUS, INFLUENCER_STATUS } = require('../../config/constants');

class AuthService {
  /**
   * Register a new Distributor (Platform Owner or Regional Distributor)
   */
  async signUpDistributor(data, creatorUser = null) {
    const {
      mobileNumber,
      password,
      companyName,
      ownerName,
      email,
      gstNumber,
      aadharNumber,
      address,
      city,
      state,
      pincode,
      isPlatformOwner = false,
      parentDistributorId = null,
    } = data;

    // Check if mobile already exists in any user table
    await this._assertMobileUnique(mobileNumber);

    // Platform Owner authorization check
    if (isPlatformOwner) {
      const existingOwnerRes = await query('SELECT distributor_id FROM distributors WHERE is_platform_owner = TRUE LIMIT 1');
      if (existingOwnerRes.rows.length > 0) {
        // If an owner exists, only that owner can create another platform owner
        if (!creatorUser || !creatorUser.isPlatformOwner) {
          throw APIError.forbidden('Only the existing Platform Owner can create another Platform Owner account.', 'PLATFORM_OWNER_REQUIRED');
        }
      }
    } else {
      // Regular distributor requires valid parent distributor
      if (!parentDistributorId) {
        throw APIError.badRequest('Non-platform owner distributors must specify a valid parent_distributor_id');
      }
      const parentCheck = await query('SELECT distributor_id FROM distributors WHERE distributor_id = $1', [parentDistributorId]);
      if (parentCheck.rows.length === 0) {
        throw APIError.badRequest('Parent distributor does not exist', null, 'INVALID_PARENT_DISTRIBUTOR');
      }
    }

    const hashedPassword = await hashPassword(password);
    const inviteCode = generateUniqueCode('DIST', 6);

    const insertQuery = `
      INSERT INTO distributors (
        mobile_number, is_platform_owner, parent_distributor_id, password_hash,
        company_name, owner_name, email, gst_number, invite_code, aadhar_number,
        address, city, state, pincode, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING distributor_id, mobile_number, is_platform_owner, parent_distributor_id, 
                company_name, owner_name, email, invite_code, status, created_at;
    `;

    const res = await query(insertQuery, [
      mobileNumber,
      isPlatformOwner,
      parentDistributorId,
      hashedPassword,
      companyName,
      ownerName,
      email || null,
      gstNumber || null,
      inviteCode,
      aadharNumber || null,
      address || null,
      city || null,
      state || null,
      pincode || null,
      DISTRIBUTOR_STATUS.ACTIVE,
    ]);

    const distributor = res.rows[0];
    const role = distributor.is_platform_owner ? ROLES.PLATFORM_OWNER_DISTRIBUTOR : ROLES.DISTRIBUTOR;

    const tokens = this._generateTokens({
      userId: distributor.distributor_id,
      role,
      isPlatformOwner: distributor.is_platform_owner,
      distributorId: distributor.distributor_id,
    });

    return {
      user: { ...distributor, role },
      tokens,
    };
  }

  /**
   * Register a new Dealer (self-registered or created by distributor)
   */
  async signUpDealer(data, creatorUser = null) {
    const {
      distributorId,
      parentDealerId,
      mobileNumber,
      password,
      shopName,
      ownerName,
      dealerType,
      aadharNumber,
      gstNumber,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      source = 'self_registered',
    } = data;

    await this._assertMobileUnique(mobileNumber);

    // Verify distributor exists
    const distRes = await query('SELECT distributor_id, status FROM distributors WHERE distributor_id = $1', [distributorId]);
    if (distRes.rows.length === 0) {
      throw APIError.badRequest('Assigned distributor does not exist');
    }

    // Determine status & source
    let status = DEALER_STATUS.PENDING;
    let actualSource = source;

    if (creatorUser && (creatorUser.role === ROLES.DISTRIBUTOR || creatorUser.isPlatformOwner)) {
      status = DEALER_STATUS.ACTIVE;
      actualSource = 'created_by_distributor';
    } else {
      status = DEALER_STATUS.PENDING;
      actualSource = 'self_registered';
    }

    const hashedPassword = await hashPassword(password);
    const inviteCode = generateUniqueCode('DLR', 6);

    return await withTransaction(async (client) => {
      const insertQuery = `
        INSERT INTO dealers (
          distributor_id, parent_dealer_id, mobile_number, password_hash,
          shop_name, owner_name, dealer_type, aadhar_number, invite_code,
          gst_number, address, city, state, pincode, latitude, longitude,
          source, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING dealer_id, distributor_id, parent_dealer_id, mobile_number, 
                  shop_name, owner_name, dealer_type, invite_code, source, status, created_at;
      `;

      const dealerRes = await client.query(insertQuery, [
        distributorId,
        parentDealerId || null,
        mobileNumber,
        hashedPassword,
        shopName,
        ownerName,
        dealerType,
        aadharNumber || null,
        inviteCode,
        gstNumber || null,
        address || null,
        city || null,
        state || null,
        pincode || null,
        latitude || null,
        longitude || null,
        actualSource,
        status,
      ]);

      const dealer = dealerRes.rows[0];

      // If self-registered, create a pending registration request for the parent distributor
      if (status === DEALER_STATUS.PENDING) {
        await client.query(
          `INSERT INTO registration_requests (
            requester_type, requester_id, parent_type, parent_id, status
          ) VALUES ($1, $2, $3, $4, $5)`,
          ['dealer', dealer.dealer_id, 'distributor', distributorId, 'pending']
        );
      }

      let tokens = null;
      if (status === DEALER_STATUS.ACTIVE) {
        tokens = this._generateTokens({
          userId: dealer.dealer_id,
          role: ROLES.DEALER,
          dealerId: dealer.dealer_id,
          distributorId: dealer.distributor_id,
        });
      }

      return {
        user: { ...dealer, role: ROLES.DEALER },
        tokens,
        requiresApproval: status === DEALER_STATUS.PENDING,
      };
    });
  }

  /**
   * Register a new Customer (self-registered or created by dealer/distributor)
   */
  async signUpCustomer(data, creatorUser = null) {
    const {
      mobileNumber,
      password,
      name,
      email,
      address,
      aadharNumber,
      city,
      state,
      pincode,
      referralCode,
      onboardingDealerId,
      createdByType = 'self',
    } = data;

    await this._assertMobileUnique(mobileNumber);

    // Resolve referring customer if referralCode was provided
    let referredByCustomerId = null;
    if (referralCode) {
      const refRes = await query('SELECT customer_id FROM customers WHERE referral_code = $1', [referralCode]);
      if (refRes.rows.length > 0) {
        referredByCustomerId = refRes.rows[0].customer_id;
      }
    }

    // Determine status & onboarding parent
    let status = CUSTOMER_STATUS.PENDING;
    let actualCreatedByType = createdByType;
    let createdById = null;
    let resolvedOnboardingDealerId = onboardingDealerId || null;

    if (creatorUser) {
      if (creatorUser.role === ROLES.DEALER) {
        status = CUSTOMER_STATUS.ACTIVE;
        actualCreatedByType = 'dealer';
        createdById = creatorUser.entityId;
        resolvedOnboardingDealerId = resolvedOnboardingDealerId || creatorUser.dealerId;
      } else if (creatorUser.role === ROLES.DISTRIBUTOR || creatorUser.isPlatformOwner) {
        status = CUSTOMER_STATUS.ACTIVE;
        actualCreatedByType = 'distributor';
        createdById = creatorUser.entityId;
      }
    } else {
      status = CUSTOMER_STATUS.PENDING;
      actualCreatedByType = 'self';
    }

    const hashedPassword = await hashPassword(password);
    const newReferralCode = generateUniqueCode('CUST', 6);

    return await withTransaction(async (client) => {
      const insertQuery = `
        INSERT INTO customers (
          mobile_number, password_hash, name, email, address, aadhar_number,
          city, state, pincode, referral_code, referred_by_customer_id,
          created_by_type, created_by_id, onboarding_dealer_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING customer_id, mobile_number, name, email, referral_code, 
                  referred_by_customer_id, onboarding_dealer_id, status, created_at;
      `;

      const custRes = await client.query(insertQuery, [
        mobileNumber,
        hashedPassword,
        name,
        email || null,
        address || null,
        aadharNumber || null,
        city || null,
        state || null,
        pincode || null,
        newReferralCode,
        referredByCustomerId,
        actualCreatedByType,
        createdById,
        resolvedOnboardingDealerId,
        status,
      ]);

      const customer = custRes.rows[0];

      // If self-registered and onboardingDealerId is present, create registration_requests record
      if (status === CUSTOMER_STATUS.PENDING && resolvedOnboardingDealerId) {
        await client.query(
          `INSERT INTO registration_requests (
            requester_type, requester_id, parent_type, parent_id, status
          ) VALUES ($1, $2, $3, $4, $5)`,
          ['customer', customer.customer_id, 'dealer', resolvedOnboardingDealerId, 'pending']
        );
      }

      let tokens = null;
      if (status === CUSTOMER_STATUS.ACTIVE) {
        tokens = this._generateTokens({
          userId: customer.customer_id,
          role: ROLES.CUSTOMER,
          customerId: customer.customer_id,
          dealerId: customer.onboarding_dealer_id,
        });

        // Credit welcome points bonus to newly active customer
        await client.query(
          `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['customer', customer.customer_id, 100, 'welcome_bonus', 'customer_registration', customer.customer_id, 'Welcome bonus points']
        );
      }

      return {
        user: { ...customer, role: ROLES.CUSTOMER },
        tokens,
        requiresApproval: status === CUSTOMER_STATUS.PENDING,
      };
    });
  }

  /**
   * Register a new Influencer
   */
  async signUpInfluencer(data, creatorUser = null) {
    const { dealerId, distributorId, mobileNumber, password, name, city, state, source = 'self_registered' } = data;

    await this._assertMobileUnique(mobileNumber);

    // Verify dealer exists
    const dealerRes = await query('SELECT dealer_id, distributor_id FROM dealers WHERE dealer_id = $1', [dealerId]);
    if (dealerRes.rows.length === 0) {
      throw APIError.badRequest('Referenced dealer does not exist');
    }

    const resolvedDistributorId = distributorId || dealerRes.rows[0].distributor_id;
    const hashedPassword = await hashPassword(password);
    const referralCode = generateUniqueCode('INF', 6);

    const insertQuery = `
      INSERT INTO influencers (
        distributor_id, dealer_id, mobile_number, password_hash, name,
        referral_code, city, state, source, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING influencer_id, distributor_id, dealer_id, mobile_number, 
                name, referral_code, city, state, source, status, created_at;
    `;

    const res = await query(insertQuery, [
      resolvedDistributorId,
      dealerId,
      mobileNumber,
      hashedPassword,
      name,
      referralCode,
      city || null,
      state || null,
      source,
      INFLUENCER_STATUS.ACTIVE,
    ]);

    const influencer = res.rows[0];
    const tokens = this._generateTokens({
      userId: influencer.influencer_id,
      role: ROLES.INFLUENCER,
      influencerId: influencer.influencer_id,
      dealerId: influencer.dealer_id,
      distributorId: influencer.distributor_id,
    });

    return {
      user: { ...influencer, role: ROLES.INFLUENCER },
      tokens,
    };
  }

  /**
   * Universal Sign In for all profiles
   */
  async signIn({ mobileNumber, password, role }) {
    let userRow = null;
    let userRole = null;
    let isPlatformOwner = false;

    // Search across relevant role tables
    const searches = [];
    if (!role || role === ROLES.PLATFORM_OWNER_DISTRIBUTOR || role === ROLES.DISTRIBUTOR) {
      searches.push(
        query(
          `SELECT distributor_id AS id, mobile_number, password_hash, company_name, owner_name, 
                  is_platform_owner, parent_distributor_id, invite_code, status, 'distributor' as detected_role 
           FROM distributors WHERE mobile_number = $1`,
          [mobileNumber]
        )
      );
    }
    if (!role || role === ROLES.DEALER) {
      searches.push(
        query(
          `SELECT dealer_id AS id, distributor_id, parent_dealer_id, mobile_number, password_hash, 
                  shop_name, owner_name, dealer_type, invite_code, status, 'dealer' as detected_role 
           FROM dealers WHERE mobile_number = $1`,
          [mobileNumber]
        )
      );
    }
    if (!role || role === ROLES.CUSTOMER) {
      searches.push(
        query(
          `SELECT customer_id AS id, mobile_number, password_hash, name, email, referral_code, 
                  referred_by_customer_id, onboarding_dealer_id, status, 'customer' as detected_role 
           FROM customers WHERE mobile_number = $1`,
          [mobileNumber]
        )
      );
    }
    if (!role || role === ROLES.INFLUENCER) {
      searches.push(
        query(
          `SELECT influencer_id AS id, distributor_id, dealer_id, mobile_number, password_hash, 
                  name, referral_code, status, 'influencer' as detected_role 
           FROM influencers WHERE mobile_number = $1`,
          [mobileNumber]
        )
      );
    }

    const results = await Promise.all(searches);
    for (const r of results) {
      if (r.rows.length > 0) {
        userRow = r.rows[0];
        userRole = userRow.detected_role;
        if (userRole === 'distributor' && userRow.is_platform_owner) {
          userRole = ROLES.PLATFORM_OWNER_DISTRIBUTOR;
          isPlatformOwner = true;
        }
        break;
      }
    }

    if (!userRow) {
      throw APIError.unauthorized('Invalid mobile number or password');
    }

    // Verify password
    const isMatch = await comparePassword(password, userRow.password_hash);
    if (!isMatch) {
      throw APIError.unauthorized('Invalid mobile number or password');
    }

    // Account status check
    if (userRow.status === 'pending') {
      throw APIError.forbidden('Your registration is pending approval by your supervisor/parent dealer.', 'ACCOUNT_PENDING_APPROVAL');
    }
    if (userRow.status !== 'active') {
      throw APIError.forbidden(`Your account is ${userRow.status}. Please contact support.`, 'ACCOUNT_INACTIVE');
    }

    // Strip password hash from returned object
    delete userRow.password_hash;
    delete userRow.detected_role;

    const tokens = this._generateTokens({
      userId: userRow.id,
      role: userRole,
      isPlatformOwner,
      distributorId: userRow.distributor_id || (userRole === ROLES.DISTRIBUTOR || isPlatformOwner ? userRow.id : null),
      dealerId: userRow.dealer_id || (userRole === ROLES.DEALER ? userRow.id : null),
    });

    return {
      user: { ...userRow, role: userRole, isPlatformOwner },
      tokens,
    };
  }

  /**
   * Refresh token rotation
   */
  async refreshToken(token) {
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw APIError.unauthorized('Invalid or expired refresh token. Please sign in again.');
    }

    const { userId, role } = decoded;

    // Check that user still exists and is active
    let userRow = null;
    if (role === ROLES.PLATFORM_OWNER_DISTRIBUTOR || role === ROLES.DISTRIBUTOR) {
      const res = await query('SELECT distributor_id AS id, is_platform_owner, status FROM distributors WHERE distributor_id = $1', [userId]);
      userRow = res.rows[0];
    } else if (role === ROLES.DEALER) {
      const res = await query('SELECT dealer_id AS id, distributor_id, status FROM dealers WHERE dealer_id = $1', [userId]);
      userRow = res.rows[0];
    } else if (role === ROLES.CUSTOMER) {
      const res = await query('SELECT customer_id AS id, status FROM customers WHERE customer_id = $1', [userId]);
      userRow = res.rows[0];
    } else if (role === ROLES.INFLUENCER) {
      const res = await query('SELECT influencer_id AS id, status FROM influencers WHERE influencer_id = $1', [userId]);
      userRow = res.rows[0];
    }

    if (!userRow || userRow.status !== 'active') {
      throw APIError.unauthorized('Account no longer valid or active');
    }

    const newTokens = this._generateTokens({
      userId: userRow.id,
      role,
      isPlatformOwner: userRow.is_platform_owner || false,
      distributorId: userRow.distributor_id || null,
    });

    return newTokens;
  }

  _generateTokens(payload) {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ userId: payload.userId, role: payload.role });
    return { accessToken, refreshToken };
  }

  async _assertMobileUnique(mobileNumber) {
    const [distRes, dlrRes, custRes, infRes] = await Promise.all([
      query('SELECT distributor_id FROM distributors WHERE mobile_number = $1', [mobileNumber]),
      query('SELECT dealer_id FROM dealers WHERE mobile_number = $1', [mobileNumber]),
      query('SELECT customer_id FROM customers WHERE mobile_number = $1', [mobileNumber]),
      query('SELECT influencer_id FROM influencers WHERE mobile_number = $1', [mobileNumber]),
    ]);

    if (distRes.rows.length || dlrRes.rows.length || custRes.rows.length || infRes.rows.length) {
      throw APIError.conflict(`Mobile number ${mobileNumber} is already registered in the system`, 'MOBILE_ALREADY_EXISTS');
    }
  }
}

module.exports = new AuthService();
