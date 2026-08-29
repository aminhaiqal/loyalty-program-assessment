import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { getConfig } from "./config.js";
import { AppError } from "./errors.js";

const { uploadsDir } = getConfig();
fs.mkdirSync(uploadsDir, { recursive: true });

const allowed = new Map([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/webp", new Set([".webp"])],
  ["application/pdf", new Set([".pdf"])]
]);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

export const receiptUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extensions = allowed.get(file.mimetype);
    const extension = path.extname(file.originalname).toLowerCase();
    if (!extensions?.has(extension)) {
      return callback(new AppError(400, "INVALID_FILE", "Receipt must be a JPG, PNG, WEBP, or PDF file"));
    }
    callback(null, true);
  }
});
