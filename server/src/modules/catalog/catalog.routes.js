const express = require('express');
const router = express.Router();
const catalogController = require('./catalog.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePlatformOwner } = require('../../middlewares/rbac.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const {
  createBrandSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} = require('./catalog.validator');

// All catalog routes require basic authentication
router.use(authenticate);

// Public/Shared read endpoints
router.get('/brands', catalogController.getBrands);
router.get('/categories', catalogController.getCategories);
router.get('/products', validate(listProductsQuerySchema, 'query'), catalogController.getProducts);
router.get('/products/:productId', catalogController.getProductById);

// Platform Owner ONLY write endpoints
router.post('/brands', requirePlatformOwner, validate(createBrandSchema), catalogController.createBrand);
router.post('/categories', requirePlatformOwner, validate(createCategorySchema), catalogController.createCategory);
router.post('/products', requirePlatformOwner, validate(createProductSchema), catalogController.createProduct);
router.patch('/products/:productId', requirePlatformOwner, validate(updateProductSchema), catalogController.updateProduct);

module.exports = router;
