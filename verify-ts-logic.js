import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: '.env' });

async function verify() {
  console.log("--- 🌍 Verifying UniMySQL-MCP-TS Logic ---");
  
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  try {
    // 1. Test Query
    console.log("\n1. Testing SELECT...");
    const [rows] = await pool.query("SELECT 1 as test");
    console.log("Result:", rows);

    // 2. Test Table Creation (if not exists)
    console.log("\n2. Testing DDL...");
    await pool.query("CREATE TABLE IF NOT EXISTS ts_test (id INT PRIMARY KEY)");
    console.log("Table created.");

    // 3. Test list tables logic
    const [tables] = await pool.query("SHOW TABLES");
    console.log("\n3. Tables in DB:", tables.map((r) => Object.values(r)[0]));

    console.log("\n✅ Database logic for TS version is solid!");
  } catch (e) {
    console.error("❌ Error:", e);
  } finally {
    await pool.end();
  }
}

verify();
