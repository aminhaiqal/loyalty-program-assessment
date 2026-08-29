import express from "express";
import { pool } from "../db.js";
import { AppError } from "../errors.js";
import { normalizeEmail, normalizePhone, optionalText } from "../validation.js";

export const userRouter = express.Router();

userRouter.get("/profile", (req, res) => res.json({ user: req.user }));

userRouter.put("/profile", async (req, res) => {
  const name = optionalText(req.body.name, "Name", 100);
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(req.body.phone);

  const next = {
    name: name === undefined ? req.user.name : name,
    email: email === undefined ? req.user.email : email,
    phone: phone === undefined ? req.user.phone : phone
  };
  if (!next.email && !next.phone) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one email or phone number is required");
  }

  const { rows } = await pool.query(
    `UPDATE users SET name = $1, email = $2, phone = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, email, phone, role, created_at AS "createdAt"`,
    [next.name, next.email, next.phone, req.user.id]
  );
  res.json({ user: rows[0] });
});

userRouter.get("/dashboard", async (req, res) => {
  const [receipts, vouchers] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved
       FROM receipts WHERE user_id = $1`,
      [req.user.id]
    ),
    pool.query(`SELECT COUNT(*)::int AS available FROM vouchers WHERE user_id = $1`, [req.user.id])
  ]);
  res.json({
    name: req.user.name || req.user.email || req.user.phone,
    pendingReceipts: receipts.rows[0].pending,
    approvedReceipts: receipts.rows[0].approved,
    availableVouchers: vouchers.rows[0].available
  });
});

userRouter.get("/vouchers", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.id, v.code, v.issued_at AS "issuedAt", v.receipt_id AS "receiptId",
            r.order_id AS "orderId", r.purchase_date AS "purchaseDate", r.amount
     FROM vouchers v
     JOIN receipts r ON r.id = v.receipt_id
     WHERE v.user_id = $1
     ORDER BY v.issued_at DESC`,
    [req.user.id]
  );
  res.json({ vouchers: rows });
});
