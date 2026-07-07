/**
 * Comprehensive verification seed: Orders, Payrolls, Voids, commissions & incentives.
 *
 * Scenarios:
 *  - Payroll: LD drinks on paid + pending tables (staff sent home before tab closes)
 *  - Payroll: voided LD lines excluded from commission/incentive totals
 *  - Orders: mixed Bar / Kitchen / LD on paid and pending tabs
 *  - Voids: item void (pending), item void (paid), full order void, void_log audit rows
 *  - Tables: full pos_tables floor plan + table_sessions linked to every order
 *  - Payouts: pre-seeded with commission, incentives, manual bonuses, adjustments, deductions
 *
 * Usage: node server/scripts/seed-verify-all.js
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
const SEED_METHOD = "seed_verify_all";
const LD_UNIT_PRICE = 350;
const BAR_UNIT_PRICE = 180;

function tsMinutesAgo(mins) {
  const d = new Date(Date.now() - mins * 60 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function orderDateFromTs(ts) {
  return ts.slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Seven manual incentive lines per employee — for payslip receipt print/cut testing. */
function buildSevenIncentives(nickname) {
  return [
    { title: `${nickname} — table target bonus`, amount: 100 },
    { title: `${nickname} — VIP guest bonus`, amount: 150 },
    { title: `${nickname} — weekend shift bonus`, amount: 200 },
    { title: `${nickname} — referral bonus`, amount: 75 },
    { title: `${nickname} — attendance bonus`, amount: 50 },
    { title: `${nickname} — sales milestone`, amount: 125 },
    { title: `${nickname} — manager discretion`, amount: 100 },
  ];
}

function sumBreakdown(items) {
  return (items || []).reduce((s, x) => s + Number(x.amount || 0), 0);
}

const DEFAULT_PASSWORD_HASH = "$2b$10$B4oc/jK4Bx5OBvUzeDu7Berro8sqOpPnCKkigopy0Eg2FF3FGmKSG";

async function ensureReferenceData(conn) {
  await conn.execute(
    `INSERT IGNORE INTO branches (id, name, code) VALUES (1, 'Rabbit Alley', 'RA')`
  ).catch(() => {});

  await conn.execute(
    `INSERT IGNORE INTO roles (id, name, guard) VALUES
      (1, 'Administrator', 'web'),
      (2, 'Staff', 'web'),
      (3, 'Operations Staff', 'web')`
  ).catch(() => {});

  const tables = [
    ["L1", "L1", "Lounge"],
    ["L2", "L2", "Lounge"],
    ["L3", "L3", "Lounge"],
    ["L4", "L4", "Lounge"],
    ["L5", "L5", "Lounge"],
    ["L6", "L6", "Lounge"],
    ["C1", "C1", "Club"],
    ["C2", "C2", "Club"],
    ["C3", "C3", "Club"],
    ["C4", "C4", "Club"],
    ["C5", "C5", "Club"],
    ["C6", "C6", "Club"],
    ["C7", "C7", "Club"],
    ["C8", "C8", "Club"],
    ["LD1", "LD1", "LD"],
    ["LD2", "LD2", "LD"],
    ["LD3", "LD3", "LD"],
    ["LD4", "LD4", "LD"],
  ];
  for (const [id, name, area] of tables) {
    await conn.execute(
      `INSERT IGNORE INTO pos_tables (branch_id, id, name, area, status) VALUES (?, ?, ?, ?, 'available')`,
      [BRANCH_ID, id, name, area]
    );
  }

  const ldStaff = [
    ["MDL001", "Angelica Santos", "angelica@rabbitalley.local", "Angel"],
    ["MDL002", "Bianca Reyes", "bianca@rabbitalley.local", "Bianca"],
    ["MDL003", "Clarisse Dela Cruz", "clarisse@rabbitalley.local", "Cla"],
  ];
  for (const [employeeId, name, email, nickname] of ldStaff) {
    const [existing] = await conn.execute("SELECT id FROM users WHERE employee_id = ?", [employeeId]);
    if (!existing.length) {
      await conn.execute(
        `INSERT INTO users (employee_id, name, email, password_hash, role_id, branch_id, nickname, allowance, hourly, active)
         VALUES (?, ?, ?, ?, 2, ?, ?, 300, 0, 1)`,
        [employeeId, name, email, DEFAULT_PASSWORD_HASH, BRANCH_ID, nickname]
      );
    }
  }

  const [ldCount] = await conn.execute("SELECT COUNT(*) AS c FROM products WHERE department = 'LD'");
  if (Number(ldCount[0]?.c || 0) === 0) {
    await conn.execute(
      `INSERT INTO products (sku, name, description, category, department, price, cost, commission, status) VALUES
        ('LD-001', 'San Mig Light', 'Ladies Drink', 'Ladies Drink', 'LD', 350, 150, 50, 'active'),
        ('LD-002', 'San Mig Pale Pilsen', 'Ladies Drink', 'Ladies Drink', 'LD', 350, 150, 50, 'active')`
    );
  }

  const [barCount] = await conn.execute("SELECT COUNT(*) AS c FROM products WHERE department = 'Bar'");
  if (Number(barCount[0]?.c || 0) === 0) {
    await conn.execute(
      `INSERT INTO products (sku, name, description, category, department, price, cost, commission, status) VALUES
        ('BAR-001', 'San Mig Light', 'Beer', 'Beer', 'Bar', 180, 80, 0, 'active')`
    );
  }

  const [kitCount] = await conn.execute("SELECT COUNT(*) AS c FROM products WHERE department = 'Kitchen'");
  if (Number(kitCount[0]?.c || 0) === 0) {
    await conn.execute(
      `INSERT INTO products (sku, name, description, category, department, price, cost, commission, status) VALUES
        ('KIT-001', 'French Fries', 'Sides', 'Sides', 'Kitchen', 120, 40, 0, 'active')`
    );
  }
}

async function ensureTableSessionsSchema(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS table_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      branch_id INT UNSIGNED NOT NULL DEFAULT 1,
      table_id VARCHAR(16) NOT NULL,
      waiter_id VARCHAR(32) DEFAULT NULL,
      opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL DEFAULT NULL,
      status ENUM('open','closed') NOT NULL DEFAULT 'open',
      closed_by VARCHAR(128) DEFAULT NULL,
      migrated_legacy TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_table_sessions_branch_table (branch_id, table_id, status)
    )
  `).catch(() => {});
  await conn.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id BIGINT UNSIGNED DEFAULT NULL").catch(() => {});
}

async function resetAllTablesAvailable(conn) {
  await conn.execute(
    "UPDATE pos_tables SET status = 'available', current_order_id = NULL WHERE branch_id = ?",
    [BRANCH_ID]
  );
}

async function openTableSession(conn, { tableId, waiterId, openedMin }) {
  const openedAt = tsMinutesAgo(openedMin);
  const [result] = await conn.execute(
    `INSERT INTO table_sessions (branch_id, table_id, waiter_id, opened_at, status, migrated_legacy)
     VALUES (?, ?, ?, ?, 'open', 0)`,
    [BRANCH_ID, tableId, waiterId, openedAt]
  );
  return Number(result.insertId);
}

async function closeTableSession(conn, sessionId, { closedMin, closedBy = "seed" }) {
  await conn.execute(
    `UPDATE table_sessions SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ?`,
    [tsMinutesAgo(closedMin), closedBy, sessionId]
  );
}

async function linkOrderToSession(conn, orderId, sessionId, visitAnchor) {
  const anchor = visitAnchor ?? orderId;
  try {
    await conn.execute("UPDATE orders SET session_id = ?, table_visit_id = ? WHERE id = ?", [
      sessionId,
      anchor,
      orderId,
    ]);
  } catch (e) {
    if (e.code === "ER_BAD_FIELD_ERROR") {
      await conn.execute("UPDATE orders SET table_visit_id = ? WHERE id = ?", [anchor, orderId]).catch(() => {});
    } else {
      throw e;
    }
  }
  return anchor;
}

async function syncPosTablesFromOrders(conn) {
  const [allTables] = await conn.execute(
    "SELECT id FROM pos_tables WHERE branch_id = ? ORDER BY id",
    [BRANCH_ID]
  );
  for (const row of allTables) {
    const tableId = String(row.id);
    const [pendingOnTable] = await conn.execute(
      `SELECT id FROM orders
       WHERE branch_id = ? AND table_id = ? AND status = 'pending' AND voided_at IS NULL
       ORDER BY id LIMIT 1`,
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
}

async function cleanPreviousSeed(conn) {
  const [oldOrders] = await conn.execute(
    "SELECT id, table_id, session_id FROM orders WHERE branch_id = ? AND payment_method = ?",
    [BRANCH_ID, SEED_METHOD]
  );
  if (!oldOrders.length) return;

  const oldIds = oldOrders.map((r) => Number(r.id));
  const placeholders = oldIds.map(() => "?").join(",");
  const sessionIds = [...new Set(oldOrders.map((r) => r.session_id).filter(Boolean))];

  await conn.execute(`DELETE FROM void_log WHERE order_id IN (${placeholders})`, oldIds).catch(() => {});
  await conn.execute(`DELETE FROM payment_voids WHERE order_id IN (${placeholders})`, oldIds).catch(() => {});
  await conn.execute(`DELETE FROM order_items WHERE order_id IN (${placeholders})`, oldIds);
  await conn.execute(`DELETE FROM orders WHERE id IN (${placeholders})`, oldIds);

  if (sessionIds.length) {
    const sPlaceholders = sessionIds.map(() => "?").join(",");
    await conn.execute(`DELETE FROM table_sessions WHERE id IN (${sPlaceholders})`, sessionIds).catch(() => {});
  }

  // Wipe leftover sessions so floor state matches seed orders only
  await conn.execute("DELETE FROM table_sessions WHERE branch_id = ?", [BRANCH_ID]).catch(() => {});
}

async function insertOrder(conn, {
  tableId,
  status,
  employeeId,
  createdMin,
  tableVisitId = null,
  sessionId = null,
  subtotal = 0,
  total = 0,
}) {
  const createdAt = tsMinutesAgo(createdMin);
  const orderDate = orderDateFromTs(createdAt);
  let result;
  try {
    [result] = await conn.execute(
      `INSERT INTO orders
        (branch_id, table_id, table_visit_id, session_id, status, payment_method, subtotal, discount, tax, total, employee_id, order_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
      [
        BRANCH_ID,
        tableId,
        tableVisitId,
        sessionId,
        status,
        SEED_METHOD,
        subtotal,
        total,
        employeeId,
        orderDate,
        createdAt,
        createdAt,
      ]
    );
  } catch (e) {
    if (e.code !== "ER_BAD_FIELD_ERROR") throw e;
    [result] = await conn.execute(
      `INSERT INTO orders
        (branch_id, table_id, table_visit_id, status, payment_method, subtotal, discount, tax, total, employee_id, order_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
      [BRANCH_ID, tableId, tableVisitId, status, SEED_METHOD, subtotal, total, employeeId, orderDate, createdAt, createdAt]
    );
  }
  return { id: Number(result.insertId), tableId, status, orderDate, createdAt };
}

async function insertItem(conn, {
  orderId,
  productId,
  productSku,
  productName,
  qty,
  unitPrice,
  department,
  servedBy = null,
  isVoided = false,
  voidedBy = null,
  voidedByName = null,
  voidedAt = null,
}) {
  const subtotal = unitPrice * qty;
  const [result] = await conn.execute(
    `INSERT INTO order_items
      (order_id, product_id, product_sku, product_name, quantity, unit_price, discount, subtotal,
       department, sent_to_dept, is_complimentary, served_by,
       is_voided, voided_by, voided_at, voided_by_name)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 1, 0, ?, ?, ?, ?, ?)`,
    [
      orderId,
      productId,
      productSku,
      productName,
      qty,
      unitPrice,
      subtotal,
      department,
      servedBy,
      isVoided ? 1 : 0,
      voidedBy,
      voidedAt,
      voidedByName,
    ]
  );
  return { id: Number(result.insertId), subtotal, qty, productName, unitPrice, isVoided };
}

async function updateOrderTotals(conn, orderId) {
  const [rows] = await conn.execute(
    `SELECT COALESCE(SUM(CASE WHEN COALESCE(is_voided, 0) = 0 THEN subtotal ELSE 0 END), 0) AS subtotal
     FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  const subtotal = Number(rows[0]?.subtotal || 0);
  await conn.execute("UPDATE orders SET subtotal = ?, total = ?, updated_at = NOW() WHERE id = ?", [
    subtotal,
    subtotal,
    orderId,
  ]);
  return subtotal;
}

async function insertVoidLog(conn, {
  orderId,
  orderItemId,
  productId,
  productSku,
  productName,
  qty,
  unitPrice,
  amount,
  tableId,
  voidType,
  voidedBy,
  voidedByName,
  voidedByEmployeeId,
  voidedAt,
  reason,
}) {
  await conn.execute(
    `INSERT INTO void_log
      (branch_id, void_type, order_id, order_item_id, product_id, product_sku, product_name,
       quantity, unit_price, amount, table_id,
       voided_by, voided_by_name, voided_by_employee_id, voided_at, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      BRANCH_ID,
      voidType,
      orderId,
      orderItemId,
      productId,
      productSku,
      productName,
      qty,
      unitPrice,
      amount,
      tableId,
      voidedBy,
      voidedByName,
      voidedByEmployeeId,
      voidedAt,
      reason,
    ]
  );
}

async function upsertPayout(conn, {
  userId,
  periodFrom,
  periodTo,
  allowance,
  commission,
  incentives,
  incentivesBreakdown,
  adjustments,
  adjustmentsBreakdown,
  deductions,
  deductionsBreakdown,
  status,
}) {
  const breakdownSum = (incentivesBreakdown || []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const total = allowance + commission + incentives + breakdownSum + adjustments - deductions;

  const [existing] = await conn.execute(
    "SELECT id FROM payouts WHERE user_id = ? AND period_from = ? AND period_to = ?",
    [userId, periodFrom, periodTo]
  );

  const params = [
    allowance,
    0,
    commission,
    incentives,
    JSON.stringify(incentivesBreakdown || []),
    adjustments,
    JSON.stringify(adjustmentsBreakdown || []),
    deductions,
    JSON.stringify(deductionsBreakdown || []),
    total,
    status,
  ];

  if (existing.length) {
    await conn.execute(
      `UPDATE payouts SET allowance = ?, hours = ?, commission = ?, incentives = ?,
         incentives_breakdown = ?, adjustments = ?, adjustments_breakdown = ?,
         deductions = ?, deductions_breakdown = ?, total = ?, status = ?
       WHERE id = ?`,
      [...params, existing[0].id]
    );
  } else {
    await conn.execute(
      `INSERT INTO payouts
        (user_id, period_from, period_to, allowance, hours, commission, incentives,
         incentives_breakdown, adjustments, adjustments_breakdown, deductions, deductions_breakdown, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, periodFrom, periodTo, ...params]
    );
  }
  return total;
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

    const periodDate = today();
    await ensureReferenceData(conn);
    await ensureTableSessionsSchema(conn);
    await cleanPreviousSeed(conn);
    await resetAllTablesAvailable(conn);

    const [waiterRows] = await conn.execute(
      "SELECT id, employee_id, name FROM users WHERE branch_id = ? AND employee_id LIKE 'WTR%' AND active = 1 ORDER BY id LIMIT 1",
      [BRANCH_ID]
    );
    const waiter = waiterRows[0] || { id: null, employee_id: "WTR002", name: "Waiter" };

    const [mgrRows] = await conn.execute(
      "SELECT id, employee_id, name FROM users WHERE branch_id = ? AND employee_id = 'MGR001' AND active = 1 LIMIT 1",
      [BRANCH_ID]
    );
    const manager = mgrRows[0] || { id: 1, employee_id: "MGR001", name: "Manager" };

    const [modelRows] = await conn.execute(
      `SELECT id, employee_id, name, budget, commission_rate, incentive_rate
       FROM users
       WHERE branch_id = ? AND employee_id IN ('MDL001', 'MDL002', 'MDL003') AND active = 1
       ORDER BY employee_id`,
      [BRANCH_ID]
    );
    if (modelRows.length < 3) {
      throw new Error("Need MDL001, MDL002, MDL003 in users table. Run server/schema.sql seed first.");
    }

    const angel = modelRows.find((r) => r.employee_id === "MDL001");
    const bianca = modelRows.find((r) => r.employee_id === "MDL002");
    const clarisse = modelRows.find((r) => r.employee_id === "MDL003");

    await conn.execute(
      `UPDATE users SET budget = 1500, commission_rate = 100, incentive_rate = 100
       WHERE id IN (?, ?, ?)`,
      [angel.id, bianca.id, clarisse.id]
    );

    const [ldProducts] = await conn.execute(
      "SELECT id, sku, name, price FROM products WHERE sku IN ('LD-001', 'LD-002', 'LD-003') ORDER BY sku"
    );
    const ldProduct = ldProducts[0] || { id: null, sku: "LD-001", name: "San Mig Light", price: LD_UNIT_PRICE };

    const [barProducts] = await conn.execute(
      "SELECT id, sku, name, price FROM products WHERE department = 'Bar' AND status = 'active' ORDER BY id LIMIT 1"
    );
    const barProduct = barProducts[0] || { id: null, sku: "BAR-SEED", name: "Beer (seed)", price: BAR_UNIT_PRICE };

    const [kitchenProducts] = await conn.execute(
      "SELECT id, sku, name, price FROM products WHERE department = 'Kitchen' AND status = 'active' ORDER BY id LIMIT 1"
    );
    const kitchenProduct = kitchenProducts[0] || { id: null, sku: "KIT-SEED", name: "Fries (seed)", price: 120 };

    // -------------------------------------------------------------------------
    // PAYROLL SCENARIO A — Bianca (MDL002): 18 LD all pending (open tables)
    // -------------------------------------------------------------------------
    const biancaPending = [
      { tableId: "LD1", qty: 8, createdMin: 50, visitId: 920001 },
      { tableId: "LD2", qty: 6, createdMin: 42, visitId: 920002 },
      { tableId: "LD3", qty: 4, createdMin: 35, visitId: 920003 },
    ];
    let biancaLdCount = 0;
    for (const o of biancaPending) {
      const sessionId = await openTableSession(conn, {
        tableId: o.tableId,
        waiterId: waiter.employee_id,
        openedMin: o.createdMin,
      });
      const order = await insertOrder(conn, {
        tableId: o.tableId,
        status: "pending",
        employeeId: waiter.employee_id,
        createdMin: o.createdMin,
        sessionId,
      });
      await linkOrderToSession(conn, order.id, sessionId, order.id);
      await insertItem(conn, {
        orderId: order.id,
        productId: ldProduct.id,
        productSku: ldProduct.sku,
        productName: ldProduct.name,
        qty: o.qty,
        unitPrice: Number(ldProduct.price) || LD_UNIT_PRICE,
        department: "LD",
        servedBy: bianca.id,
      });
      biancaLdCount += o.qty;
      await updateOrderTotals(conn, order.id);
    }

    // -------------------------------------------------------------------------
    // PAYROLL SCENARIO B — Clarisse (MDL003): 5 paid + 5 pending LD
    // -------------------------------------------------------------------------
    const c6PaidSession = await openTableSession(conn, {
      tableId: "C6",
      waiterId: waiter.employee_id,
      openedMin: 130,
    });
    const paidOrder = await insertOrder(conn, {
      tableId: "C6",
      status: "paid",
      employeeId: waiter.employee_id,
      createdMin: 130,
      sessionId: c6PaidSession,
    });
    await linkOrderToSession(conn, paidOrder.id, c6PaidSession, paidOrder.id);
    await insertItem(conn, {
      orderId: paidOrder.id,
      productId: ldProduct.id,
      productSku: ldProduct.sku,
      productName: ldProduct.name,
      qty: 5,
      unitPrice: Number(ldProduct.price) || LD_UNIT_PRICE,
      department: "LD",
      servedBy: clarisse.id,
    });
    await insertItem(conn, {
      orderId: paidOrder.id,
      productId: barProduct.id,
      productSku: barProduct.sku,
      productName: barProduct.name,
      qty: 2,
      unitPrice: Number(barProduct.price) || BAR_UNIT_PRICE,
      department: "Bar",
    });
    await updateOrderTotals(conn, paidOrder.id);
    await closeTableSession(conn, c6PaidSession, { closedMin: 128, closedBy: "payment" });

    const c6OpenSession = await openTableSession(conn, {
      tableId: "C6",
      waiterId: waiter.employee_id,
      openedMin: 25,
    });
    const clarissePendingOrder = await insertOrder(conn, {
      tableId: "C6",
      status: "pending",
      employeeId: waiter.employee_id,
      createdMin: 25,
      sessionId: c6OpenSession,
    });
    await linkOrderToSession(conn, clarissePendingOrder.id, c6OpenSession, clarissePendingOrder.id);
    await insertItem(conn, {
      orderId: clarissePendingOrder.id,
      productId: ldProduct.id,
      productSku: ldProduct.sku,
      productName: ldProduct.name,
      qty: 5,
      unitPrice: Number(ldProduct.price) || LD_UNIT_PRICE,
      department: "LD",
      servedBy: clarisse.id,
    });
    await updateOrderTotals(conn, clarissePendingOrder.id);
    const clarisseLdCount = 10;

    // -------------------------------------------------------------------------
    // PAYROLL SCENARIO C — Angel (MDL001): 3 paid LD
    // -------------------------------------------------------------------------
    const l1Session = await openTableSession(conn, {
      tableId: "L1",
      waiterId: waiter.employee_id,
      openedMin: 100,
    });
    const angelPaidOrder = await insertOrder(conn, {
      tableId: "L1",
      status: "paid",
      employeeId: waiter.employee_id,
      createdMin: 100,
      sessionId: l1Session,
    });
    await linkOrderToSession(conn, angelPaidOrder.id, l1Session, angelPaidOrder.id);
    await insertItem(conn, {
      orderId: angelPaidOrder.id,
      productId: ldProduct.id,
      productSku: ldProduct.sku,
      productName: ldProduct.name,
      qty: 3,
      unitPrice: Number(ldProduct.price) || LD_UNIT_PRICE,
      department: "LD",
      servedBy: angel.id,
    });
    await updateOrderTotals(conn, angelPaidOrder.id);
    await closeTableSession(conn, l1Session, { closedMin: 98, closedBy: "payment" });
    const angelLdCount = 3;

    // -------------------------------------------------------------------------
    // VOID SCENARIO D — 5 LD voided on pending tab (must NOT count in payroll)
    // -------------------------------------------------------------------------
    const ld4Session = await openTableSession(conn, {
      tableId: "LD4",
      waiterId: waiter.employee_id,
      openedMin: 20,
    });
    const voidPendingOrder = await insertOrder(conn, {
      tableId: "LD4",
      status: "pending",
      employeeId: waiter.employee_id,
      createdMin: 20,
      sessionId: ld4Session,
    });
    await linkOrderToSession(conn, voidPendingOrder.id, ld4Session, voidPendingOrder.id);
    const voidedLdItem = await insertItem(conn, {
      orderId: voidPendingOrder.id,
      productId: ldProduct.id,
      productSku: ldProduct.sku,
      productName: ldProduct.name,
      qty: 5,
      unitPrice: Number(ldProduct.price) || LD_UNIT_PRICE,
      department: "LD",
      servedBy: bianca.id,
      isVoided: true,
      voidedBy: manager.id,
      voidedByName: manager.name,
      voidedAt: tsMinutesAgo(18),
    });
    await insertItem(conn, {
      orderId: voidPendingOrder.id,
      productId: barProduct.id,
      productSku: barProduct.sku,
      productName: barProduct.name,
      qty: 1,
      unitPrice: Number(barProduct.price) || BAR_UNIT_PRICE,
      department: "Bar",
    });
    await updateOrderTotals(conn, voidPendingOrder.id);
    await insertVoidLog(conn, {
      orderId: voidPendingOrder.id,
      orderItemId: voidedLdItem.id,
      productId: ldProduct.id,
      productSku: ldProduct.sku,
      productName: voidedLdItem.productName,
      qty: voidedLdItem.qty,
      unitPrice: Number(ldProduct.price) || LD_UNIT_PRICE,
      amount: voidedLdItem.subtotal,
      tableId: "LD4",
      voidType: "item",
      voidedBy: manager.id,
      voidedByName: manager.name,
      voidedByEmployeeId: manager.employee_id,
      voidedAt: tsMinutesAgo(18),
      reason: "Wrong drink ordered",
    });

    // -------------------------------------------------------------------------
    // VOID SCENARIO E — item void on paid order (Bar item)
    // -------------------------------------------------------------------------
    const c3Session = await openTableSession(conn, {
      tableId: "C3",
      waiterId: waiter.employee_id,
      openedMin: 90,
    });
    const paidVoidOrder = await insertOrder(conn, {
      tableId: "C3",
      status: "paid",
      employeeId: waiter.employee_id,
      createdMin: 90,
      sessionId: c3Session,
    });
    await linkOrderToSession(conn, paidVoidOrder.id, c3Session, paidVoidOrder.id);
    const voidedBarItem = await insertItem(conn, {
      orderId: paidVoidOrder.id,
      productId: barProduct.id,
      productSku: barProduct.sku,
      productName: barProduct.name,
      qty: 2,
      unitPrice: Number(barProduct.price) || BAR_UNIT_PRICE,
      department: "Bar",
      isVoided: true,
      voidedBy: manager.id,
      voidedByName: manager.name,
      voidedAt: tsMinutesAgo(85),
    });
    await insertItem(conn, {
      orderId: paidVoidOrder.id,
      productId: kitchenProduct.id,
      productSku: kitchenProduct.sku,
      productName: kitchenProduct.name,
      qty: 1,
      unitPrice: Number(kitchenProduct.price) || 120,
      department: "Kitchen",
    });
    await updateOrderTotals(conn, paidVoidOrder.id);
    await closeTableSession(conn, c3Session, { closedMin: 88, closedBy: "payment" });
    await insertVoidLog(conn, {
      orderId: paidVoidOrder.id,
      orderItemId: voidedBarItem.id,
      productId: barProduct.id,
      productSku: barProduct.sku,
      productName: voidedBarItem.productName,
      qty: voidedBarItem.qty,
      unitPrice: Number(barProduct.price) || BAR_UNIT_PRICE,
      amount: voidedBarItem.subtotal,
      tableId: "C3",
      voidType: "item",
      voidedBy: manager.id,
      voidedByName: manager.name,
      voidedByEmployeeId: manager.employee_id,
      voidedAt: tsMinutesAgo(85),
      reason: "Guest changed mind",
    });

    // -------------------------------------------------------------------------
    // VOID SCENARIO F — full pending order void (Kitchen + Bar)
    // -------------------------------------------------------------------------
    const l4Session = await openTableSession(conn, {
      tableId: "L4",
      waiterId: waiter.employee_id,
      openedMin: 15,
    });
    const fullVoidOrder = await insertOrder(conn, {
      tableId: "L4",
      status: "pending",
      employeeId: waiter.employee_id,
      createdMin: 15,
      sessionId: l4Session,
    });
    await linkOrderToSession(conn, fullVoidOrder.id, l4Session, fullVoidOrder.id);
    const fullVoidItem1 = await insertItem(conn, {
      orderId: fullVoidOrder.id,
      productId: kitchenProduct.id,
      productSku: kitchenProduct.sku,
      productName: kitchenProduct.name,
      qty: 2,
      unitPrice: Number(kitchenProduct.price) || 120,
      department: "Kitchen",
      isVoided: true,
      voidedBy: manager.id,
      voidedByName: manager.name,
      voidedAt: tsMinutesAgo(12),
    });
    const fullVoidItem2 = await insertItem(conn, {
      orderId: fullVoidOrder.id,
      productId: barProduct.id,
      productSku: barProduct.sku,
      productName: barProduct.name,
      qty: 1,
      unitPrice: Number(barProduct.price) || BAR_UNIT_PRICE,
      department: "Bar",
      isVoided: true,
      voidedBy: manager.id,
      voidedByName: manager.name,
      voidedAt: tsMinutesAgo(12),
    });
    await conn.execute(
      "UPDATE orders SET voided_at = ?, voided_by = ?, voided_by_name = ?, subtotal = 0, total = 0 WHERE id = ?",
      [tsMinutesAgo(12), manager.id, manager.name, fullVoidOrder.id]
    );
    await closeTableSession(conn, l4Session, { closedMin: 12, closedBy: "void" });
    for (const item of [fullVoidItem1, fullVoidItem2]) {
      await insertVoidLog(conn, {
        orderId: fullVoidOrder.id,
        orderItemId: item.id,
        productId: item.productName === kitchenProduct.name ? kitchenProduct.id : barProduct.id,
        productSku: item.productName === kitchenProduct.name ? kitchenProduct.sku : barProduct.sku,
        productName: item.productName,
        qty: item.qty,
        unitPrice: item.subtotal / item.qty,
        amount: item.subtotal,
        tableId: "L4",
        voidType: "order",
        voidedBy: manager.id,
        voidedByName: manager.name,
        voidedByEmployeeId: manager.employee_id,
        voidedAt: tsMinutesAgo(12),
        reason: "Table walked out",
      });
    }

    // -------------------------------------------------------------------------
    // SALES SCENARIO G — mixed paid + pending on same table (visit grouping)
    // -------------------------------------------------------------------------
    const c1Session = await openTableSession(conn, {
      tableId: "C1",
      waiterId: waiter.employee_id,
      openedMin: 140,
    });
    const salesMixedPaid = await insertOrder(conn, {
      tableId: "C1",
      status: "paid",
      employeeId: waiter.employee_id,
      createdMin: 140,
      sessionId: c1Session,
    });
    const c1VisitAnchor = await linkOrderToSession(conn, salesMixedPaid.id, c1Session, salesMixedPaid.id);
    await insertItem(conn, {
      orderId: salesMixedPaid.id,
      productId: barProduct.id,
      productSku: barProduct.sku,
      productName: barProduct.name,
      qty: 3,
      unitPrice: Number(barProduct.price) || BAR_UNIT_PRICE,
      department: "Bar",
    });
    await updateOrderTotals(conn, salesMixedPaid.id);

    const salesMixedPending = await insertOrder(conn, {
      tableId: "C1",
      status: "pending",
      employeeId: waiter.employee_id,
      createdMin: 22,
      sessionId: c1Session,
    });
    await linkOrderToSession(conn, salesMixedPending.id, c1Session, c1VisitAnchor);
    await insertItem(conn, {
      orderId: salesMixedPending.id,
      productId: barProduct.id,
      productSku: barProduct.sku,
      productName: barProduct.name,
      qty: 2,
      unitPrice: Number(barProduct.price) || BAR_UNIT_PRICE,
      department: "Bar",
    });
    await updateOrderTotals(conn, salesMixedPending.id);

    // -------------------------------------------------------------------------
    // Shift + payment void (for shift void report)
    // -------------------------------------------------------------------------
    let shiftId = null;
    try {
      const [shiftResult] = await conn.execute(
        `INSERT INTO shifts (user_id, branch_id, shift_date, start_time, status, opening_cash, total_voids)
         VALUES (?, ?, ?, ?, 'open', 5000, ?)`,
        [waiter.id, BRANCH_ID, periodDate, tsMinutesAgo(480), voidedBarItem.subtotal]
      );
      shiftId = shiftResult.insertId;
      await conn.execute(
        `INSERT INTO payment_voids (order_id, payment_method, voided_amount, reason, requested_by, shift_id, status, completed_at)
         VALUES (?, 'cash', ?, 'Duplicate charge', ?, ?, 'completed', ?)`,
        [paidVoidOrder.id, voidedBarItem.subtotal, manager.id, shiftId, tsMinutesAgo(84)]
      );
    } catch {
      // shifts table may not exist on older DBs
    }

    // -------------------------------------------------------------------------
    // Sync pos_tables occupancy + table_sessions from orders
    // -------------------------------------------------------------------------
    await syncPosTablesFromOrders(conn);

    const [occupiedTables] = await conn.execute(
      `SELECT id, status, current_order_id FROM pos_tables
       WHERE branch_id = ? AND status = 'occupied' ORDER BY id`,
      [BRANCH_ID]
    );
    const [openSessions] = await conn.execute(
      `SELECT id, table_id, waiter_id, status FROM table_sessions
       WHERE branch_id = ? AND status = 'open' ORDER BY table_id`,
      [BRANCH_ID]
    );

    // -------------------------------------------------------------------------
    // Pre-seed payouts (commission + incentives + manual lines)
    // -------------------------------------------------------------------------
    const branchTotalLd = biancaLdCount + clarisseLdCount + angelLdCount; // 31 — voided 5 LD excluded
    const commissionRate = 100;
    const incentiveRate = 100;
    const budget = 1500;

    const biancaCommission = biancaLdCount * commissionRate;
    const biancaIncentives = branchTotalLd * incentiveRate;
    const biancaManualBonus = buildSevenIncentives("Bianca");
    const biancaManualTotal = sumBreakdown(biancaManualBonus);
    const biancaTotal = await upsertPayout(conn, {
      userId: bianca.id,
      periodFrom: periodDate,
      periodTo: periodDate,
      allowance: budget,
      commission: biancaCommission,
      incentives: biancaIncentives,
      incentivesBreakdown: biancaManualBonus,
      adjustments: 0,
      adjustmentsBreakdown: [],
      deductions: 0,
      deductionsBreakdown: [],
      status: "draft",
    });

    const clarisseCommission = clarisseLdCount * commissionRate;
    const clarisseIncentives = branchTotalLd * incentiveRate;
    const clarisseManualBonus = buildSevenIncentives("Cla");
    const clarisseManualTotal = sumBreakdown(clarisseManualBonus);
    const clarisseTotal = await upsertPayout(conn, {
      userId: clarisse.id,
      periodFrom: periodDate,
      periodTo: periodDate,
      allowance: budget,
      commission: clarisseCommission,
      incentives: clarisseIncentives,
      incentivesBreakdown: clarisseManualBonus,
      adjustments: 200,
      adjustmentsBreakdown: [{ title: "Transport allowance", amount: 200 }],
      deductions: 150,
      deductionsBreakdown: [{ title: "Cash advance", amount: 150 }],
      status: "approved",
    });

    const angelCommission = angelLdCount * commissionRate;
    const angelIncentives = branchTotalLd * incentiveRate;
    const angelManualBonus = buildSevenIncentives("Angel");
    const angelManualTotal = sumBreakdown(angelManualBonus);
    const angelTotal = await upsertPayout(conn, {
      userId: angel.id,
      periodFrom: periodDate,
      periodTo: periodDate,
      allowance: budget,
      commission: angelCommission,
      incentives: angelIncentives,
      incentivesBreakdown: angelManualBonus,
      adjustments: 0,
      adjustmentsBreakdown: [],
      deductions: 0,
      deductionsBreakdown: [],
      status: "draft",
    });

    await conn.commit();

    console.log("[seed-verify-all] Seed complete\n");
    console.log(`Date: ${periodDate}`);
    console.log(`Waiter: ${waiter.name} (${waiter.employee_id})`);
    console.log(`Manager (voids): ${manager.name} (${manager.employee_id})`);
    console.log("");

    console.log("--- ORDERS ---");
    console.log(`Bianca (${bianca.employee_id}): ${biancaLdCount} LD on pending tables LD1/LD2/LD3`);
    console.log(`Clarisse (${clarisse.employee_id}): ${clarisseLdCount} LD (5 paid + 5 pending on C6)`);
    console.log(`Angel (${angel.employee_id}): ${angelLdCount} LD paid on L1`);
    console.log("Sales: C1 mixed paid + pending (visit grouping test)");
    console.log("");

    console.log("--- VOIDS (5 LD voided excluded from payroll) ---");
    console.log("LD4: 5 LD item void on pending tab (Bianca served, voided)");
    console.log("C3: 2 Bar items void on paid tab");
    console.log("L4: full order void (Kitchen + Bar)");
    if (shiftId) console.log(`Payment void on shift #${shiftId}`);
    console.log("");

    console.log("--- TABLES ---");
    console.log(`Floor plan: 18 tables (L1–L6 Lounge, C1–C8 Club, LD1–LD4 LD)`);
    console.log(`Occupied: ${occupiedTables.map((t) => `${t.id} (order #${t.current_order_id})`).join(", ") || "none"}`);
    console.log(`Open sessions: ${openSessions.map((s) => `${s.table_id} (session #${s.id}, ${s.waiter_id})`).join(", ") || "none"}`);
    console.log("C6: closed paid session + new open session for pending tab");
    console.log("C1: single open session spans paid + pending (same visit anchor)");
    console.log("L1/C3/L4: closed sessions after payment or void");
    console.log("");

    console.log("--- PAYROLL (pre-seeded) ---");
    console.log(`Branch total LD (non-voided): ${branchTotalLd}`);
    console.log("");
    console.log(`Bianca: budget ₱${budget} + commission ₱${biancaCommission} (${biancaLdCount}×${commissionRate})`);
    console.log(`        + incentives ₱${biancaIncentives} (${branchTotalLd}×${incentiveRate}) + 7 manual lines ₱${biancaManualTotal}`);
    console.log(`        = ₱${biancaTotal.toLocaleString()} (draft)`);
    console.log("");
    console.log(`Clarisse: budget ₱${budget} + commission ₱${clarisseCommission} + incentives ₱${clarisseIncentives}`);
    console.log(`          + 7 manual lines ₱${clarisseManualTotal} + adjustments ₱200 - deductions ₱150`);
    console.log(`          = ₱${clarisseTotal.toLocaleString()} (approved)`);
    console.log("");
    console.log(`Angel: budget ₱${budget} + commission ₱${angelCommission} + incentives ₱${angelIncentives}`);
    console.log(`       + 7 manual lines ₱${angelManualTotal} = ₱${angelTotal.toLocaleString()} (draft)`);
    console.log("");

    console.log("--- VERIFY ---");
    console.log("1. POS floor → LD1/LD2/LD3/C6/LD4/C1 should show occupied; others available");
    console.log("2. Reports → Payroll → today → Print payslip — verify all 7 incentive lines show (not cut)");
    console.log("3. Reports → Payroll → today → Compute Payouts (LD totals should still match)");
    console.log("4. Reports → Void → should show 4 void_log rows (1 LD item, 1 Bar item, 2 order void lines)");
    console.log("5. Reports → Sales → C1 mixed paid/pending should not merge incorrectly");
    console.log("6. Voided 5 LD on LD4 must NOT appear in any payroll LD count");
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("[seed-verify-all] Error:", err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
