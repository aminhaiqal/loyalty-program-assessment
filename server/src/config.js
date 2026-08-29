import "dotenv/config";
import path from "node:path";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getConfig() {
  const jwtSecret = required("JWT_SECRET");
  if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error("JWT_SECRET must be at least 32 bytes long");
  }
  return {
    databaseUrl: required("DATABASE_URL"),
    jwtSecret,
    port: Number(process.env.PORT || 3000),
    clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    uploadsDir: path.resolve(process.env.UPLOAD_DIR || "uploads")
  };
}
