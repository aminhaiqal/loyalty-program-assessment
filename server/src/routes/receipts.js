import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db.js";
import { getConfig } from "../config.js";
import { AppError } from "../errors.js";
import { receiptUpload } from "../upload.js";
import { validateReceiptInput } from "../validation.js";

const { uploadsDir } = getConfig();
export const receiptsRouter = express.Router();

receiptsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, order_id AS "orderId", purchase_date AS "purchaseDate", amount,
            status, submitted_at AS "submittedAt", rejection_reason AS "rejectionReason"
     FROM receipts WHERE user_id = $1 ORDER BY submitted_at DESC`,
    [req.user.id]
  );
  res.json({ receipts: rows });
});

receiptsRouter.post("/", receiptUpload.single("receipt"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, "VALIDATION_ERROR", "Receipt file is required");
    const input = validateReceiptInput(req.body);
    const { rows } = await pool.query(
      `INSERT INTO receipts
         (user_id, order_id, purchase_date, amount, original_file_name, stored_file_name, mime_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, order_id AS "orderId", purchase_date AS "purchaseDate", amount,
                 status, submitted_at AS "submittedAt"`,
      [
        req.user.id,
        input.orderId,
        input.purchaseDate,
        input.amount,
        path.basename(req.file.originalname),
        req.file.filename,
        req.file.mimetype,
        req.file.size
      ]
    );
    res.status(201).json({ receipt: rows[0] });
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    next(error);
  }
});

receiptsRouter.get("/:id/file", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT user_id, original_file_name, stored_file_name FROM receipts WHERE id = $1`,
    [req.params.id]
  );
  const receipt = rows[0];
  if (!receipt) throw new AppError(404, "NOT_FOUND", "Receipt not found");
  if (req.user.role !== "ADMIN" && receipt.user_id !== req.user.id) {
    throw new AppError(403, "FORBIDDEN", "You cannot access this receipt");
  }
  const filePath = path.resolve(uploadsDir, receipt.stored_file_name);
  if (path.dirname(filePath) !== uploadsDir) {
    throw new AppError(404, "NOT_FOUND", "Receipt file not found");
  }
  await fs.access(filePath).catch(() => {
    throw new AppError(404, "NOT_FOUND", "Receipt file not found");
  });
  res.download(filePath, receipt.original_file_name);
});
