import crypto from "node:crypto";
import { AppError } from "../errors.js";

function voucherCode() {
  return `VCH-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

export async function processReceiptDecision(db, { receiptId, adminId, decision, rejectionReason }) {
  if (!['APPROVE', 'REJECT'].includes(decision)) {
    throw new AppError(400, "VALIDATION_ERROR", "Decision must be APPROVE or REJECT");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id, user_id, status FROM receipts WHERE id = $1 FOR UPDATE`,
      [receiptId]
    );
    const receipt = locked.rows[0];
    if (!receipt) throw new AppError(404, "NOT_FOUND", "Receipt not found");
    if (receipt.status !== "PENDING") {
      throw new AppError(409, "ALREADY_PROCESSED", `Receipt is already ${receipt.status.toLowerCase()}`);
    }

    const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const updated = await client.query(
      `UPDATE receipts
       SET status = $1, processed_at = NOW(), processed_by = $2, rejection_reason = $3
       WHERE id = $4
       RETURNING id, user_id AS "userId", order_id AS "orderId", status,
                 processed_at AS "processedAt", rejection_reason AS "rejectionReason"`,
      [status, adminId, status === "REJECTED" ? rejectionReason || null : null, receiptId]
    );

    let voucher = null;
    if (status === "APPROVED") {
      const inserted = await client.query(
        `INSERT INTO vouchers (user_id, receipt_id, code)
         VALUES ($1, $2, $3)
         RETURNING id, receipt_id AS "receiptId", code, issued_at AS "issuedAt"`,
        [receipt.user_id, receipt.id, voucherCode()]
      );
      voucher = inserted.rows[0];
    }

    await client.query("COMMIT");
    return { receipt: updated.rows[0], voucher };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
