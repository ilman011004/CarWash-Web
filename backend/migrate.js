import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrate() {
  console.log('🔄 Memulai migrasi database PostgreSQL...');
  try {
    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);
    console.log('✅ Migrasi database berhasil dijalankan!');
  } catch (error) {
    console.error('❌ Gagal menjalankan migrasi:', error);
  } finally {
    await pool.end();
  }
}

runMigrate();
