import { query } from '../../database';
import { APIError } from '../../errors/apiError';
import { hashPassword } from '../../utils/password.utils';
import { authService } from '../auth/auth.service';
import { getPaginationParams, formatPaginationMetadata } from '../../utils/pagination';
import { ROLES, STAFF_STATUS } from '../../config/constants';
import { UserContext } from '../../middlewares/auth.middleware';

export class StaffService {
  /**
   * Onboard a new staff member under the authenticated organization
   */
  async createStaff(data: any, currentUser: UserContext) {
    const {
      fullName,
      mobileNumber,
      password,
      email = null,
      role = 'staff',
      canCreateInvoices = true,
      canApproveRegistrations = false,
    } = data;

    let employerType: 'distributor' | 'dealer';
    let distributorId: string | null = null;
    let dealerId: string | null = null;

    if (currentUser.isPlatformOwner || currentUser.role === ROLES.DISTRIBUTOR) {
      employerType = 'distributor';
      distributorId = currentUser.distributorId || currentUser.id;
    } else if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
      employerType = 'dealer';
      dealerId = currentUser.dealerId || currentUser.id;
    } else {
      throw APIError.forbidden('Only distributors and dealers can onboard operational staff.');
    }

    // Verify unique mobile across all users and staff
    await authService._assertMobileUnique(mobileNumber);

    const hashedPassword = await hashPassword(password);

    const insertSql = `
      INSERT INTO staff (
        employer_type, distributor_id, dealer_id, full_name, mobile_number, email,
        password_hash, role, can_create_invoices, can_approve_registrations, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING staff_id, employer_type, distributor_id, dealer_id, full_name, mobile_number, email,
                role, can_create_invoices, can_approve_registrations, status, created_at, updated_at;
    `;

    const res = await query(insertSql, [
      employerType,
      distributorId,
      dealerId,
      fullName,
      mobileNumber,
      email || null,
      hashedPassword,
      role,
      canCreateInvoices,
      canApproveRegistrations,
      STAFF_STATUS.ACTIVE,
    ]);

    return res.rows[0];
  }

  /**
   * List staff belonging to the caller's organization
   */
  async listStaff(currentUser: UserContext, queryParams: any) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params: any[] = [];

    let countSql = 'SELECT COUNT(*) FROM staff WHERE 1=1';
    let dataSql = `
      SELECT staff_id, employer_type, distributor_id, dealer_id, full_name, mobile_number, email,
             role, can_create_invoices, can_approve_registrations, current_latitude, current_longitude,
             last_location_at, status, created_at, updated_at
      FROM staff
      WHERE 1=1
    `;

    if (currentUser.isPlatformOwner) {
      if (queryParams.distributorId) {
        params.push(queryParams.distributorId);
        const clause = ` AND distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      }
    } else if (currentUser.role === ROLES.DISTRIBUTOR) {
      params.push(currentUser.distributorId);
      const clause = ` AND employer_type = 'distributor' AND distributor_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    } else if (currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER) {
      params.push(currentUser.dealerId);
      const clause = ` AND employer_type = 'dealer' AND dealer_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    } else if (currentUser.role === ROLES.STAFF) {
      // Staff viewing colleagues under same employer
      if (currentUser.employerType === 'distributor') {
        params.push(currentUser.employerId);
        const clause = ` AND employer_type = 'distributor' AND distributor_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      } else {
        params.push(currentUser.employerId);
        const clause = ` AND employer_type = 'dealer' AND dealer_id = $${params.length}`;
        countSql += clause;
        dataSql += clause;
      }
    } else {
      throw APIError.forbidden('Access denied to staff records.');
    }

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const clause = ` AND (full_name ILIKE $${params.length} OR mobile_number ILIKE $${params.length} OR email ILIKE $${params.length})`;
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
      staff: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Update staff active/inactive/suspended status
   */
  async updateStaffStatus(staffId: string, status: string, currentUser: UserContext) {
    await this._assertStaffOwnership(staffId, currentUser);

    const res = await query(
      `UPDATE staff
       SET status = $1, updated_at = NOW()
       WHERE staff_id = $2
       RETURNING staff_id, full_name, mobile_number, status, updated_at;`,
      [status, staffId]
    );

    return res.rows[0];
  }

  /**
   * Update operational permissions (can_create_invoices, can_approve_registrations)
   */
  async updateStaffPermissions(
    staffId: string,
    permissions: { canCreateInvoices?: boolean; canApproveRegistrations?: boolean },
    currentUser: UserContext
  ) {
    await this._assertStaffOwnership(staffId, currentUser);

    const updates: string[] = [];
    const params: any[] = [staffId];

    if (permissions.canCreateInvoices !== undefined) {
      params.push(permissions.canCreateInvoices);
      updates.push(`can_create_invoices = $${params.length}`);
    }

    if (permissions.canApproveRegistrations !== undefined) {
      params.push(permissions.canApproveRegistrations);
      updates.push(`can_approve_registrations = $${params.length}`);
    }

    if (updates.length === 0) {
      throw APIError.badRequest('No permission fields provided for update.');
    }

    updates.push('updated_at = NOW()');

    const sql = `
      UPDATE staff
      SET ${updates.join(', ')}
      WHERE staff_id = $1
      RETURNING staff_id, full_name, mobile_number, can_create_invoices, can_approve_registrations, updated_at;
    `;

    const res = await query(sql, params);
    return res.rows[0];
  }

  /**
   * Delete staff member
   */
  async deleteStaff(staffId: string, currentUser: UserContext) {
    const staff = await this._assertStaffOwnership(staffId, currentUser);

    await query('DELETE FROM staff WHERE staff_id = $1', [staffId]);

    return {
      message: `Staff member "${staff.full_name}" deleted successfully`,
      staffId,
    };
  }

  /**
   * Ensure requesting parent owns the target staff member
   */
  private async _assertStaffOwnership(staffId: string, currentUser: UserContext) {
    const res = await query('SELECT * FROM staff WHERE staff_id = $1', [staffId]);
    if (res.rows.length === 0) {
      throw APIError.notFound('Staff member not found.');
    }

    const staff = res.rows[0];
    if (currentUser.isPlatformOwner) {
      return staff;
    }

    if (staff.employer_type === 'distributor') {
      if (currentUser.role !== ROLES.DISTRIBUTOR || currentUser.distributorId !== staff.distributor_id) {
        throw APIError.forbidden('You do not have permission to manage this staff member.');
      }
    } else if (staff.employer_type === 'dealer') {
      const isDealerOrRetailer = currentUser.role === ROLES.DEALER || currentUser.role === ROLES.RETAILER;
      if (!isDealerOrRetailer || currentUser.dealerId !== staff.dealer_id) {
        throw APIError.forbidden('You do not have permission to manage this staff member.');
      }
    } else {
      throw APIError.forbidden('Unauthorized access.');
    }

    return staff;
  }
}

export const staffService = new StaffService();
export default staffService;
