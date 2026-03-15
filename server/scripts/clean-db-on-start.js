/**
 * Clean database on start: clear orders, occupancy, and transactional data.
 * RETAINS: products, users (and roles, permissions, branches, settings, printers, product_area_prices).
 *
 * Run from project root: node server/scripts/clean-db-on-start.js
 * Or from server: node scripts/clean-db-on-start.js
 */
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

async function cleanDb() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      multipleStatements: true,
    });

    console.log("[clean-db] Cleaning database (keeping products & users)...");

    // Disable FK checks so we can truncate/delete in any order
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    // Clear in dependency order (child tables first, then parent)
    const tablesToClear = [
      "order_items",
      "split_payments",
      "table_transfers",
      "refunds",
      "payment_voids",
      "cash_counts",
      "payment_conversions",
      "charge_transactions",
      "orders",
      "shifts",
      "payouts",
      "attendance",
      "audit_logs",
      "discounts",
    ];

    for (const table of tablesToClear) {
      try {
        await conn.query(`DELETE FROM \`${table}\``);
        console.log(`[clean-db] Cleared ${table}`);
      } catch (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
          console.log(`[clean-db] Skip ${table} (table does not exist)`);
        } else {
          throw err;
        }
      }
    }

    // Reset all pos_tables to available (clear occupied state)
    try {
      const [res] = await conn.query(
        "UPDATE pos_tables SET status = 'available', current_order_id = NULL"
      );
      console.log(`[clean-db] Reset pos_tables (available): ${res.affectedRows} row(s)`);
    } catch (err) {
      if (err.code !== "ER_NO_SUCH_TABLE") throw err;
      console.log("[clean-db] Skip pos_tables (table does not exist)");
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("[clean-db] Done. Products and users retained.");
  } catch (err) {
    console.error("[clean-db] Error:", err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

cleanDb();
