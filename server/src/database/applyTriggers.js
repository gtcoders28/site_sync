const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function applyTriggers() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'triggers.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Terminal state triggers applied successfully to database!');
  } catch (err) {
    console.error('Failed to apply triggers:', err.message);
  } finally {
    await pool.end();
  }
}

applyTriggers();
