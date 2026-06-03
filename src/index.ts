import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

// Define the export directory
const EXPORTS_DIR = path.resolve(process.cwd(), "exports");
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

/**
 * UniMySQL-Tutor: The global AI Tutor for SQL students.
 * Built with TypeScript for the international community.
 */
class UniMySQLServer {
  private server: Server;
  private pool: mysql.Pool | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "mysql-mcp-guard",
        version: "0.1.2",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupResources();
    this.setupPrompts();
    this.setupTools();
    
    // Error handling
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

  private setupResources() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "mysql://localhost/schema",
          name: "Database Schema",
          mimeType: "application/json",
          description: "Complete database schema including tables and column definitions."
        }
      ]
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      if (uri !== "mysql://localhost/schema") {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }

      const pool = await this.getPool();
      const [tables]: any = await pool.query("SHOW TABLES");
      const schema: any = {};

      for (const tableRow of tables) {
        const tableName = Object.values(tableRow)[0] as string;
        const [columns]: any = await pool.query(`DESCRIBE \`${tableName}\``);
        schema[tableName] = columns;
      }

      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(schema, null, 2)
        }]
      };
    });
  }

  private setupPrompts() {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: "sql_lesson",
          description: "Learn a specific SQL concept (e.g., JOINs, Aggregate functions).",
          arguments: [
            { name: "topic", description: "The topic you want to learn.", required: true }
          ]
        },
        {
          name: "schema_audit",
          description: "Audit the current schema for normalization and best practices."
        }
      ]
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "sql_lesson") {
        const topic = args?.topic || "SQL Basics";
        return {
          description: `Educational lesson about ${topic}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `I want to learn about ${topic} in MySQL. Please check my current database schema and provide a practical example using my tables.`
              }
            }
          ]
        };
      }

      if (name === "schema_audit") {
        return {
          description: "Analyze the database design.",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Please analyze my current database schema. Check for missing primary keys, potential normalization issues (up to 3rd Normal Form), and suggest appropriate indexes."
              }
            }
          ]
        };
      }

      throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
    });
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
        {
          name: "export_data",
          description: "Export large query results to a local file (CSV/JSON). Prevents chat overflow.",
          inputSchema: {
            type: "object",
            properties: {
              sql: { type: "string", description: "The SELECT query to export." },
              filename: { type: "string", description: "Desired filename (e.g., 'students_report')." },
              format: { type: "string", enum: ["csv", "json"], default: "csv" }
            },
            required: ["sql", "filename"]
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const pool = await this.getPool();

        switch (name) {
          case "export_data": {
            const { sql, filename, format = "csv" } = args as { sql: string; filename: string; format: "csv" | "json" };
            
            if (!sql.trim().toUpperCase().startsWith("SELECT")) {
                return { content: [{ type: "text", text: "Error: Only SELECT queries can be exported." }], isError: true };
            }

            const safeFilename = filename.replace(/[^a-z0-9_-]/gi, '_') + "." + format;
            const targetPath = path.join(EXPORTS_DIR, safeFilename);

            const [rows]: any = await pool.query(sql);
            
            let content = "";
            if (format === "csv") {
                if (rows.length > 0) {
                    const headers = Object.keys(rows[0]).join(",");
                    const data = rows.map((r: any) => Object.values(r).map(v => `"${v}"`).join(",")).join("\n");
                    content = `${headers}\n${data}`;
                }
            } else {
                content = JSON.stringify(rows, null, 2);
            }

            fs.writeFileSync(targetPath, content);
            
            return {
              content: [{ 
                type: "text", 
                text: `Export Successful!\n- File: ${safeFilename}\n- Path: ${targetPath}\n- Rows: ${rows.length}\n- Format: ${format.toUpperCase()}` 
              }]
            };
          }

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
                  text: "STOP: You are attempting a destructive operation (UPDATE/DELETE). As a tutor, you MUST explain the consequences to the user and ask for explicit permission. Once they agree, call this tool again with confirm: true." 
                }],
                isError: true,
              };
            }

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
