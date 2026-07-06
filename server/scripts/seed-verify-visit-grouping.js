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

const BRANCH_ID = 1;
const SEED_METHOD = "seed_verify";
const DEFAULT_EMPLOYEE_ID = "WTR002";
const DEFAULT_TABLE_FALLBACK = "C6";

function tsMinutesAgo(mins) {
  const d = new Date(Date.now() - mins * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function orderDateFromTs(ts) {
  return ts.slice(0, 10);
}

async function run() {
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

    await conn.beginTransaction();

    const [tableRows] = await conn.execute(
      "SELECT id FROM pos_tables WHERE branch_id = ? ORDER BY id LIMIT 6",
      [BRANCH_ID]
    );
    const tableIds = tableRows.map((r) => String(r.id));
    while (tableIds.length < 6) {
      tableIds.push(`${DEFAULT_TABLE_FALLBACK}-${tableIds.length + 1}`);
    }

    const [userRows] = await conn.execute(
      "SELECT employee_id FROM users WHERE branch_id = ? ORDER BY id LIMIT 1",
      [BRANCH_ID]
    );
    const employeeId = userRows[0]?.employee_id || DEFAULT_EMPLOYEE_ID;

    // Clean previous verify dataset.
    const [oldOrders] = await conn.execute(
      "SELECT id FROM orders WHERE branch_id = ? AND payment_method = ?",
      [BRANCH_ID, SEED_METHOD]
    );
    if (oldOrders.length) {
      const oldIds = oldOrders.map((r) => Number(r.id));
      const placeholders = oldIds.map(() => "?").join(",");
      await conn.execute(`DELETE FROM order_items WHERE order_id IN (${placeholders})`, oldIds);
      await conn.execute(`DELETE FROM orders WHERE id IN (${placeholders})`, oldIds);
    }

    // Scenario pack:
    // 1) Same table mixed paid + pending (classic Juan/Pedro merge bug repro)
    // 2) Same table paid sessions separated by time gap
    // 3) Same table all pending multi-order open tab
    // 4) Separate table fully paid
    // 5) Separate table pending -> paid timeline mix
    // 6) Legacy-like null visit ids to exercise fallback grouping
    const seedOrders = [
      // Scenario 1 (table 0): mixed paid+pending on same visit anchor
      { tag: "S1-JUAN", tableId: tableIds[0], tableVisitId: 900001, status: "paid", subtotal: 450, tax: 0, total: 450, createdMin: 135, updatedMin: 120 },
      { tag: "S1-JUAN", tableId: tableIds[0], tableVisitId: 900001, status: "paid", subtotal: 208, tax: 0, total: 208, createdMin: 132, updatedMin: 118 },
      { tag: "S1-PEDRO", tableId: tableIds[0], tableVisitId: 900001, status: "pending", subtotal: 348, tax: 0, total: 348, createdMin: 28, updatedMin: 28 },
      { tag: "S1-PEDRO", tableId: tableIds[0], tableVisitId: 900001, status: "pending", subtotal: 990, tax: 0, total: 990, createdMin: 18, updatedMin: 18 },

      // Scenario 2 (table 1): all paid, same anchor but clearly separate sessions by time
      { tag: "S2-PAID-A", tableId: tableIds[1], tableVisitId: 900101, status: "paid", subtotal: 600, tax: 0, total: 600, createdMin: 210, updatedMin: 200 },
      { tag: "S2-PAID-A", tableId: tableIds[1], tableVisitId: 900101, status: "paid", subtotal: 380, tax: 0, total: 380, createdMin: 206, updatedMin: 198 },
      { tag: "S2-PAID-B", tableId: tableIds[1], tableVisitId: 900101, status: "paid", subtotal: 500, tax: 0, total: 500, createdMin: 90, updatedMin: 72 },
      { tag: "S2-PAID-B", tableId: tableIds[1], tableVisitId: 900101, status: "paid", subtotal: 420, tax: 0, total: 420, createdMin: 86, updatedMin: 70 },

      // Scenario 3 (table 2): open tab with multiple pending orders
      { tag: "S3-OPEN", tableId: tableIds[2], tableVisitId: 900201, status: "pending", subtotal: 250, tax: 0, total: 250, createdMin: 42, updatedMin: 42 },
      { tag: "S3-OPEN", tableId: tableIds[2], tableVisitId: 900201, status: "pending", subtotal: 180, tax: 0, total: 180, createdMin: 36, updatedMin: 36 },
      { tag: "S3-OPEN", tableId: tableIds[2], tableVisitId: 900201, status: "pending", subtotal: 310, tax: 0, total: 310, createdMin: 30, updatedMin: 30 },

      // Scenario 4 (table 3): separate table paid only
      { tag: "S4-PAID", tableId: tableIds[3], tableVisitId: 900301, status: "paid", subtotal: 720, tax: 0, total: 720, createdMin: 160, updatedMin: 140 },
      { tag: "S4-PAID", tableId: tableIds[3], tableVisitId: 900301, status: "paid", subtotal: 199, tax: 0, total: 199, createdMin: 155, updatedMin: 139 },

      // Scenario 5 (table 4): pending then paid timeline split
      { tag: "S5-OLD-PAID", tableId: tableIds[4], tableVisitId: 900401, status: "paid", subtotal: 390, tax: 0, total: 390, createdMin: 190, updatedMin: 170 },
      { tag: "S5-NEW-PENDING", tableId: tableIds[4], tableVisitId: 900402, status: "pending", subtotal: 275, tax: 0, total: 275, createdMin: 25, updatedMin: 25 },
      { tag: "S5-NEW-PENDING", tableId: tableIds[4], tableVisitId: 900402, status: "pending", subtotal: 310, tax: 0, total: 310, createdMin: 20, updatedMin: 20 },

      // Scenario 6 (table 5): null visit ids to exercise fallback segmentation
      { tag: "S6-LEGACY", tableId: tableIds[5], tableVisitId: null, status: "paid", subtotal: 450, tax: 0, total: 450, createdMin: 300, updatedMin: 280 },
      { tag: "S6-LEGACY", tableId: tableIds[5], tableVisitId: null, status: "paid", subtotal: 180, tax: 0, total: 180, createdMin: 298, updatedMin: 279 },
      { tag: "S6-LEGACY", tableId: tableIds[5], tableVisitId: null, status: "pending", subtotal: 220, tax: 0, total: 220, createdMin: 14, updatedMin: 14 },
    ];

    const insertedRows = [];
    for (const o of seedOrders) {
      const createdAt = tsMinutesAgo(o.createdMin);
      const updatedAt = tsMinutesAgo(o.updatedMin);
      const orderDate = orderDateFromTs(createdAt);
      const [result] = await conn.execute(
        `INSERT INTO orders
          (branch_id, table_id, table_visit_id, status, payment_method, subtotal, discount, tax, total, employee_id, order_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
        [
          BRANCH_ID,
          o.tableId,
          o.tableVisitId,
          o.status,
          SEED_METHOD,
          o.subtotal,
          o.tax,
          o.total,
          employeeId,
          orderDate,
          createdAt,
          updatedAt,
        ]
      );
      insertedRows.push({ id: Number(result.insertId), ...o });
    }

    for (let i = 0; i < insertedRows.length; i++) {
      const row = insertedRows[i];
      await conn.execute(
        `INSERT INTO order_items
          (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, department, sent_to_dept, is_complimentary)
         VALUES (?, NULL, ?, 1, ?, 0, ?, 'Bar', 1, 0)`,
        [row.id, `${row.tag} ITEM`, row.total, row.total]
      );
    }

    // Update occupancy based on pending rows per table.
    for (const tableId of tableIds) {
      const pending = insertedRows
        .filter((r) => r.tableId === tableId && r.status === "pending")
        .sort((a, b) => a.id - b.id);
      await conn.execute(
        "UPDATE pos_tables SET status = ?, current_order_id = ? WHERE branch_id = ? AND id = ?",
        [pending.length ? "occupied" : "available", pending.length ? String(pending[0].id) : null, BRANCH_ID, tableId]
      );
    }

    await conn.commit();

    console.log("[seed-verify-visit-grouping] Seed complete");
    console.log(`Tables used: ${tableIds.join(", ")}`);
    console.log(`Employee: ${employeeId}`);
    console.log(`Total orders: ${insertedRows.length}`);
    console.log(`Order IDs: ${insertedRows.map((r) => r.id).join(", ")}`);
    console.log("Expected in Sales Report:");
    console.log("- S1: Same table mixed paid+pending should split (no merge)");
    console.log("- S2: Same table paid sessions should split by time gap");
    console.log("- S3: Same table multiple pending should stay together");
    console.log("- S4/S5: Other tables grouped independently");
    console.log("- S6: Legacy null visit IDs should still segment correctly");
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("[seed-verify-visit-grouping] Error:", err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
