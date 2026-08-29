import { app } from "./app.js";
import { pool } from "./db.js";
import { getConfig } from "./config.js";

const { port } = getConfig();
const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
