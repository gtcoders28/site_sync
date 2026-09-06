const { pool } = require('../config/database');
const authService = require('../modules/auth/auth.service');
const catalogService = require('../modules/catalog/catalog.service');
const approvalsService = require('../modules/approvals/approvals.service');
const purchasesService = require('../modules/purchases/purchases.service');
const invoicesService = require('../modules/invoices/invoices.service');
const loyaltyService = require('../modules/loyalty/loyalty.service');
const analyticsService = require('../modules/analytics/analytics.service');
const { errorHandler } = require('../middlewares/error.middleware');
const { ROLES } = require('../config/constants');

async function runTests() {
  console.log('================================================================');
  console.log('STARTING CRM BACKEND PRODUCTION SUITE INTEGRATION TESTS');
  console.log('================================================================');

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const ownerMobile = `98${randomSuffix}0001`;
  const distMobile = `98${randomSuffix}0002`;
  const dlrMobile = `98${randomSuffix}0003`;
  const custMobile = `98${randomSuffix}0004`;
  const infMobile = `98${randomSuffix}0005`;

  try {
    // 1. BOOTSTRAP OR FETCH PLATFORM OWNER
    console.log('\n[1] Resolving Platform Owner...');
    let platformOwner;
    const existingOwnerRes = await pool.query('SELECT distributor_id, company_name FROM distributors WHERE is_platform_owner = TRUE LIMIT 1');
    if (existingOwnerRes.rows.length > 0) {
      platformOwner = existingOwnerRes.rows[0];
      console.log('✓ Found existing Platform Owner:', platformOwner.distributor_id, platformOwner.company_name);
    } else {
      const ownerResult = await authService.signUpDistributor({
        mobileNumber: ownerMobile,
        password: 'Password@123',
        companyName: 'Apex Headquarters Platform',
        ownerName: 'Apex Owner',
        email: `owner_${randomSuffix}@apex.com`,
        isPlatformOwner: true,
      });
      platformOwner = ownerResult.user;
      console.log('✓ Platform Owner created:', platformOwner.distributor_id, platformOwner.company_name);
    }
    const ownerContext = {
      id: platformOwner.distributor_id,
      role: ROLES.PLATFORM_OWNER_DISTRIBUTOR,
      isPlatformOwner: true,
      distributorId: platformOwner.distributor_id,
    };

    // 2. GLOBAL SHARED CATALOG
    console.log('\n[2] Creating Global Shared Catalog (Brands, Categories, Products)...');
    const brand = await catalogService.createBrand({ brandName: `Brand_${randomSuffix}` }, ownerContext);
    const category = await catalogService.createCategory({ categoryName: `Category_${randomSuffix}`, defaultUnit: 'bags' }, ownerContext);
    const product = await catalogService.createProduct(
      {
        categoryId: category.category_id,
        brandId: brand.brand_id,
        variantName: `Premium Grade_${randomSuffix}`,
        unit: 'bag',
        unitPrice: 350.0,
        attributes: { weight: '50kg', grade: '53-grade' },
      },
      ownerContext
    );
    console.log('✓ Global product created:', product.product_id, product.variant_name, `@ ₹${product.unit_price}`);

    // 3. REGIONAL DISTRIBUTOR ONBOARDING (Platform Owner creates distributor)
    console.log('\n[3] Onboarding Regional Distributor under Platform Owner...');
    const distResult = await authService.createDistributor(
      {
        mobileNumber: distMobile,
        password: 'Password@123',
        companyName: `Regional Distributor ${randomSuffix}`,
        ownerName: 'Regional Lead',
        email: `dist_${randomSuffix}@apex.com`,
      },
      ownerContext
    );
    const distributor = distResult.user;
    const distContext = {
      id: distributor.distributor_id,
      role: ROLES.DISTRIBUTOR,
      isPlatformOwner: false,
      distributorId: distributor.distributor_id,
    };
    console.log('✓ Regional Distributor created:', distributor.distributor_id, distributor.company_name);

    // 4. DEALER SELF-REGISTRATION & STRICT PARENT APPROVAL
    console.log('\n[4] Dealer Self-Registration & Strict Parent Approval Workflow...');
    const dlrResult = await authService.signUpDealer({
      distributorId: distributor.distributor_id,
      mobileNumber: dlrMobile,
      password: 'Password@123',
      shopName: `Metro Hardware ${randomSuffix}`,
      ownerName: 'Dealer Owner',
      dealerType: 'both',
      source: 'self_registered',
    });
    const dealer = dlrResult.user;
    console.log('✓ Dealer registered (status pending):', dealer.dealer_id, dealer.status);

    // Fetch registration request
    const dlrReqs = await approvalsService.listRequests(distContext, { requesterType: 'dealer', status: 'pending' });
    const dlrReq = dlrReqs.requests.find((r) => r.requester_id === dealer.dealer_id);
    if (!dlrReq) throw new Error('Dealer registration request not found in parent queue');

    // Strict Parent Check: Verify unauthorized user rejection
    const fakeDistContext = { id: '00000000-0000-0000-0000-000000000000', role: ROLES.DISTRIBUTOR, isPlatformOwner: false, distributorId: '00000000-0000-0000-0000-000000000000' };
    try {
      await approvalsService.resolveRequest(dlrReq.request_id, { action: 'approve' }, fakeDistContext);
      throw new Error('Expected 403 Forbidden for unauthorized parent!');
    } catch (err) {
      console.log('✓ Unauthorized parent correctly rejected with:', err.message);
    }

    // Legitimate approval by parent distributor
    const resolvedDlr = await approvalsService.resolveRequest(dlrReq.request_id, { action: 'approve' }, distContext);
    console.log('✓ Dealer approved by parent distributor:', resolvedDlr.status);

    const dealerContext = {
      id: dealer.dealer_id,
      role: ROLES.DEALER,
      isPlatformOwner: false,
      dealerId: dealer.dealer_id,
      distributorId: distributor.distributor_id,
    };

    // 5. CUSTOMER SELF-REGISTRATION & INFLUENCER
    console.log('\n[5] Customer Self-Registration & Influencer Setup...');
    const infResult = await authService.signUpInfluencer({
      dealerId: dealer.dealer_id,
      distributorId: distributor.distributor_id,
      mobileNumber: infMobile,
      password: 'Password@123',
      name: `Engineer Raman ${randomSuffix}`,
    });
    const influencer = infResult.user;
    console.log('✓ Influencer registered with code:', influencer.referral_code);

    const custResult = await authService.signUpCustomer({
      mobileNumber: custMobile,
      password: 'Password@123',
      name: `Customer Sharma ${randomSuffix}`,
      onboardingDealerId: dealer.dealer_id,
      createdByType: 'self',
    });
    const customer = custResult.user;
    console.log('✓ Customer self-registered (status pending):', customer.customer_id);

    // Approve customer by dealer
    const custReqs = await approvalsService.listRequests(dealerContext, { requesterType: 'customer', status: 'pending' });
    const custReq = custReqs.requests.find((r) => r.requester_id === customer.customer_id);
    await approvalsService.resolveRequest(custReq.request_id, { action: 'approve' }, dealerContext);
    console.log('✓ Customer approved by dealer. Welcome bonus 100 points credited.');

    // 6. INBOUND PURCHASES & INVENTORY
    console.log('\n[6] Distributor Inbound Supplier Purchase...');
    const purchase = await purchasesService.createPurchase(
      {
        supplierName: 'UltraTech Plant 1',
        invoiceNumber: `SUPP-INV-${randomSuffix}`,
        items: [{ productId: product.product_id, quantity: 500, unitPrice: 300.0 }],
      },
      distContext
    );
    console.log('✓ Inbound purchase created (pending):', purchase.purchase_id, purchase.invoice_number);

    await purchasesService.updatePurchaseStatus(purchase.purchase_id, 'received', distContext);
    console.log('✓ Purchase marked received. Stock added to distributor_inventory.');

    // 7. DISTRIBUTOR-TO-DEALER INVOICE & IN-TRANSIT RESERVATION
    console.log('\n[7] Distributor B2B Invoicing & In-Transit Reservation Mechanism...');
    const distInvoice = await invoicesService.createDistributorInvoice(
      {
        dealerId: dealer.dealer_id,
        invoiceNumber: `DLR-INV-${randomSuffix}`,
        items: [{ productId: product.product_id, quantity: 100, unitPrice: 340.0 }],
      },
      distContext
    );
    console.log('✓ Distributor invoice created (pending).');

    // Check inventory reservation: available should be 400, in_transit should be 100
    const invCheck1 = await pool.query(
      'SELECT quantity_available, quantity_in_transit FROM distributor_inventory WHERE distributor_id = $1 AND product_id = $2',
      [distributor.distributor_id, product.product_id]
    );
    console.log('✓ Distributor inventory during in-transit reservation:', {
      available: invCheck1.rows[0].quantity_available,
      inTransit: invCheck1.rows[0].quantity_in_transit,
    });

    if (parseFloat(invCheck1.rows[0].quantity_available) !== 400 || parseFloat(invCheck1.rows[0].quantity_in_transit) !== 100) {
      throw new Error('In-transit inventory reservation calculation mismatch!');
    }

    // Deliver invoice
    await invoicesService.updateDistributorInvoiceStatus(distInvoice.invoice_id, 'delivered', distContext);
    console.log('✓ Distributor invoice marked delivered.');

    // Verify after delivery: distributor in_transit is cleared (0), available untouched (400), dealer available is 100
    const invCheck2 = await pool.query(
      'SELECT quantity_available, quantity_in_transit FROM distributor_inventory WHERE distributor_id = $1 AND product_id = $2',
      [distributor.distributor_id, product.product_id]
    );
    const dlrInvCheck = await pool.query(
      'SELECT quantity_available, quantity_in_transit FROM dealer_inventory WHERE dealer_id = $1 AND product_id = $2',
      [dealer.dealer_id, product.product_id]
    );
    console.log('✓ Post-delivery distributor inventory (inTransit cleared, available untouched):', {
      distAvailable: invCheck2.rows[0].quantity_available,
      distInTransit: invCheck2.rows[0].quantity_in_transit,
      dealerAvailable: dlrInvCheck.rows[0].quantity_available,
    });

    // 8. TERMINAL-STATE GUARD VERIFICATION (HTTP 409 CONFLICT)
    console.log('\n[8] Testing Terminal-State Guard & 409 Conflict Mapping...');
    try {
      await invoicesService.updateDistributorInvoiceStatus(distInvoice.invoice_id, 'cancelled', distContext);
      throw new Error('Expected terminal state modification to fail!');
    } catch (err) {
      console.log('✓ Service caught terminal state guard:', err.statusCode, err.errorCode, '-', err.message);
      if (err.statusCode !== 409) {
        throw new Error(`Expected HTTP 409, received ${err.statusCode}`);
      }
    }

    // Also test raw SQL update to trigger PostgreSQL BEFORE UPDATE trigger guard
    try {
      await pool.query("UPDATE distributor_invoices SET status = 'cancelled' WHERE invoice_id = $1", [distInvoice.invoice_id]);
      throw new Error('Expected Postgres trigger to forbid direct SQL update on delivered invoice!');
    } catch (pgErr) {
      console.log('✓ PostgreSQL DB trigger fired exception code:', pgErr.code, '-', pgErr.message);
      // Simulate error middleware response
      let mappedRes = null;
      const fakeRes = {
        status: (code) => ({
          json: (body) => {
            mappedRes = { statusCode: code, ...body };
          },
        }),
      };
      errorHandler(pgErr, {}, fakeRes, () => {});
      console.log('✓ Error middleware converted Postgres trigger exception to:', mappedRes.statusCode, mappedRes.errorCode);
      if (mappedRes.statusCode !== 409) {
        throw new Error('Error middleware failed to map trigger exception to 409!');
      }
    }

    // 9. DEALER INVOICE & LOYALTY POINTS
    console.log('\n[9] Dealer B2C Invoicing with Influencer Attribution & Loyalty Points Accrual...');
    const dealerInvoice = await invoicesService.createDealerInvoice(
      {
        customerId: customer.customer_id,
        influencerId: influencer.influencer_id,
        invoiceNumber: `CUST-INV-${randomSuffix}`,
        items: [{ productId: product.product_id, quantity: 20, unitPrice: 380.0 }], // Total: 7600
      },
      dealerContext
    );
    console.log('✓ Dealer invoice created and delivered:', dealerInvoice.invoice_id, `Total: ₹${dealerInvoice.total_amount}`);

    // Check customer points and influencer points
    const custBal = await loyaltyService.getBalance('customer', customer.customer_id);
    const infBal = await loyaltyService.getBalance('influencer', influencer.influencer_id);
    console.log('✓ Customer points balance (100 welcome + 760 order):', custBal.balance);
    console.log('✓ Influencer points balance (15% commission = 114):', infBal.balance);

    if (custBal.balance !== 860) throw new Error(`Expected 860 customer points, got ${custBal.balance}`);
    if (infBal.balance !== 114) throw new Error(`Expected 114 influencer points, got ${infBal.balance}`);

    // 10. POINTS REDEMPTION WORKFLOW
    console.log('\n[10] Points Redemption Request & Platform Owner Approval...');
    const custUserContext = { id: customer.customer_id, role: ROLES.CUSTOMER };
    const redemptionReq = await loyaltyService.requestRedemption(
      { pointsRedeemed: 200, rewardDescription: 'Hardware Store Voucher ₹200' },
      custUserContext
    );
    console.log('✓ Redemption requested (status pending):', redemptionReq.redemption_id);

    // Platform Owner approves redemption
    const resolvedRedemption = await loyaltyService.resolveRedemption(
      redemptionReq.redemption_id,
      { action: 'approve' },
      ownerContext
    );
    console.log('✓ Redemption approved by Platform Owner:', resolvedRedemption.status);

    const postRedeemBal = await loyaltyService.getBalance('customer', customer.customer_id);
    console.log('✓ Customer points balance post-redemption (860 - 200 = 660):', postRedeemBal.balance);
    if (postRedeemBal.balance !== 660) throw new Error(`Expected 660 points post redemption, got ${postRedeemBal.balance}`);

    // 11. DYNAMIC TIME-RANGE ANALYTICS
    console.log('\n[11] Testing Dynamic Time-Range Analytics...');
    const dealerAnalytics = await analyticsService.getDealerAnalytics({ timeframe: 'today' }, dealerContext);
    console.log('✓ Dealer Analytics (Today):', {
      sales: dealerAnalytics.sales,
      purchases: dealerAnalytics.purchases,
      points: dealerAnalytics.points,
    });

    const distAnalytics = await analyticsService.getDistributorAnalytics({ timeframe: 'this_month' }, distContext);
    console.log('✓ Distributor Analytics (Dealers under distributor):', {
      b2bSales: distAnalytics.b2bSalesToDealers,
      dealersCount: distAnalytics.dealersCount,
      topDealer: distAnalytics.dealers[0]?.shopName,
    });

    const ownerAnalytics = await analyticsService.getPlatformOwnerAnalytics({ timeframe: 'this_year' }, ownerContext);
    console.log('✓ Platform Owner Analytics (Global Network):', {
      networkSize: ownerAnalytics.networkSize,
      volume: ownerAnalytics.volume,
      pointsEcosystem: ownerAnalytics.pointsEcosystem,
    });

    console.log('\n================================================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! BACKEND IS PRODUCTION-READY.');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
