/**
 * Rabbit Alley POS - API (MySQL)
 * Auth: POST /api/auth/login
 * Dashboard: GET /api/dashboard/stats, GET /api/dashboard/tables
 * Products: GET/POST/PUT/PATCH /api/products
 * Staff: GET/POST/PUT /api/staff
 * Discounts: GET/POST/PATCH /api/discounts
 * Reports: GET /api/reports/sales, GET /api/reports/payroll, PATCH approve
 * Print: POST /api/print/receipt
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
import cors from "cors";
import compression from "compression";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import ThermalPrinter from "node-thermal-printer";

const {
  DB_HOST = "localhost",
  DB_PORT = 3306,
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_DATABASE = "rabbit_alley_pos",
  PORT = 8000,
  PRINTER_TYPE = "epson", // epson, star, etc
  PRINTER_INTERFACE = "", // Leave empty to auto-detect, or set like "\\\\localhost\\XP-K200L" or "tcp://192.168.1.100"
  PRINTER_TIMEOUT = "10000", // Socket timeout in ms for network printers (default 10s)
} = process.env;

const printerOptions = { timeout: Math.max(3000, Number(PRINTER_TIMEOUT) || 10000) };

// Map PRINTER_TYPE env to node-thermal-printer type (epson = ESC/POS, works for most generic thermal printers)
const PRINTER_TYPES_MAP = {
  epson: ThermalPrinter.types.EPSON,
  star: ThermalPrinter.types.STAR,
  brother: ThermalPrinter.types.BROTHER,
  daruma: ThermalPrinter.types.DARUMA,
  tanca: ThermalPrinter.types.TANCA,
  custom: ThermalPrinter.types.CUSTOM,
};
const printerType = PRINTER_TYPES_MAP[String(PRINTER_TYPE || "epson").toLowerCase()] || ThermalPrinter.types.EPSON;

// Ethernet printing: set PRINTER_INTERFACE=tcp://IP:9100 in .env. No "printer" package required.
const isSystemPrinterInterface = String(PRINTER_INTERFACE || "").toLowerCase().startsWith("printer:");
function getPrinterDriver() {
  return null;
}

/** Get Windows printer list for Settings dropdown (PowerShell on Windows). Ethernet printer from .env is added separately. */
function getWindowsPrinterList() {
  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process");
      const out = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: "utf8", timeout: 5000 }
      );
      const names = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      return names.map((name) => ({ name, isDefault: false }));
    } catch (e) {
      // ignore
    }
  }
  return [];
}

/** Parse PRINTER_INTERFACE: single value or comma-separated list (e.g. tcp://IP:9100,tcp://IP2:9100). Returns array of { interface, displayName }. */
function getEthernetPrintersFromEnv() {
  const raw = (PRINTER_INTERFACE || "").trim();
  if (!raw) return [];
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list
    .filter((iface) => iface.toLowerCase().startsWith("tcp://") || iface.toLowerCase().startsWith("socket://"))
    .map((iface) => ({
      interface: iface,
      displayName: iface.replace(/^socket:\/\//i, "").replace(/^tcp:\/\//i, ""),
    }));
}

const ethernetPrintersFromEnv = getEthernetPrintersFromEnv();
if (ethernetPrintersFromEnv.length > 0) {
  console.log("[Print] Ethernet printer(s) from .env →", ethernetPrintersFromEnv.map((p) => p.interface).join(", "));
}

const app = express();
app.use(compression()); // Compress all responses
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" })); // Limit request body size

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

/**
 * Run a query that uses oi.is_voided; if the column doesn't exist, re-run without it.
 * Returns the rows from whichever version succeeds.
 */
async function queryWithVoidFallback(db, sqlWithVoid, sqlWithout, params) {
  try {
    const [rows] = await db.execute(sqlWithVoid, params);
    return rows;
  } catch (e) {
    if (e.code === "ER_BAD_FIELD_ERROR") {
      const [rows] = await db.execute(sqlWithout, params);
      return rows;
    }
    throw e;
  }
}

function row(r) {
  return r && typeof r === "object" ? Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])
  ) : r;
}

/** Normalize UI staff type into a valid web role. */
function normalizeStaffRoleName(type) {
  const value = String(type || "").trim().toLowerCase();
  if (value === "administrator" || value === "admin") return "Administrator";
  if (value === "operations staff" || value === "operations_staff" || value === "cashier" || value === "bartender") {
    return "Operations Staff";
  }
  return "Staff";
}

async function getWebRoleIdByName(db, roleName) {
  const [roleRows] = await db.execute(
    "SELECT id FROM roles WHERE guard = 'web' AND LOWER(name) = LOWER(?) LIMIT 1",
    [roleName]
  );
  if (roleRows.length) return Number(roleRows[0].id);
  const [fallbackRows] = await db.execute(
    "SELECT id FROM roles WHERE guard = 'web' AND LOWER(name) = 'staff' LIMIT 1"
  );
  if (fallbackRows.length) return Number(fallbackRows[0].id);
  return 1;
}

/** Branch for multi-branch: from header X-Branch-Id or query branchId, default 1 */
function getBranchId(req) {
  const h = req.headers["x-branch-id"];
  const q = req.query?.branchId;
  const v = h || q || "1";
  return String(v).trim() || "1";
}

/** Payment method mapping for shift aggregation (cash, card, gcash, bank) */
const SALES_CASH_COND = "payment_method = 'cash'";
const SALES_CARD_COND = "payment_method IN ('credit','debit')";
const SALES_GCASH_COND = "payment_method = 'gcash'";
const SALES_BANK_COND = "payment_method = 'bank'";

/** Get acting user from request headers (sent by frontend for audit) */
function getActingUser(req) {
  return {
    userId: req.headers["x-user-id"] || null,
    employeeId: req.headers["x-employee-id"] || null,
    userName: req.headers["x-user-name"] || null,
    userRole: req.headers["x-user-role"] || null,
  };
}

/** Write audit log - fire and forget, never block main flow */
async function logAudit(req, action, entityType = null, entityId = null, details = null) {
  const { userId, employeeId, userName, userRole } = getActingUser(req);
  const branchId = getBranchId(req);
  const ip = req.ip || req.connection?.remoteAddress || null;
  try {
    const db = await getPool();
    await db.execute(
      `INSERT INTO audit_logs (user_id, employee_id, user_name, role_name, action, entity_type, entity_id, details, ip_address, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ? parseInt(userId, 10) : null,
        employeeId || null,
        userName || null,
        userRole || null,
        action,
        entityType,
        entityId ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        ip,
        branchId,
      ]
    );
  } catch (err) {
    console.warn("Audit log write failed:", err.message);
  }
}

/** Log with explicit user (e.g. login - no headers yet) */
async function logAuditWithUser(db, user, action, entityType = null, entityId = null, details = null) {
  try {
    await db.execute(
      `INSERT INTO audit_logs (user_id, employee_id, user_name, role_name, action, entity_type, entity_id, details, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id || null,
        user.employeeId || user.employee_id || null,
        user.name || null,
        user.roleName || user.role_name || null,
        action,
        entityType,
        entityId ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        user.branch_id || user.branchId || 1,
      ]
    );
  } catch (err) {
    console.warn("Audit log write failed:", err.message);
  }
}

// ---------- Audit Logs (Manager only - check view_audit_logs on frontend) ----------
app.get("/api/audit-logs", async (req, res) => {
  const branchId = getBranchId(req);
  const { from, to, userId, employeeId, action, limit = "200" } = req.query || {};
  try {
    const db = await getPool();
    let sql = `SELECT a.id, a.user_id AS userId, a.employee_id AS employeeId, a.user_name AS userName,
      a.role_name AS roleName, a.action, a.entity_type AS entityType, a.entity_id AS entityId,
      a.details, a.created_at AS createdAt
      FROM audit_logs a WHERE a.branch_id = ?`;
    const params = [branchId];
    if (from) {
      sql += " AND DATE(a.created_at) >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND DATE(a.created_at) <= ?";
      params.push(to);
    }
    if (userId) {
      sql += " AND a.user_id = ?";
      params.push(userId);
    }
    if (employeeId) {
      sql += " AND a.employee_id = ?";
      params.push(employeeId);
    }
    if (action) {
      sql += " AND a.action = ?";
      params.push(action);
    }
    sql += " ORDER BY a.created_at DESC LIMIT ?";
    params.push(Math.min(parseInt(String(limit), 10) || 200, 500));
    const [rows] = await db.execute(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      employeeId: r.employeeId,
      userName: r.userName,
      roleName: r.roleName,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      details: r.details ? (typeof r.details === "string" ? JSON.parse(r.details) : r.details) : null,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
    })));
  } catch (err) {
    console.error("Audit logs error:", err);
    res.status(500).json({ error: "Failed to load audit logs" });
  }
});

// ---------- Branches (multi-branch) ----------
app.get("/api/branches", async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      "SELECT id, name, code, address, active FROM branches WHERE active = 1 ORDER BY name"
    );
    res.json(rows.map((r) => ({ id: r.id, name: r.name, code: r.code, address: r.address ?? undefined, active: !!r.active })));
  } catch (err) {
    console.error("Branches list error:", err);
    res.status(500).json({ error: "Failed to list branches" });
  }
});

// ---------- Auth ----------
app.post("/api/auth/login", async (req, res) => {
  const { employeeId, password } = req.body || {};
  if (!employeeId || !password) {
    return res.status(400).json({ error: "Employee ID and password are required" });
  }
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT u.id, u.employee_id, u.name, u.email, u.password_hash, u.role_id, u.branch_id, r.name AS role_name, b.name AS branch_name, b.code AS branch_code
       FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.employee_id = ? AND u.active = 1 AND r.guard = 'web'`,
      [String(employeeId).trim().toUpperCase()]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid Employee ID or Password" });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid Employee ID or Password" });
    const [permRows] = await db.execute(
      `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const branchId = user.branch_id != null ? String(user.branch_id) : "1";
    logAuditWithUser(db, { id: user.id, employee_id: user.employee_id, name: user.name, role_name: user.role_name, branch_id: branchId }, "auth_login", "user", String(user.id));

    // Auto clock-in: create attendance record for today if none exists
    try {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const [existing] = await db.execute(
        "SELECT 1 FROM attendance WHERE user_id = ? AND work_date = ?",
        [user.id, today]
      );
      if (existing.length === 0) {
        await db.execute(
          "INSERT INTO attendance (user_id, work_date, time_in, break_minutes) VALUES (?, ?, ?, 0)",
          [user.id, today, now]
        );
      }
    } catch (attErr) {
      if (attErr.code !== "ER_NO_SUCH_TABLE") console.error("Auto clock-in error:", attErr);
    }

    res.json({
      user: {
        id: String(user.id),
        employeeId: user.employee_id,
        name: user.name,
        email: user.email,
        role: user.role_name.toLowerCase().replace(/\s+/g, "_"),
        branchId,
        branchName: user.branch_name || "Main Branch",
        branchCode: user.branch_code || "MAIN",
      },
      permissions: permRows.map((r) => r.name),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Verify manager for discount or charge (must have approve_discounts)
app.post("/api/auth/verify-manager", async (req, res) => {
  const { employeeId, password, discountName, discountId, action, customerName } = req.body || {};
  if (!employeeId || !password) {
    return res.status(400).json({ error: "Employee ID and password are required" });
  }
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT u.id, u.employee_id, u.name, u.password_hash, u.role_id, u.branch_id
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.employee_id = ? AND u.active = 1 AND r.guard = 'web'`,
      [String(employeeId).trim().toUpperCase()]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid Employee ID or Password" });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid Employee ID or Password" });
    const [permRows] = await db.execute(
      `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permissions = permRows.map((r) => r.name);
    if (!permissions.includes("approve_discounts")) {
      return res.status(403).json({ error: "Only a Manager can authorize this action" });
    }
    const [roleRows] = await db.execute("SELECT name FROM roles WHERE id = ?", [user.role_id]);
    const roleName = roleRows[0]?.name || null;
    const branchId = user.branch_id != null ? String(user.branch_id) : getBranchId(req);
    if (action === "charge") {
      if (!customerName || !String(customerName).trim()) return res.status(400).json({ error: "Customer name is required for Charge/Utang" });
      logAuditWithUser(db, { id: user.id, employee_id: user.employee_id, name: user.name, role_name: roleName, branch_id: branchId }, "charge_authorize", "charge", null, { customerName: String(customerName).trim(), authorizedBy: user.name });
    } else {
      logAuditWithUser(db, { id: user.id, employee_id: user.employee_id, name: user.name, role_name: roleName, branch_id: branchId }, "discount_apply_authorize", "discount", discountId || null, { discountName: discountName || null, authorizedBy: user.name });
    }
    res.json({ ok: true, managerName: user.name });
  } catch (err) {
    console.error("Verify manager error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// ---------- Dashboard ----------
app.get("/api/dashboard/stats", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const today = new Date().toISOString().slice(0, 10);
    const [ordersCount] = await db.execute(
      "SELECT COUNT(*) AS c FROM orders WHERE branch_id = ? AND order_date = ?",
      [branchId, today]
    );
    const [salesSum] = await db.execute(
      "SELECT COALESCE(SUM(total), 0) AS s FROM orders WHERE branch_id = ? AND order_date = ? AND status = 'paid'",
      [branchId, today]
    );
    const [openTables] = await db.execute(
      "SELECT COUNT(*) AS c FROM pos_tables WHERE branch_id = ? AND status = 'available'",
      [branchId]
    );
    const [pendingOrders] = await db.execute(
      "SELECT COUNT(*) AS c FROM orders WHERE branch_id = ? AND order_date = ? AND status = 'pending'",
      [branchId, today]
    );
    let todaysLdSales = 0;
    {
      const ldRows = await queryWithVoidFallback(
        db,
        `SELECT COALESCE(SUM(oi.subtotal),0) AS s FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.branch_id = ? AND o.order_date = ? AND o.status = 'paid'
           AND oi.department = 'LD' AND COALESCE(oi.is_voided,0) = 0`,
        `SELECT COALESCE(SUM(oi.subtotal),0) AS s FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.branch_id = ? AND o.order_date = ? AND o.status = 'paid'
           AND oi.department = 'LD'`,
        [branchId, today]
      );
      todaysLdSales = Number(ldRows[0]?.s ?? 0);
    }
    res.json({
      todaysOrders: Number(ordersCount[0]?.c ?? 0),
      todaysSales: Number(salesSum[0]?.s ?? 0),
      todaysLdSales,
      openTables: Number(openTables[0]?.c ?? 0),
      pendingOrders: Number(pendingOrders[0]?.c ?? 0),
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

app.get("/api/dashboard/tables", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      "SELECT id, name, area, status, current_order_id AS currentOrderId FROM pos_tables WHERE branch_id = ? ORDER BY area, name",
      [branchId]
    );
    res.json(rows.map((r) => ({ ...r, id: r.id, currentOrderId: r.currentOrderId ?? undefined })));
  } catch (err) {
    console.error("Dashboard tables error:", err);
    res.status(500).json({ error: "Failed to load tables" });
  }
});

app.post("/api/dashboard/tables", async (req, res) => {
  const { name, area } = req.body || {};
  const branchId = getBranchId(req);
  if (!name?.trim() || !area) return res.status(400).json({ error: "Name and area required" });
  const nameTrim = String(name).trim();
  const validAreas = ["Lounge", "Club", "LD"];
  if (!validAreas.includes(area)) return res.status(400).json({ error: "Area must be Lounge, Club, or LD" });
  try {
    const db = await getPool();
    let id = nameTrim.replace(/\s+/g, "_").slice(0, 16) || "T";
    const [existing] = await db.execute(
      "SELECT id FROM pos_tables WHERE branch_id = ? AND id = ?",
      [branchId, id]
    );
    if (existing.length > 0) {
      id = id + "_" + Date.now();
    }
    await db.execute(
      "INSERT INTO pos_tables (branch_id, id, name, area, status) VALUES (?, ?, ?, ?, 'available')",
      [branchId, id, nameTrim, area]
    );
    const [rows] = await db.execute(
      "SELECT id, name, area, status, current_order_id AS currentOrderId FROM pos_tables WHERE branch_id = ? AND id = ?",
      [branchId, id]
    );
    res.status(201).json({ ...rows[0], currentOrderId: rows[0].currentOrderId ?? undefined });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Table name/ID already exists" });
    console.error("Add table error:", err);
    res.status(500).json({ error: "Failed to add table" });
  }
});

app.put("/api/dashboard/tables/:id", async (req, res) => {
  const { id } = req.params;
  const branchId = getBranchId(req);
  const { name, area, status } = req.body || {};
  try {
    const db = await getPool();
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push("name = ?"); params.push(String(name).trim()); }
    if (area !== undefined) { updates.push("area = ?"); params.push(area); }
    if (status !== undefined) { updates.push("status = ?"); params.push(status); }
    if (params.length) { params.push(branchId, id); await db.execute(`UPDATE pos_tables SET ${updates.join(", ")} WHERE branch_id = ? AND id = ?`, params); }
    const [rows] = await db.execute(
      "SELECT id, name, area, status, current_order_id AS currentOrderId FROM pos_tables WHERE branch_id = ? AND id = ?",
      [branchId, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Table not found" });
    res.json({ ...rows[0], currentOrderId: rows[0].currentOrderId ?? undefined });
  } catch (err) {
    console.error("Update table error:", err);
    res.status(500).json({ error: "Failed to update table" });
  }
});

app.delete("/api/dashboard/tables/:id", async (req, res) => {
  const { id } = req.params;
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      "SELECT id, status, current_order_id FROM pos_tables WHERE branch_id = ? AND id = ?",
      [branchId, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Table not found" });
    if (rows[0].status !== "available" || rows[0].current_order_id) {
      return res.status(400).json({ error: "Only available tables with no active order can be removed" });
    }
    await db.execute("DELETE FROM pos_tables WHERE branch_id = ? AND id = ?", [branchId, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete table error:", err);
    res.status(500).json({ error: "Failed to delete table" });
  }
});

// ---------- Orders ----------
// Create a new order (when sending to departments)
app.post("/api/orders", async (req, res) => {
  const { tableId, employeeId, items, subtotal, tax, total } = req.body || {};
  const branchId = getBranchId(req);
  if (!tableId || !items || !items.length) {
    return res.status(400).json({ error: "Table ID and items are required" });
  }
  try {
    const db = await getPool();
    const orderDate = new Date().toISOString().slice(0, 10);
    
    const [orderResult] = await db.execute(
      `INSERT INTO orders (branch_id, table_id, status, subtotal, discount, tax, total, employee_id, order_date)
       VALUES (?, ?, 'pending', ?, 0, ?, ?, ?, ?)`,
      [branchId, tableId, subtotal || 0, tax || 0, total || 0, employeeId || null, orderDate]
    );
    const orderId = orderResult.insertId;
    
    const specialReq = (item) => (item.specialRequest && String(item.specialRequest).trim()) || null;
    for (const item of items) {
      const servedBy = item.servedBy ? parseInt(item.servedBy, 10) : null;
      try {
        await db.execute(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, department, sent_to_dept, is_complimentary, served_by, special_request)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [orderId, item.productId || null, item.name, item.quantity, item.unitPrice, item.discount || 0, item.subtotal, item.department || 'Bar', item.isComplimentary ? 1 : 0, servedBy, specialReq(item)]
        );
      } catch (e) {
        if (e.code === "ER_BAD_FIELD_ERROR") {
          await db.execute(
            `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, department, sent_to_dept, is_complimentary, served_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [orderId, item.productId || null, item.name, item.quantity, item.unitPrice, item.discount || 0, item.subtotal, item.department || 'Bar', item.isComplimentary ? 1 : 0, servedBy]
          );
        } else throw e;
      }
    }
    
    await db.execute(
      "UPDATE pos_tables SET status = 'occupied', current_order_id = ? WHERE branch_id = ? AND id = ?",
      [String(orderId), branchId, tableId]
    );
    logAudit(req, "order_create", "order", orderId, { tableId, itemCount: items.length, total });
    res.json({ ok: true, orderId: String(orderId) });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Add items to existing order (L2: allow adding after sent, until billed)
app.post("/api/orders/:id/items", async (req, res) => {
  const { id } = req.params;
  const { items: newItems } = req.body || {};
  const branchId = getBranchId(req);
  if (!newItems || !Array.isArray(newItems) || newItems.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }
  try {
    const db = await getPool();
    const [orders] = await db.execute(
      "SELECT id, branch_id, status, subtotal, discount, tax, total FROM orders WHERE id = ?",
      [id]
    );
    if (!orders.length) return res.status(404).json({ error: "Order not found" });
    const ord = orders[0];
    if (String(ord.branch_id) !== branchId) return res.status(403).json({ error: "Order belongs to another branch" });
    if (ord.status === "paid") return res.status(400).json({ error: "Cannot add items to paid order" });

    let newSubtotal = Number(ord.subtotal);
    for (const item of newItems) {
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      const discount = item.discount || 0;
      const subtotal = qty * unitPrice - discount;
      const productId = item.productId || null;
      const dept = item.department || "Bar";
      const servedByVal = item.servedBy ? parseInt(item.servedBy, 10) : null;
      const [existing] = await db.execute(
        "SELECT id, quantity, subtotal FROM order_items WHERE order_id = ? AND product_id = ? AND department = ? AND is_complimentary = ? AND (COALESCE(served_by,0) = COALESCE(?,0)) LIMIT 1",
        [id, productId, dept, item.isComplimentary ? 1 : 0, servedByVal]
      );
      if (existing.length) {
        const oldSub = Number(existing[0].subtotal);
        const newQty = existing[0].quantity + qty;
        const delta = qty * unitPrice - discount;
        await db.execute(
          "UPDATE order_items SET quantity = ?, subtotal = ? WHERE id = ?",
          [newQty, oldSub + delta, existing[0].id]
        );
        newSubtotal += delta;
      } else {
        const specReq = (item.specialRequest && String(item.specialRequest).trim()) || null;
        try {
          await db.execute(
            `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, department, sent_to_dept, is_complimentary, served_by, special_request)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [id, productId, item.name || "Item", qty, unitPrice, discount, subtotal, dept, item.isComplimentary ? 1 : 0, servedByVal, specReq]
          );
        } catch (e) {
          if (e.code === "ER_BAD_FIELD_ERROR") {
            await db.execute(
              `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount, subtotal, department, sent_to_dept, is_complimentary, served_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
              [id, productId, item.name || "Item", qty, unitPrice, discount, subtotal, dept, item.isComplimentary ? 1 : 0, servedByVal]
            );
          } else throw e;
        }
        newSubtotal += subtotal;
      }
    }
    const newTax = newSubtotal * 0.12;
    const newService = newSubtotal * 0.1;
    const newTotal = newSubtotal + newTax + newService;
    await db.execute(
      "UPDATE orders SET subtotal = ?, tax = ?, total = ?, updated_at = NOW() WHERE id = ?",
      [newSubtotal, newTax, newTotal, id]
    );
    logAudit(req, "order_add_items", "order", id, { itemCount: newItems.length });
    res.json({ ok: true, subtotal: newSubtotal, tax: newTax, total: newTotal });
  } catch (err) {
    console.error("Add order items error:", err);
    res.status(500).json({ error: "Failed to add items to order" });
  }
});

// Get single order detail with all items (for Sales Report history view)
app.get("/api/orders/:orderId/detail", async (req, res) => {
  const { orderId } = req.params;
  // Strip "ORD-" prefix if present (sales report formats IDs as ORD-XX)
  const numericId = String(orderId).replace(/^ORD-/i, "");
  try {
    const db = await getPool();
    const [orders] = await db.execute(
      `SELECT o.id, t.name AS tableName, t.area,
              o.employee_id, u.name AS employee,
              o.subtotal, o.discount, o.tax, o.total,
              o.status, o.payment_method, o.created_at, o.updated_at
       FROM orders o
       LEFT JOIN pos_tables t ON t.branch_id = o.branch_id AND t.id = o.table_id
       LEFT JOIN users u ON u.employee_id = o.employee_id
       WHERE o.id = ?`,
      [numericId]
    );
    if (!orders.length) return res.status(404).json({ error: "Order not found" });
    const order = orders[0];
    const [items] = await db.execute(
      `SELECT oi.id, oi.product_name AS name, oi.quantity, oi.unit_price, oi.subtotal,
              oi.discount, oi.department, oi.special_request,
              oi.is_complimentary, oi.is_voided,
              u.name AS servedByName
       FROM order_items oi
       LEFT JOIN users u ON u.id = oi.served_by
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
      [numericId]
    );
    res.json({
      id: "ORD-" + order.id,
      table: order.tableName,
      area: order.area,
      employee: order.employee || order.employee_id || "—",
      subtotal: Number(order.subtotal),
      discount: Number(order.discount ?? 0),
      tax: Number(order.tax ?? 0),
      total: Number(order.total),
      status: order.status,
      paymentMethod: order.payment_method ?? null,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: items.map((i) => ({
        id: String(i.id),
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        subtotal: Number(i.subtotal),
        discount: Number(i.discount ?? 0),
        department: i.department,
        specialRequest: i.special_request ?? null,
        isComplimentary: !!i.is_complimentary,
        isVoided: !!i.is_voided,
        servedByName: i.servedByName ?? null,
      })),
    });
  } catch (err) {
    console.error("Order detail error:", err);
    res.status(500).json({ error: "Failed to load order detail" });
  }
});

// Get ALL pending orders for table (multi-tab: each order = one tab)
app.get("/api/orders/table/:tableId", async (req, res) => {
  const { tableId } = req.params;
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    let orders;
    try {
      [orders] = await db.execute(
        "SELECT id, table_id, status, subtotal, discount, tax, total, employee_id, order_date, voided_at, voided_by, voided_by_name FROM orders WHERE table_id = ? AND status = 'pending' AND branch_id = ? ORDER BY id",
        [tableId, branchId]
      );
    } catch (e) {
      if (e.code === "ER_BAD_FIELD_ERROR") {
        [orders] = await db.execute(
          "SELECT id, table_id, status, subtotal, discount, tax, total, employee_id, order_date FROM orders WHERE table_id = ? AND status = 'pending' AND branch_id = ? ORDER BY id",
          [tableId, branchId]
        );
      } else throw e;
    }
    if (!orders.length) {
      return res.json({ orders: [], tableStatus: "available" });
    }
    const orderList = [];
    for (const o of orders) {
      let items;
      try {
        [items] = await db.execute(
          `SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.discount, oi.subtotal, oi.department, oi.sent_to_dept, oi.is_complimentary, oi.served_by, oi.special_request, oi.is_voided, oi.voided_by_name, u.name AS served_by_name
           FROM order_items oi LEFT JOIN users u ON u.id = oi.served_by WHERE oi.order_id = ?`,
          [o.id]
        );
      } catch (e) {
        if (e.code === "ER_BAD_FIELD_ERROR") {
          [items] = await db.execute(
            `SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.discount, oi.subtotal, oi.department, oi.sent_to_dept, oi.is_complimentary, oi.served_by, u.name AS served_by_name
             FROM order_items oi LEFT JOIN users u ON u.id = oi.served_by WHERE oi.order_id = ?`,
            [o.id]
          );
        } else throw e;
      }
      orderList.push({
        id: String(o.id),
        tableId: o.table_id,
        status: o.status,
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        tax: Number(o.tax),
        total: Number(o.total),
        employeeId: o.employee_id,
        orderDate: o.order_date,
        voidedAt: o.voided_at || null,
        voidedBy: o.voided_by != null ? String(o.voided_by) : null,
        voidedByName: o.voided_by_name || null,
        items: items.map((i) => ({
          id: String(i.id),
          productId: String(i.product_id || i.id),
          name: i.product_name,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          discount: Number(i.discount),
          subtotal: Number(i.subtotal),
          department: i.department,
          sentToDept: !!i.sent_to_dept,
          isComplimentary: !!i.is_complimentary,
          servedBy: i.served_by ? String(i.served_by) : null,
          servedByName: i.served_by_name || null,
          specialRequest: i.special_request || null,
          isVoided: !!i.is_voided,
          voidedByName: i.voided_by_name || null,
        })),
      });
    }
    res.json({ orders: orderList, tableStatus: "occupied" });
  } catch (err) {
    console.error("Get order error:", err);
    res.status(500).json({ error: "Failed to get order" });
  }
});

// Helper: verify manager (approve_discounts) and return { id, name }
async function verifyManagerForVoid(db, employeeId, password) {
  if (!employeeId || !password) throw new Error("Employee ID and password are required");
  const [rows] = await db.execute(
    `SELECT u.id, u.employee_id, u.name, u.password_hash, u.role_id
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.employee_id = ? AND u.active = 1 AND r.guard = 'web'`,
    [String(employeeId).trim().toUpperCase()]
  );
  if (rows.length === 0) throw new Error("Invalid Employee ID or Password");
  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid Employee ID or Password");
  const [permRows] = await db.execute(
    `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
    [user.role_id]
  );
  const permissions = permRows.map((r) => r.name);
  if (!permissions.includes("approve_discounts")) throw new Error("Only a Manager can authorize void");
  return { id: user.id, name: user.name };
}

// Void entire order (manager auth required)
app.post("/api/orders/:id/void", async (req, res) => {
  const orderId = req.params.id;
  const branchId = getBranchId(req);
  const { employeeId, password, reason } = req.body || {};
  try {
    const db = await getPool();
    const manager = await verifyManagerForVoid(db, employeeId, password);
    const [orders] = await db.execute("SELECT id, branch_id, status FROM orders WHERE id = ?", [orderId]);
    if (!orders.length) return res.status(404).json({ error: "Order not found" });
    if (String(orders[0].branch_id) !== branchId) return res.status(403).json({ error: "Order belongs to another branch" });
    if (orders[0].status === "paid") return res.status(400).json({ error: "Cannot void paid order" });
    try {
      await db.execute(
        "UPDATE orders SET voided_at = NOW(), voided_by = ?, voided_by_name = ? WHERE id = ?",
        [manager.id, manager.name, orderId]
      );
      await db.execute(
        "UPDATE order_items SET is_voided = 1, voided_by = ?, voided_at = NOW(), voided_by_name = ? WHERE order_id = ?",
        [manager.id, manager.name, orderId]
      );
    } catch (e) {
      if (e.code === "ER_BAD_FIELD_ERROR") return res.status(500).json({ error: "Void not supported: run schema migration for void columns" });
      throw e;
    }
    res.json({ ok: true, voidedByName: manager.name });
  } catch (err) {
    if (err.message && (err.message.includes("Employee ID") || err.message.includes("Password") || err.message.includes("Manager"))) {
      return res.status(401).json({ error: err.message });
    }
    console.error("Order void error:", err);
    res.status(500).json({ error: "Failed to void order" });
  }
});

// Void single order item (manager auth required)
app.patch("/api/order-items/:id/void", async (req, res) => {
  const itemId = req.params.id;
  const branchId = getBranchId(req);
  const { employeeId, password } = req.body || {};
  try {
    const db = await getPool();
    const manager = await verifyManagerForVoid(db, employeeId, password);
    const [items] = await db.execute(
      "SELECT oi.id, oi.order_id, o.subtotal FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? AND o.branch_id = ?",
      [itemId, branchId]
    );
    if (!items.length) return res.status(404).json({ error: "Item not found" });
    try {
      await db.execute(
        "UPDATE order_items SET is_voided = 1, voided_by = ?, voided_at = NOW(), voided_by_name = ? WHERE id = ?",
        [manager.id, manager.name, itemId]
      );
      const orderId = items[0].order_id;
      const [sumRows] = await db.execute(
        "SELECT COALESCE(SUM(CASE WHEN is_voided = 0 THEN subtotal ELSE 0 END), 0) AS subtotal FROM order_items WHERE order_id = ?",
        [orderId]
      );
      const newSubtotal = Number(sumRows[0]?.subtotal ?? 0);
      const newTax = newSubtotal * 0.12;
      const newService = newSubtotal * 0.1;
      const newTotal = newSubtotal + newTax + newService;
      await db.execute("UPDATE orders SET subtotal = ?, tax = ?, total = ? WHERE id = ?", [newSubtotal, newTax, newTotal, orderId]);
    } catch (e) {
      if (e.code === "ER_BAD_FIELD_ERROR") return res.status(500).json({ error: "Void not supported: run schema migration for void columns" });
      throw e;
    }
    res.json({ ok: true, voidedByName: manager.name });
  } catch (err) {
    if (err.message && (err.message.includes("Employee ID") || err.message.includes("Password") || err.message.includes("Manager"))) {
      return res.status(401).json({ error: err.message });
    }
    console.error("Item void error:", err);
    res.status(500).json({ error: "Failed to void item" });
  }
});

// Set order item as complimentary (for cashier at bill-out)
app.patch("/api/order-items/:id/complimentary", async (req, res) => {
  const itemId = req.params.id;
  const branchId = getBranchId(req);
  const { isComplimentary } = req.body || {};
  const value = !!isComplimentary;
  try {
    const db = await getPool();
    const [items] = await db.execute(
      "SELECT oi.id, oi.order_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? AND o.branch_id = ?",
      [itemId, branchId]
    );
    if (!items.length) return res.status(404).json({ error: "Item not found" });
    await db.execute("UPDATE order_items SET is_complimentary = ? WHERE id = ?", [value ? 1 : 0, itemId]);
    const orderId = items[0].order_id;
    const [sumRows] = await db.execute(
      `SELECT COALESCE(SUM(CASE WHEN COALESCE(is_voided,0) = 0 THEN subtotal ELSE 0 END), 0) AS subtotal,
              COALESCE(SUM(CASE WHEN COALESCE(is_voided,0) = 0 AND is_complimentary = 1 THEN subtotal ELSE 0 END), 0) AS complimentary
       FROM order_items WHERE order_id = ?`,
      [orderId]
    );
    const totalSub = Number(sumRows[0]?.subtotal ?? 0);
    const compli = Number(sumRows[0]?.complimentary ?? 0);
    const chargeable = totalSub - compli;
    const newTax = chargeable * 0.12;
    const newService = chargeable * 0.1;
    const newTotal = chargeable + newTax + newService;
    await db.execute("UPDATE orders SET subtotal = ?, tax = ?, total = ? WHERE id = ?", [totalSub, newTax, newTotal, orderId]);
    res.json({ ok: true, isComplimentary: value });
  } catch (err) {
    console.error("Set complimentary error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// Pay single order (legacy; for single-order flow)
app.patch("/api/orders/:id/pay", async (req, res) => {
  const { id } = req.params;
  const branchId = getBranchId(req);
  const { paymentMethod } = req.body || {};
  try {
    const db = await getPool();
    const [orders] = await db.execute("SELECT branch_id, table_id FROM orders WHERE id = ?", [id]);
    if (!orders.length) return res.status(404).json({ error: "Order not found" });
    const orderBranchId = String(orders[0].branch_id);
    if (orderBranchId !== branchId) return res.status(403).json({ error: "Order belongs to another branch" });
    await db.execute("UPDATE orders SET status = 'paid', payment_method = ? WHERE id = ?", [paymentMethod || "cash", id]);
    if (orders[0].table_id) {
      const [pending] = await db.execute("SELECT id FROM orders WHERE table_id = ? AND status = 'pending' AND branch_id = ?", [orders[0].table_id, branchId]);
      if (!pending.length) {
        await db.execute(
          "UPDATE pos_tables SET status = 'available', current_order_id = NULL WHERE branch_id = ? AND id = ?",
          [branchId, orders[0].table_id]
        );
      }
    }
    logAudit(req, "order_pay", "order", id, { paymentMethod: paymentMethod || "cash", tableId: orders[0].table_id });
    res.json({ ok: true });
  } catch (err) {
    console.error("Pay order error:", err);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// Pay ALL pending orders for a table (multi-tab: one bill for entire table)
app.post("/api/tables/:tableId/pay-all", async (req, res) => {
  const { tableId } = req.params;
  const branchId = getBranchId(req);
  const { paymentMethod, discountName, discountAmount, customerName, splits } = req.body || {};
  try {
    const db = await getPool();
    const [pending] = await db.execute(
      "SELECT id, subtotal, discount, tax, total FROM orders WHERE table_id = ? AND status = 'pending' AND branch_id = ? ORDER BY id",
      [tableId, branchId]
    );
    if (!pending.length) return res.status(400).json({ error: "No pending orders for this table" });

    // Split payment: at least 2 entries provided
    const isSplitPayment = Array.isArray(splits) && splits.length >= 2;
    const paymentMethodVal = isSplitPayment ? "split_payment" : (paymentMethod || "cash");

    if (!isSplitPayment && paymentMethodVal === "charge") {
      const name = String(customerName || "").trim();
      if (!name) return res.status(400).json({ error: "Customer name is required for Charge/Utang" });
    }
    const { userId, employeeId, userName } = getActingUser(req);
    for (const o of pending) {
      await db.execute("UPDATE orders SET status = 'paid', payment_method = ? WHERE id = ?", [paymentMethodVal, o.id]);
    }
    await db.execute(
      "UPDATE pos_tables SET status = 'available', current_order_id = NULL WHERE branch_id = ? AND id = ?",
      [branchId, tableId]
    );
    const combinedSubtotal = pending.reduce((s, o) => s + Number(o.subtotal), 0);
    const combinedDiscount = pending.reduce((s, o) => s + Number(o.discount), 0);
    const combinedTax = pending.reduce((s, o) => s + Number(o.tax), 0);
    const combinedTotal = pending.reduce((s, o) => s + Number(o.total), 0);

    // Handle split payment records
    if (isSplitPayment) {
      const primaryOrderId = pending[0].id;
      try {
        await db.execute(`DELETE FROM split_payments WHERE order_id = ?`, [primaryOrderId]);
        for (let i = 0; i < splits.length; i++) {
          await db.execute(
            `INSERT INTO split_payments (order_id, split_number, amount, payment_method, status) VALUES (?, ?, ?, ?, 'paid')`,
            [primaryOrderId, i + 1, splits[i].amount, splits[i].paymentMethod]
          );
        }
      } catch (_splitErr) {
        // split_payments table may not exist — non-fatal
      }
      // Handle charge entries within split
      const chargeSplits = splits.filter((s) => s.paymentMethod === "charge" && String(s.customerName || "").trim());
      for (const cs of chargeSplits) {
        try {
          const [r] = await db.execute(
            `INSERT INTO charge_transactions (branch_id, order_ids, customer_name, amount, status, charged_by) VALUES (?, ?, ?, ?, 'pending', ?)`,
            [branchId, pending.map((o) => o.id).join(","), String(cs.customerName).trim(), cs.amount, userName || employeeId || null]
          );
          logAudit(req, "charge_create", "charge", String(r.insertId), { customerName: String(cs.customerName).trim(), amount: cs.amount, orderIds: pending.map((o) => String(o.id)) });
        } catch (_chargeErr) {
          // charge_transactions table may not exist — non-fatal
        }
      }
    } else if (paymentMethodVal === "charge") {
      const [r] = await db.execute(
        `INSERT INTO charge_transactions (branch_id, order_ids, customer_name, amount, status, charged_by) VALUES (?, ?, ?, ?, 'pending', ?)`,
        [branchId, pending.map((o) => o.id).join(","), String(customerName).trim(), combinedTotal, userName || employeeId || null]
      );
      logAudit(req, "charge_create", "charge", String(r.insertId), { customerName: String(customerName).trim(), amount: combinedTotal, orderIds: pending.map((o) => String(o.id)) });
    }

    const auditDetails = { orderIds: pending.map((o) => String(o.id)), paymentMethod: paymentMethodVal, total: combinedTotal };
    if (discountName || (discountAmount != null && Number(discountAmount) > 0)) {
      auditDetails.discountName = discountName || null;
      auditDetails.discountAmount = Number(discountAmount) || combinedDiscount;
    }
    if (paymentMethodVal === "charge") auditDetails.customerName = String(customerName).trim();
    if (isSplitPayment) auditDetails.splits = splits;
    logAudit(req, "table_pay_all", "table", tableId, auditDetails);
    res.json({
      ok: true,
      orderIds: pending.map((o) => String(o.id)),
      subtotal: combinedSubtotal,
      discount: combinedDiscount,
      tax: combinedTax,
      total: combinedTotal,
    });
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE" && err.message?.includes("charge_transactions")) {
      return res.status(503).json({ error: "Charge feature not available. Run server/schema.sql in MySQL" });
    }
    console.error("Pay table error:", err);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// ---------- List printers (for POS Settings) ----------
// Windows printers + Ethernet from .env + printers added in DB (Settings / system).
app.get("/api/print/printers", async (req, res) => {
  const printers = [];
  let error = null;
  try {
    const list = getWindowsPrinterList();
    list.forEach((p) => printers.push({ name: p.name, isDefault: !!p.isDefault, isNetwork: false }));
    if (list.length === 0 && process.platform === "win32") {
      error = "No printers found. Install npm package: npm install printer --legacy-peer-deps (in server folder) for best support, or add printers in Windows Settings.";
    }
  } catch (e) {
    error = e.message || "Failed to get printers";
  }
  // Add Ethernet/network printers from .env (single or comma-separated)
  ethernetPrintersFromEnv.forEach(({ interface: iface, displayName }) => {
    printers.push({ name: iface, displayName: `Ethernet (${displayName})`, isDefault: false, isNetwork: true });
  });
  // Add printers from DB (added in system / Settings)
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      "SELECT id, name, interface, type FROM printers WHERE active = 1 ORDER BY name"
    );
    rows.forEach((row) => {
      const iface = row.interface;
      const isNetwork = /^tcp:\/\//i.test(iface) || /^socket:\/\//i.test(iface);
      printers.push({
        name: iface,
        displayName: row.name || iface,
        isDefault: false,
        isNetwork: !!isNetwork,
        fromSystem: true,
      });
    });
  } catch (e) {
    // Table may not exist yet; ignore
  }
  res.json({ printers, error: error || undefined });
});

// ---------- Add printer (system) ----------
app.post("/api/print/printers", async (req, res) => {
  const { name, interface: iface, type: typeName } = req.body || {};
  if (!name || !iface || typeof name !== "string" || typeof iface !== "string") {
    return res.status(400).json({ error: "name and interface are required" });
  }
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    await db.execute(
      "INSERT INTO printers (name, interface, type, branch_id, active) VALUES (?, ?, ?, ?, 1)",
      [name.trim(), iface.trim(), (typeName && String(typeName).trim()) || "epson", branchId]
    );
    res.json({ ok: true, message: "Printer added" });
  } catch (e) {
    if (e.code === "ER_NO_SUCH_TABLE") {
      return res.status(503).json({ error: "Printers table not found. Run the schema migration that creates the printers table." });
    }
    res.status(500).json({ error: e.message || "Failed to add printer" });
  }
});

// ---------- Print Receipt ----------
app.post("/api/print/receipt", async (req, res) => {
  const { receipt, printerName } = req.body || {};
  if (!receipt) {
    return res.status(400).json({ error: "Receipt data is required" });
  }

  const driver = getPrinterDriver();
  const usePrinterName = (typeof printerName === "string" && printerName.trim()) ? printerName.trim() : null;
  // If user selected a printer, use it (Ethernet tcp:// or Windows printer:Name). Else default: first Ethernet from .env or single PRINTER_INTERFACE.
  const defaultFromEnv = ethernetPrintersFromEnv.length > 0 ? ethernetPrintersFromEnv[0].interface : (PRINTER_INTERFACE || "").trim() || undefined;
  const interfaceToUse = usePrinterName
    ? (usePrinterName.toLowerCase().startsWith("tcp://") || usePrinterName.toLowerCase().startsWith("socket://")
        ? usePrinterName
        : `printer:${usePrinterName}`)
    : defaultFromEnv;
  const needDriver = interfaceToUse && String(interfaceToUse).toLowerCase().startsWith("printer:");

  try {
    if (needDriver && !driver) {
      return res.json({ ok: false, error: "Automatic print requires Node 18 or 20 and: npm install printer --legacy-peer-deps. Or select a printer in Settings.", fallback: true });
    }
    const printer = new ThermalPrinter.printer({
      type: printerType,
      interface: interfaceToUse || undefined,
      driver: driver || undefined,
      options: printerOptions,
      characterSet: "PC437_USA",
      removeSpecialCharacters: false,
      lineCharacter: "-",
      width: 48, // 80mm paper = ~48 characters
    });

    // Check if printer is connected
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected && PRINTER_INTERFACE) {
      console.warn("Printer not connected, attempting to print anyway...");
    }

    // Build receipt
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println("RABBIT ALLEY");
    printer.bold(false);
    printer.setTextNormal();
    printer.println("Bar & Restaurant");
    printer.println("123 Main Street, City");
    printer.println("Tel: (02) 123-4567");
    printer.drawLine();

    // Order info
    printer.alignLeft();
    printer.println(`Order #: ${receipt.orderNumber}`);
    printer.println(`Date: ${receipt.date}`);
    printer.println(`Time: ${receipt.time}`);
    printer.println(`Table: ${receipt.table}`);
    printer.println(`Cashier: ${receipt.cashier}`);
    printer.drawLine();

    // Items
    printer.bold(true);
    printer.println("ITEMS");
    printer.bold(false);
    for (const item of receipt.items || []) {
      const itemLine = `${item.quantity}x ${item.name}`;
      const priceLine = `P${Number(item.subtotal).toFixed(2)}`;
      const padding = 48 - itemLine.length - priceLine.length;
      printer.println(itemLine + " ".repeat(Math.max(1, padding)) + priceLine);
      if (item.note && String(item.note).trim()) {
        printer.println("   Note: " + String(item.note).trim().slice(0, 40));
      }
    }
    printer.drawLine();

    // Totals
    const printLine = (label, value) => {
      const padding = 48 - label.length - value.length;
      printer.println(label + " ".repeat(Math.max(1, padding)) + value);
    };

    printLine("Subtotal:", `P${Number(receipt.subtotal).toFixed(2)}`);
    if (receipt.complimentary) {
      printLine("Less Compli:", `-P${Number(receipt.complimentary).toFixed(2)}`);
    }
    if (receipt.discount) {
      printLine("Discount:", `-P${Number(receipt.discount).toFixed(2)}`);
    }
    printLine("Service (10%):", `P${Number(receipt.serviceCharge).toFixed(2)}`);
    printLine("VAT (12%):", `P${Number(receipt.tax).toFixed(2)}`);
    if (receipt.cardSurcharge) {
      printLine("Card Fee (4%):", `P${Number(receipt.cardSurcharge).toFixed(2)}`);
    }
    printer.drawLine();
    printer.bold(true);
    printLine("TOTAL:", `P${Number(receipt.total).toFixed(2)}`);
    printer.bold(false);
    printer.drawLine();

    // Payment info
    printLine("Payment:", receipt.paymentMethod?.toUpperCase() || "CASH");
    printLine("Amount Paid:", `P${Number(receipt.amountPaid).toFixed(2)}`);
    printLine("Change:", `P${Number(receipt.change).toFixed(2)}`);
    printer.drawLine();

    // Footer
    printer.alignCenter();
    printer.println("");
    printer.bold(true);
    printer.println("Thank you for dining with us!");
    printer.bold(false);
    printer.println("Please come again");
    printer.println("");
    printer.println("This serves as your OFFICIAL RECEIPT");
    printer.println("VAT Reg TIN: 123-456-789-000");
    printer.println("");

    // Cut paper
    printer.cut();

    // Execute print
    await printer.execute();
    console.log("Receipt printed successfully!");

    res.json({ ok: true, message: "Receipt printed" });
  } catch (err) {
    const isTimeout = /timeout|ETIMEDOUT/i.test(String(err.message));
    console.warn(isTimeout ? "Receipt: printer unavailable (timeout). Use browser print." : "Print error:", err.message);
    res.json({ ok: false, error: err.message, fallback: true });
  }
});

// ---------- Print Department Chit (Kitchen / Bar / LD) ----------
// Body: { dept, title, subtitle, items: [{name, quantity, servedByName?, specialRequest?}], table, area, encoder, orderNumber, date, time, printerName? }
app.post("/api/print/dept-receipt", async (req, res) => {
  const { dept, title, subtitle, items, table: tableStr, area, encoder, orderNumber, date, time, printerName } = req.body || {};
  if (!dept || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: "dept and items are required" });
  }

  const driver = getPrinterDriver();
  const usePrinterName = (typeof printerName === "string" && printerName.trim()) ? printerName.trim() : null;
  const defaultFromEnv = ethernetPrintersFromEnv.length > 0 ? ethernetPrintersFromEnv[0].interface : (PRINTER_INTERFACE || "").trim() || undefined;
  const interfaceToUse = usePrinterName
    ? (usePrinterName.toLowerCase().startsWith("tcp://") || usePrinterName.toLowerCase().startsWith("socket://")
        ? usePrinterName
        : `printer:${usePrinterName}`)
    : defaultFromEnv;
  const needDriver = interfaceToUse && String(interfaceToUse).toLowerCase().startsWith("printer:");

  if (!interfaceToUse) {
    return res.json({ ok: false, error: "No printer configured for this department.", fallback: true });
  }

  try {
    if (needDriver && !driver) {
      return res.json({ ok: false, error: "USB print requires printer package.", fallback: true });
    }
    const printer = new ThermalPrinter.printer({
      type: printerType,
      interface: interfaceToUse,
      driver: driver || undefined,
      options: printerOptions,
      characterSet: "PC437_USA",
      removeSpecialCharacters: false,
      lineCharacter: "-",
      width: 42,
    });

    // Header
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(String(title || dept).toUpperCase());
    printer.bold(false);
    printer.setTextNormal();
    if (subtitle) printer.println(subtitle);
    printer.drawLine();

    // Order info
    printer.alignLeft();
    printer.println(`Order : ${orderNumber || ""}`);
    printer.println(`${date || ""}  ${time || ""}  ${area || ""} T${tableStr || ""}`);
    printer.drawLine();

    // Items
    printer.bold(true);
    printer.println("ITEMS");
    printer.bold(false);

    if (dept === "LD") {
      // Group by lady name
      const byLady = {};
      for (const item of items) {
        const key = item.servedByName || "Unassigned";
        if (!byLady[key]) byLady[key] = [];
        byLady[key].push(item);
      }
      for (const [lady, ladyItems] of Object.entries(byLady)) {
        printer.bold(true);
        printer.println(`[${lady}]`);
        printer.bold(false);
        for (const item of ladyItems) {
          const note = item.specialRequest ? ` (${item.specialRequest})` : "";
          printer.println(`  ${item.quantity}x ${item.name}${note}`);
        }
      }
    } else {
      for (const item of items) {
        const note = item.specialRequest ? ` (${item.specialRequest})` : "";
        const server = item.servedByName ? ` [${item.servedByName}]` : "";
        printer.println(`${item.quantity}x ${item.name}${server}${note}`);
      }
    }

    printer.drawLine();
    printer.println(`Encoder: ${encoder || ""}`);
    printer.cut();
    await printer.execute();
    console.log(`[Print] Dept chit (${dept}) printed to ${interfaceToUse}`);
    res.json({ ok: true, message: `${dept} chit printed` });
  } catch (err) {
    const isTimeout = /timeout|ETIMEDOUT/i.test(String(err.message));
    console.warn(isTimeout ? `Dept chit (${dept}): printer unavailable.` : `Dept chit error:`, err.message);
    res.json({ ok: false, error: err.message, fallback: true });
  }
});

// ---------- Print Order Slip (cashier chit sent to Bar/cashier printer) ----------
app.post("/api/print/order-slip", async (req, res) => {
  const { orderId, table: tableStr, area, waiter, date, time, subtotal, items, printerName } = req.body || {};
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: "items required" });

  const driver = getPrinterDriver();
  const usePrinterName = (typeof printerName === "string" && printerName.trim()) ? printerName.trim() : null;
  const defaultFromEnv = ethernetPrintersFromEnv.length > 0 ? ethernetPrintersFromEnv[0].interface : (PRINTER_INTERFACE || "").trim() || undefined;
  const interfaceToUse = usePrinterName
    ? (usePrinterName.toLowerCase().startsWith("tcp://") || usePrinterName.toLowerCase().startsWith("socket://")
        ? usePrinterName : `printer:${usePrinterName}`)
    : defaultFromEnv;

  if (!interfaceToUse) return res.json({ ok: false, error: "No printer configured." });

  try {
    if (interfaceToUse.toLowerCase().startsWith("printer:") && !driver) {
      return res.json({ ok: false, error: "USB print requires printer package.", fallback: true });
    }
    const printer = new ThermalPrinter.printer({
      type: printerType, interface: interfaceToUse, driver: driver || undefined,
      options: printerOptions, characterSet: "PC437_USA", removeSpecialCharacters: false,
      lineCharacter: "-", width: 42,
    });
    printer.alignCenter();
    printer.bold(true);
    printer.println("RABBIT ALLEY");
    printer.bold(false);
    printer.println("Bar & Restaurant");
    printer.drawLine();
    printer.bold(true);
    printer.println("ORDER SLIP");
    printer.bold(false);
    printer.alignLeft();
    printer.println(`Order : ${orderId || ""}`);
    printer.println(`${date || ""}  ${time || ""}  ${area || ""} T${tableStr || ""}`);
    printer.println(`Waiter: ${waiter || ""}`);
    printer.drawLine();
    printer.bold(true);
    printer.println("ITEMS");
    printer.bold(false);
    for (const item of items) {
      const note = item.specialRequest ? ` (${item.specialRequest})` : "";
      const price = `P${Number(item.subtotal).toFixed(2)}`;
      const label = `${item.quantity}x ${item.name}${note}`;
      const pad = Math.max(1, 42 - label.length - price.length);
      printer.println(label + " ".repeat(pad) + price);
    }
    printer.drawLine();
    const subStr = `P${Number(subtotal).toFixed(2)}`;
    const subPad = Math.max(1, 42 - "SUBTOTAL:".length - subStr.length);
    printer.bold(true);
    printer.println("SUBTOTAL:" + " ".repeat(subPad) + subStr);
    printer.bold(false);
    printer.alignCenter();
    printer.println("Not official receipt.");
    printer.println("Subject to tax & service charge.");
    printer.println("Signature: ____________________");
    printer.cut();
    await printer.execute();
    res.json({ ok: true });
  } catch (err) {
    console.warn("Order slip print error:", err.message);
    res.json({ ok: false, error: err.message });
  }
});

// ---------- Print Payslip (thermal) ----------
app.post("/api/print/payslip", async (req, res) => {
  const { payslip } = req.body || {};
  if (!payslip || !payslip.name) {
    return res.status(400).json({ error: "Payslip data is required" });
  }

  try {
    const driver = getPrinterDriver();
    if (isSystemPrinterInterface && !driver) {
      return res.json({ ok: false, error: "Automatic USB print requires Node 18 or 20 and printer package.", fallback: true });
    }
    const printer = new ThermalPrinter.printer({
      type: printerType,
      interface: PRINTER_INTERFACE || undefined,
      driver: driver || undefined,
      options: printerOptions,
      characterSet: "PC437_USA",
      removeSpecialCharacters: false,
      lineCharacter: "-",
      width: 48,
    });

    const pl = (label, value) => {
      const v = String(value);
      const pad = 48 - label.length - v.length;
      printer.println(label + " ".repeat(Math.max(1, pad)) + v);
    };

    printer.alignCenter();
    printer.bold(true);
    printer.println("RABBIT ALLEY");
    printer.bold(false);
    printer.println("PAYSLIP");
    printer.drawLine();

    printer.alignLeft();
    pl("ID:", payslip.employeeId || "");
    pl("Name:", (payslip.name || "").slice(0, 20));
    pl("Period:", `${payslip.periodFrom || ""} - ${payslip.periodTo || ""}`);
    printer.drawLine();

    printer.bold(true);
    printer.println("EARNINGS");
    printer.bold(false);
    pl("Budget:", `P${Number(payslip.allowance ?? 0).toFixed(2)}`);
    pl("Commission:", `P${Number(payslip.commission ?? 0).toFixed(2)}`);
    pl("Incentives:", `P${Number(payslip.incentives ?? 0).toFixed(2)}`);
    pl("Adjustments:", `P${Number(payslip.adjustments ?? 0).toFixed(2)}`);
    pl("Gross:", `P${Number(payslip.gross ?? 0).toFixed(2)}`);
    printer.drawLine();

    printer.println("DEDUCTIONS");
    pl("Deductions:", `P${Number(payslip.deductions ?? 0).toFixed(2)}`);
    printer.drawLine();

    printer.bold(true);
    pl("NET PAYOUT:", `P${Number(payslip.netPayout ?? 0).toFixed(2)}`);
    printer.bold(false);
    printer.drawLine();

    printer.alignCenter();
    printer.println(`Status: ${(payslip.status || "draft").toUpperCase()}`);
    if (payslip.approvedBy) printer.println(`Approved: ${payslip.approvedBy}`);
    printer.println("");
    printer.cut();
    await printer.execute();

    res.json({ ok: true, message: "Payslip printed" });
  } catch (err) {
    const isTimeout = /timeout|ETIMEDOUT/i.test(String(err.message));
    console.warn(isTimeout ? "Payslip: printer unavailable (timeout). Use Print or Download PDF." : "Payslip print error:", err.message);
    res.json({ ok: false, error: err.message, fallback: true });
  }
});

// ---------- Products ----------
// Area-based pricing: ?area=Lounge|Club|LD returns each product with price for that area (fallback to base price).
// Each product also has pricesByArea: { Lounge?, Club?, LD? } when table exists (for edit UI).
app.get("/api/products", async (req, res) => {
  try {
    const db = await getPool();
    const { search, category, department, status, limit, area } = req.query;
    let sql = "SELECT id, sku, name, description, category, COALESCE(sub_category, '') AS sub_category, department, price, cost, commission, status FROM products WHERE 1=1";
    const params = [];
    if (search) {
      sql += " AND (name LIKE ? OR sku LIKE ?)";
      const s = `%${String(search)}%`;
      params.push(s, s);
    }
    if (category && category !== "All") { sql += " AND category = ?"; params.push(category); }
    if (department && department !== "All") { sql += " AND department = ?"; params.push(department); }
    if (status && status !== "All") { sql += " AND status = ?"; params.push(status); }
    sql += " ORDER BY category, name";
    if (limit) { sql += " LIMIT ?"; params.push(Number(limit)); }
    const [rows] = await db.execute(sql, params);
    const productIds = rows.map((r) => r.id);
    let areaPricesMap = {}; // product_id -> { Lounge: number, Club: number, LD: number }
    if (productIds.length > 0) {
      const [placeholders] = [productIds.map(() => "?").join(",")];
      const [apRows] = await db.execute(
        `SELECT product_id, area, price FROM product_area_prices WHERE product_id IN (${placeholders})`,
        productIds
      );
      apRows.forEach((r) => {
        if (!areaPricesMap[r.product_id]) areaPricesMap[r.product_id] = {};
        areaPricesMap[r.product_id][r.area] = Number(r.price);
      });
    }
    const validArea = area && ["Lounge", "Club", "LD"].includes(String(area)) ? String(area) : null;
    const out = rows.map((r) => {
      const basePrice = Number(r.price);
      const pricesByArea = areaPricesMap[r.id] || {};
      const resolvedPrice = validArea && pricesByArea[validArea] != null ? pricesByArea[validArea] : basePrice;
      return {
        ...r,
        id: String(r.id),
        description: r.description ?? "",
        sub_category: r.sub_category ?? "",
        price: resolvedPrice,
        cost: Number(r.cost),
        commission: Number(r.commission),
        pricesByArea: { Lounge: pricesByArea.Lounge, Club: pricesByArea.Club, LD: pricesByArea.LD },
      };
    });
    res.json(out);
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR" || err.code === "ER_NO_SUCH_TABLE") {
      // product_area_prices or sub_category may not exist yet (migration not run)
      const db = await getPool();
      const { search, category, department, status, limit, area } = req.query;
      let sql = "SELECT id, sku, name, description, category, department, price, cost, commission, status FROM products WHERE 1=1";
      const params = [];
      if (search) { sql += " AND (name LIKE ? OR sku LIKE ?)"; const s = `%${String(search)}%`; params.push(s, s); }
      if (category && category !== "All") { sql += " AND category = ?"; params.push(category); }
      if (department && department !== "All") { sql += " AND department = ?"; params.push(department); }
      if (status && status !== "All") { sql += " AND status = ?"; params.push(status); }
      sql += " ORDER BY category, name";
      if (limit) { sql += " LIMIT ?"; params.push(Number(limit)); }
      const [rows] = await db.execute(sql, params);
      return res.json(rows.map((r) => ({
        ...r, id: String(r.id), description: r.description ?? "", sub_category: "", price: Number(r.price), cost: Number(r.cost), commission: Number(r.commission),
        pricesByArea: {},
      })));
    }
    console.error("Products list error:", err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

app.post("/api/products", async (req, res) => {
  const { sku, name, description, category, sub_category, department, price, cost, commission, status, pricesByArea } = req.body || {};
  if (!sku?.trim() || !name?.trim()) return res.status(400).json({ error: "SKU and name required" });
  try {
    const db = await getPool();
    let newId;
    try {
      const [r] = await db.execute(
        `INSERT INTO products (sku, name, description, category, sub_category, department, price, cost, commission, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(sku).trim(), String(name).trim(), description?.trim() || null, category || "Beer", (sub_category && String(sub_category).trim()) || null, department || "Bar", Number(price) || 0, Number(cost) || 0, Number(commission) || 0, status || "active"]
      );
      newId = r.insertId;
    } catch (colErr) {
      if (colErr.code === "ER_BAD_FIELD_ERROR") {
        const [r] = await db.execute(
          `INSERT INTO products (sku, name, description, category, department, price, cost, commission, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [String(sku).trim(), String(name).trim(), description?.trim() || null, category || "Beer", department || "Bar", Number(price) || 0, Number(cost) || 0, Number(commission) || 0, status || "active"]
        );
        newId = r.insertId;
      } else throw colErr;
    }
    if (pricesByArea && typeof pricesByArea === "object" && [].concat(Object.keys(pricesByArea)).some((k) => ["Lounge", "Club", "LD"].includes(k))) {
      try {
        for (const area of ["Lounge", "Club", "LD"]) {
          if (pricesByArea[area] != null && Number(pricesByArea[area]) >= 0) {
            await db.execute(
              "INSERT INTO product_area_prices (product_id, area, price) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = VALUES(price)",
              [newId, area, Number(pricesByArea[area])]
            );
          }
        }
      } catch (_) { /* table may not exist */ }
    }
    let rows;
    try {
      [rows] = await db.execute("SELECT id, sku, name, description, category, sub_category, department, price, cost, commission, status FROM products WHERE id = ?", [newId]);
    } catch (e) {
      if (e.code === "ER_BAD_FIELD_ERROR") {
        [rows] = await db.execute("SELECT id, sku, name, description, category, department, price, cost, commission, status FROM products WHERE id = ?", [newId]);
      } else throw e;
    }
    const p = rows[0];
    let savedPricesByArea = { Lounge: undefined, Club: undefined, LD: undefined };
    try {
      const [apRows] = await db.execute("SELECT area, price FROM product_area_prices WHERE product_id = ?", [newId]);
      apRows.forEach((row) => { savedPricesByArea[row.area] = Number(row.price); });
    } catch (_) { /* table may not exist */ }
    logAudit(req, "product_create", "product", String(p.id), { sku: p.sku, name: p.name });
    res.status(201).json({ id: String(p.id), ...p, sub_category: p.sub_category ?? "", price: Number(p.price), cost: Number(p.cost), commission: Number(p.commission), pricesByArea: savedPricesByArea });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "SKU already exists" });
    console.error("Product create error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const id = req.params.id;
  const { sku, name, description, category, sub_category, department, price, cost, commission, status, pricesByArea } = req.body || {};
  if (!sku?.trim() || !name?.trim()) return res.status(400).json({ error: "SKU and name required" });
  try {
    const db = await getPool();
    try {
      await db.execute(
        `UPDATE products SET sku=?, name=?, description=?, category=?, sub_category=?, department=?, price=?, cost=?, commission=?, status=? WHERE id = ?`,
        [String(sku).trim(), String(name).trim(), description?.trim() || null, category || "Beer", (sub_category && String(sub_category).trim()) || null, department || "Bar", Number(price) || 0, Number(cost) || 0, Number(commission) || 0, status || "active", id]
      );
    } catch (colErr) {
      if (colErr.code === "ER_BAD_FIELD_ERROR") {
        await db.execute(
          `UPDATE products SET sku=?, name=?, description=?, category=?, department=?, price=?, cost=?, commission=?, status=? WHERE id = ?`,
          [String(sku).trim(), String(name).trim(), description?.trim() || null, category || "Beer", department || "Bar", Number(price) || 0, Number(cost) || 0, Number(commission) || 0, status || "active", id]
        );
      } else throw colErr;
    }
    if (pricesByArea && typeof pricesByArea === "object") {
      try {
        await db.execute("DELETE FROM product_area_prices WHERE product_id = ?", [id]);
        for (const area of ["Lounge", "Club", "LD"]) {
          if (pricesByArea[area] != null && Number(pricesByArea[area]) >= 0) {
            await db.execute(
              "INSERT INTO product_area_prices (product_id, area, price) VALUES (?, ?, ?)",
              [id, area, Number(pricesByArea[area])]
            );
          }
        }
      } catch (_) { /* table may not exist */ }
    }
    let rows;
    try {
      [rows] = await db.execute("SELECT id, sku, name, description, category, sub_category, department, price, cost, commission, status FROM products WHERE id = ?", [id]);
    } catch (e) {
      if (e.code === "ER_BAD_FIELD_ERROR") {
        [rows] = await db.execute("SELECT id, sku, name, description, category, department, price, cost, commission, status FROM products WHERE id = ?", [id]);
      } else throw e;
    }
    if (rows.length === 0) return res.status(404).json({ error: "Product not found" });
    const p = rows[0];
    // Re-read pricesByArea from DB so response reflects what was saved
    let savedPricesByArea = { Lounge: undefined, Club: undefined, LD: undefined };
    try {
      const [apRows] = await db.execute("SELECT area, price FROM product_area_prices WHERE product_id = ?", [id]);
      apRows.forEach((row) => { savedPricesByArea[row.area] = Number(row.price); });
    } catch (_) { /* table may not exist */ }
    logAudit(req, "product_update", "product", id, { sku: p.sku, name: p.name });
    res.json({ id: String(p.id), ...p, sub_category: p.sub_category ?? "", price: Number(p.price), cost: Number(p.cost), commission: Number(p.commission), pricesByArea: savedPricesByArea });
  } catch (err) {
    console.error("Product update error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.patch("/api/products/:id", async (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });
  try {
    const db = await getPool();
    await db.execute("UPDATE products SET status = ? WHERE id = ?", [status, id]);
    logAudit(req, "product_set_status", "product", id, { status });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const db = await getPool();
    await db.execute("DELETE FROM product_area_prices WHERE product_id = ?", [id]);
    const [r] = await db.execute("DELETE FROM products WHERE id = ?", [id]);
    if (!r.affectedRows) return res.status(404).json({ error: "Product not found" });
    logAudit(req, "product_delete", "product", id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("Product delete error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// ---------- Staff (users; scoped by branch) ----------
// LD Ladies: staff with incentive_rate > 0 (get paid per ladies drink)
app.get("/api/staff/ld-ladies", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    // Return ALL active staff as available ladies for LD orders
    const [rows] = await db.execute(
      `SELECT u.id, u.employee_id AS code, u.name, u.nickname
       FROM users u WHERE u.branch_id = ? AND u.active = 1 ORDER BY u.name`,
      [branchId]
    );
    res.json(rows.map((r) => ({
      id: String(r.id),
      code: r.code,
      name: r.nickname || r.name,
    })));
  } catch (err) {
    console.error("LD ladies list error:", err);
    res.status(500).json({ error: "Failed to load LD ladies" });
  }
});

app.get("/api/staff/roles", async (_req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      "SELECT id, name FROM roles WHERE guard = 'web' ORDER BY id"
    );
    res.json(rows.map((r) => ({ id: String(r.id), name: r.name })));
  } catch (err) {
    console.error("Staff roles list error:", err);
    res.status(500).json({ error: "Failed to load staff roles" });
  }
});

app.get("/api/staff", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT u.id, u.employee_id AS code, u.name, u.nickname, u.email, u.allowance, u.hourly,
              u.budget, u.commission_rate, u.incentive_rate, u.table_incentive, u.has_quota, u.quota_amount,
              u.active AS status, r.name AS type
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.branch_id = ? ORDER BY u.employee_id`,
      [branchId]
    );
    res.json(rows.map((r) => ({
      id: String(r.id),
      code: r.code,
      name: r.name,
      nickname: r.nickname || "",
      type: r.type,
      allowance: Number(r.allowance || 0),
      hourly: Number(r.hourly || 0),
      budget: Number(r.budget || 0),
      commissionRate: Number(r.commission_rate || 0),
      incentiveRate: Number(r.incentive_rate || 0),
      tableIncentive: Number(r.table_incentive || 0),
      hasQuota: !!r.has_quota,
      quotaAmount: Number(r.quota_amount || 0),
      hasLogin: true,
      status: r.status === 1 ? "active" : "inactive",
    })));
  } catch (err) {
    console.error("Staff list error:", err);
    res.status(500).json({ error: "Failed to load staff" });
  }
});

app.post("/api/staff", async (req, res) => {
  const branchId = getBranchId(req);
  const { code, name, nickname, type, allowance, hourly, budget, commissionRate, incentiveRate, tableIncentive, hasQuota, quotaAmount, password } = req.body || {};
  if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: "Code and name required" });
  try {
    const db = await getPool();
    const roleId = await getWebRoleIdByName(db, normalizeStaffRoleName(type));
    const hash = password ? await bcrypt.hash(String(password), 10) : await bcrypt.hash("password", 10);
    const email = (code + "@pos.local").toLowerCase().replace(/\s/g, "");
    await db.execute(
      `INSERT INTO users (employee_id, name, email, password_hash, role_id, branch_id, nickname, allowance, hourly, 
        budget, commission_rate, incentive_rate, table_incentive, has_quota, quota_amount, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        String(code).trim().toUpperCase(), String(name).trim(), email, hash, roleId, branchId,
        nickname || null, Number(allowance) || 0, Number(hourly) || 0,
        Number(budget) || 0, Number(commissionRate) || 0, Number(incentiveRate) || 0, 
        Number(tableIncentive) || 0, hasQuota ? 1 : 0, Number(quotaAmount) || 0
      ]
    );
    const [rows] = await db.execute(
      `SELECT u.id, u.employee_id AS code, u.name, u.nickname, u.allowance, u.hourly,
              u.budget, u.commission_rate, u.incentive_rate, u.table_incentive, u.has_quota, u.quota_amount,
              r.name AS type 
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.employee_id = ?`,
      [String(code).trim().toUpperCase()]
    );
    const r = rows[0];
    if (r?.id) logAudit(req, "staff_create", "user", String(r.id), { code: String(code).trim().toUpperCase(), name: String(name).trim() });
    res.status(201).json({
      id: String(r.id), code: r.code, name: r.name, nickname: r.nickname || "", type: r.type,
      allowance: Number(r.allowance), hourly: Number(r.hourly), 
      budget: Number(r.budget || 0), commissionRate: Number(r.commission_rate || 0),
      incentiveRate: Number(r.incentive_rate || 0), tableIncentive: Number(r.table_incentive || 0),
      hasQuota: !!r.has_quota, quotaAmount: Number(r.quota_amount || 0),
      hasLogin: true, status: "active",
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Staff code already exists" });
    console.error("Staff create error:", err);
    res.status(500).json({ error: "Failed to create staff" });
  }
});

app.put("/api/staff/:id", async (req, res) => {
  const id = req.params.id;
  const { code, name, nickname, type, allowance, hourly, budget, commissionRate, incentiveRate, tableIncentive, hasQuota, quotaAmount, status } = req.body || {};
  if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: "Code and name required" });
  try {
    const db = await getPool();
    const [existingRows] = await db.execute(
      "SELECT id, role_id FROM users WHERE id = ?",
      [id]
    );
    if (!existingRows.length) return res.status(404).json({ error: "Staff not found" });
    const resolvedRoleId =
      type !== undefined
        ? await getWebRoleIdByName(db, normalizeStaffRoleName(type))
        : Number(existingRows[0].role_id);
    await db.execute(
      `UPDATE users SET employee_id=?, name=?, nickname=?, allowance=?, hourly=?, 
        budget=?, commission_rate=?, incentive_rate=?, table_incentive=?, has_quota=?, quota_amount=?,
        active=?, role_id=? WHERE id = ?`,
      [
        String(code || "").trim().toUpperCase(), String(name || "").trim(), nickname || null, 
        Number(allowance) || 0, Number(hourly) || 0,
        Number(budget) || 0, Number(commissionRate) || 0, Number(incentiveRate) || 0,
        Number(tableIncentive) || 0, hasQuota ? 1 : 0, Number(quotaAmount) || 0,
        status === "active" ? 1 : 0, resolvedRoleId, id
      ]
    );
    const [rows] = await db.execute(
      `SELECT u.id, u.employee_id AS code, u.name, u.nickname, u.allowance, u.hourly,
              u.budget, u.commission_rate, u.incentive_rate, u.table_incentive, u.has_quota, u.quota_amount,
              u.active, r.name AS type 
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    const r = rows[0];
    logAudit(req, "staff_update", "user", id, { code: r.code, name: r.name });
    res.json({
      id: String(r.id), code: r.code, name: r.name, nickname: r.nickname || "", type: r.type,
      allowance: Number(r.allowance), hourly: Number(r.hourly), 
      budget: Number(r.budget || 0), commissionRate: Number(r.commission_rate || 0),
      incentiveRate: Number(r.incentive_rate || 0), tableIncentive: Number(r.table_incentive || 0),
      hasQuota: !!r.has_quota, quotaAmount: Number(r.quota_amount || 0),
      hasLogin: true, status: r.active === 1 ? "active" : "inactive",
    });
  } catch (err) {
    console.error("Staff update error:", err);
    res.status(500).json({ error: "Failed to update staff" });
  }
});

app.patch("/api/staff/:id/status", async (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  const active = status === "active" ? 1 : 0;
  try {
    const db = await getPool();
    const [r] = await db.execute("SELECT id FROM users WHERE id = ?", [id]);
    if (!r.length) return res.status(404).json({ error: "Staff not found" });
    await db.execute("UPDATE users SET active = ? WHERE id = ?", [active, id]);
    res.json({ ok: true, status: status === "active" ? "active" : "inactive" });
  } catch (err) {
    console.error("Staff status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

app.patch("/api/staff/:id/password", async (req, res) => {
  const id = req.params.id;
  const { password } = req.body || {};
  if (!password || String(password).trim().length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }
  try {
    const db = await getPool();
    const hash = await bcrypt.hash(String(password), 10);
    const [result] = await db.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hash, id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Staff not found" });
    logAudit(req, "staff_password_reset", "user", id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Staff password reset error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

app.delete("/api/staff/:id", async (req, res) => {
  const id = req.params.id;
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const [r] = await db.execute("SELECT id FROM users WHERE id = ? AND branch_id = ?", [id, branchId]);
    if (!r.length) return res.status(404).json({ error: "Staff not found" });
    await db.execute("UPDATE order_items SET served_by = NULL WHERE served_by = ?", [id]);
    await db.execute("DELETE FROM users WHERE id = ?", [id]);
    logAudit(req, "staff_delete", "user", id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("Staff delete error:", err);
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

// ---------- Discounts ----------
app.get("/api/discounts", async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      "SELECT d.id, d.name, d.type, d.category, d.applicable_to AS applicableTo, d.value, d.valid_from AS validFrom, d.valid_to AS validTo, d.status, u.employee_id AS creator FROM discounts d LEFT JOIN users u ON u.id = d.creator_id ORDER BY d.id DESC"
    );
    res.json(rows.map((r) => ({
      ...r,
      id: String(r.id),
      applicableTo: r.applicableTo,
      category: r.category || null,
      validFrom: r.validFrom ? r.validFrom.toISOString().slice(0, 10) : null,
      validTo: r.validTo ? r.validTo.toISOString().slice(0, 10) : null,
      creator: r.creator || "—",
    })));
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      try {
        const db = await getPool();
        const [rows] = await db.execute(
          "SELECT d.id, d.name, d.type, d.applicable_to AS applicableTo, d.value, d.status, u.employee_id AS creator FROM discounts d LEFT JOIN users u ON u.id = d.creator_id ORDER BY d.id DESC"
        );
        return res.json(rows.map((r) => ({ ...r, id: String(r.id), applicableTo: r.applicableTo, category: null, validFrom: null, validTo: null, creator: r.creator || "—" })));
      } catch (e) {
        console.error("Discounts list error:", e);
        return res.status(500).json({ error: "Failed to load discounts" });
      }
    }
    console.error("Discounts list error:", err);
    res.status(500).json({ error: "Failed to load discounts" });
  }
});

app.post("/api/discounts", async (req, res) => {
  const { name, type, category, applicableTo, value, validFrom, validTo, creatorId } = req.body || {};
  if (!name?.trim() || !value?.trim()) return res.status(400).json({ error: "Name and value required" });
  try {
    const db = await getPool();
    const [r] = await db.execute(
      "INSERT INTO discounts (name, type, category, applicable_to, value, valid_from, valid_to, status, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)",
      [String(name).trim(), type || "Standalone", category || null, applicableTo || "Order", String(value).trim(), validFrom || null, validTo || null, creatorId || 1]
    );
    const [rows] = await db.execute("SELECT id, name, type, category, applicable_to AS applicableTo, value, valid_from AS validFrom, valid_to AS validTo, status FROM discounts WHERE id = ?", [r.insertId]);
    const d = rows[0];
    logAudit(req, "discount_create", "discount", String(d.id), { name: d.name });
    res.status(201).json({
      id: String(d.id), ...d, applicableTo: d.applicableTo,
      validFrom: d.validFrom ? d.validFrom.toISOString().slice(0, 10) : null,
      validTo: d.validTo ? d.validTo.toISOString().slice(0, 10) : null,
      creator: "—",
    });
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      const db = await getPool();
      const [r] = await db.execute(
        "INSERT INTO discounts (name, type, applicable_to, value, status, creator_id) VALUES (?, ?, ?, ?, 'pending', ?)",
        [String(name).trim(), type || "Standalone", applicableTo || "Order", String(value).trim(), creatorId || 1]
      );
      const [rows] = await db.execute("SELECT id, name, type, applicable_to AS applicableTo, value, status FROM discounts WHERE id = ?", [r.insertId]);
      const d = rows[0];
      return res.status(201).json({ id: String(d.id), ...d, applicableTo: d.applicableTo, category: null, validFrom: null, validTo: null, creator: "—" });
    }
    console.error("Discount create error:", err);
    res.status(500).json({ error: "Failed to create discount" });
  }
});

app.patch("/api/discounts/:id/approve", async (req, res) => {
  try {
    const db = await getPool();
    await db.execute("UPDATE discounts SET status = 'approved' WHERE id = ?", [req.params.id]);
    logAudit(req, "discount_approve", "discount", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve" });
  }
});

app.patch("/api/discounts/:id/reject", async (req, res) => {
  try {
    const db = await getPool();
    await db.execute("UPDATE discounts SET status = 'rejected' WHERE id = ?", [req.params.id]);
    logAudit(req, "discount_reject", "discount", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject" });
  }
});

app.put("/api/discounts/:id", async (req, res) => {
  const id = req.params.id;
  const { name, type, category, applicableTo, value, validFrom, validTo, status } = req.body || {};
  if (!name?.trim() || !value?.trim()) return res.status(400).json({ error: "Name and value required" });
  try {
    const db = await getPool();
    await db.execute(
      `UPDATE discounts 
       SET name = ?, type = ?, category = ?, applicable_to = ?, value = ?, valid_from = ?, valid_to = ?, status = ?
       WHERE id = ?`,
      [
        String(name).trim(),
        type || "Standalone",
        category || null,
        applicableTo || "Order",
        String(value).trim(),
        validFrom || null,
        validTo || null,
        status || "pending",
        id,
      ]
    );
    const [rows] = await db.execute(
      "SELECT id, name, type, category, applicable_to AS applicableTo, value, valid_from AS validFrom, valid_to AS validTo, status FROM discounts WHERE id = ?",
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Discount not found" });
    const d = rows[0];
    logAudit(req, "discount_update", "discount", id, { name: d.name });
    res.json({
      id: String(d.id),
      ...d,
      applicableTo: d.applicableTo,
      category: d.category || null,
      validFrom: d.validFrom ? d.validFrom.toISOString().slice(0, 10) : null,
      validTo: d.validTo ? d.validTo.toISOString().slice(0, 10) : null,
      creator: "—",
    });
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      try {
        const db = await getPool();
        await db.execute(
          "UPDATE discounts SET name = ?, type = ?, applicable_to = ?, value = ?, status = ? WHERE id = ?",
          [String(name).trim(), type || "Standalone", applicableTo || "Order", String(value).trim(), status || "pending", id]
        );
        const [rows] = await db.execute(
          "SELECT id, name, type, applicable_to AS applicableTo, value, status FROM discounts WHERE id = ?",
          [id]
        );
        if (!rows.length) return res.status(404).json({ error: "Discount not found" });
        const d = rows[0];
        logAudit(req, "discount_update", "discount", id, { name: d.name });
        return res.json({
          id: String(d.id),
          ...d,
          applicableTo: d.applicableTo,
          category: null,
          validFrom: null,
          validTo: null,
          creator: "—",
        });
      } catch (e) {
        console.error("Discount update error:", e);
        return res.status(500).json({ error: "Failed to update discount" });
      }
    }
    console.error("Discount update error:", err);
    res.status(500).json({ error: "Failed to update discount" });
  }
});

app.delete("/api/discounts/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const db = await getPool();
    const [result] = await db.execute("DELETE FROM discounts WHERE id = ?", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Discount not found" });
    logAudit(req, "discount_delete", "discount", id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Discount delete error:", err);
    res.status(500).json({ error: "Failed to delete discount" });
  }
});

// ---------- Reports ----------
// Save X/Z report (and other prints) to project prints folder — no "Save As" dialog
const PRINTS_DIR = path.join(__dirname, "..", "prints"); // __dirname set at top for ESM
app.post("/api/reports/save-print", (req, res) => {
  const { type, html } = req.body || {};
  if (!type || !html || typeof html !== "string") {
    return res.status(400).json({ error: "type and html are required" });
  }
  try {
    fs.mkdirSync(PRINTS_DIR, { recursive: true });
    const slug = type.replace(/\s+/g, "-");
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");
    const filename = `${slug}_${dateStr}_${timeStr}.html`;
    const filepath = path.join(PRINTS_DIR, filename);
    fs.writeFileSync(filepath, html, "utf8");
    res.json({ ok: true, filename, path: filepath });
  } catch (err) {
    console.error("Save print error:", err);
    res.status(500).json({ error: "Failed to save report to prints folder" });
  }
});

app.get("/api/reports/sales", async (req, res) => {
  const branchId = getBranchId(req);
  const { from, to, dayStartHour } = req.query;
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || fromDate;
  const startHour = dayStartHour != null ? Math.min(23, Math.max(0, parseInt(String(dayStartHour), 10) || 0)) : null;
  try {
    const db = await getPool();
    let sql = `SELECT o.id, o.table_id AS tableId, t.area, t.name AS tableName, o.status, o.subtotal, o.discount, o.tax, o.total, 
              o.employee_id AS employeeId, u.name AS employeeName, u.nickname AS employeeNickname,
              o.order_date AS orderDate, o.created_at AS time
       FROM orders o 
       LEFT JOIN pos_tables t ON t.branch_id = o.branch_id AND t.id = o.table_id
       LEFT JOIN users u ON u.employee_id = o.employee_id
       WHERE o.branch_id = ?`;
    const params = [branchId];
    if (startHour != null && !isNaN(startHour)) {
      const hourPad = String(startHour).padStart(2, "0");
      sql += ` AND o.created_at >= CONCAT(?, ' ', ?, ':00:00') AND o.created_at < CONCAT(DATE_ADD(?, INTERVAL 1 DAY), ' ', ?, ':00:00')`;
      params.push(fromDate, hourPad, toDate, hourPad);
    } else {
      sql += ` AND o.order_date BETWEEN ? AND ?`;
      params.push(fromDate, toDate);
    }
    sql += ` ORDER BY o.created_at DESC`;
    const [rows] = await db.execute(sql, params);
    const list = rows.map((r) => ({
      id: "ORD-" + r.id,
      tableId: r.tableId,
      area: r.area || "—",
      table: r.tableName != null ? r.tableName : (r.tableId ? `Table ${r.tableId} (removed)` : "—"),
      employee: r.employeeNickname || r.employeeName || r.employeeId || "—",
      subtotal: Number(r.subtotal),
      discount: Number(r.discount),
      tax: Number(r.tax),
      total: Number(r.total),
      status: r.status,
      time: r.time ? new Date(r.time).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : "—",
    }));
    const totalOrders = list.length;
    const totalSales = list.reduce((s, o) => s + o.total, 0);
    const totalDiscounts = list.reduce((s, o) => s + o.discount, 0);
    const totalTax = list.reduce((s, o) => s + o.tax, 0);
    res.json({ list, summary: { totalOrders, totalSales, totalDiscounts, totalTax } });
  } catch (err) {
    console.error("Sales report error:", err);
    res.status(500).json({ error: "Failed to load sales report" });
  }
});

app.get("/api/reports/payroll", async (req, res) => {
  const branchId = getBranchId(req);
  const { from, to } = req.query;
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || fromDate;
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT p.id, p.user_id AS userId, u.employee_id AS employeeId, u.name, u.allowance AS defaultAllowance, u.hourly AS perHour,
       p.allowance, p.hours, p.commission, p.incentives, p.adjustments, p.deductions,
       p.incentives_breakdown, p.adjustments_breakdown, p.deductions_breakdown,
       p.total, p.status, p.approved_by AS approvedById,
       approver.name AS approvedBy
       FROM payouts p
       JOIN users u ON u.id = p.user_id AND u.branch_id = ?
       LEFT JOIN users approver ON approver.id = p.approved_by
       WHERE p.period_from >= ? AND p.period_to <= ? ORDER BY p.id`,
      [branchId, fromDate, toDate]
    );
    const parseBreakdown = (v) => {
      if (!v) return null;
      try { return Array.isArray(typeof v === "string" ? JSON.parse(v) : v) ? (typeof v === "string" ? JSON.parse(v) : v) : null; } catch (_) { return null; }
    };
    // Get LD drink count (quantity) AND total sales amount per staff for this period
    const ldCountRows = await queryWithVoidFallback(
      db,
      `SELECT oi.served_by AS userId,
              SUM(oi.quantity) AS ldCount,
              SUM(oi.subtotal) AS ldAmount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.branch_id = ? AND oi.department = 'LD'
         AND o.order_date BETWEEN ? AND ? AND o.status = 'paid'
         AND COALESCE(oi.is_voided,0) = 0
       GROUP BY oi.served_by`,
      `SELECT oi.served_by AS userId,
              SUM(oi.quantity) AS ldCount,
              SUM(oi.subtotal) AS ldAmount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.branch_id = ? AND oi.department = 'LD'
         AND o.order_date BETWEEN ? AND ? AND o.status = 'paid'
       GROUP BY oi.served_by`,
      [branchId, fromDate, toDate]
    );
    const ldCountMap = {};
    const ldAmountMap = {};
    for (const r of (ldCountRows || [])) {
      if (r.userId) {
        ldCountMap[String(r.userId)] = Number(r.ldCount || 0);
        ldAmountMap[String(r.userId)] = Number(r.ldAmount || 0);
      }
    }
    const userIds = rows.map((r) => r.userId).filter(Boolean);
    let timeInMap = {};
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => "?").join(",");
      const [attRows] = await db.execute(
        `SELECT user_id AS userId, MIN(time_in) AS timeIn FROM attendance
         WHERE work_date BETWEEN ? AND ? AND user_id IN (${placeholders}) GROUP BY user_id`,
        [fromDate, toDate, ...userIds]
      ).catch(() => []);
      for (const a of (attRows || [])) {
        if (a.userId) timeInMap[String(a.userId)] = a.timeIn;
      }
    }
    const mapRow = (r) => {
      const incB = parseBreakdown(r.incentives_breakdown);
      const adjB = parseBreakdown(r.adjustments_breakdown);
      const dedB = parseBreakdown(r.deductions_breakdown);
      const budget = Number(r.allowance ?? 0);
      const commission = Number(r.commission ?? 0);
      const incentives = Number(r.incentives ?? 0);
      const otherIncentives = Array.isArray(incB) ? incB.reduce((s, x) => s + Number(x.amount || 0), 0) : 0;
      const adjustments = Number(r.adjustments ?? 0);
      const deductions = Number(r.deductions ?? 0);
      const netPayout = budget + commission + incentives + otherIncentives + adjustments - deductions;
      const timeIn = timeInMap[String(r.userId)];
      return {
        id: String(r.id),
        userId: String(r.userId),
        employeeId: r.employeeId,
        name: r.name,
        timeIn: timeIn ? new Date(timeIn).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
        defaultAllowance: Number(r.defaultAllowance ?? 0),
        perHour: 0,
        allowance: budget,
        hours: 0,
        commission,
        ldCount: ldCountMap[String(r.userId)] ?? 0,
        ldAmount: ldAmountMap[String(r.userId)] ?? 0,
        incentives,
        adjustments,
        deductions,
        incentivesBreakdown: incB,
        adjustmentsBreakdown: adjB,
        deductionsBreakdown: dedB,
        total: Number(r.total ?? 0),
        netPayout,
        status: r.status,
        approvedBy: r.approvedBy || null,
      };
    };
    res.json(rows.map(mapRow));
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      try {
        const db = await getPool();
        const branchId = getBranchId(req);
        const [rows] = await db.execute(
          `SELECT p.id, p.user_id AS userId, u.employee_id AS employeeId, u.name, u.allowance AS defaultAllowance, u.hourly AS perHour,
           p.allowance, p.hours, p.commission, p.incentives, p.total, p.status
           FROM payouts p JOIN users u ON u.id = p.user_id AND u.branch_id = ?
           WHERE p.period_from >= ? AND p.period_to <= ? ORDER BY p.id`,
          [branchId, fromDate, toDate]
        );
        return res.json(rows.map((r) => ({
          id: String(r.id), userId: String(r.userId), employeeId: r.employeeId, name: r.name,
          defaultAllowance: Number(r.defaultAllowance ?? 0), perHour: 0,
          allowance: Number(r.allowance), hours: 0, commission: Number(r.commission),
          incentives: Number(r.incentives ?? 0), adjustments: 0, deductions: 0,
          incentivesBreakdown: null, adjustmentsBreakdown: null, deductionsBreakdown: null,
          total: Number(r.total), netPayout: Number(r.allowance) + Number(r.commission) + Number(r.incentives ?? 0), status: r.status, approvedBy: null,
        })));
      } catch (e) {
        console.error("Payroll report error:", e);
        return res.status(500).json({ error: "Failed to load payroll report" });
      }
    }
    console.error("Payroll report error:", err);
    res.status(500).json({ error: "Failed to load payroll report" });
  }
});

app.patch("/api/reports/payroll/:id", async (req, res) => {
  const id = req.params.id;
  const { incentives, adjustments, deductions, incentivesBreakdown, adjustmentsBreakdown, deductionsBreakdown } = req.body || {};
  try {
    const db = await getPool();
    const updates = [];
    const params = [];
    let adjVal = adjustments;
    let dedVal = deductions;
    if (Array.isArray(incentivesBreakdown)) {
      const sanitized = incentivesBreakdown.filter((x) => x && typeof x.title === "string" && typeof x.amount === "number").map((x) => ({ title: String(x.title).slice(0, 128), amount: Number(x.amount) }));
      updates.push("incentives_breakdown = ?");
      params.push(JSON.stringify(sanitized));
    }
    if (incentives !== undefined) {
      updates.push("incentives = ?");
      params.push(Number(incentives) ?? 0);
    }
    if (Array.isArray(adjustmentsBreakdown)) {
      const sanitized = adjustmentsBreakdown.filter((x) => x && typeof x.title === "string" && typeof x.amount === "number").map((x) => ({ title: String(x.title).slice(0, 128), amount: Number(x.amount) }));
      updates.push("adjustments_breakdown = ?");
      params.push(JSON.stringify(sanitized));
      adjVal = sanitized.reduce((s, x) => s + x.amount, 0);
    }
    if (Array.isArray(deductionsBreakdown)) {
      const sanitized = deductionsBreakdown.filter((x) => x && typeof x.title === "string" && typeof x.amount === "number").map((x) => ({ title: String(x.title).slice(0, 128), amount: Number(x.amount) }));
      updates.push("deductions_breakdown = ?");
      params.push(JSON.stringify(sanitized));
      dedVal = sanitized.reduce((s, x) => s + x.amount, 0);
    }
    if (adjustments !== undefined) { updates.push("adjustments = ?"); params.push(Number(adjustments) ?? adjVal ?? 0); }
    else if (adjVal !== undefined) { updates.push("adjustments = ?"); params.push(Number(adjVal)); }
    if (deductions !== undefined) { updates.push("deductions = ?"); params.push(Number(deductions) ?? dedVal ?? 0); }
    else if (dedVal !== undefined) { updates.push("deductions = ?"); params.push(Number(dedVal)); }
    if (params.length) {
      params.push(id);
      await db.execute(`UPDATE payouts SET ${updates.join(", ")} WHERE id = ?`, params);
    }
    const [rows] = await db.execute(
      "SELECT allowance, commission, incentives, incentives_breakdown, adjustments, deductions FROM payouts WHERE id = ?",
      [id]
    );
    if (rows.length) {
      const r = rows[0];
      let otherInc = 0;
      try {
        const b = r.incentives_breakdown ? (typeof r.incentives_breakdown === "string" ? JSON.parse(r.incentives_breakdown) : r.incentives_breakdown) : [];
        otherInc = Array.isArray(b) ? b.reduce((s, x) => s + Number(x.amount || 0), 0) : 0;
      } catch (_) {}
      const total = Number(r.allowance) + Number(r.commission) + Number(r.incentives ?? 0) + otherInc + Number(r.adjustments ?? 0) - Number(r.deductions ?? 0);
      await db.execute("UPDATE payouts SET total = ? WHERE id = ?", [total, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      const db = await getPool();
      const up = [];
      const p = [];
      if (incentives !== undefined) { up.push("incentives = ?"); p.push(Number(incentives) || 0); }
      if (adjustments !== undefined) { up.push("adjustments = ?"); p.push(Number(adjustments) || 0); }
      if (deductions !== undefined) { up.push("deductions = ?"); p.push(Number(deductions) || 0); }
      if (p.length) { p.push(id); await db.execute(`UPDATE payouts SET ${up.join(", ")} WHERE id = ?`, p); }
      const [rows] = await db.execute("SELECT allowance, commission, incentives FROM payouts WHERE id = ?", [id]);
      if (rows.length) {
        const rr = rows[0];
        const total = Number(rr.allowance) + Number(rr.commission) + Number(rr.incentives || 0);
        await db.execute("UPDATE payouts SET total = ? WHERE id = ?", [total, id]);
      }
      return res.json({ ok: true });
    }
    console.error("Payroll update error:", err);
    res.status(500).json({ error: "Failed to update payout" });
  }
});

app.patch("/api/reports/payroll/:id/approve", async (req, res) => {
  const { approvedBy } = req.body || {};
  try {
    const db = await getPool();
    await db.execute("UPDATE payouts SET status = 'approved', approved_by = ? WHERE id = ?", [approvedBy || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      await (await getPool()).execute("UPDATE payouts SET status = 'approved' WHERE id = ?", [req.params.id]);
      return res.json({ ok: true });
    }
    res.status(500).json({ error: "Failed to approve payout" });
  }
});

// Get single payout for payslip view/print
app.get("/api/reports/payroll/:id", async (req, res) => {
  try {
    const db = await getPool();
    const id = req.params.id;
    const [rows] = await db.execute(
      `SELECT p.id, p.user_id AS userId, u.employee_id AS employeeId, u.name, u.allowance AS defaultAllowance, u.hourly AS perHour,
       p.period_from AS periodFrom, p.period_to AS periodTo,
       p.allowance, p.hours, p.commission, p.incentives, p.adjustments, p.deductions,
       p.incentives_breakdown, p.adjustments_breakdown, p.deductions_breakdown,
       p.total, p.status, p.approved_by AS approvedById,
       approver.name AS approvedBy
       FROM payouts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN users approver ON approver.id = p.approved_by
       WHERE p.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Payout not found" });
    const r = rows[0];
    const parseB = (v) => { try { const x = v ? (typeof v === "string" ? JSON.parse(v) : v) : null; return Array.isArray(x) ? x : null; } catch (_) { return null; } };
    const gross = Number(r.allowance) + Number(r.commission) + Number(r.incentives ?? 0) + Number(r.adjustments ?? 0);
    const net = gross - Number(r.deductions ?? 0);
    res.json({
      id: String(r.id),
      userId: String(r.userId),
      employeeId: r.employeeId,
      name: r.name,
      defaultAllowance: Number(r.defaultAllowance ?? 0),
      perHour: 0,
      periodFrom: r.periodFrom,
      periodTo: r.periodTo,
      allowance: Number(r.allowance),
      hours: 0,
      commission: Number(r.commission),
      incentives: Number(r.incentives ?? 0),
      adjustments: Number(r.adjustments ?? 0),
      deductions: Number(r.deductions ?? 0),
      incentivesBreakdown: parseB(r.incentives_breakdown),
      adjustmentsBreakdown: parseB(r.adjustments_breakdown),
      deductionsBreakdown: parseB(r.deductions_breakdown),
      gross,
      total: Number(r.total),
      netPayout: net,
      status: r.status,
      approvedBy: r.approvedBy || null,
    });
  } catch (err) {
    console.error("Get payout error:", err);
    res.status(500).json({ error: "Failed to load payout" });
  }
});

// Compute payouts for all staff (creates/updates payout records; scoped by branch)
// Commission = total LD sales amount (sum of LD drink prices served by this lady)
// Incentive = incentive_rate × this staff's own LD count
app.post("/api/reports/payroll/compute", async (req, res) => {
  const branchId = getBranchId(req);
  const { from, to } = req.body || {};
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || fromDate;
  
  try {
    const db = await getPool();
    
    // Total LD quantity for entire period (all staff combined) — used for incentive formula
    const totalLdRows = await queryWithVoidFallback(
      db,
      `SELECT COALESCE(SUM(oi.quantity),0) AS totalLd
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.branch_id = ? AND oi.department = 'LD'
         AND o.order_date BETWEEN ? AND ? AND o.status = 'paid'
         AND COALESCE(oi.is_voided,0) = 0`,
      `SELECT COALESCE(SUM(oi.quantity),0) AS totalLd
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.branch_id = ? AND oi.department = 'LD'
         AND o.order_date BETWEEN ? AND ? AND o.status = 'paid'`,
      [branchId, fromDate, toDate]
    );
    const totalLdAll = Number(totalLdRows[0]?.totalLd ?? 0);
    
    let taxRate = 12;
    try {
      const [setRows] = await db.execute("SELECT setting_value FROM settings WHERE setting_key = 'tax_rate' LIMIT 1");
      if (setRows.length && setRows[0].setting_value != null) taxRate = Math.max(0, parseFloat(setRows[0].setting_value) || 12);
    } catch (_) {}
    
    const [staffList] = await db.execute(
      `SELECT id, employee_id, name, allowance, hourly, budget, commission_rate, incentive_rate, table_incentive, has_quota, quota_amount
       FROM users WHERE active = 1 AND branch_id = ?`,
      [branchId]
    );
    
    const results = [];
    
    for (const staff of staffList) {
      // Count LD drinks served by this staff: total quantity AND total sales amount
      const ldRows = await queryWithVoidFallback(
        db,
        `SELECT COALESCE(SUM(oi.quantity),0) AS ldCount,
                COALESCE(SUM(oi.subtotal),0) AS ldAmount
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.branch_id = ? AND oi.served_by = ? AND oi.department = 'LD'
           AND o.order_date BETWEEN ? AND ? AND o.status = 'paid'
           AND COALESCE(oi.is_voided,0) = 0`,
        `SELECT COALESCE(SUM(oi.quantity),0) AS ldCount,
                COALESCE(SUM(oi.subtotal),0) AS ldAmount
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.branch_id = ? AND oi.served_by = ? AND oi.department = 'LD'
           AND o.order_date BETWEEN ? AND ? AND o.status = 'paid'`,
        [branchId, staff.id, fromDate, toDate]
      );

      const ldCount = Number(ldRows[0]?.ldCount || 0);
      const ldAmount = Number(ldRows[0]?.ldAmount || 0);
      // Commission = LD amount excluding tax (waiter account should not include tax)
      const taxMultiplier = 1 + taxRate / 100;
      const commission = taxMultiplier > 0 ? ldAmount / taxMultiplier : ldAmount;
      // Incentive = total all-staff LD × rate
      const rate = Number(staff.incentive_rate || 0);
      const incentives = totalLdAll * rate;
      
      const budget = Number(staff.budget || 0);
      
      const [existing] = await db.execute(
        `SELECT id, incentives_breakdown, adjustments, deductions FROM payouts WHERE user_id = ? AND period_from = ? AND period_to = ?`,
        [staff.id, fromDate, toDate]
      );
      
      const otherSum = (() => {
        if (!existing.length || !existing[0].incentives_breakdown) return 0;
        try {
          const b = typeof existing[0].incentives_breakdown === "string" ? JSON.parse(existing[0].incentives_breakdown) : existing[0].incentives_breakdown;
          return Array.isArray(b) ? b.reduce((s, x) => s + Number(x.amount || 0), 0) : 0;
        } catch (_) { return 0; }
      })();
      const adjustments = existing.length ? Number(existing[0].adjustments ?? 0) : 0;
      const deductions = existing.length ? Number(existing[0].deductions ?? 0) : 0;
      const total = budget + commission + incentives + otherSum + adjustments - deductions;
      
      if (existing.length > 0) {
        await db.execute(
          `UPDATE payouts SET allowance = ?, hours = ?, commission = ?, incentives = ?, total = ?, status = 'draft' WHERE id = ?`,
          [budget, 0, commission, incentives, total, existing[0].id]
        );
      } else {
        await db.execute(
          `INSERT INTO payouts (user_id, period_from, period_to, allowance, hours, commission, incentives, incentives_breakdown, total, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
          [staff.id, fromDate, toDate, budget, 0, commission, incentives, JSON.stringify([]), total]
        );
      }
      
      results.push({
        employeeId: staff.employee_id,
        name: staff.name,
        allowance: budget,
        commission,
        ldCount,
        ldAmount,
        incentives,
        total,
      });
    }
    
    res.json({ ok: true, computed: results.length, results });
  } catch (err) {
    console.error("Compute payouts error:", err);
    res.status(500).json({ error: "Failed to compute payouts" });
  }
});

// ============================================================================
// ATTENDANCE (TIME TRACKING)
// ============================================================================

// Clock in – create or update today's row with time_in
app.post("/api/attendance/clock-in", async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    const db = await getPool();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    await db.execute(
      `INSERT INTO attendance (user_id, work_date, time_in, break_minutes) VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE time_in = VALUES(time_in), time_out = NULL, break_minutes = 0, updated_at = NOW()`,
      [userId, today, now]
    );
    const [rows] = await db.execute(
      `SELECT id, user_id AS userId, work_date AS workDate, time_in AS timeIn, time_out AS timeOut, break_minutes AS breakMinutes
       FROM attendance WHERE user_id = ? AND work_date = ?`,
      [userId, today]
    );
    const r = rows[0];
    res.json({
      id: r.id,
      userId: String(r.userId),
      workDate: r.workDate,
      timeIn: r.timeIn,
      timeOut: r.timeOut || null,
      breakMinutes: r.breakMinutes || 0,
    });
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return res.status(503).json({ error: "Attendance table not found. Run server/schema.sql in MySQL" });
    console.error("Clock-in error:", err);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// Clock out – set time_out for today's row
app.post("/api/attendance/clock-out", async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    const db = await getPool();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const [result] = await db.execute(
      `UPDATE attendance SET time_out = ?, updated_at = NOW() WHERE user_id = ? AND work_date = ?`,
      [now, userId, today]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No clock-in found for today. Clock in first." });
    }
    const [rows] = await db.execute(
      `SELECT id, user_id AS userId, work_date AS workDate, time_in AS timeIn, time_out AS timeOut, break_minutes AS breakMinutes
       FROM attendance WHERE user_id = ? AND work_date = ?`,
      [userId, today]
    );
    const r = rows[0];
    res.json({
      id: r.id,
      userId: String(r.userId),
      workDate: r.workDate,
      timeIn: r.timeIn,
      timeOut: r.timeOut,
      breakMinutes: r.breakMinutes || 0,
    });
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return res.status(503).json({ error: "Attendance table not found. Run server/schema.sql in MySQL" });
    console.error("Clock-out error:", err);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// Get today's attendance for user (for UI state)
app.get("/api/attendance/today", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    const db = await getPool();
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await db.execute(
      `SELECT id, user_id AS userId, work_date AS workDate, time_in AS timeIn, time_out AS timeOut, break_minutes AS breakMinutes
       FROM attendance WHERE user_id = ? AND work_date = ?`,
      [userId, today]
    );
    if (!rows.length) return res.json(null);
    const r = rows[0];
    res.json({
      id: r.id,
      userId: String(r.userId),
      workDate: r.workDate,
      timeIn: r.timeIn,
      timeOut: r.timeOut || null,
      breakMinutes: r.breakMinutes || 0,
    });
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return res.json(null);
    console.error("Get today attendance error:", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

// List attendance for period (for reports / payroll)
app.get("/api/attendance", async (req, res) => {
  const { userId, from, to } = req.query;
  const fromDate = from || new Date().toISOString().slice(0, 10);
  const toDate = to || fromDate;
  try {
    const db = await getPool();
    let sql = `SELECT a.id, a.user_id AS userId, u.employee_id AS employeeId, u.name,
       a.work_date AS workDate, a.time_in AS timeIn, a.time_out AS timeOut, a.break_minutes AS breakMinutes
       FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE a.work_date BETWEEN ? AND ?`;
    const params = [fromDate, toDate];
    if (userId) {
      sql += " AND a.user_id = ?";
      params.push(userId);
    }
    sql += " ORDER BY a.work_date DESC, a.time_in DESC";
    const [rows] = await db.execute(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      userId: String(r.userId),
      employeeId: r.employeeId,
      name: r.name,
      workDate: r.workDate,
      timeIn: r.timeIn,
      timeOut: r.timeOut || null,
      breakMinutes: r.breakMinutes || 0,
    })));
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return res.json([]);
    console.error("List attendance error:", err);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

// ============================================================================
// SHIFT MANAGEMENT ENDPOINTS
// ============================================================================

// Get current open shift for user
app.get("/api/shifts/current", async (req, res) => {
  try {
    const db = await getPool();
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    const [rows] = await db.execute(
      `SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1`,
      [userId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error("Get current shift error:", err);
    res.status(500).json({ error: "Failed to get current shift" });
  }
});

// Open a new shift
app.post("/api/shifts/open", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const { userId, openingCash } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    
    const [existing] = await db.execute(
      `SELECT id FROM shifts WHERE user_id = ? AND status = 'open'`,
      [userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "User already has an open shift" });
    }
    
    const now = new Date();
    const [result] = await db.execute(
      `INSERT INTO shifts (user_id, branch_id, shift_date, start_time, opening_cash, status) VALUES (?, ?, ?, ?, ?, 'open')`,
      [userId, branchId, now.toISOString().split('T')[0], now, openingCash || 0]
    );
    
    const [newShift] = await db.execute(`SELECT * FROM shifts WHERE id = ?`, [result.insertId]);
    res.json(newShift[0]);
  } catch (err) {
    console.error("Open shift error:", err);
    res.status(500).json({ error: "Failed to open shift" });
  }
});

// Get shift summary (X reading - running totals)
app.get("/api/shifts/:id/summary", async (req, res) => {
  try {
    const db = await getPool();
    const shiftId = req.params.id;
    
    const [shift] = await db.execute(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
    if (!shift[0]) return res.status(404).json({ error: "Shift not found" });
    
    // Get sales totals since shift started (same branch as shift)
    const [salesData] = await db.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN ${SALES_CASH_COND} THEN total ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN ${SALES_CARD_COND} THEN total ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN ${SALES_GCASH_COND} THEN total ELSE 0 END), 0) as gcash_sales,
        COALESCE(SUM(CASE WHEN ${SALES_BANK_COND} THEN total ELSE 0 END), 0) as bank_sales,
        COUNT(*) as transaction_count
      FROM orders 
      WHERE branch_id = ? AND status = 'paid' AND created_at >= ?
    `, [shift[0].branch_id, shift[0].start_time]);
    
    // Get refunds total
    const [refundData] = await db.execute(`
      SELECT COALESCE(SUM(refund_amount), 0) as total_refunds
      FROM refunds 
      WHERE shift_id = ? AND status = 'completed'
    `, [shiftId]);
    
    // Get voids total
    const [voidData] = await db.execute(`
      SELECT COALESCE(SUM(voided_amount), 0) as total_voids
      FROM payment_voids 
      WHERE shift_id = ? AND status = 'completed'
    `, [shiftId]);
    
    const sales = salesData[0];
    const expectedCash = Number(shift[0].opening_cash) + Number(sales.cash_sales) - Number(refundData[0].total_refunds);
    let conversions = [];
    try {
      const [convRows] = await db.execute("SELECT from_method, to_method, amount, notes, converted_by, converted_at FROM payment_conversions WHERE shift_id = ? ORDER BY converted_at DESC", [shiftId]);
      conversions = (convRows || []).map((c) => ({ fromMethod: c.from_method, toMethod: c.to_method, amount: Number(c.amount), notes: c.notes, convertedBy: c.converted_by, convertedAt: c.converted_at }));
    } catch (_) {}
    res.json({
      shift: shift[0],
      sales: {
        cash: Number(sales.cash_sales),
        card: Number(sales.card_sales),
        gcash: Number(sales.gcash_sales),
        bank: Number(sales.bank_sales),
        total: Number(sales.cash_sales) + Number(sales.card_sales) + Number(sales.gcash_sales) + Number(sales.bank_sales),
        transactionCount: Number(sales.transaction_count),
      },
      refunds: Number(refundData[0].total_refunds),
      voids: Number(voidData[0].total_voids),
      conversions,
      expectedCash,
    });
  } catch (err) {
    console.error("Shift summary error:", err);
    res.status(500).json({ error: "Failed to get shift summary" });
  }
});

// Close shift with cash count
app.post("/api/shifts/:id/close", async (req, res) => {
  try {
    const db = await getPool();
    const shiftId = req.params.id;
    const { actualCash, cashCount, varianceReason, notes } = req.body;
    
    // Get shift and calculate expected
    const [shift] = await db.execute(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
    if (!shift[0]) return res.status(404).json({ error: "Shift not found" });
    if (shift[0].status !== 'open') return res.status(400).json({ error: "Shift already closed" });
    
    // Calculate totals
    const [salesData] = await db.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN ${SALES_CASH_COND} THEN total ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN ${SALES_CARD_COND} THEN total ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN ${SALES_GCASH_COND} THEN total ELSE 0 END), 0) as gcash_sales,
        COALESCE(SUM(CASE WHEN ${SALES_BANK_COND} THEN total ELSE 0 END), 0) as bank_sales
      FROM orders 
      WHERE status = 'paid' AND created_at >= ?
    `, [shift[0].start_time]);
    
    const [refundData] = await db.execute(`
      SELECT COALESCE(SUM(refund_amount), 0) as total FROM refunds WHERE shift_id = ? AND status = 'completed'
    `, [shiftId]);
    
    const [voidData] = await db.execute(`
      SELECT COALESCE(SUM(voided_amount), 0) as total FROM payment_voids WHERE shift_id = ? AND status = 'completed'
    `, [shiftId]);
    
    const sales = salesData[0];
    const expectedCash = Number(shift[0].opening_cash) + Number(sales.cash_sales) - Number(refundData[0].total);
    const variance = actualCash - expectedCash;
    
    // Update shift
    await db.execute(`
      UPDATE shifts SET 
        end_time = NOW(),
        status = 'closed',
        total_cash_sales = ?,
        total_card_sales = ?,
        total_gcash_sales = ?,
        total_bank_sales = ?,
        total_refunds = ?,
        total_voids = ?,
        expected_cash = ?,
        actual_cash = ?,
        cash_variance = ?,
        variance_reason = ?,
        notes = ?
      WHERE id = ?
    `, [
      sales.cash_sales, sales.card_sales, sales.gcash_sales, sales.bank_sales,
      refundData[0].total, voidData[0].total,
      expectedCash, actualCash, variance, varianceReason || null, notes || null, shiftId
    ]);
    
    // Save cash count denominations if provided
    if (cashCount && Array.isArray(cashCount)) {
      for (const item of cashCount) {
        await db.execute(
          `INSERT INTO cash_counts (shift_id, denomination, quantity, subtotal) VALUES (?, ?, ?, ?)`,
          [shiftId, item.denomination, item.quantity, item.subtotal]
        );
      }
    }
    
    const [updated] = await db.execute(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
    res.json(updated[0]);
  } catch (err) {
    console.error("Close shift error:", err);
    res.status(500).json({ error: "Failed to close shift" });
  }
});

// Approve shift with variance (supervisor approval)
app.post("/api/shifts/:id/approve", async (req, res) => {
  try {
    const db = await getPool();
    const shiftId = req.params.id;
    const { approvedBy } = req.body;
    
    await db.execute(`
      UPDATE shifts SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?
    `, [approvedBy, shiftId]);
    
    const [updated] = await db.execute(`SELECT * FROM shifts WHERE id = ?`, [shiftId]);
    res.json(updated[0]);
  } catch (err) {
    console.error("Approve shift error:", err);
    res.status(500).json({ error: "Failed to approve shift" });
  }
});

// List shifts (with filters; scoped by branch)
app.get("/api/shifts", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const { userId, status, dateFrom, dateTo, limit } = req.query;
    
    let sql = `SELECT s.*, u.name as user_name FROM shifts s LEFT JOIN users u ON s.user_id = u.id WHERE s.branch_id = ?`;
    const params = [branchId];
    
    if (userId) { sql += ` AND s.user_id = ?`; params.push(userId); }
    if (status) { sql += ` AND s.status = ?`; params.push(status); }
    if (dateFrom) { sql += ` AND s.shift_date >= ?`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND s.shift_date <= ?`; params.push(dateTo); }
    
    sql += ` ORDER BY s.start_time DESC`;
    if (limit) { sql += ` LIMIT ?`; params.push(Number(limit)); }
    
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("List shifts error:", err);
    res.status(500).json({ error: "Failed to list shifts" });
  }
});

// ============================================================================
// CHARGE / UTANG (credit payment - track who owes and paid status)
// ============================================================================

app.get("/api/charges", async (req, res) => {
  const branchId = getBranchId(req);
  const { customerName, status, from, to, limit } = req.query;
  try {
    const db = await getPool();
    let sql = "SELECT * FROM charge_transactions WHERE branch_id = ?";
    const params = [branchId];
    if (customerName && String(customerName).trim()) {
      sql += " AND customer_name LIKE ?";
      params.push("%" + String(customerName).trim() + "%");
    }
    if (status && ["pending", "paid"].includes(String(status))) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (from) { sql += " AND charged_at >= ?"; params.push(from); }
    if (to) { sql += " AND charged_at <= ?"; params.push(to + " 23:59:59"); }
    sql += " ORDER BY charged_at DESC LIMIT ?";
    params.push(Math.min(parseInt(String(limit), 10) || 200, 500));
    const [rows] = await db.execute(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      orderIds: r.order_ids,
      customerName: r.customer_name,
      amount: Number(r.amount),
      status: r.status,
      chargedAt: r.charged_at?.toISOString?.() || r.charged_at,
      paidAt: r.paid_at?.toISOString?.() || r.paid_at,
      chargedBy: r.charged_by,
      paidBy: r.paid_by,
      notes: r.notes,
    })));
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return res.json([]);
    console.error("List charges error:", err);
    res.status(500).json({ error: "Failed to list charges" });
  }
});

app.patch("/api/charges/:id/mark-paid", async (req, res) => {
  const id = req.params.id;
  const branchId = getBranchId(req);
  const { paidBy } = req.body || {};
  const { userName, employeeId } = getActingUser(req);
  try {
    const db = await getPool();
    const [rows] = await db.execute("SELECT id, status FROM charge_transactions WHERE id = ? AND branch_id = ?", [id, branchId]);
    if (!rows.length) return res.status(404).json({ error: "Charge not found" });
    if (rows[0].status === "paid") return res.status(400).json({ error: "Charge is already paid" });
    await db.execute(
      "UPDATE charge_transactions SET status = 'paid', paid_at = NOW(), paid_by = ? WHERE id = ? AND branch_id = ?",
      [paidBy || userName || employeeId || null, id, branchId]
    );
    logAudit(req, "charge_mark_paid", "charge", id, { paidBy: paidBy || userName || employeeId });
    res.json({ ok: true });
  } catch (err) {
    console.error("Mark charge paid error:", err);
    res.status(500).json({ error: "Failed to mark as paid" });
  }
});

// ============================================================================
// PAYMENT CONVERSIONS (digital -> cash, e.g. pasahod)
// ============================================================================

app.post("/api/conversions", async (req, res) => {
  const branchId = getBranchId(req);
  const { fromMethod, toMethod, amount, notes, shiftId } = req.body || {};
  const { userId, employeeId, userName, userRole } = getActingUser(req);
  if (!fromMethod || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: "fromMethod and amount are required" });
  }
  const validFrom = ["gcash", "bank", "debit", "credit"];
  if (!validFrom.includes(String(fromMethod).toLowerCase())) {
    return res.status(400).json({ error: "Invalid fromMethod. Use: gcash, maya, bank, bpi, debit, credit, online" });
  }
  try {
    const db = await getPool();
    const [r] = await db.execute(
      `INSERT INTO payment_conversions (branch_id, shift_id, from_method, to_method, amount, notes, converted_by) VALUES (?, ?, ?, 'cash', ?, ?, ?)`,
      [branchId, shiftId || null, String(fromMethod).toLowerCase(), Number(amount), notes || null, userName || employeeId || null]
    );
    const [rows] = await db.execute("SELECT * FROM payment_conversions WHERE id = ?", [r.insertId]);
    logAudit(req, "conversion_create", "conversion", String(r.insertId), { fromMethod, amount, toMethod: "cash", notes });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return res.status(503).json({ error: "Conversions table not found. Run server/schema.sql in MySQL" });
    console.error("Create conversion error:", err);
    res.status(500).json({ error: "Failed to record conversion" });
  }
});

app.get("/api/conversions", async (req, res) => {
  const branchId = getBranchId(req);
  const { shiftId, from, to, limit } = req.query;
  try {
    const db = await getPool();
    let sql = "SELECT * FROM payment_conversions WHERE branch_id = ?";
    const params = [branchId];
    if (shiftId) { sql += " AND shift_id = ?"; params.push(shiftId); }
    if (from) { sql += " AND converted_at >= ?"; params.push(from); }
    if (to) { sql += " AND converted_at <= ?"; params.push(to + " 23:59:59"); }
    sql += " ORDER BY converted_at DESC LIMIT ?";
    params.push(Math.min(parseInt(String(limit), 10) || 100, 500));
    const [rows] = await db.execute(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      shiftId: r.shift_id,
      fromMethod: r.from_method,
      toMethod: r.to_method,
      amount: Number(r.amount),
      notes: r.notes,
      convertedBy: r.converted_by,
      convertedAt: r.converted_at?.toISOString?.() || r.converted_at,
    })));
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return res.json([]);
    console.error("List conversions error:", err);
    res.status(500).json({ error: "Failed to list conversions" });
  }
});

// ============================================================================
// REFUND ENDPOINTS
// ============================================================================

// Request refund
app.post("/api/refunds", async (req, res) => {
  try {
    const db = await getPool();
    const { orderId, originalPaymentMethod, refundAmount, refundMethod, reason, requestedBy, shiftId } = req.body;
    
    const [result] = await db.execute(`
      INSERT INTO refunds (order_id, original_payment_method, refund_amount, refund_method, reason, requested_by, shift_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [orderId, originalPaymentMethod, refundAmount, refundMethod, reason, requestedBy, shiftId || null]);
    
    const [newRefund] = await db.execute(`SELECT * FROM refunds WHERE id = ?`, [result.insertId]);
    res.json(newRefund[0]);
  } catch (err) {
    console.error("Create refund error:", err);
    res.status(500).json({ error: "Failed to create refund" });
  }
});

// Approve/Complete refund
app.put("/api/refunds/:id", async (req, res) => {
  try {
    const db = await getPool();
    const refundId = req.params.id;
    const { status, approvedBy } = req.body;
    
    let sql = `UPDATE refunds SET status = ?`;
    const params = [status];
    
    if (status === 'approved' || status === 'completed') {
      sql += `, approved_by = ?`;
      params.push(approvedBy);
    }
    if (status === 'completed') {
      sql += `, completed_at = NOW()`;
    }
    
    sql += ` WHERE id = ?`;
    params.push(refundId);
    
    await db.execute(sql, params);
    const [updated] = await db.execute(`SELECT * FROM refunds WHERE id = ?`, [refundId]);
    res.json(updated[0]);
  } catch (err) {
    console.error("Update refund error:", err);
    res.status(500).json({ error: "Failed to update refund" });
  }
});

// List refunds
app.get("/api/refunds", async (req, res) => {
  try {
    const db = await getPool();
    const { orderId, status, dateFrom, dateTo } = req.query;
    
    let sql = `SELECT r.*, o.table_id, u.name as requested_by_name 
               FROM refunds r 
               LEFT JOIN orders o ON r.order_id = o.id 
               LEFT JOIN users u ON r.requested_by = u.id
               WHERE 1=1`;
    const params = [];
    
    if (orderId) { sql += ` AND r.order_id = ?`; params.push(orderId); }
    if (status) { sql += ` AND r.status = ?`; params.push(status); }
    if (dateFrom) { sql += ` AND DATE(r.created_at) >= ?`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND DATE(r.created_at) <= ?`; params.push(dateTo); }
    
    sql += ` ORDER BY r.created_at DESC`;
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("List refunds error:", err);
    res.status(500).json({ error: "Failed to list refunds" });
  }
});

// ============================================================================
// PAYMENT VOID ENDPOINTS
// ============================================================================

// Request payment void
app.post("/api/payment-voids", async (req, res) => {
  try {
    const db = await getPool();
    const { orderId, paymentMethod, voidedAmount, reason, requestedBy, shiftId } = req.body;
    
    const [result] = await db.execute(`
      INSERT INTO payment_voids (order_id, payment_method, voided_amount, reason, requested_by, shift_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `, [orderId, paymentMethod, voidedAmount, reason, requestedBy, shiftId || null]);
    
    const [newVoid] = await db.execute(`SELECT * FROM payment_voids WHERE id = ?`, [result.insertId]);
    res.json(newVoid[0]);
  } catch (err) {
    console.error("Create void error:", err);
    res.status(500).json({ error: "Failed to create payment void" });
  }
});

// Approve/Complete payment void
app.put("/api/payment-voids/:id", async (req, res) => {
  try {
    const db = await getPool();
    const voidId = req.params.id;
    const { status, approvedBy } = req.body;
    
    let sql = `UPDATE payment_voids SET status = ?`;
    const params = [status];
    
    if (status === 'approved' || status === 'completed') {
      sql += `, approved_by = ?`;
      params.push(approvedBy);
    }
    if (status === 'completed') {
      sql += `, completed_at = NOW()`;
      // Also update the order status back to pending if voiding
      const [voidInfo] = await db.execute(`SELECT order_id FROM payment_voids WHERE id = ?`, [voidId]);
      if (voidInfo[0]) {
        await db.execute(`UPDATE orders SET status = 'pending' WHERE id = ?`, [voidInfo[0].order_id]);
      }
    }
    
    sql += ` WHERE id = ?`;
    params.push(voidId);
    
    await db.execute(sql, params);
    const [updated] = await db.execute(`SELECT * FROM payment_voids WHERE id = ?`, [voidId]);
    res.json(updated[0]);
  } catch (err) {
    console.error("Update void error:", err);
    res.status(500).json({ error: "Failed to update payment void" });
  }
});

// ============================================================================
// SPLIT BILL ENDPOINTS
// ============================================================================

// Create split payment plan
app.post("/api/split-payments", async (req, res) => {
  try {
    const db = await getPool();
    const { orderId, splits } = req.body;  // splits = [{amount, paymentMethod}, ...]
    
    if (!orderId || !splits || splits.length < 2) {
      return res.status(400).json({ error: "Need at least 2 splits" });
    }
    
    // Delete any existing splits for this order
    await db.execute(`DELETE FROM split_payments WHERE order_id = ?`, [orderId]);
    
    // Create new splits
    for (let i = 0; i < splits.length; i++) {
      await db.execute(`
        INSERT INTO split_payments (order_id, split_number, amount, payment_method, status)
        VALUES (?, ?, ?, ?, 'pending')
      `, [orderId, i + 1, splits[i].amount, splits[i].paymentMethod]);
    }
    
    const [newSplits] = await db.execute(`SELECT * FROM split_payments WHERE order_id = ? ORDER BY split_number`, [orderId]);
    res.json(newSplits);
  } catch (err) {
    console.error("Create split payments error:", err);
    res.status(500).json({ error: "Failed to create split payments" });
  }
});

// Pay a split
app.put("/api/split-payments/:id/pay", async (req, res) => {
  try {
    const db = await getPool();
    const splitId = req.params.id;
    const { processedBy } = req.body;
    
    await db.execute(`
      UPDATE split_payments SET status = 'paid', paid_at = NOW(), processed_by = ? WHERE id = ?
    `, [processedBy, splitId]);
    
    // Check if all splits are paid
    const [split] = await db.execute(`SELECT order_id FROM split_payments WHERE id = ?`, [splitId]);
    if (split[0]) {
      const [pending] = await db.execute(
        `SELECT COUNT(*) as cnt FROM split_payments WHERE order_id = ? AND status = 'pending'`,
        [split[0].order_id]
      );
      if (pending[0].cnt === 0) {
        // All splits paid, update order status
        await db.execute(`UPDATE orders SET status = 'paid' WHERE id = ?`, [split[0].order_id]);
        const [orderInfo] = await db.execute(
          "SELECT table_id, branch_id FROM orders WHERE id = ?",
          [split[0].order_id]
        );
        if (orderInfo[0]?.table_id) {
          const tableId = orderInfo[0].table_id;
          const branchId = String(orderInfo[0].branch_id || "1");
          const [tablePending] = await db.execute(
            "SELECT COUNT(*) AS cnt FROM orders WHERE branch_id = ? AND table_id = ? AND status = 'pending'",
            [branchId, tableId]
          );
          if (Number(tablePending[0]?.cnt || 0) === 0) {
            await db.execute(
              "UPDATE pos_tables SET status = 'available', current_order_id = NULL WHERE branch_id = ? AND id = ?",
              [branchId, tableId]
            );
          }
        }
      }
    }
    
    const [updated] = await db.execute(`SELECT * FROM split_payments WHERE id = ?`, [splitId]);
    res.json(updated[0]);
  } catch (err) {
    console.error("Pay split error:", err);
    res.status(500).json({ error: "Failed to pay split" });
  }
});

// Get splits for order
app.get("/api/split-payments/:orderId", async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      `SELECT * FROM split_payments WHERE order_id = ? ORDER BY split_number`,
      [req.params.orderId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Get splits error:", err);
    res.status(500).json({ error: "Failed to get splits" });
  }
});

// ============================================================================
// TABLE TRANSFER / MERGE ENDPOINTS
// ============================================================================

// Transfer order(s) to another table. If transferAll: true, move ALL pending orders from fromTable to toTable.
app.post("/api/tables/transfer", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const { orderId, fromTable, toTable, transferredBy, reason, transferAll } = req.body;
    
    const [targetOrders] = await db.execute(
      `SELECT id FROM orders WHERE branch_id = ? AND table_id = ? AND status = 'pending'`,
      [branchId, toTable]
    );
    
    if (targetOrders.length > 0) {
      return res.status(400).json({ 
        error: "Target table has active order. Use merge instead.",
        existingOrderId: targetOrders[0].id 
      });
    }
    
    let orderIdsToMove = [];
    if (transferAll && fromTable && toTable) {
      const [sourceOrders] = await db.execute(
        `SELECT id FROM orders WHERE branch_id = ? AND table_id = ? AND status = 'pending' ORDER BY id`,
        [branchId, fromTable]
      );
      orderIdsToMove = sourceOrders.map((r) => r.id);
    } else if (orderId && fromTable && toTable) {
      orderIdsToMove = [orderId];
    }
    
    if (orderIdsToMove.length === 0) {
      return res.status(400).json({ error: "No orders to transfer" });
    }
    
    for (const oid of orderIdsToMove) {
      await db.execute(`UPDATE orders SET table_id = ? WHERE id = ?`, [toTable, oid]);
      await db.execute(`
        INSERT INTO table_transfers (order_id, from_table, to_table, transfer_type, transferred_by, reason)
        VALUES (?, ?, ?, 'move', ?, ?)
      `, [oid, fromTable, toTable, transferredBy || null, reason || null]);
    }
    
    await db.execute(`UPDATE pos_tables SET status = 'available', current_order_id = NULL WHERE branch_id = ? AND id = ?`, [branchId, fromTable]);
    const firstOrderId = orderIdsToMove[0];
    await db.execute(`UPDATE pos_tables SET status = 'occupied', current_order_id = ? WHERE branch_id = ? AND id = ?`, [firstOrderId, branchId, toTable]);
    
    const msg = orderIdsToMove.length > 1
      ? `${orderIdsToMove.length} orders transferred from ${fromTable} to ${toTable}`
      : `Order transferred from ${fromTable} to ${toTable}`;
    res.json({ ok: true, message: msg });
  } catch (err) {
    console.error("Transfer table error:", err);
    res.status(500).json({ error: "Failed to transfer order" });
  }
});

// Merge orders from two tables (same branch). Moves items from source order into target, then moves ALL remaining orders from source table to target table.
app.post("/api/tables/merge", async (req, res) => {
  const branchId = getBranchId(req);
  try {
    const db = await getPool();
    const { sourceOrderId, targetOrderId, transferredBy, reason } = req.body;
    
    const [sourceOrder] = await db.execute(`SELECT branch_id, table_id FROM orders WHERE id = ?`, [sourceOrderId]);
    const [targetOrder] = await db.execute(`SELECT table_id FROM orders WHERE id = ?`, [targetOrderId]);
    if (!sourceOrder[0] || !targetOrder[0]) {
      return res.status(404).json({ error: "Source or target order not found" });
    }
    if (sourceOrder[0].branch_id != null && String(sourceOrder[0].branch_id) !== branchId) {
      return res.status(403).json({ error: "Orders must belong to the same branch" });
    }
    const sourceTableId = sourceOrder[0].table_id;
    const targetTableId = targetOrder[0].table_id;
    
    // Move items from source order into target order
    const [sourceItems] = await db.execute(`SELECT * FROM order_items WHERE order_id = ?`, [sourceOrderId]);
    for (const item of sourceItems) {
      await db.execute(`UPDATE order_items SET order_id = ? WHERE id = ?`, [targetOrderId, item.id]);
    }
    
    const [totals] = await db.execute(
      `SELECT COALESCE(SUM(subtotal), 0) as subtotal FROM order_items WHERE order_id = ?`,
      [targetOrderId]
    );
    await db.execute(`UPDATE orders SET subtotal = ?, total = ? WHERE id = ?`, 
      [totals[0].subtotal, totals[0].subtotal, targetOrderId]);
    
    await db.execute(`DELETE FROM orders WHERE id = ?`, [sourceOrderId]);
    
    // Move ALL remaining pending orders from source table to target table (so source table is fully cleared)
    const [remaining] = await db.execute(
      `SELECT id FROM orders WHERE branch_id = ? AND table_id = ? AND status = 'pending' ORDER BY id`,
      [branchId, sourceTableId]
    );
    for (const row of remaining) {
      await db.execute(`UPDATE orders SET table_id = ? WHERE id = ?`, [targetTableId, row.id]);
      await db.execute(`
        INSERT INTO table_transfers (order_id, from_table, to_table, transfer_type, transferred_by, reason)
        VALUES (?, ?, ?, 'move', ?, ?)
      `, [row.id, sourceTableId, targetTableId, transferredBy || null, reason || null]);
    }
    
    // Only now set source table to available (no more orders there)
    await db.execute(
      `UPDATE pos_tables SET status = 'available', current_order_id = NULL WHERE branch_id = ? AND id = ?`,
      [branchId, sourceTableId]
    );
    // Ensure target table is occupied (use first order id we have)
    const [targetOrders] = await db.execute(
      `SELECT id FROM orders WHERE branch_id = ? AND table_id = ? AND status = 'pending' ORDER BY id LIMIT 1`,
      [branchId, targetTableId]
    );
    if (targetOrders.length > 0) {
      await db.execute(
        `UPDATE pos_tables SET status = 'occupied', current_order_id = ? WHERE branch_id = ? AND id = ?`,
        [targetOrders[0].id, branchId, targetTableId]
      );
    }
    
    await db.execute(`
      INSERT INTO table_transfers (order_id, from_table, to_table, transfer_type, transferred_by, reason)
      VALUES (?, ?, ?, 'merge', ?, ?)
    `, [targetOrderId, sourceTableId, targetTableId, transferredBy, reason || null]);
    
    res.json({ ok: true, message: "Orders merged successfully" });
  } catch (err) {
    console.error("Merge tables error:", err);
    res.status(500).json({ error: "Failed to merge orders" });
  }
});

// Get transfer history for order
app.get("/api/tables/transfers/:orderId", async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute(`
      SELECT t.*, u.name as transferred_by_name 
      FROM table_transfers t 
      LEFT JOIN users u ON t.transferred_by = u.id 
      WHERE t.order_id = ? 
      ORDER BY t.created_at DESC
    `, [req.params.orderId]);
    res.json(rows);
  } catch (err) {
    console.error("Get transfers error:", err);
    res.status(500).json({ error: "Failed to get transfer history" });
  }
});

// ---------- Settings ----------

app.get("/api/settings", async (_req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute("SELECT setting_key, setting_value FROM settings");
    const result = {};
    for (const row of rows) result[row.setting_key] = row.setting_value;
    res.json(result);
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

app.put("/api/settings", async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object") return res.status(400).json({ error: "Invalid settings payload" });
  try {
    const db = await getPool();
    const entries = Object.entries(data);
    for (const [key, value] of entries) {
      await db.execute(
        "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [key, String(value ?? "")]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Save settings error:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// Auto-migrate: add is_voided and related columns to order_items if they don't exist.
// This fixes LD count queries silently returning wrong data on older DBs.
(async () => {
  try {
    const db = await getPool();
    const migrations = [
      "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_voided TINYINT(1) NOT NULL DEFAULT 0",
      "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_by INT UNSIGNED DEFAULT NULL",
      "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP NULL DEFAULT NULL",
      "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_by_name VARCHAR(128) DEFAULT NULL",
      "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS special_request VARCHAR(512) DEFAULT NULL",
    ];
    for (const sql of migrations) {
      await db.execute(sql).catch(() => {}); // ignore if already exists
    }
    console.log("[Migration] order_items columns verified.");
  } catch (e) {
    console.warn("[Migration] Could not run auto-migration:", e.message);
  }
})();

const server = app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use. Either:`);
    console.error(`  1. Stop the other process: taskkill /F /IM node.exe  (or close the other terminal running the server)`);
    console.error(`  2. Or use another port: set PORT=3002 in server/.env and restart\n`);
    process.exit(1);
  }
  throw err;
});
