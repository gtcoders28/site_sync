/**
 * Standardized API Response structure
 */
class APIResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Response message
   * @param {any} [data=null] - Payload data
   * @param {object} [metadata=null] - Pagination / filter metadata
   */
  constructor(statusCode = 200, message = 'Success', data = null, metadata = null) {
    this.success = true;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (metadata) {
      this.metadata = metadata;
    }
  }

  static success(res, message = 'Operation successful', data = null, statusCode = 200, metadata = null) {
    return res.status(statusCode).json(new APIResponse(statusCode, message, data, metadata));
  }

  static created(res, message = 'Resource created successfully', data = null) {
    return res.status(201).json(new APIResponse(201, message, data));
  }

  static paginated(res, message = 'Data retrieved successfully', data = [], metadata = {}) {
    return res.status(200).json(new APIResponse(200, message, data, metadata));
  }
}

module.exports = {
  APIResponse,
};
