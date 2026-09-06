const { APIError } = require('../errors/apiError');

/**
 * Zod schema validation middleware for Express
 * @param {import('zod').ZodSchema} schema 
 * @param {'body' | 'query' | 'params'} [source='body']
 */
const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err.errors) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(APIError.badRequest('Validation failed', details, 'VALIDATION_ERROR'));
      }
      return next(APIError.badRequest('Invalid request data'));
    }
  };
};

module.exports = {
  validate,
};
