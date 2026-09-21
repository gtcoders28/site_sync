import { Response } from 'express';

/**
 * Standardized API Response structure
 */
export class APIResponse<T = any> {
  public success: boolean;
  public statusCode: number;
  public message: string;
  public data: T | null;
  public metadata?: Record<string, any>;

  constructor(statusCode = 200, message = 'Success', data: T | null = null, metadata?: Record<string, any>) {
    this.success = true;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (metadata) {
      this.metadata = metadata;
    }
  }

  static success<T>(
    res: Response,
    message = 'Operation successful',
    data: T | null = null,
    statusCode = 200,
    metadata?: Record<string, any>
  ): Response {
    return res.status(statusCode).json(new APIResponse(statusCode, message, data, metadata));
  }

  static created<T>(res: Response, message = 'Resource created successfully', data: T | null = null): Response {
    return res.status(201).json(new APIResponse(201, message, data));
  }

  static paginated<T>(
    res: Response,
    message = 'Data retrieved successfully',
    data: T[] = [],
    metadata: Record<string, any> = {}
  ): Response {
    return res.status(200).json(new APIResponse(200, message, data, metadata));
  }
}

export default APIResponse;
