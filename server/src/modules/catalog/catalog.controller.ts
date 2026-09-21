import { Request, Response, NextFunction } from 'express';
import { catalogService } from './catalog.service';
import { APIResponse } from '../../utils/apiResponse';
import { UserContext } from '../../middlewares/auth.middleware';

export class CatalogController {
  async createBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.createBrand(req.body, req.user as UserContext);
      APIResponse.created(res, 'Brand created successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.listBrands();
      APIResponse.success(res, 'Brands retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.createCategory(req.body, req.user as UserContext);
      APIResponse.created(res, 'Product category created successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.listCategories();
      APIResponse.success(res, 'Product categories retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.createProduct(req.body, req.user as UserContext);
      APIResponse.created(res, 'Product created successfully in global catalog', result);
    } catch (err) {
      next(err);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.productId as string;
      const result = await catalogService.updateProduct(productId, req.body, req.user as UserContext);
      APIResponse.success(res, 'Product updated successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.listProducts(req.query);
      APIResponse.paginated(res, 'Products retrieved successfully', result.products, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productId = req.params.productId as string;
      const result = await catalogService.getProductById(productId);
      APIResponse.success(res, 'Product retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }
}

export const catalogController = new CatalogController();
export default catalogController;
