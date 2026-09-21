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
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT shop_name FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN (SELECT name FROM customers WHERE customer_id = r.requester_id)
             END as requester_name,
             CASE 
               WHEN r.requester_type = 'dealer' THEN (SELECT owner_name FROM dealers WHERE dealer_id = r.requester_id)
               WHEN r.requester_type = 'customer' THEN (SELECT name FROM customers WHERE customer_id = r.requester_id)
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
               WHEN r.requester_type = 'customer' THEN 'Customer'
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
      } else if (currentUser.role === ROLES.DEALER) {
        params.push(currentUser.dealerId);
        const clause = ` AND r.parent_type = 'dealer' AND r.parent_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        throw APIError.forbidden('Only parent distributors or dealers can view registration requests.');
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
   * Resolve a registration request (approve or reject) with strict parent validation
   */
  async resolveRequest(requestId: string, { action, rejectionReason }: { action: 'approve' | 'reject'; rejectionReason?: string }, currentUser: UserContext) {
    const isApprove = action === 'approve';
    const newStatus = isApprove ? 'approved' : 'rejected';

    return await withTransaction(async (client) => {
      // Fetch request with lock
      const reqRes = await client.query(
        'SELECT * FROM registration_requests WHERE request_id = $1 FOR UPDATE',
        [requestId]
      );

      if (reqRes.rows.length === 0) {
        throw APIError.notFound('Registration request not found.');
      }

      const reqData = reqRes.rows[0];

      if (reqData.status !== 'pending') {
        throw APIError.conflict(`This request has already been ${reqData.status}.`, 'REQUEST_ALREADY_RESOLVED');
      }

      // STRICT PARENT CHECK: Can only be approved by the parent user under which registration was requested
      if (!currentUser.isPlatformOwner) {
        if (reqData.parent_type === 'distributor') {
          if (currentUser.role !== ROLES.DISTRIBUTOR || currentUser.distributorId !== reqData.parent_id) {
            throw APIError.forbidden(
              'Permission denied. You can only approve registration requests submitted directly to your distributorship.',
              'UNAUTHORIZED_PARENT'
            );
          }
        } else if (reqData.parent_type === 'dealer') {
          if (currentUser.role !== ROLES.DEALER || currentUser.dealerId !== reqData.parent_id) {
            throw APIError.forbidden(
              'Permission denied. You can only approve registration requests submitted directly to your dealership.',
              'UNAUTHORIZED_PARENT'
            );
          }
        } else {
          throw APIError.forbidden('Unauthorized parent type.');
        }
      }

      // Update registration_requests table
      await client.query(
        `UPDATE registration_requests
         SET status = $1, rejection_reason = $2, resolved_at = NOW()
         WHERE request_id = $3`,
        [newStatus, !isApprove ? rejectionReason || 'Rejected by parent' : null, requestId]
      );

      // Update target entity status
      if (reqData.requester_type === 'dealer') {
        const targetStatus = isApprove ? DEALER_STATUS.ACTIVE : DEALER_STATUS.REJECTED;
        await client.query('UPDATE dealers SET status = $1, updated_at = NOW() WHERE dealer_id = $2', [
          targetStatus,
          reqData.requester_id,
        ]);
      } else if (reqData.requester_type === 'customer') {
        const targetStatus = isApprove ? CUSTOMER_STATUS.ACTIVE : CUSTOMER_STATUS.REJECTED;
        await client.query('UPDATE customers SET status = $1, updated_at = NOW() WHERE customer_id = $2', [
          targetStatus,
          reqData.requester_id,
        ]);

        // If newly approved customer, award welcome bonus points
        if (isApprove) {
          await client.query(
            `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['customer', reqData.requester_id, 100, 'welcome_bonus', 'customer_registration', reqData.requester_id, 'Welcome bonus points upon registration approval']
          );
        }
      }

      return {
        requestId,
        requesterType: reqData.requester_type,
        requesterId: reqData.requester_id,
        status: newStatus,
        resolvedAt: new Date(),
      };
    });
  }
}

export const approvalsService = new ApprovalsService();
export default approvalsService;
