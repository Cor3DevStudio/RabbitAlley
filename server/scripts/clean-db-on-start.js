/**
 * DISABLED — Report data must never be deleted.
 * =================================================
 * This script used to wipe Sales, Product, and Void report data
 * (orders, order_items, void_log, table_sessions, receipt_snapshots,
 * shifts, payouts, attendance, audit_logs, discounts, etc.) with a
 * plain `DELETE FROM`, no backup, and no confirmation prompt.
 *
 * It has been permanently disabled because reports must be retained
 * indefinitely. It was never wired into launcher.js, start.bat, or
 * server/index.js — this guard exists solely to stop anyone from
 * running it manually or wiring it into a startup/scheduled task in
 * the future (its old "on-start" name made that an easy mistake).
 *
 * If you need to archive old report data, build a proper export/backup
 * flow instead of deleting rows.
 */

console.error(
  "[clean-db-on-start] DISABLED: this script is not allowed to run. " +
    "Report data (sales, product, and void reports) must never be deleted. " +
    "See the comment at the top of this file for details."
);
process.exit(1);
