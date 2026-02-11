import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// Database lama — READ ONLY
export const dbLegacy = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sik",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Database baru — READ + WRITE
export const dbNew = mysql.createPool({
  host: process.env.DB_NEW_HOST || "localhost",
  port: parseInt(process.env.DB_NEW_PORT) || 3306,
  user: process.env.DB_NEW_USER || "root",
  password: process.env.DB_NEW_PASSWORD || "",
  database: process.env.DB_NEW_NAME || "mera_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Default export tetap legacy untuk backward compatibility
export default dbLegacy;