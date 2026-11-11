import request from 'supertest';
import app from '../src/app';
import { query } from '../src/database';
import { hashPassword } from '../src/utils/password.utils';
import { generateUniqueCode } from '../src/utils/codeGenerator';

describe('Auth Endpoints & Validation', () => {
  const suffix = Date.now().toString().slice(-6);
  let testDistId: string | null = null;
  let testWholesaleDealerId: string | null = null;
  let testRetailerId: string | null = null;
  let childRetailerUnderDealerId: string | null = null;
  let childRetailerUnderDistId: string | null = null;
  const createdDealerIds: string[] = [];

  const wholesaleMobile = `91${suffix}01`;
  const retailerMobile = `91${suffix}02`;
  const childDistRetailerMobile = `91${suffix}03`;
  const childDealerRetailerMobile = `91${suffix}04`;
  const sharedPassword = 'TestPassword123!';

  beforeAll(async () => {
    const pwdHash = await hashPassword(sharedPassword);
    const poRes = await query(
      'SELECT distributor_id FROM distributors WHERE is_platform_owner = TRUE LIMIT 1'
    );
    const poDistId = poRes.rows[0].distributor_id;

    const distRes = await query(
      `INSERT INTO distributors (company_name, owner_name, mobile_number, password_hash, status, invite_code, is_platform_owner, parent_distributor_id)
       VALUES ($1, $2, $3, $4, 'active', $5, FALSE, $6)
       RETURNING distributor_id`,
      [`Auth Test Dist ${suffix}`, 'Dist Owner', `91${suffix}00`, pwdHash, generateUniqueCode('DIST', 6), poDistId]
    );
    testDistId = distRes.rows[0].distributor_id;

    const dealerRes = await query(
      `INSERT INTO dealers (distributor_id, mobile_number, password_hash, shop_name, owner_name, dealer_type, invite_code, source, status)
       VALUES ($1, $2, $3, $4, $5, 'dealer', $6, 'created_by_distributor', 'active')
       RETURNING dealer_id`,
      [testDistId, wholesaleMobile, pwdHash, `Wholesale Hub ${suffix}`, 'Wholesale Owner', generateUniqueCode('DLR', 6)]
    );
    testWholesaleDealerId = dealerRes.rows[0].dealer_id;
    createdDealerIds.push(testWholesaleDealerId!);

    const retailerRes = await query(
      `INSERT INTO dealers (distributor_id, mobile_number, password_hash, shop_name, owner_name, dealer_type, invite_code, source, status)
       VALUES ($1, $2, $3, $4, $5, 'retailer', $6, 'created_by_distributor', 'active')
       RETURNING dealer_id`,
      [testDistId, retailerMobile, pwdHash, `Retail Store ${suffix}`, 'Retail Owner', generateUniqueCode('DLR', 6)]
    );
    testRetailerId = retailerRes.rows[0].dealer_id;
    createdDealerIds.push(testRetailerId!);
  });

  afterAll(async () => {
    if (createdDealerIds.length > 0) {
      await query(
        'DELETE FROM registration_requests WHERE requester_id = ANY($1::uuid[]) OR parent_id = ANY($1::uuid[])',
        [createdDealerIds]
      );
      await query('DELETE FROM dealers WHERE dealer_id = ANY($1::uuid[])', [createdDealerIds]);
    }
    if (testDistId) {
      await query('DELETE FROM registration_requests WHERE parent_id = $1', [testDistId]);
      await query('DELETE FROM distributors WHERE distributor_id = $1', [testDistId]);
    }
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject login when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid mobile number format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          mobileNumber: '12345',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject nonexistent credentials with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          mobileNumber: '9999999999',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, 15000);
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should return 400 validation error when no refresh token is provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({});

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Distributor Creation Security', () => {
    it('should reject unauthenticated distributor creation with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/distributor/create')
        .send({
          companyName: 'ACME Ltd',
          ownerName: 'John Doe',
          mobileNumber: '9876543210',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/dealer/signup', () => {
    it('should fail with 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/dealer/signup')
        .send({
          shopName: 'My Shop',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/retailer/signup', () => {
    it('should fail with 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/retailer/signup')
        .send({
          shopName: 'Missing Fields Retailer',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should register a pending retailer under an active distributor and ignore client dealerType/source bypass attempts', async () => {
      const res = await request(app)
        .post('/api/v1/auth/retailer/signup')
        .send({
          distributorId: testDistId,
          mobileNumber: childDistRetailerMobile,
          password: sharedPassword,
          shopName: `Self Retailer Dist ${suffix}`,
          ownerName: 'Retailer One',
          dealerType: 'dealer', // must be overridden to 'retailer'
          source: 'created_by_distributor', // must be forced to 'self_registered'
          city: 'Delhi',
          state: 'Delhi',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresApproval).toBe(true);
      expect(res.body.data.tokens).toBeNull();
      expect(res.body.data.user.dealer_type).toBe('retailer');
      expect(res.body.data.user.role).toBe('retailer');
      expect(res.body.data.user.status).toBe('pending');
      expect(res.body.data.user.source).toBe('self_registered');
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.aadhar_number).toBeUndefined();

      childRetailerUnderDistId = res.body.data.user.dealer_id;
      createdDealerIds.push(childRetailerUnderDistId!);

      const reqCheck = await query(
        "SELECT parent_type, parent_id, status FROM registration_requests WHERE requester_type = 'dealer' AND requester_id = $1",
        [childRetailerUnderDistId]
      );
      expect(reqCheck.rows.length).toBe(1);
      expect(reqCheck.rows[0].parent_type).toBe('distributor');
      expect(reqCheck.rows[0].parent_id).toBe(testDistId);
      expect(reqCheck.rows[0].status).toBe('pending');
    });

    it('should register a pending retailer under an active wholesale dealer (parentDealerId)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/retailer/signup')
        .send({
          parentDealerId: testWholesaleDealerId,
          mobileNumber: childDealerRetailerMobile,
          password: sharedPassword,
          shopName: `Child Retailer ${suffix}`,
          ownerName: 'Retailer Two',
          city: 'Noida',
          state: 'Uttar Pradesh',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresApproval).toBe(true);
      expect(res.body.data.user.dealer_type).toBe('retailer');
      expect(res.body.data.user.parent_dealer_id).toBe(testWholesaleDealerId);
      expect(res.body.data.user.distributor_id).toBeNull();
      expect(res.body.data.user.password_hash).toBeUndefined();

      childRetailerUnderDealerId = res.body.data.user.dealer_id;
      createdDealerIds.push(childRetailerUnderDealerId!);

      const reqCheck = await query(
        "SELECT parent_type, parent_id, status FROM registration_requests WHERE requester_type = 'dealer' AND requester_id = $1",
        [childRetailerUnderDealerId]
      );
      expect(reqCheck.rows.length).toBe(1);
      expect(reqCheck.rows[0].parent_type).toBe('dealer');
      expect(reqCheck.rows[0].parent_id).toBe(testWholesaleDealerId);
    });

    it('should automatically assign a retailer without parentDealerId or distributorId to the active platform owner distributor', async () => {
      const poRes = await query(
        "SELECT distributor_id FROM distributors WHERE is_platform_owner = TRUE AND status = 'active' ORDER BY created_at ASC LIMIT 1"
      );
      const expectedPoId = poRes.rows[0].distributor_id;

      const res = await request(app)
        .post('/api/v1/auth/retailer/signup')
        .send({
          mobileNumber: `91${suffix}05`,
          password: sharedPassword,
          shopName: `PO Direct Retailer ${suffix}`,
          ownerName: 'Retailer Three',
          city: 'Delhi',
          state: 'Delhi',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresApproval).toBe(true);
      expect(res.body.data.user.distributor_id).toBe(expectedPoId);
      expect(res.body.data.user.parent_dealer_id).toBeNull();

      const poRetailerId = res.body.data.user.dealer_id;
      createdDealerIds.push(poRetailerId);

      const reqCheck = await query(
        "SELECT parent_type, parent_id, status FROM registration_requests WHERE requester_type = 'dealer' AND requester_id = $1",
        [poRetailerId]
      );
      expect(reqCheck.rows.length).toBe(1);
      expect(reqCheck.rows[0].parent_type).toBe('distributor');
      expect(reqCheck.rows[0].parent_id).toBe(expectedPoId);
    });

    it('should reject onboarding when parentDealerId belongs to a retailer instead of a wholesale dealer', async () => {
      const res = await request(app)
        .post('/api/v1/auth/retailer/signup')
        .send({
          parentDealerId: testRetailerId,
          mobileNumber: `91${suffix}99`,
          password: sharedPassword,
          shopName: `Invalid Parent Retailer ${suffix}`,
          ownerName: 'Invalid Parent',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Dealer vs Retailer Strict Sign-In Isolation & Approvals', () => {
    let wholesaleToken = '';

    it('should allow dealer to sign in via /api/v1/auth/dealer/signin without exposing sensitive fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/dealer/signin')
        .send({
          mobileNumber: wholesaleMobile,
          password: sharedPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('dealer');
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.aadhar_number).toBeUndefined();
      wholesaleToken = res.body.data.tokens.accessToken;
    });

    it('should allow retailer to sign in via /api/v1/auth/retailer/signin without exposing sensitive fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/retailer/signin')
        .send({
          mobileNumber: retailerMobile,
          password: sharedPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('retailer');
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.aadhar_number).toBeUndefined();
    });

    it('should reject a retailer signing in via /api/v1/auth/dealer/signin with generic 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/dealer/signin')
        .send({
          mobileNumber: retailerMobile,
          password: sharedPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid mobile number or password');
    });

    it('should reject a dealer signing in via /api/v1/auth/retailer/signin with generic 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/retailer/signin')
        .send({
          mobileNumber: wholesaleMobile,
          password: sharedPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid mobile number or password');
    });

    it('should reject role mismatch on universal /api/v1/auth/signin with generic 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          mobileNumber: wholesaleMobile,
          password: sharedPassword,
          role: 'retailer',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid mobile number or password');
    });

    it('should allow universal /api/v1/auth/signin without role to detect retailer role cleanly', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signin')
        .send({
          mobileNumber: retailerMobile,
          password: sharedPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('retailer');
    });

    it('should allow wholesale dealer to approve pending child retailer registration and let child retailer sign in', async () => {
      const listRes = await request(app)
        .get('/api/v1/approvals/registration-requests')
        .set('Authorization', `Bearer ${wholesaleToken}`);

      expect(listRes.status).toBe(200);
      const pendingReq = listRes.body.data.find(
        (r: any) => r.requester_id === childRetailerUnderDealerId && r.status === 'pending'
      );
      expect(pendingReq).toBeDefined();

      const approveRes = await request(app)
        .post(`/api/v1/approvals/registration-requests/${pendingReq.request_id}/approve`)
        .set('Authorization', `Bearer ${wholesaleToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);

      const childLoginRes = await request(app)
        .post('/api/v1/auth/retailer/signin')
        .send({
          mobileNumber: childDealerRetailerMobile,
          password: sharedPassword,
        });

      expect(childLoginRes.status).toBe(200);
      expect(childLoginRes.body.data.user.role).toBe('retailer');
    });
  });

  describe('Public Directory Endpoints Privacy', () => {
    it('should expose dealer_type without sensitive PII fields in public-dealers and public-distributors', async () => {
      const [distRes, dlrRes] = await Promise.all([
        request(app).get('/api/v1/auth/public-distributors'),
        request(app).get('/api/v1/auth/public-dealers'),
      ]);

      expect(distRes.status).toBe(200);
      expect(Array.isArray(distRes.body.data)).toBe(true);
      for (const dist of distRes.body.data) {
        expect(dist.mobile_number).toBeUndefined();
        expect(dist.password_hash).toBeUndefined();
        expect(dist.aadhar_number).toBeUndefined();
      }

      expect(dlrRes.status).toBe(200);
      expect(Array.isArray(dlrRes.body.data)).toBe(true);
      const foundWholesale = dlrRes.body.data.find((d: any) => d.dealer_id === testWholesaleDealerId);
      expect(foundWholesale).toBeDefined();
      expect(foundWholesale.dealer_type).toBe('dealer');

      for (const dlr of dlrRes.body.data) {
        expect(dlr.mobile_number).toBeUndefined();
        expect(dlr.password_hash).toBeUndefined();
        expect(dlr.aadhar_number).toBeUndefined();
        expect(dlr.gst_number).toBeUndefined();
        expect(dlr.address).toBeUndefined();
        expect(dlr.invite_code).toBeUndefined();
      }
    });
  });
});
