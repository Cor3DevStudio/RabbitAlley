import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUPS_DIR = path.join(__dirname, "..", "..", "backups");

function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function runMysqldump(outputPath, config) {
  return new Promise((resolve, reject) => {
    const args = [
      `-h${config.host}`,
      `-P${config.port}`,
      `-u${config.user}`,
    ];
    if (config.password) {
      args.push(`-p${config.password}`);
    }
    args.push(config.database);

    const dumpProcess = spawn("mysqldump", args, { shell: true });
    const writeStream = fs.createWriteStream(outputPath);

    dumpProcess.stdout.pipe(writeStream);

    let errorData = "";
    dumpProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    dumpProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`mysqldump process exited with code ${code}. Error: ${errorData}`));
      }
    });

    dumpProcess.on("error", (err) => {
      reject(err);
    });
  });
}

async function runJsBackup(outputPath, config) {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    const [tables] = await conn.query("SHOW FULL TABLES");
    const tableNames = tables.map((t) => Object.values(t)[0]);
    const tableTypes = tables.map((t) => Object.values(t)[1]); // BASE TABLE or VIEW

    const sqlContent = [
      `-- Rabbit Alley POS Database Backup`,
      `-- Generated on ${new Date().toISOString()}`,
      `-- Database: ${config.database}`,
      `-- Host: ${config.host}`,
      ``,
      `SET FOREIGN_KEY_CHECKS = 0;`,
      ``,
    ];

    // Export structure and data for each base table
    for (let i = 0; i < tableNames.length; i++) {
      const name = tableNames[i];
      const type = tableTypes[i];

      if (type === "VIEW") continue;

      sqlContent.push(`-- ------------------------------------------------------`);
      sqlContent.push(`-- Table structure for table \`${name}\``);
      sqlContent.push(`-- ------------------------------------------------------`);
      sqlContent.push(`DROP TABLE IF EXISTS \`${name}\`;`);

      const [[showCreateTable]] = await conn.query(`SHOW CREATE TABLE \`${name}\``);
      const createSql = showCreateTable["Create Table"];
      sqlContent.push(`${createSql};`);
      sqlContent.push(``);

      sqlContent.push(`-- Dumping data for table \`${name}\``);
      const [rows] = await conn.query(`SELECT * FROM \`${name}\``);
      if (rows.length > 0) {
        sqlContent.push(`INSERT INTO \`${name}\` VALUES`);
        const valueStrings = [];
        for (const row of rows) {
          const rowValues = Object.values(row).map((val) => {
            if (val === null) return "NULL";
            if (typeof val === "number" || typeof val === "boolean") return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (val instanceof Buffer) return `X'${val.toString("hex")}'`;
            // Escape string
            return `'${String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
          });
          valueStrings.push(`(${rowValues.join(",")})`);
        }
        sqlContent.push(valueStrings.join(",\n") + ";");
      }
      sqlContent.push(``);
    }

    // Export views after base tables
    for (let i = 0; i < tableNames.length; i++) {
      const name = tableNames[i];
      const type = tableTypes[i];

      if (type !== "VIEW") continue;

      sqlContent.push(`-- ------------------------------------------------------`);
      sqlContent.push(`-- View structure for view \`${name}\``);
      sqlContent.push(`-- ------------------------------------------------------`);
      sqlContent.push(`DROP VIEW IF EXISTS \`${name}\`;`);

      const [[showCreateView]] = await conn.query(`SHOW CREATE VIEW \`${name}\``);
      const createSql = showCreateView["Create View"];
      sqlContent.push(`${createSql};`);
      sqlContent.push(``);
    }

    sqlContent.push(`SET FOREIGN_KEY_CHECKS = 1;`);

    fs.writeFileSync(outputPath, sqlContent.join("\n"), "utf8");
  } finally {
    if (conn) await conn.end();
  }
}

async function cleanOldBackups(backupsDir) {
  try {
    const files = fs.readdirSync(backupsDir);
    const backupFiles = files
      .filter((f) => f.startsWith("backup_") && f.endsWith(".sql"))
      .map((f) => {
        const filePath = path.join(backupsDir, f);
        const stat = fs.statSync(filePath);
        return { name: f, path: filePath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    // Keep the last 30 backups
    const maxBackups = 30;
    if (backupFiles.length > maxBackups) {
      for (let i = maxBackups; i < backupFiles.length; i++) {
        fs.unlinkSync(backupFiles[i].path);
      }
    }
  } catch (err) {
    console.error("[backup] Error cleaning old backups:", err.message);
  }
}

export async function createDatabaseBackup(dbConfig) {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = getTimestamp();
  const filename = `backup_${timestamp}.sql`;
  const outputPath = path.join(BACKUPS_DIR, filename);

  const config = {
    host: dbConfig.host || "localhost",
    port: Number(dbConfig.port) || 3306,
    user: dbConfig.user || "root",
    password: dbConfig.password || "",
    database: dbConfig.database || "rabbit_alley_pos",
  };

  try {
    // Try mysqldump first
    await runMysqldump(outputPath, config);
    await cleanOldBackups(BACKUPS_DIR);
    return { success: true, filename, method: "mysqldump", path: outputPath };
  } catch (err) {
    // Fall back to pure JS backup
    try {
      await runJsBackup(outputPath, config);
      await cleanOldBackups(BACKUPS_DIR);
      return { success: true, filename, method: "js_fallback", path: outputPath };
    } catch (jsErr) {
      throw new Error(`Backup failed: ${err.message} / JS fallback: ${jsErr.message}`);
    }
  }
}

export function listBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  try {
    const files = fs.readdirSync(BACKUPS_DIR);
    return files
      .filter((f) => f.startsWith("backup_") && f.endsWith(".sql"))
      .map((f) => {
        const filePath = path.join(BACKUPS_DIR, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.birthtime,
          path: filePath,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}
