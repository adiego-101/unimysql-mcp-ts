# 🎓 UniMySQL-MCP (Global Tutor Edition)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![MCP Protocol](https://img.shields.io/badge/Protocol-MCP-orange.svg)](https://modelcontextprotocol.io)

> **UniMySQL-MCP** is more than just a database connector; it's the tutor you wish you had in your first year of university. Transform your AI into a SQL expert that guides, protects, and teaches you.

---

## 🌟 Why UniMySQL?

Unlike other MCP servers that are "black boxes" or security risks, UniMySQL is built on the philosophy of **Supervised Learning**:

### 1. 🛡️ Interactive Supervision Layer
If you attempt a `DELETE` or `UPDATE`, the server intercepts the request. The Tutor explains the consequences and only executes the command if you explicitly confirm. No more accidental data loss!

### 2. 📊 Educational Planner (Explain-First)
Built-in audit tools analyze how MySQL executes your queries. The AI can detect missing indexes or inefficient queries before they become a problem.

### 3. 🔗 Relationship Mapping (Oracle Style)
We automatically detect Foreign Keys (FK) and present them clearly so the LLM understands your schema without hallucinations.

---

## 🏗️ How it Works (Architecture)

```mermaid
graph TD
    User((Student)) -->|Natural Language| LLM[MCP Client]
    LLM -->|JSON-RPC| MCP[UniMySQL-MCP Server (TS)]
    
    subgraph "Safety & Tutoring"
        MCP --> Guard{Is Destructive?}
        Guard -->|Yes| Warn[Ask for Confirmation]
        Guard -->|No| Safe[Execute SQL]
    end
    
    Safe --> MySQL[(MySQL Localhost)]
    MySQL --> Results[Paginated Results]
    Results -->|Educational Feedback| LLM
```

---

## 🚀 Quick Start

### Global Installer (Recommended)
We've created a script that handles everything for you:

```bash
curl -sSL https://raw.githubusercontent.com/adiego-101/unimysql-mcp-ts/main/setup.sh | bash
```

### Manual Installation
1. **Clone the repo:**
   ```bash
   git clone https://github.com/adiego-101/unimysql-mcp-ts.git
   cd unimysql-mcp-ts
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Build the project:**
   ```bash
   npm run build
   ```
4. **Configure your `.env`:**
   Copy `.env.example` to `.env` and set your credentials.

---

## 🛠️ Agent Configuration

### Claude Desktop
Add this to your `claude_desktop_config.json`:
```json
"unimysql-ts": {
  "command": "node",
  "args": ["/absolute/path/to/unimysql-mcp-ts/dist/index.js"]
}
```

### Cursor / Gemini CLI
Point the MCP server to the `dist/index.js` file path.

---

## 🔐 The "Tutor User" (Best Practices)
Don't use `root`. Be a good engineer and create a user with just enough permissions:

```sql
CREATE USER 'mcp_tutor'@'localhost' IDENTIFIED BY 'your_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON university.* TO 'mcp_tutor'@'localhost';
FLUSH PRIVILEGES;
```

---

## 🤝 Contributing
This is an **Open Source** project for students. If you have an idea for a new educational tool, open a PR!

*Made with ❤️ for the OpenAI community and students worldwide.* ⭐
