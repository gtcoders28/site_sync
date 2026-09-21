import { query } from '../../database';
import { APIError } from '../../errors/apiError';
import { getPaginationParams, formatPaginationMetadata } from '../../utils/pagination';
import { UserContext } from '../../middlewares/auth.middleware';

export class CatalogService {
  /**
   * Create Brand (Platform Owner Only)
   */
  async createBrand({ brandName }: { brandName: string }, currentUser: UserContext) {
    if (!currentUser.isPlatformOwner) {
      throw APIError.forbidden('Only the Platform Owner can manage catalog brands.');
    }

    const res = await query(
      'INSERT INTO brands (brand_name) VALUES ($1) RETURNING brand_id, brand_name, created_at',
      [brandName]
    );
    return res.rows[0];
  }

  /**
   * List Brands (Global Read)
   */
  async listBrands() {
    const res = await query('SELECT brand_id, brand_name, created_at FROM brands ORDER BY brand_name ASC');
    return res.rows;
  }

  /**
   * Create Category (Platform Owner Only)
   */
  async createCategory({ categoryName, defaultUnit }: { categoryName: string; defaultUnit: string }, currentUser: UserContext) {
    if (!currentUser.isPlatformOwner) {
      throw APIError.forbidden('Only the Platform Owner can manage product categories.');
    }

    const res = await query(
      'INSERT INTO product_categories (category_name, default_unit) VALUES ($1, $2) RETURNING category_id, category_name, default_unit, created_at',
      [categoryName, defaultUnit]
    );
    return res.rows[0];
  }

  /**
   * List Categories (Global Read)
   */
  async listCategories() {
    const res = await query('SELECT category_id, category_name, default_unit, created_at FROM product_categories ORDER BY category_name ASC');
    return res.rows;
  }

  /**
   * Create Product in Global Shared Catalog (Platform Owner Only)
   */
  async createProduct(data: any, currentUser: UserContext) {
    if (!currentUser.isPlatformOwner) {
      throw APIError.forbidden('Only the Platform Owner can create products in the global catalog.');
    }

    const { categoryId, brandId, variantName, unit, unitPrice, attributes = {} } = data;

    // Check category and brand existence
    const [catRes, brandRes] = await Promise.all([
      query('SELECT category_id FROM product_categories WHERE category_id = $1', [categoryId]),
      query('SELECT brand_id FROM brands WHERE brand_id = $1', [brandId]),
    ]);

    if (catRes.rows.length === 0) throw APIError.badRequest('Product category does not exist');
    if (brandRes.rows.length === 0) throw APIError.badRequest('Brand does not exist');

    const insertSql = `
      INSERT INTO products (
        distributor_id, category_id, brand_id, variant_name, unit, attributes, unit_price, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING product_id, distributor_id, category_id, brand_id, variant_name, unit, attributes, unit_price, status, created_at;
    `;

    const res = await query(insertSql, [
      currentUser.id, // platform owner
      categoryId,
      brandId,
      variantName,
      unit,
      JSON.stringify(attributes),
      unitPrice,
    ]);

    return res.rows[0];
  }

  /**
   * Update Product in Global Shared Catalog (Platform Owner Only)
   */
  async updateProduct(productId: string, data: any, currentUser: UserContext) {
    if (!currentUser.isPlatformOwner) {
      throw APIError.forbidden('Only the Platform Owner can update catalog products.');
    }

    const existingRes = await query('SELECT product_id FROM products WHERE product_id = $1', [productId]);
    if (existingRes.rows.length === 0) {
      throw APIError.notFound('Product not found in catalog');
    }

    const updates: string[] = [];
    const params: any[] = [productId];

    if (data.variantName !== undefined) {
      params.push(data.variantName);
      updates.push(`variant_name = $${params.length}`);
    }
    if (data.unit !== undefined) {
      params.push(data.unit);
      updates.push(`unit = $${params.length}`);
    }
    if (data.unitPrice !== undefined) {
      params.push(data.unitPrice);
      updates.push(`unit_price = $${params.length}`);
    }
    if (data.attributes !== undefined) {
      params.push(JSON.stringify(data.attributes));
      updates.push(`attributes = $${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(data.status);
      updates.push(`status = $${params.length}`);
    }

    if (updates.length === 0) {
      throw APIError.badRequest('No update fields provided');
    }

    updates.push('updated_at = NOW()');

    const updateSql = `
      UPDATE products 
      SET ${updates.join(', ')} 
      WHERE product_id = $1
      RETURNING product_id, category_id, brand_id, variant_name, unit, attributes, unit_price, status, updated_at;
    `;

    const res = await query(updateSql, params);
    return res.rows[0];
  }

  /**
   * List Products in Global Catalog (Shared across all distributors & dealers)
   */
  async listProducts(queryParams: any) {
    const { page, limit, offset } = getPaginationParams(queryParams);
    const params: any[] = [];

    let countSql = 'SELECT COUNT(*) FROM products p WHERE 1=1';
    let dataSql = `
      SELECT p.product_id, p.category_id, p.brand_id, p.variant_name, p.unit,
             p.attributes, p.unit_price, p.status, p.created_at, p.updated_at,
             c.category_name, c.default_unit, b.brand_name
      FROM products p
      JOIN product_categories c ON p.category_id = c.category_id
      JOIN brands b ON p.brand_id = b.brand_id
      WHERE 1=1
    `;

    if (queryParams.status) {
      params.push(queryParams.status);
      const clause = ` AND p.status = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    } else {
      countSql += " AND p.status = 'active'";
      dataSql += " AND p.status = 'active'";
    }

    if (queryParams.categoryId) {
      params.push(queryParams.categoryId);
      const clause = ` AND p.category_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.brandId) {
      params.push(queryParams.brandId);
      const clause = ` AND p.brand_id = $${params.length}`;
      countSql += clause;
      dataSql += clause;
    }

    if (queryParams.search) {
      params.push(`%${queryParams.search}%`);
      const clause = ` AND (p.variant_name ILIKE $${params.length} OR b.brand_name ILIKE $${params.length} OR c.category_name ILIKE $${params.length})`;
      countSql += clause;
      dataSql += clause;
    }

    dataSql += ` ORDER BY b.brand_name ASC, p.variant_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const total = parseInt(countRes.rows[0].count, 10);
    return {
      products: dataRes.rows,
      pagination: formatPaginationMetadata(total, page, limit),
    };
  }

  /**
   * Get single product by ID
   */
  async getProductById(productId: string) {
    const res = await query(
      `SELECT p.product_id, p.category_id, p.brand_id, p.variant_name, p.unit,
              p.attributes, p.unit_price, p.status, p.created_at, p.updated_at,
              c.category_name, b.brand_name
       FROM products p
       JOIN product_categories c ON p.category_id = c.category_id
       JOIN brands b ON p.brand_id = b.brand_id
       WHERE p.product_id = $1`,
      [productId]
    );

    if (res.rows.length === 0) {
      throw APIError.notFound('Product not found');
    }
    return res.rows[0];
  }
}

export const catalogService = new CatalogService();
export default catalogService;
