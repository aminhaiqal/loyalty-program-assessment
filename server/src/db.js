import pg from "pg";
import { getConfig } from "./config.js";

const { Pool } = pg;
const config = getConfig();

export const pool = new Pool({ connectionString: config.databaseUrl });

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
