import test from "node:test";
import assert from "node:assert/strict";
import { processReceiptDecision } from "../src/services/receipt-decision.js";

class FakeClient {
  constructor(receipt) {
    this.receipt = receipt;
    this.vouchers = [];
    this.commands = [];
  }

  async query(sql, params = []) {
    this.commands.push(sql.trim());
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("SELECT id, user_id, status")) return { rows: this.receipt ? [{ ...this.receipt }] : [] };
    if (sql.includes("UPDATE receipts")) {
      this.receipt.status = params[0];
      return {
        rows: [{
          id: this.receipt.id,
          userId: this.receipt.user_id,
          orderId: "ORDER-1",
          status: params[0],
          processedAt: new Date(),
          rejectionReason: params[2]
        }]
      };
    }
    if (sql.includes("INSERT INTO vouchers")) {
      const voucher = { id: "voucher-1", receiptId: params[1], code: params[2], issuedAt: new Date() };
      this.vouchers.push(voucher);
      return { rows: [voucher] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }

  release() {}
}

function fakeDb(receipt = { id: "receipt-1", user_id: "user-1", status: "PENDING" }) {
  const client = new FakeClient(receipt);
  return { client, connect: async () => client };
}

test("approving a pending receipt updates it and creates one voucher in a transaction", async () => {
  const db = fakeDb();
  const result = await processReceiptDecision(db, {
    receiptId: "receipt-1", adminId: "admin-1", decision: "APPROVE"
  });

  assert.equal(result.receipt.status, "APPROVED");
  assert.match(result.voucher.code, /^VCH-[A-F0-9]{24}$/);
  assert.equal(db.client.vouchers.length, 1);
  assert.ok(db.client.commands.some((sql) => sql.includes("FOR UPDATE")));
  assert.equal(db.client.commands.at(0), "BEGIN");
  assert.equal(db.client.commands.at(-1), "COMMIT");
});

test("repeating approval is rejected and cannot create a second voucher", async () => {
  const db = fakeDb();
  await processReceiptDecision(db, {
    receiptId: "receipt-1", adminId: "admin-1", decision: "APPROVE"
  });

  await assert.rejects(
    processReceiptDecision(db, {
      receiptId: "receipt-1", adminId: "admin-1", decision: "APPROVE"
    }),
    (error) => error.status === 409 && error.code === "ALREADY_PROCESSED"
  );
  assert.equal(db.client.vouchers.length, 1);
  assert.equal(db.client.commands.at(-1), "ROLLBACK");
});

test("rejecting a pending receipt creates no voucher", async () => {
  const db = fakeDb();
  const result = await processReceiptDecision(db, {
    receiptId: "receipt-1", adminId: "admin-1", decision: "REJECT", rejectionReason: "Unreadable"
  });
  assert.equal(result.receipt.status, "REJECTED");
  assert.equal(result.receipt.rejectionReason, "Unreadable");
  assert.equal(result.voucher, null);
  assert.equal(db.client.vouchers.length, 0);
});

test("missing receipts and invalid decisions return controlled errors", async () => {
  const missingDb = fakeDb(null);
  await assert.rejects(
    processReceiptDecision(missingDb, {
      receiptId: "missing", adminId: "admin-1", decision: "APPROVE"
    }),
    (error) => error.status === 404 && error.code === "NOT_FOUND"
  );
  assert.equal(missingDb.client.commands.at(-1), "ROLLBACK");

  let connected = false;
  await assert.rejects(
    processReceiptDecision({ connect: async () => { connected = true; } }, {
      receiptId: "receipt-1", adminId: "admin-1", decision: "MAYBE"
    }),
    (error) => error.status === 400 && error.code === "VALIDATION_ERROR"
  );
  assert.equal(connected, false);
});
