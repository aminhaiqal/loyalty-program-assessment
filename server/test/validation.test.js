import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, normalizePhone, validatePassword, validateReceiptInput } from "../src/validation.js";

test("normalizes valid contact details", () => {
  assert.equal(normalizeEmail("  Member@Example.COM "), "member@example.com");
  assert.equal(normalizePhone("+60 12-345 6789"), "+60 12-345 6789");
});

test("rejects malformed contact details", () => {
  assert.throws(() => normalizeEmail("not-an-email"), /valid email/);
  assert.throws(() => normalizePhone("abc"), /valid phone/);
});

test("enforces a safe bcrypt password length", () => {
  assert.throws(() => validatePassword("short"), /8 to 72/);
  assert.throws(() => validatePassword("å".repeat(37)), /8 to 72/);
  assert.equal(validatePassword("long-enough"), "long-enough");
});

test("accepts valid receipt input and returns normalized values", () => {
  assert.deepEqual(
    validateReceiptInput({ orderId: "  ORDER-1 ", purchaseDate: "2025-01-15", amount: "10.50" }),
    { orderId: "ORDER-1", purchaseDate: "2025-01-15", amount: "10.50" }
  );
});

test("rejects missing or malformed receipt fields", () => {
  assert.throws(() => validateReceiptInput({ orderId: "", purchaseDate: "2025-01-15", amount: "10" }), /Order ID/);
  assert.throws(() => validateReceiptInput({ orderId: "A", purchaseDate: "2025-02-30", amount: "10" }), /invalid/);
  assert.throws(() => validateReceiptInput({ orderId: "A", purchaseDate: "2999-01-01", amount: "10" }), /future/);
  assert.throws(() => validateReceiptInput({ orderId: "A", purchaseDate: "2025-01-01", amount: "0" }), /positive/);
  assert.throws(() => validateReceiptInput({ orderId: "A", purchaseDate: "2025-01-01", amount: "10.001" }), /two decimal/);
  assert.throws(() => validateReceiptInput({ orderId: "A", purchaseDate: "2025-01-01", amount: "1e2" }), /two decimal/);
});
