import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/**
 * UniMySQL-MCP: The global AI Tutor for SQL students.
 * Built with TypeScript for the international community.
 */
class UniMySQLServer {
  private server: Server;
  private pool: mysql.Pool | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "unimysql-tutor-global",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    
    // Error handling - Keep it clean and quiet on stdout
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.close();
      process.exit(0);
    });
  }

  private async getPool() {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: process.env.MYSQL_HOST || "localhost",
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "test",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    }
    return this.pool;
  }

  private isDestructiveQuery(sql: string): boolean {
    const sqlUpper = sql.trim().toUpperCase();
    return sqlUpper.startsWith("UPDATE") || sqlUpper.startsWith("DELETE");
  }

  private setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_tables",
          description: "List all tables in the current database.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "describe_table",
          description: "Get schema and relationships for a specific table.",
          inputSchema: {
            type: "object",
            properties: {
              table_name: { type: "string", description: "The name of the table to describe." },
            },
            required: ["table_name"],
          },
        },
        {
          name: "execute_query",
          description: "Execute a SQL query. Destructive operations (UPDATE/DELETE) require confirm=true.",
          inputSchema: {
            type: "object",
            properties: {
              sql: { type: "string", description: "The SQL query to run." },
              confirm: { type: "boolean", description: "Must be true for UPDATE/DELETE operations.", default: false },
            },
            required: ["sql"],
          },
        },
        {
          name: "explain_query",
          description: "Analyze a SELECT query execution plan (EXPLAIN). Great for learning about indexes.",
          inputSchema: {
            type: "object",
            properties: {
              sql: { type: "string", description: "The SELECT query to analyze." },
            },
            required: ["sql"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const pool = await this.getPool();

        switch (name) {
          case "list_tables": {
            const [rows]: any = await pool.query("SHOW TABLES");
            return {
              content: [{ type: "text", text: JSON.stringify({ tables: rows.map((r: any) => Object.values(r)[0]) }, null, 2) }],
            };
          }

          case "describe_table": {
            const { table_name } = args as { table_name: string };
            if (!/^[a-zA-Z0-9_]+$/.test(table_name)) {
              throw new McpError(ErrorCode.InvalidParams, "Invalid table name format.");
            }

            const [columns]: any = await pool.query(`DESCRIBE \`${table_name}\``);
            const [relations]: any = await pool.query(`
              SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
              FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
              WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [table_name]);

            return {
              content: [{
                type: "text",
                text: JSON.stringify({ table: table_name, columns, relations: relations.length ? relations : "No FKs detected." }, null, 2)
              }],
            };
          }

          case "explain_query": {
            const { sql } = args as { sql: string };
            if (!sql.trim().toUpperCase().startsWith("SELECT")) {
              return {
                content: [{ type: "text", text: "Error: EXPLAIN only works for SELECT queries." }],
                isError: true,
              };
            }

            const [plan]: any = await pool.query(`EXPLAIN ${sql}`);
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ 
                  plan, 
                  advice: "Check the 'type' column: 'ALL' means a slow Full Table Scan. Look for 'index' or 'ref'!" 
                }, null, 2)
              }],
            };
          }

          case "execute_query": {
            let { sql, confirm } = args as { sql: string; confirm?: boolean };
            
            if (this.isDestructiveQuery(sql) && !confirm) {
              return {
                content: [{ 
                  type: "text", 
                  text: "🚨 STOP: You are attempting a destructive operation (UPDATE/DELETE). As a tutor, you MUST explain the consequences to the user and ask for explicit permission. Once they agree, call this tool again with confirm: true." 
                }],
                isError: true,
              };
            }

            // Apply a safety LIMIT 50 to SELECT queries if not present
            if (sql.trim().toUpperCase().startsWith("SELECT") && !sql.toUpperCase().includes("LIMIT")) {
              sql = sql.replace(/;?$/, " LIMIT 50;");
              process.stderr.write("INFO: Applied safety LIMIT 50.\n");
            }

            const [result]: any = await pool.query(sql);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Database Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    process.stderr.write("UniMySQL Global Tutor (TS) is running!\n");
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}

const server = new UniMySQLServer();
server.run().catch(console.error);
