import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

export async function applyTriggers(): Promise<void> {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'triggers.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Terminal state triggers applied successfully to database!');
  } catch (err: any) {
    console.error('Failed to apply triggers:', err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  applyTriggers();
}
