import { pool, query } from '../src/database';
import { hashPassword } from '../src/utils/password.utils';
import { generateUniqueCode } from '../src/utils/codeGenerator';
import { analyticsService } from '../src/modules/analytics/analytics.service';
import { ROLES } from '../src/config/constants';

describe('CRM End-to-End Domain & Database Integration', () => {
  const timestamp = Date.now().toString().slice(-6);
  let poDistId: string;
  let distId: string;
  let dealerId: string;
  let brandId: string;
  let categoryId: string;
  let productId: string;
  let customerId: string;

  afterAll(async () => {
    await pool.end();
  });

  it('1. Database connectivity & get Platform Owner', async () => {
    const res = await query('SELECT current_database(), current_user, version()');
    expect(res.rows.length).toBe(1);

    const poRes = await query(
      'SELECT distributor_id, mobile_number FROM distributors WHERE is_platform_owner = TRUE LIMIT 1'
    );
    expect(poRes.rows.length).toBeGreaterThan(0);
    poDistId = poRes.rows[0].distributor_id;
    expect(poDistId).toBeDefined();
  });

  it('2. Create Regional Distributor & Verify record', async () => {
    const mobile = `98${timestamp}`;
    const pwd = await hashPassword('DistPass123!');
    const distInvite = generateUniqueCode('DIS', 6);
    const res = await query(
      `INSERT INTO distributors (
        company_name, owner_name, mobile_number, password_hash, status, 
        invite_code, is_platform_owner, parent_distributor_id
      ) VALUES ($1, $2, $3, $4, 'active', $5, FALSE, $6)
      RETURNING distributor_id, company_name, mobile_number, status`,
      [`Test Dist ${timestamp}`, 'Test Owner', mobile, pwd, distInvite, poDistId]
    );

    expect(res.rows.length).toBe(1);
    distId = res.rows[0].distributor_id;
    expect(distId).toBeDefined();
    expect(res.rows[0].status).toBe('active');
  });

  it('3. Register Dealer under Distributor and Approve', async () => {
    const mobile = `97${timestamp}`;
    const pwd = await hashPassword('DealerPass123!');
    const invite = generateUniqueCode('DLR', 6);

    const dealerRes = await query(
      `INSERT INTO dealers (distributor_id, mobile_number, password_hash, shop_name, owner_name, dealer_type, invite_code, status, source)
       VALUES ($1, $2, $3, $4, $5, 'retailer', $6, 'pending', 'self_registered')
       RETURNING dealer_id, status`,
      [distId, mobile, pwd, `Dealer Shop ${timestamp}`, 'Dealer Guy', invite]
    );

    dealerId = dealerRes.rows[0].dealer_id;
    expect(dealerRes.rows[0].status).toBe('pending');

    // Approve the dealer
    const updated = await query(
      `UPDATE dealers SET status = 'active' WHERE dealer_id = $1 RETURNING status`,
      [dealerId]
    );
    expect(updated.rows[0].status).toBe('active');
  });

  it('4. Global Catalog: create brand, category, and product', async () => {
    const brandRes = await query(
      `INSERT INTO brands (brand_name) VALUES ($1) RETURNING brand_id`,
      [`Brand-${timestamp}`]
    );
    brandId = brandRes.rows[0].brand_id;

    const catRes = await query(
      `INSERT INTO product_categories (category_name, default_unit) VALUES ($1, 'box') RETURNING category_id`,
      [`Category-${timestamp}`]
    );
    categoryId = catRes.rows[0].category_id;

    const prodRes = await query(
      `INSERT INTO products (distributor_id, category_id, brand_id, variant_name, unit, unit_price, status)
       VALUES ($1, $2, $3, $4, 'box', 150.00, 'active') RETURNING product_id`,
      [poDistId, categoryId, brandId, `Product-${timestamp}`]
    );
    productId = prodRes.rows[0].product_id;
    expect(productId).toBeDefined();
  });

  it('5. Inbound Purchase: Distributor purchases stock from supplier', async () => {
    const purchaseRes = await query(
      `INSERT INTO distributor_purchases (distributor_id, supplier_name, invoice_number, purchase_date, total_amount, status)
       VALUES ($1, 'Mega Supplier Ltd', $2, CURRENT_DATE, 15000.00, 'received')
       RETURNING purchase_id`,
      [distId, `SUP-${timestamp}`]
    );
    const purchaseId = purchaseRes.rows[0].purchase_id;

    // Add purchase item
    await query(
      `INSERT INTO distributor_purchase_items (purchase_id, product_id, quantity, unit_price, total_price)
       VALUES ($1, $2, 100, 150.00, 15000.00)`,
      [purchaseId, productId]
    );

    // Upsert distributor inventory
    await query(
      `INSERT INTO distributor_inventory (distributor_id, product_id, quantity_available)
       VALUES ($1, $2, 100)
       ON CONFLICT (distributor_id, product_id)
       DO UPDATE SET quantity_available = distributor_inventory.quantity_available + 100`,
      [distId, productId]
    );

    const inv = await query(
      `SELECT quantity_available FROM distributor_inventory WHERE distributor_id = $1 AND product_id = $2`,
      [distId, productId]
    );
    expect(parseFloat(inv.rows[0].quantity_available)).toBeGreaterThanOrEqual(100);
  });

  it('6. B2B Sales: Distributor invoices Dealer & moves inventory', async () => {
    // Deduct distributor stock and reserve in transit
    await query(
      `UPDATE distributor_inventory
       SET quantity_available = quantity_available - 20,
           quantity_in_transit = quantity_in_transit + 20
       WHERE distributor_id = $1 AND product_id = $2`,
      [distId, productId]
    );

    // Create distributor invoice
    const invRes = await query(
      `INSERT INTO distributor_invoices (distributor_id, dealer_id, invoice_number, invoice_date, total_amount, status)
       VALUES ($1, $2, $3, CURRENT_DATE, 3400.00, 'pending')
       RETURNING invoice_id`,
      [distId, dealerId, `DINV-${timestamp}`]
    );
    const invoiceId = invRes.rows[0].invoice_id;

    // Delivery confirmation: release transit & add to dealer inventory
    await query(
      `UPDATE distributor_inventory
       SET quantity_in_transit = quantity_in_transit - 20
       WHERE distributor_id = $1 AND product_id = $2`,
      [distId, productId]
    );

    await query(
      `INSERT INTO dealer_inventory (dealer_id, product_id, quantity_available)
       VALUES ($1, $2, 20)
       ON CONFLICT (dealer_id, product_id)
       DO UPDATE SET quantity_available = dealer_inventory.quantity_available + 20`,
      [dealerId, productId]
    );

    await query(
      `UPDATE distributor_invoices SET status = 'delivered' WHERE invoice_id = $1`,
      [invoiceId]
    );

    const dealerStock = await query(
      `SELECT quantity_available FROM dealer_inventory WHERE dealer_id = $1 AND product_id = $2`,
      [dealerId, productId]
    );
    expect(parseFloat(dealerStock.rows[0].quantity_available)).toBe(20);
  });

  it('7. Register Customer, issue B2C Invoice, and credit Points', async () => {
    const mobile = `96${timestamp}`;
    const pwd = await hashPassword('CustPass123!');
    const refCode = generateUniqueCode('CUST', 6);

    const custRes = await query(
      `INSERT INTO customers (mobile_number, password_hash, name, referral_code, onboarding_dealer_id, status, created_by_type)
       VALUES ($1, $2, 'Test Customer', $3, $4, 'active', 'dealer')
       RETURNING customer_id`,
      [mobile, pwd, refCode, dealerId]
    );
    customerId = custRes.rows[0].customer_id;

    // Deduct dealer stock for sale
    await query(
      `UPDATE dealer_inventory SET quantity_available = quantity_available - 5
       WHERE dealer_id = $1 AND product_id = $2`,
      [dealerId, productId]
    );

    // Create delivered dealer invoice
    const dInvRes = await query(
      `INSERT INTO dealer_invoices (dealer_id, customer_id, invoice_number, invoice_date, total_amount, status)
       VALUES ($1, $2, $3, CURRENT_DATE, 1000.00, 'delivered')
       RETURNING invoice_id`,
      [dealerId, customerId, `CINV-${timestamp}`]
    );

    // Credit points to customer via ledger
    await query(
      `INSERT INTO points_ledger (profile_type, profile_id, points, reason, reference_type, reference_id)
       VALUES ('customer', $1, 100, 'invoice_purchase', 'dealer_invoice', $2)`,
      [customerId, dInvRes.rows[0].invoice_id]
    );

    const pts = await query(
      `SELECT balance FROM points_balances WHERE profile_type = 'customer' AND profile_id = $1`,
      [customerId]
    );
    expect(parseInt(pts.rows[0].balance, 10)).toBe(100);
  });

  it('8. Verify Analytics Service computation for Dealer', async () => {
    const dealerAnalytics = await analyticsService.getDealerAnalytics(
      { timeframe: 'this_month' },
      {
        id: dealerId,
        userId: dealerId,
        role: ROLES.DEALER,
        dealerId,
        entityId: dealerId,
        mobileNumber: '9700000000',
        status: 'active',
        profile: {},
        isPlatformOwner: false,
      }
    );

    expect(dealerAnalytics.dealerId).toBe(dealerId);
    expect(dealerAnalytics.sales.invoiceCount).toBeGreaterThanOrEqual(1);
    expect(dealerAnalytics.sales.totalAmount).toBeGreaterThanOrEqual(1000);
    expect(dealerAnalytics.customers.totalCount).toBeGreaterThanOrEqual(1);
  });
});
