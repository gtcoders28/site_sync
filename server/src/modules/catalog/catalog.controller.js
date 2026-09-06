const catalogService = require('./catalog.service');
const { APIResponse } = require('../../utils/apiResponse');

class CatalogController {
  async createBrand(req, res, next) {
    try {
      const result = await catalogService.createBrand(req.body, req.user);
      return APIResponse.created(res, 'Brand created successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getBrands(req, res, next) {
    try {
      const result = await catalogService.listBrands();
      return APIResponse.success(res, 'Brands retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req, res, next) {
    try {
      const result = await catalogService.createCategory(req.body, req.user);
      return APIResponse.created(res, 'Product category created successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getCategories(req, res, next) {
    try {
      const result = await catalogService.listCategories();
      return APIResponse.success(res, 'Product categories retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async createProduct(req, res, next) {
    try {
      const result = await catalogService.createProduct(req.body, req.user);
      return APIResponse.created(res, 'Product created successfully in global catalog', result);
    } catch (err) {
      next(err);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const { productId } = req.params;
      const result = await catalogService.updateProduct(productId, req.body, req.user);
      return APIResponse.success(res, 'Product updated successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getProducts(req, res, next) {
    try {
      const result = await catalogService.listProducts(req.query);
      return APIResponse.paginated(res, 'Products retrieved successfully', result.products, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getProductById(req, res, next) {
    try {
      const { productId } = req.params;
      const result = await catalogService.getProductById(productId);
      return APIResponse.success(res, 'Product retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CatalogController();
