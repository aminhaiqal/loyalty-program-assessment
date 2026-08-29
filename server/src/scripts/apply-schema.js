import fs from "node:fs/promises";
import { pool } from "../db.js";

try {
  const schema = await fs.readFile(new URL("../../db/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
  console.log("Database schema applied");
} finally {
  await pool.end();
}
