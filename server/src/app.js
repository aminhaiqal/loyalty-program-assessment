import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import { getConfig } from "./config.js";
import { AppError } from "./errors.js";
import { authenticate, requireAdmin } from "./middleware/auth.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { receiptsRouter } from "./routes/receipts.js";
import { userRouter } from "./routes/user.js";

const config = getConfig();
export const app = express();

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  version: config.appVersion,
  commit: config.appCommitSha
}));
app.use("/api/auth", authRouter);
app.use("/api/user", authenticate, userRouter);
app.use("/api/receipts", authenticate, receiptsRouter);
app.use("/api/admin", authenticate, requireAdmin, adminRouter);

const distDir = path.resolve("dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && req.accepts("html")) return res.sendFile(path.join(distDir, "index.html"));
    next();
  });
}

app.use((req, _res, next) => next(new AppError(404, "NOT_FOUND", "Route not found")));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Receipt file must be 5 MB or smaller" : "Invalid file upload";
    return res.status(400).json({ error: { code: "INVALID_FILE", message } });
  }
  if (error.code === "23505") {
    const duplicateOrder = error.constraint === "receipts_user_order_unique";
    return res.status(409).json({
      error: {
        code: duplicateOrder ? "DUPLICATE_ORDER" : "DUPLICATE_VALUE",
        message: duplicateOrder ? "A receipt with this order ID already exists" : "Email, phone, or value is already in use"
      }
    });
  }
  if (error.code === "22P02") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid identifier" } });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request body contains invalid JSON" } });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
});
