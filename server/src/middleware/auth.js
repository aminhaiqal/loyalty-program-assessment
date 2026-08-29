import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { getConfig } from "../config.js";
import { AppError } from "../errors.js";

const config = getConfig();

export function createToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: "8h" });
}

export async function authenticate(req, _res, next) {
  try {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
    }
    let payload;
    try {
      payload = jwt.verify(header.slice(7), config.jwtSecret);
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "Session is invalid or expired");
    }
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, role, created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (!rows[0]) throw new AppError(401, "UNAUTHENTICATED", "Account no longer exists");
    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user.role !== "ADMIN") {
    return next(new AppError(403, "FORBIDDEN", "Administrator access is required"));
  }
  next();
}
