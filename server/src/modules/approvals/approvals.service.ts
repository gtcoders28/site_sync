import { query, withTransaction } from '../../database';
import { APIError } from '../../errors/apiError';
import { getPaginationParams, formatPaginationMetadata } from '../../utils/pagination';
import { ROLES, DEALER_STATUS, CUSTOMER_STATUS } from '../../config/constants';
import { UserContext } from '../../middlewares/auth.middleware';

export class ApprovalsService {
  /**
   * List registration requests awaiting approval by the calling parent
   */
  async listRequests(currentUser: UserContext, queryParams: any) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params: any[] = [];

    let countSql = 'SELECT COUNT(*) FROM registration_requests r WHERE 1=1';
    let dataSql = `
      SELECT r.request_id, r.requester_type, r.requester_id, r.parent_type, r.parent_id,
             r.status, r.rejection_reason, r.requested_at, r.resolved_at,
             r.resolved_by_staff_id, r.resolved_by_user_id, r.resolver_type,
             (SELECT full_name FROM staff WHERE staff_id = COALESCE(r.resolved_by_staff_id, (SELECT approved_by_staff_id FROM customers WHERE customer_id = r.requester_id))) as resolved_by_staff_name,
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT shop_name FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN (SELECT name FROM customers WHERE customer_id = r.requester_id)
             END as requester_name,
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT owner_name FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN NULL
             END as owner_name,
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT mobile_number FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN (SELECT mobile_number FROM customers WHERE customer_id = r.requester_id)
             END as requester_mobile,
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT city FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN (SELECT city FROM customers WHERE customer_id = r.requester_id)
             END as city,
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT state FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN (SELECT state FROM customers WHERE customer_id = r.requester_id)
             END as state,
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT dealer_type FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN NULL
             END as category_or_type
      FROM registration_requests r
      WHERE 1=1
    `;

    // Strict parent scoping
    if (!currentUser.isPlatformOwner) {
      if (currentUser.role === ROLES.DISTRIBUTOR) {
        params.push(currentUser.distributorId);
        const clause = ` AND r.parent_type = 'distributor' AND r.parent_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
        params.push(currentUser.dealerId);
        const clause = ` AND r.parent_type = 'dealer' AND r.parent_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else if (currentUser.role === ROLES.STAFF) {
        if (!currentUser.permissions?.canApproveRegistrations) {
          throw APIError.forbidden('Staff member does not have permission to review registration requests.');
        }
        if (currentUser.employerType === 'distributor') {
          params.push(currentUser.employerId);
          const clause = ` AND r.parent_type = 'distributor' AND r.parent_id = $${params.length}`;
          countSql += clause;
          dataSql += clause;
        } else {
          params.push(currentUser.employerId);
          const clause = ` AND r.parent_type = 'dealer' AND r.parent_id = $${params.length}`;
          countSql += clause;
          dataSql += clause;
        }
      } else {
        throw APIError.forbidden('Only parent distributors, dealers, or authorized staff can view registration requests.');
      }
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND r.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.requesterType) {
      params.push(queryParams.requesterType);
      const clause = ` AND r.requester_type = $${params.length}`;
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
      requests: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Resolve a registration request (approve or reject) with live stored procedure public.approve_registration_request
   */
  async resolveRequest(
    requestId: string,
    { action, rejectionReason }: { action: 'approve' | 'reject'; rejectionReason?: string },
    currentUser: UserContext
  ) {
    const isApprove = action === 'approve';

    // Fetch request with lock
    const reqRes = await query(
      'SELECT * FROM registration_requests WHERE request_id = $1',
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      throw APIError.notFound('Registration request not found.');
    }

    const reqData = reqRes.rows[0];

    if (reqData.status !== 'pending') {
      throw APIError.conflict(`This request has already been ${reqData.status}.`, 'REQUEST_ALREADY_RESOLVED');
    }

    let staffId: string | null = null;
    let userId: string | null = null;

    if (currentUser.role === ROLES.STAFF) {
      if (!currentUser.permissions?.canApproveRegistrations) {
        throw APIError.forbidden('Staff member is not authorized to approve registration requests.');
      }
      staffId = currentUser.id;

      // Ensure staff works for the parent organization
      if (reqData.parent_type === 'distributor' && currentUser.employerType === 'distributor' && currentUser.employerId === reqData.parent_id) {
        // authorized
      } else if (reqData.parent_type === 'dealer' && currentUser.employerType === 'dealer' && currentUser.employerId === reqData.parent_id) {
        // authorized
      } else {
        throw APIError.forbidden('Staff cannot approve registrations belonging to another organization.');
      }
    } else {
      userId = currentUser.id;

      // Strict parent check for owner
      if (!currentUser.isPlatformOwner) {
        if (reqData.parent_type === 'distributor') {
          if (currentUser.role !== ROLES.DISTRIBUTOR || currentUser.distributorId !== reqData.parent_id) {
            throw APIError.forbidden(
              'Permission denied. You can only approve registration requests submitted directly to your distributorship.',
              'UNAUTHORIZED_PARENT'
            );
          }
        } else if (reqData.parent_type === 'dealer') {
          const isParentDealer = (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) && currentUser.dealerId === reqData.parent_id;
          if (!isParentDealer) {
            throw APIError.forbidden(
              'Permission denied. You can only approve registration requests submitted directly to your dealership.',
              'UNAUTHORIZED_PARENT'
            );
          }
        } else {
          throw APIError.forbidden('Unauthorized parent type.');
        }
      }
    }

    if (isApprove) {
      // Call live stored procedure: public.approve_registration_request(p_request_id, p_staff_id, p_user_id)
      const procRes = await query(
        'SELECT public.approve_registration_request($1, $2, $3) as result',
        [requestId, staffId, userId]
      );

      // If customer was approved, credit welcome bonus points with idempotency key
      if (reqData.requester_type === 'customer') {
        await query(
          `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            'customer',
            reqData.requester_id,
            100,
            'welcome_bonus',
            'customer_registration',
            reqData.requester_id,
            'Welcome bonus points upon registration approval',
            `welcome_bonus_${reqData.requester_id}`,
          ]
        );
      }

      return procRes.rows[0].result;
    }

    // Rejection branch
    return await withTransaction(async (client) => {
      const resolverType = staffId ? 'staff' : 'owner';
      await client.query(
        `UPDATE registration_requests
         SET status = 'rejected',
             rejection_reason = $1,
             resolved_by_staff_id = $2,
             resolved_by_user_id = $3,
             resolver_type = $4,
             resolved_at = NOW()
         WHERE request_id = $5`,
        [rejectionReason || 'Rejected by reviewer', staffId, userId, resolverType, requestId]
      );

      if (reqData.requester_type === 'dealer') {
        await client.query('UPDATE dealers SET status = $1, updated_at = NOW() WHERE dealer_id = $2', [
          DEALER_STATUS.REJECTED,
          reqData.requester_id,
        ]);
      } else if (reqData.requester_type === 'customer') {
        await client.query('UPDATE customers SET status = $1, updated_at = NOW() WHERE customer_id = $2', [
          CUSTOMER_STATUS.REJECTED,
          reqData.requester_id,
        ]);
      }

      return {
        success: true,
        requestId,
        requesterType: reqData.requester_type,
        requesterId: reqData.requester_id,
        status: 'rejected',
        resolvedAt: new Date(),
      };
    });
  }
}

export const approvalsService = new ApprovalsService();
export default approvalsService;
