import { AppError } from "./errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,28}[0-9]$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

export function optionalText(value, field, maxLength) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const text = String(value).trim();
  if (text.length > maxLength) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be at most ${maxLength} characters`);
  }
  return text;
}

export function normalizeEmail(value, required = false) {
  const email = optionalText(value, "Email", 254);
  if (email === undefined && !required) return undefined;
  if (!email) {
    if (required) throw new AppError(400, "VALIDATION_ERROR", "Email is required");
    return email;
  }
  const normalized = email.toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AppError(400, "VALIDATION_ERROR", "Enter a valid email address");
  }
  return normalized;
}

export function normalizePhone(value) {
  const phone = optionalText(value, "Phone number", 30);
  if (phone === undefined || phone === null) return phone;
  if (!PHONE_PATTERN.test(phone)) {
    throw new AppError(400, "VALIDATION_ERROR", "Enter a valid phone number");
  }
  return phone;
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 8 || Buffer.byteLength(value, "utf8") > 72) {
    throw new AppError(400, "VALIDATION_ERROR", "Password must be 8 to 72 bytes long");
  }
  return value;
}

export function validateReceiptInput({ orderId, purchaseDate, amount }) {
  const cleanOrderId = optionalText(orderId, "Order ID", 100);
  if (!cleanOrderId) throw new AppError(400, "VALIDATION_ERROR", "Order ID is required");

  if (typeof purchaseDate !== "string" || !DATE_PATTERN.test(purchaseDate)) {
    throw new AppError(400, "VALIDATION_ERROR", "Purchase date must use YYYY-MM-DD");
  }
  const date = new Date(`${purchaseDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== purchaseDate) {
    throw new AppError(400, "VALIDATION_ERROR", "Purchase date is invalid");
  }
  const now = new Date();
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  if (purchaseDate > localToday) {
    throw new AppError(400, "VALIDATION_ERROR", "Purchase date cannot be in the future");
  }

  const amountText = String(amount ?? "").trim();
  if (!AMOUNT_PATTERN.test(amountText) || Number(amountText) <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Amount must be positive with at most two decimal places");
  }

  return { orderId: cleanOrderId, purchaseDate, amount: amountText };
}
