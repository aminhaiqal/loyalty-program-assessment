import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { normalizeEmail, validatePassword } from "../validation.js";

try {
  const email = normalizeEmail(process.env.ADMIN_EMAIL, true);
  const password = validatePassword(process.env.ADMIN_PASSWORD);
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE users SET role = 'ADMIN', password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, existing.rows[0].id]
    );
    console.log(`Updated administrator ${email}`);
  } else {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Administrator', $1, $2, 'ADMIN')`,
      [email, passwordHash]
    );
    console.log(`Created administrator ${email}`);
  }
} finally {
  await pool.end();
}
