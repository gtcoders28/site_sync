import { pool } from '../config/database';

export async function checkSchema(): Promise<void> {
  try {
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('--- PUBLIC TABLES & VIEWS ---');
    console.log(tablesRes.rows.map((r: any) => r.table_name));

    const triggersRes = await pool.query(`
      SELECT event_object_table, trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public';
    `);
    console.log('--- TRIGGERS ---');
    console.log(triggersRes.rows);
  } catch (err) {
    console.error('Error querying schema:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkSchema();
}
