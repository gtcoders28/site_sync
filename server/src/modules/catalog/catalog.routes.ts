import { Router } from 'express';
import { catalogController } from './catalog.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePlatformOwner } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createBrandSchema,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from './catalog.validator';

const router = Router();

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

export default router;
