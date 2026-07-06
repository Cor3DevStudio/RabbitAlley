/**
 * Backfill table_sessions + orders.session_id from table_visit_id / legacy heuristics.
 *
 * Usage (from server/):
 *   node scripts/migrate-table-sessions.js
 *   node scripts/migrate-table-sessions.js --branch=1
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { migrateLegacySessions, ensureTableSessionsSchema } from "../lib/tableSessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const {
  DB_HOST = "localhost",
  DB_PORT = 3306,
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_DATABASE = "rabbit_alley_pos",
} = process.env;

const branchArg = process.argv.find((a) => a.startsWith("--branch="));
const branchId = branchArg ? Number(branchArg.split("=")[1]) : null;

async function main() {
  const db = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
  });
  try {
    await ensureTableSessionsSchema(db);
    const result = await migrateLegacySessions(db, {
      branchId: Number.isFinite(branchId) ? branchId : null,
    });
    console.log("[migrate-table-sessions]", result);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
