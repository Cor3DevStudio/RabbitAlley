import "dotenv/config";
import mysql from "mysql2/promise";

const db = await mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "rabbit_alley_pos",
});

const [orders] = await db.execute(
  "SELECT id, branch_id, status, payment_method, total, updated_at FROM orders ORDER BY id DESC LIMIT 8"
);
console.log("Recent orders:");
for (const o of orders) console.log(o);

try {
  const [snaps] = await db.execute(
    "SELECT id, branch_id, order_id, snapshot_type, created_at FROM receipt_snapshots ORDER BY id DESC LIMIT 8"
  );
  console.log("\nRecent receipt_snapshots:");
  for (const s of snaps) console.log(s);
} catch (e) {
  console.log("\nreceipt_snapshots table:", e.code, e.message);
}

await db.end();
