const { PAGINATION } = require('../config/constants');

/**
 * Extract and sanitize pagination query parameters
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
const getPaginationParams = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) page = PAGINATION.DEFAULT_PAGE;
  if (isNaN(limit) || limit < 1) limit = PAGINATION.DEFAULT_LIMIT;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Build pagination metadata object
 * @param {number} totalItems 
 * @param {number} page 
 * @param {number} limit 
 * @returns {object}
 */
const formatPaginationMetadata = (totalItems, page, limit) => {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

module.exports = {
  getPaginationParams,
  formatPaginationMetadata,
};
