import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Securely hash a plaintext password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare plaintext password with hashed password
 */
export const comparePassword = async (plainPassword: string, hashedPassword?: string | null): Promise<boolean> => {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
};

export default {
  hashPassword,
  comparePassword,
};
