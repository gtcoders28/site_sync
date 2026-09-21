import { query } from '../../database';
import { APIError } from '../../errors/apiError';
import { parseDateRange } from '../../utils/dateFilter';
import { ROLES } from '../../config/constants';
import { UserContext } from '../../middlewares/auth.middleware';
import { AnalyticsQueryInput } from './analytics.validator';

export class AnalyticsService {
  /**
   * Dealer Dashboard Analytics
   */
  async getDealerAnalytics(queryParams: AnalyticsQueryInput, currentUser: UserContext) {
    let dealerId = currentUser.dealerId;

    if (currentUser.isPlatformOwner || currentUser.role === ROLES.DISTRIBUTOR) {
      if (queryParams.dealerId) {
        // If distributor, verify dealer belongs to this distributor
        if (!currentUser.isPlatformOwner) {
          const dCheck = await query('SELECT distributor_id FROM dealers WHERE dealer_id = $1', [queryParams.dealerId]);
          if (dCheck.rows.length === 0 || dCheck.rows[0].distributor_id !== currentUser.distributorId) {
            throw APIError.forbidden('You can only view metrics of dealers under your distributorship.');
          }
        }
        dealerId = queryParams.dealerId;
      }
    }

    if (!dealerId) {
      throw APIError.forbidden('Dealer context required for dealer analytics.');
    }

    const { fromDate, toDate } = parseDateRange(queryParams);

    // 1. Sales to customers in time range
    const salesRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_sales, COUNT(*) AS invoice_count
       FROM dealer_invoices
       WHERE dealer_id = $1 AND status = 'delivered'
         AND invoice_date >= $2::date AND invoice_date <= $3::date`,
      [dealerId, fromDate, toDate]
    );

    // 2. Purchases from distributor in time range
    const purchaseRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_purchases, COUNT(*) AS purchase_count
       FROM distributor_invoices
       WHERE dealer_id = $1 AND status = 'delivered'
         AND invoice_date >= $2::date AND invoice_date <= $3::date`,
      [dealerId, fromDate, toDate]
    );

    // 3. Dealer's own points balance
    const dealerPointsRes = await query(
      `SELECT COALESCE(balance, 0) AS balance FROM points_balances WHERE profile_type = 'dealer' AND profile_id = $1`,
      [dealerId]
    );

    // 4. Points of all customers under this dealer
    const customerPointsRes = await query(
      `SELECT COALESCE(SUM(l.points), 0) AS customer_points_total, COUNT(DISTINCT c.customer_id) AS customer_count
       FROM customers c
       LEFT JOIN points_ledger l ON l.profile_type = 'customer' AND l.profile_id = c.customer_id
       WHERE c.onboarding_dealer_id = $1`,
      [dealerId]
    );

    // 5. Current inventory summary
    const invRes = await query(
      `SELECT COUNT(product_id) AS total_skus, COALESCE(SUM(quantity_available), 0) AS total_stock
       FROM dealer_inventory WHERE dealer_id = $1`,
      [dealerId]
    );

    return {
      period: { fromDate, toDate },
      dealerId,
      sales: {
        totalAmount: parseFloat(salesRes.rows[0].total_sales),
        invoiceCount: parseInt(salesRes.rows[0].invoice_count, 10),
      },
      purchases: {
        totalAmount: parseFloat(purchaseRes.rows[0].total_purchases),
        invoiceCount: parseInt(purchaseRes.rows[0].purchase_count, 10),
      },
      points: {
        dealerPoints: parseInt(dealerPointsRes.rows[0]?.balance || '0', 10),
        customersTotalPoints: parseInt(customerPointsRes.rows[0].customer_points_total, 10),
      },
      customers: {
        totalCount: parseInt(customerPointsRes.rows[0].customer_count, 10),
      },
      inventory: {
        skuCount: parseInt(invRes.rows[0].total_skus, 10),
        totalStockUnits: parseFloat(invRes.rows[0].total_stock),
      },
    };
  }

  /**
   * Distributor Dashboard Analytics
   * STRICT: Distributor can ONLY view metrics of dealers who come under that distributor
   */
  async getDistributorAnalytics(queryParams: AnalyticsQueryInput, currentUser: UserContext) {
    let distributorId = currentUser.distributorId;

    if (currentUser.isPlatformOwner && queryParams.distributorId) {
      distributorId = queryParams.distributorId;
    }

    if (!distributorId) {
      throw APIError.forbidden('Distributor context required for distributor analytics.');
    }

    const { fromDate, toDate } = parseDateRange(queryParams);

    // 1. Distributor total B2B sales to dealers in time range
    const b2bSalesRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_b2b_sales, COUNT(*) AS invoice_count
       FROM distributor_invoices
       WHERE distributor_id = $1 AND status = 'delivered'
         AND invoice_date >= $2::date AND invoice_date <= $3::date`,
      [distributorId, fromDate, toDate]
    );

    // 2. Inbound purchases from suppliers in time range
    const supplierPurchasesRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_purchases, COUNT(*) AS purchase_count
       FROM distributor_purchases
       WHERE distributor_id = $1 AND status = 'received'
         AND purchase_date >= $2::date AND purchase_date <= $3::date`,
      [distributorId, fromDate, toDate]
    );

    // 3. Dealers breakdown strictly under this distributor
    const dealersBreakdownRes = await query(
      `SELECT 
         d.dealer_id, d.shop_name, d.owner_name, d.mobile_number, d.city, d.status,
         (SELECT COUNT(*) FROM customers c WHERE c.onboarding_dealer_id = d.dealer_id) AS customer_count,
         COALESCE((
           SELECT SUM(di.total_amount) 
           FROM dealer_invoices di 
           WHERE di.dealer_id = d.dealer_id AND di.status = 'delivered'
             AND di.invoice_date >= $2::date AND di.invoice_date <= $3::date
         ), 0) AS total_sales,
         COALESCE((SELECT balance FROM points_balances pb WHERE pb.profile_type = 'dealer' AND pb.profile_id = d.dealer_id), 0) AS dealer_points,
         COALESCE((
           SELECT SUM(pl.points) 
           FROM customers c2 
           JOIN points_ledger pl ON pl.profile_type = 'customer' AND pl.profile_id = c2.customer_id
           WHERE c2.onboarding_dealer_id = d.dealer_id
         ), 0) AS customer_points_under_dealer
       FROM dealers d
       WHERE d.distributor_id = $1
       ORDER BY total_sales DESC`,
      [distributorId, fromDate, toDate]
    );

    return {
      period: { fromDate, toDate },
      distributorId,
      b2bSalesToDealers: {
        totalAmount: parseFloat(b2bSalesRes.rows[0].total_b2b_sales),
        invoiceCount: parseInt(b2bSalesRes.rows[0].invoice_count, 10),
      },
      supplierPurchases: {
        totalAmount: parseFloat(supplierPurchasesRes.rows[0].total_purchases),
        purchaseCount: parseInt(supplierPurchasesRes.rows[0].purchase_count, 10),
      },
      dealersCount: dealersBreakdownRes.rows.length,
      dealers: dealersBreakdownRes.rows.map((r: any) => ({
        dealerId: r.dealer_id,
        shopName: r.shop_name,
        ownerName: r.owner_name,
        mobileNumber: r.mobile_number,
        city: r.city,
        status: r.status,
        customerCount: parseInt(r.customer_count, 10),
        totalSales: parseFloat(r.total_sales),
        dealerPoints: parseInt(r.dealer_points, 10),
        customerPointsUnderDealer: parseInt(r.customer_points_under_dealer, 10),
      })),
    };
  }

  /**
   * Platform Owner Cross-Network Analytics
   * Platform owner sees metrics across all distributors, dealers under any distributor, and direct dealers
   */
  async getPlatformOwnerAnalytics(queryParams: AnalyticsQueryInput, currentUser: UserContext) {
    if (!currentUser.isPlatformOwner) {
      throw APIError.forbidden('Only the Platform Owner can access cross-network platform analytics.', 'PLATFORM_OWNER_REQUIRED');
    }

    const { fromDate, toDate } = parseDateRange(queryParams);

    // 1. Platform-wide entity counts
    const [distCount, dlrCount, custCount, infCount] = await Promise.all([
      query('SELECT COUNT(*) FROM distributors WHERE is_platform_owner = FALSE'),
      query('SELECT COUNT(*) FROM dealers'),
      query('SELECT COUNT(*) FROM customers'),
      query('SELECT COUNT(*) FROM influencers'),
    ]);

    // 2. Platform-wide total sales volumes
    const [b2bTotal, b2cTotal] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
         FROM distributor_invoices
         WHERE status = 'delivered' AND invoice_date >= $1::date AND invoice_date <= $2::date`,
        [fromDate, toDate]
      ),
      query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
         FROM dealer_invoices
         WHERE status = 'delivered' AND invoice_date >= $1::date AND invoice_date <= $2::date`,
        [fromDate, toDate]
      ),
    ]);

    // 3. Distributor-by-Distributor Summary
    const distSummaryRes = await query(
      `SELECT 
         dist.distributor_id, dist.company_name, dist.owner_name, dist.is_platform_owner,
         COUNT(DISTINCT d.dealer_id) AS dealer_count,
         COALESCE(SUM(di.total_amount), 0) AS total_b2b_sales
       FROM distributors dist
       LEFT JOIN dealers d ON d.distributor_id = dist.distributor_id
       LEFT JOIN distributor_invoices di ON di.distributor_id = dist.distributor_id 
            AND di.status = 'delivered' AND di.invoice_date >= $1::date AND di.invoice_date <= $2::date
       GROUP BY dist.distributor_id, dist.company_name, dist.owner_name, dist.is_platform_owner
       ORDER BY total_b2b_sales DESC`,
      [fromDate, toDate]
    );

    // 4. Points Ecosystem summary
    const pointsSummaryRes = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) AS total_points_issued,
        COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0) AS total_points_redeemed
      FROM points_ledger
    `);

    return {
      period: { fromDate, toDate },
      networkSize: {
        distributors: parseInt(distCount.rows[0].count, 10),
        dealers: parseInt(dlrCount.rows[0].count, 10),
        customers: parseInt(custCount.rows[0].count, 10),
        influencers: parseInt(infCount.rows[0].count, 10),
      },
      volume: {
        distributorToDealerSales: {
          totalAmount: parseFloat(b2bTotal.rows[0].total),
          invoiceCount: parseInt(b2bTotal.rows[0].count, 10),
        },
        dealerToCustomerSales: {
          totalAmount: parseFloat(b2cTotal.rows[0].total),
          invoiceCount: parseInt(b2cTotal.rows[0].count, 10),
        },
      },
      pointsEcosystem: {
        totalPointsIssued: parseInt(pointsSummaryRes.rows[0].total_points_issued, 10),
        totalPointsRedeemed: parseInt(pointsSummaryRes.rows[0].total_points_redeemed, 10),
      },
      distributors: distSummaryRes.rows.map((r: any) => ({
        distributorId: r.distributor_id,
        companyName: r.company_name,
        ownerName: r.owner_name,
        isPlatformOwner: r.is_platform_owner,
        dealerCount: parseInt(r.dealer_count, 10),
        totalSales: parseFloat(r.total_b2b_sales),
      })),
    };
  }
}

export const analyticsService = new AnalyticsService();
