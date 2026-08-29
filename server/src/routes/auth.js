import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { AppError } from "../errors.js";
import { createToken } from "../middleware/auth.js";
import {
  normalizeEmail,
  normalizePhone,
  optionalText,
  validatePassword
} from "../validation.js";

export const authRouter = express.Router();

authRouter.post("/register", async (req, res) => {
  const name = optionalText(req.body.name, "Name", 100) ?? null;
  const email = normalizeEmail(req.body.email) ?? null;
  const phone = normalizePhone(req.body.phone) ?? null;
  const password = validatePassword(req.body.password);
  if (!email && !phone) {
    throw new AppError(400, "VALIDATION_ERROR", "Email or phone number is required");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, phone, role, created_at AS "createdAt"`,
    [name, email, phone, passwordHash]
  );
  const user = rows[0];
  res.status(201).json({ token: createToken(user), user });
});

authRouter.post("/login", async (req, res) => {
  const identifier = optionalText(req.body.identifier, "Email or phone number", 254);
  if (!identifier || typeof req.body.password !== "string") {
    throw new AppError(400, "VALIDATION_ERROR", "Email/phone and password are required");
  }
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, role, password_hash, created_at AS "createdAt"
     FROM users
     WHERE LOWER(email) = LOWER($1) OR phone = $1`,
    [identifier]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid login credentials");
  }
  delete user.password_hash;
  res.json({ token: createToken(user), user });
});

// JWT logout is client-side; this endpoint gives the UI a conventional logout target.
authRouter.post("/logout", (_req, res) => res.status(204).end());
