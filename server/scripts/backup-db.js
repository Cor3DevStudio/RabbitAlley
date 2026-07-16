import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createDatabaseBackup } from "../lib/backup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const {
  DB_HOST = "localhost",
  DB_PORT = 3306,
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_DATABASE = "rabbit_alley_pos",
} = process.env;

async function run() {
  console.log(`[Backup Script] Running CLI auto-backup...`);
  try {
    const res = await createDatabaseBackup({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
    });
    console.log(`[Backup Script] Success! File created: ${res.filename} (Method: ${res.method})`);
  } catch (err) {
    console.error(`[Backup Script] Critical Error:`, err.message);
    process.exit(1);
  }
}

run();
