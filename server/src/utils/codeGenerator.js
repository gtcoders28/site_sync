const crypto = require('crypto');

/**
 * Generate a cryptographically random, uppercase alphanumeric code
 * @param {string} prefix - e.g. 'DIST', 'DLR', 'CUST', 'INF'
 * @param {number} length - Random suffix length (default 6)
 * @returns {string} e.g. 'DIST-7K9W2Q'
 */
const generateUniqueCode = (prefix = 'REF', length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excluding ambiguous 0, O, 1, I
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `${prefix}-${result}`;
};

module.exports = {
  generateUniqueCode,
};
