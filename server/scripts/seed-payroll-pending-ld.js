/**
 * Seed payroll test data: LD drinks on paid AND pending (open) tables.
 *
 * Reproduces the daily-payout scenario where staff go home before the table is paid.
 * After seeding, open Reports → Payroll, pick today's date, and click Compute Payouts.
 *
 * Usage: node server/scripts/seed-payroll-pending-ld.js
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

const BRANCH_ID = 1;
const SEED_METHOD = "seed_payroll";
const LD_UNIT_PRICE = 350;

function tsMinutesAgo(mins) {
  const d = new Date(Date.now() - mins * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function orderDateFromTs(ts) {
  return ts.slice(0, 10);
}

async function insertOrder(conn, { tableId, status, employeeId, createdMin, tableVisitId = null }) {
  const createdAt = tsMinutesAgo(createdMin);
  const orderDate = orderDateFromTs(createdAt);
  const [result] = await conn.execute(
    `INSERT INTO orders
      (branch_id, table_id, table_visit_id, status, payment_method, subtotal, discount, tax, total, employee_id, order_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?)`,
    [BRANCH_ID, tableId, tableVisitId, status, SEED_METHOD, employeeId, orderDate, createdAt, createdAt]
  );
  return { id: Number(result.insertId), tableId, status, orderDate, createdAt };
}

async function insertLdItems(conn, orderId, servedByUserId, qty) {
  const subtotal = LD_UNIT_PRICE * qty;
  await conn.execute(
    `INSERT INTO order_items
      (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, department, sent_to_dept, is_complimentary, served_by)
     VALUES (?, NULL, ?, ?, ?, 0, ?, 'LD', 1, 0, ?)`,
    [orderId, "San Mig Light (seed)", qty, LD_UNIT_PRICE, subtotal, servedByUserId]
  );
  await conn.execute(
    "UPDATE orders SET subtotal = ?, total = ?, updated_at = NOW() WHERE id = ?",
    [subtotal, subtotal, orderId]
  );
  return subtotal;
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

    const today = new Date().toISOString().slice(0, 10);

    // Clean previous payroll seed rows.
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

    const [waiterRows] = await conn.execute(
      "SELECT employee_id FROM users WHERE branch_id = ? AND employee_id LIKE 'WTR%' AND active = 1 ORDER BY id LIMIT 1",
      [BRANCH_ID]
    );
    const waiterEmployeeId = waiterRows[0]?.employee_id || "WTR002";

    const [modelRows] = await conn.execute(
      `SELECT id, employee_id, name, budget, commission_rate, incentive_rate
       FROM users
       WHERE branch_id = ? AND employee_id IN ('MDL002', 'MDL003') AND active = 1
       ORDER BY employee_id`,
      [BRANCH_ID]
    );
    if (modelRows.length < 2) {
      throw new Error("Need MDL002 and MDL003 in users table. Run server/schema.sql seed first.");
    }

    const caryl = modelRows.find((r) => r.employee_id === "MDL002") || modelRows[0];
    const allyson = modelRows.find((r) => r.employee_id === "MDL003") || modelRows[1];

    // Ensure test rates for predictable payroll math.
    await conn.execute(
      `UPDATE users SET budget = 1500, commission_rate = 100, incentive_rate = 100 WHERE id IN (?, ?)`,
      [caryl.id, allyson.id]
    );

    const [tableRows] = await conn.execute(
      "SELECT id FROM pos_tables WHERE branch_id = ? AND area IN ('Club','LD','Lounge') ORDER BY id LIMIT 4",
      [BRANCH_ID]
    );
    const tableIds = tableRows.map((r) => String(r.id));
    while (tableIds.length < 4) tableIds.push("LD1");

    /**
     * Scenario A — CARYL (Bianca): 18 LD all on OPEN (pending) tables, staff sent home early.
     * Tables LD1/LD2/LD3 with 8 + 6 + 4 drinks.
     */
    const carylPendingOrders = [
      { tableId: tableIds[0], qty: 8, createdMin: 45, visitId: 910001 },
      { tableId: tableIds[1], qty: 6, createdMin: 38, visitId: 910002 },
      { tableId: tableIds[2], qty: 4, createdMin: 30, visitId: 910003 },
    ];

    let carylTotalLd = 0;
    for (const o of carylPendingOrders) {
      const order = await insertOrder(conn, {
        tableId: o.tableId,
        status: "pending",
        employeeId: waiterEmployeeId,
        createdMin: o.createdMin,
        tableVisitId: o.visitId,
      });
      carylTotalLd += o.qty;
      await insertLdItems(conn, order.id, caryl.id, o.qty);
    }

    /**
     * Scenario B — ALLISON (Clarisse): 5 paid + 5 pending LD (mixed shift).
     */
    const paidOrder = await insertOrder(conn, {
      tableId: tableIds[3],
      status: "paid",
      employeeId: waiterEmployeeId,
      createdMin: 120,
      tableVisitId: 910101,
    });
    await insertLdItems(conn, paidOrder.id, allyson.id, 5);

    const pendingOrder = await insertOrder(conn, {
      tableId: tableIds[3],
      status: "pending",
      employeeId: waiterEmployeeId,
      createdMin: 22,
      tableVisitId: 910102,
    });
    await insertLdItems(conn, pendingOrder.id, allyson.id, 5);

    const allysonTotalLd = 10;
    const branchTotalLd = carylTotalLd + allysonTotalLd;

    // Mark tables with pending tabs as occupied.
    for (const tableId of [...new Set(carylPendingOrders.map((o) => o.tableId).concat(tableIds[3]))]) {
      const [pendingOnTable] = await conn.execute(
        "SELECT id FROM orders WHERE branch_id = ? AND table_id = ? AND status = 'pending' AND voided_at IS NULL ORDER BY id LIMIT 1",
        [BRANCH_ID, tableId]
      ).catch(async () => {
        const [rows] = await conn.execute(
          "SELECT id FROM orders WHERE branch_id = ? AND table_id = ? AND status = 'pending' ORDER BY id LIMIT 1",
          [BRANCH_ID, tableId]
        );
        return [rows];
      });
      await conn.execute(
        "UPDATE pos_tables SET status = ?, current_order_id = ? WHERE branch_id = ? AND id = ?",
        [
          pendingOnTable.length ? "occupied" : "available",
          pendingOnTable.length ? String(pendingOnTable[0].id) : null,
          BRANCH_ID,
          tableId,
        ]
      );
    }

    await conn.commit();

    console.log("[seed-payroll-pending-ld] Seed complete");
    console.log(`Date: ${today}`);
    console.log(`Waiter (order opener): ${waiterEmployeeId}`);
    console.log("");
    console.log(`${caryl.name} (${caryl.employee_id}) — ${carylTotalLd} LD, ALL pending (open tables):`);
    for (const o of carylPendingOrders) {
      console.log(`  Table ${o.tableId}: ${o.qty} LD (pending)`);
    }
    console.log(`  Expected commission: ${carylTotalLd} × 100 = ₱${(carylTotalLd * 100).toLocaleString()}`);
    console.log(`  Expected incentive: ${branchTotalLd} × 100 = ₱${(branchTotalLd * 100).toLocaleString()}`);
    console.log("");
    console.log(`${allyson.name} (${allyson.employee_id}) — ${allysonTotalLd} LD (5 paid + 5 pending):`);
    console.log(`  Table ${tableIds[3]}: 5 paid + 5 pending`);
    console.log(`  Expected commission: ${allysonTotalLd} × 100 = ₱${(allysonTotalLd * 100).toLocaleString()}`);
    console.log(`  Expected incentive: ${branchTotalLd} × 100 = ₱${(branchTotalLd * 100).toLocaleString()}`);
    console.log("");
    console.log(`Branch total LD (paid + pending): ${branchTotalLd}`);
    console.log("");
    console.log("Next steps:");
    console.log("1. Reports → Payroll → set From/To to today");
    console.log("2. Click Compute Payouts");
    console.log("3. Click employee name to verify LD-by-table includes pending tables");
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("[seed-payroll-pending-ld] Error:", err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
