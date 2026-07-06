/**
 * Daily clean on start: wipe Sales, Product, and Void report data so each day
 * starts fresh (no yesterday mixed into today's reports).
 *
 * Clears: orders, order_items, void_log, table_sessions, receipt_snapshots, shifts, etc.
 * RETAINS: products, users (roles, permissions, branches, settings, printers, stock).
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

    console.log("[clean-db] Daily reset: Sales, Product, and Void report tables...");

    // Disable FK checks so we can truncate/delete in any order
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    // Child / line-item tables first, then orders & sessions (Sales + Product + Void reports)
    const tablesToClear = [
      // Product & Sales (line items, payments)
      "order_items",
      "split_payments",
      "receipt_snapshots",
      // Void report
      "void_log",
      // Sales (orders, sessions, transfers)
      "table_transfers",
      "refunds",
      "payment_voids",
      "orders",
      "table_sessions",
      "order_number_sequences",
      // Shift / payroll / ops (same daily window)
      "cash_counts",
      "payment_conversions",
      "charge_transactions",
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

    // Reset AUTO_INCREMENT counters so IDs restart from 1 each day
    const tablesWithAutoInc = [
      "orders",
      "order_items",
      "void_log",
      "table_sessions",
      "receipt_snapshots",
      "shifts",
      "payouts",
      "attendance",
      "audit_logs",
    ];
    for (const tbl of tablesWithAutoInc) {
      try {
        await conn.query(`ALTER TABLE \`${tbl}\` AUTO_INCREMENT = 1`);
        console.log(`[clean-db] Reset AUTO_INCREMENT for ${tbl}`);
      } catch (err) {
        if (err.code !== "ER_NO_SUCH_TABLE") {
          console.warn(`[clean-db] Could not reset AUTO_INCREMENT for ${tbl}: ${err.message}`);
        }
      }
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("[clean-db] Done. Sales, Product, and Void reports start fresh. Products and users retained.");
  } catch (err) {
    console.error("[clean-db] Error:", err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

cleanDb();
