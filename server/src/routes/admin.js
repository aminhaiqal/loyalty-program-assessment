import express from "express";
import { pool } from "../db.js";
import { AppError } from "../errors.js";
import { processReceiptDecision } from "../services/receipt-decision.js";
import { optionalText } from "../validation.js";

export const adminRouter = express.Router();

const receiptSelect = `
  SELECT r.id, r.order_id AS "orderId", r.purchase_date AS "purchaseDate", r.amount,
         r.status, r.submitted_at AS "submittedAt", r.processed_at AS "processedAt",
         r.rejection_reason AS "rejectionReason", r.original_file_name AS "fileName",
         u.id AS "userId", u.name AS "userName", u.email AS "userEmail", u.phone AS "userPhone"
  FROM receipts r JOIN users u ON u.id = r.user_id`;

adminRouter.get("/dashboard", async (_req, res) => {
  const [receipts, vouchers] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
              COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
              COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected
       FROM receipts`
    ),
    pool.query(`SELECT COUNT(*)::int AS issued FROM vouchers`)
  ]);
  res.json({
    pendingReceipts: receipts.rows[0].pending,
    approvedReceipts: receipts.rows[0].approved,
    rejectedReceipts: receipts.rows[0].rejected,
    vouchersIssued: vouchers.rows[0].issued
  });
});

adminRouter.get("/receipts", async (req, res) => {
  const status = req.query.status?.toUpperCase();
  if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid receipt status");
  }
  const { rows } = await pool.query(
    `${receiptSelect} ${status ? "WHERE r.status = $1" : ""} ORDER BY r.submitted_at DESC`,
    status ? [status] : []
  );
  res.json({ receipts: rows });
});

adminRouter.get("/receipts/:id", async (req, res) => {
  const { rows } = await pool.query(`${receiptSelect} WHERE r.id = $1`, [req.params.id]);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Receipt not found");
  res.json({ receipt: rows[0] });
});

adminRouter.patch("/receipts/:id/decision", async (req, res) => {
  const decision = typeof req.body.decision === "string" ? req.body.decision.toUpperCase() : "";
  const rejectionReason = optionalText(req.body.rejectionReason, "Rejection reason", 500);
  const result = await processReceiptDecision(pool, {
    receiptId: req.params.id,
    adminId: req.user.id,
    decision,
    rejectionReason
  });
  res.json(result);
});
