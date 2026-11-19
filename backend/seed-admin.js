import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
await pool.query(
  `INSERT INTO users (name, email, password_hash, role)
   VALUES ('Admin', $1, $2, 'admin')
   ON CONFLICT (email) DO NOTHING`,
  [process.env.ADMIN_EMAIL, hash]
);
console.log('Akun admin siap');
await pool.end();