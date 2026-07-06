/**
 * Drop and recreate the POS database from server/schema.sql.
 * WARNING: Deletes ALL data in DB_DATABASE.
 *
 * Usage (from project root):
 *   node server/scripts/reset-database.js
 *
 * Requires server/.env with DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const {
  DB_HOST = "localhost",
  DB_PORT = 3306,
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_DATABASE = "rabbit_alley_pos",
} = process.env;

const schemaPath = path.join(__dirname, "..", "schema.sql");

async function resetDatabase() {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  let conn;

  try {
    conn = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true,
    });

    console.log(`[reset-db] Dropping database "${DB_DATABASE}" if it exists...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_DATABASE.replace(/`/g, "")}\``);

    console.log(`[reset-db] Applying schema from schema.sql...`);
    await conn.query(schemaSql);

    const [tables] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ?`,
      [DB_DATABASE]
    );
    const tableCount = tables[0]?.c ?? tables[0]?.C ?? 0;
    console.log(`[reset-db] Done. Database "${DB_DATABASE}" recreated with ${tableCount} table(s).`);
    console.log("[reset-db] Default logins: MGR001 / WTR001 / BAR001 — password: password");
  } finally {
    if (conn) await conn.end();
  }
}

resetDatabase().catch((err) => {
  console.error("[reset-db] Failed:", err.message);
  process.exit(1);
});
