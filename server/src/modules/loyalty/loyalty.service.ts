import { query, withTransaction } from '../../database';
import { APIError } from '../../errors/apiError';
import { getPaginationParams, formatPaginationMetadata } from '../../utils/pagination';
import { ROLES } from '../../config/constants';
import { UserContext } from '../../middlewares/auth.middleware';

export class LoyaltyService {
  /**
   * Get points balance for a profile
   */
  async getBalance(profileType: string, profileId: string) {
    const res = await query(
      'SELECT profile_type, profile_id, COALESCE(balance, 0) AS balance FROM points_balances WHERE profile_type = $1 AND profile_id = $2',
      [profileType, profileId]
    );

    if (res.rows.length === 0) {
      return { profileType, profileId, balance: 0 };
    }
    return {
      profileType: res.rows[0].profile_type,
      profileId: res.rows[0].profile_id,
      balance: parseInt(res.rows[0].balance, 10),
    };
  }

  /**
   * Get points ledger history
   */
  async getLedger(queryParams: any, currentUser: UserContext) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params: any[] = [];

    let countSql = 'SELECT COUNT(*) FROM points_ledger l WHERE 1=1';
    let dataSql = `
      SELECT l.entry_id, l.profile_type, l.profile_id, l.points, l.reason,
             l.reference_type, l.reference_id, l.notes, l.created_at
      FROM points_ledger l
      WHERE 1=1
    `;

    // Scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
        params.push('dealer');
        params.push(currentUser.dealerId);
        const clause = ` AND l.profile_type = $${params.length - 1} AND l.profile_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.CUSTOMER) {
        params.push('customer');
        params.push(currentUser.id);
        const clause = ` AND l.profile_type = $${params.length - 1} AND l.profile_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.INFLUENCER) {
        params.push('influencer');
        params.push(currentUser.id);
        const clause = ` AND l.profile_type = $${params.length - 1} AND l.profile_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      }
    } else {
      if (queryParams.profileType && queryParams.profileId) {
        params.push(queryParams.profileType);
        params.push(queryParams.profileId);
        const clause = ` AND l.profile_type = $${params.length - 1} AND l.profile_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      }
    }

    dataSql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      entries: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Submit Points Redemption Request (Dealer, Customer, Influencer)
   */
  async requestRedemption({ pointsRedeemed, rewardDescription }: { pointsRedeemed: number; rewardDescription: string }, currentUser: UserContext) {
    let profileType: string;
    let profileId: string;

    if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
      profileType = 'dealer';
      profileId = currentUser.dealerId || currentUser.id;
    } else if (currentUser.role === ROLES.CUSTOMER) {
      profileType = 'customer';
      profileId = currentUser.id;
    } else if (currentUser.role === ROLES.INFLUENCER) {
      profileType = 'influencer';
      profileId = currentUser.id;
    } else {
      throw APIError.badRequest('Only dealers, customers, and influencers can redeem loyalty points.');
    }

    // Verify sufficient balance
    const currentBalance = await this.getBalance(profileType, profileId);
    if (currentBalance.balance < pointsRedeemed) {
      throw APIError.badRequest(
        `Insufficient points balance. Current balance: ${currentBalance.balance}, Requested: ${pointsRedeemed}`,
        null,
        'INSUFFICIENT_POINTS'
      );
    }

    const insertSql = `
      INSERT INTO points_redemptions (
        profile_type, profile_id, points_redeemed, reward_description, status
      ) VALUES ($1, $2, $3, $4, 'pending')
      RETURNING redemption_id, profile_type, profile_id, points_redeemed, reward_description, status, requested_at;
    `;

    const res = await query(insertSql, [profileType, profileId, pointsRedeemed, rewardDescription]);
    return res.rows[0];
  }

  /**
   * List Points Redemption Requests
   */
  async listRedemptions(queryParams: any, currentUser: UserContext) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params: any[] = [];

    let countSql = 'SELECT COUNT(*) FROM points_redemptions r WHERE 1=1';
    let dataSql = `
      SELECT r.redemption_id, r.profile_type, r.profile_id, r.points_redeemed,
             r.reward_description, r.status, r.rejection_reason, r.requested_at,
             r.resolved_at, r.resolved_by_type, r.resolved_by_id,
             CASE 
               WHEN r.profile_type = 'dealer' THEN (SELECT shop_name FROM dealers WHERE dealer_id = r.profile_id)
               WHEN r.profile_type = 'customer' THEN (SELECT name FROM customers WHERE customer_id = r.profile_id)
               WHEN r.profile_type = 'influencer' THEN (SELECT name FROM influencers WHERE influencer_id = r.profile_id)
             END as profile_name
      FROM points_redemptions r
      WHERE 1=1
    `;

    // Scoping: Platform owner sees all. Others only see their own requests.
    if (!currentUser.isPlatformOwner) {
      let pType = (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) ? 'dealer' : currentUser.role;
      params.push(pType);
      params.push(currentUser.entityId || currentUser.id);
      const clause = ` AND r.profile_type = $${params.length - 1} AND r.profile_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND r.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.profileType) {
      params.push(queryParams.profileType);
      const clause = ` AND r.profile_type = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY r.requested_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      redemptions: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Resolve Points Redemption Request (Platform Owner Only)
   */
  async resolveRedemption(redemptionId: string, { action, rejectionReason }: { action: 'approve' | 'reject'; rejectionReason?: string }, currentUser: UserContext) {
    if (!currentUser.isPlatformOwner) {
      throw APIError.forbidden('Only the Platform Owner can approve or reject points redemption requests.', 'PLATFORM_OWNER_REQUIRED');
    }

    const isApprove = action === 'approve';
    const newStatus = isApprove ? 'approved' : 'rejected';

    return await withTransaction(async (client) => {
      // Lock redemption record
      const rRes = await client.query(
        'SELECT * FROM points_redemptions WHERE redemption_id = $1 FOR UPDATE',
        [redemptionId]
      );

      if (rRes.rows.length === 0) {
        throw APIError.notFound('Points redemption request not found.');
      }

      const redemption = rRes.rows[0];

      if (redemption.status !== 'pending') {
        throw APIError.conflict(
          `Redemption request has already been resolved (${redemption.status}).`,
          'REQUEST_ALREADY_RESOLVED'
        );
      }

      if (isApprove) {
        // Re-verify points balance inside transaction
        const balRes = await client.query(
          'SELECT COALESCE(SUM(points), 0) AS balance FROM points_ledger WHERE profile_type = $1 AND profile_id = $2',
          [redemption.profile_type, redemption.profile_id]
        );
        const balance = parseInt(balRes.rows[0].balance, 10);

        if (balance < redemption.points_redeemed) {
          throw APIError.conflict(
            `Cannot approve. Profile's current balance (${balance}) is less than requested redemption (${redemption.points_redeemed}).`,
            'INSUFFICIENT_BALANCE_AT_APPROVAL'
          );
        }

        // Insert debit in points_ledger
        await client.query(
          `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes)
           VALUES ($1, $2, $3, 'redemption_debit', 'points_redemption', $4, $5)`,
          [
            redemption.profile_type,
            redemption.profile_id,
            -redemption.points_redeemed,
            redemptionId,
            `Redeemed: ${redemption.reward_description}`,
          ]
        );
      }

      // Update redemption record
      const updatedRes = await client.query(
        `UPDATE points_redemptions
         SET status = $1,
             rejection_reason = $2,
             resolved_at = NOW(),
             resolved_by_type = 'distributor',
             resolved_by_id = $3
         WHERE redemption_id = $4
         RETURNING redemption_id, profile_type, profile_id, points_redeemed, reward_description, status, rejection_reason, resolved_at;`,
        [newStatus, !isApprove ? rejectionReason || 'Rejected by Platform Owner' : null, currentUser.id, redemptionId]
      );

      return updatedRes.rows[0];
    });
  }
}

export const loyaltyService = new LoyaltyService();
export default loyaltyService;
