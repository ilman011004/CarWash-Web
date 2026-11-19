import bcrypt from 'bcryptjs';
import { pool } from './db.js';

async function resetPassword() {
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@carwash.com']);
  console.log('✅ Password admin berhasil diset ke: admin123');
  await pool.end();
}

resetPassword();
