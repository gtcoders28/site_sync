import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool } from '../config/database';

/**
 * Execute a single query with optional parameters
 */
export const query = <R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> => {
  return pool.query<R>(text, params);
};

/**
 * Acquire a dedicated client from the pool
 */
export const getClient = (): Promise<PoolClient> => {
  return pool.connect();
};

/**
 * High-order transaction runner that handles BEGIN, COMMIT, ROLLBACK automatically
 */
export const withTransaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export { pool };

export default {
  pool,
  query,
  getClient,
  withTransaction,
};
