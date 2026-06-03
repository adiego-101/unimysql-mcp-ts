#!/bin/bash

# --- Colors for a human touch ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE} Welcome to the UniMySQL-MCP (TS) Installer${NC}"
echo -e "Preparing your personal SQL Tutor...\n"

# 1. Check for Node.js
if ! command -v node &> /dev/null
then
  echo -e "${YELLOW} Node.js not found. Please install Node.js 18+ to continue.${NC}"
  exit 1
fi

# 2. Install dependencies
echo -e " Installing dependencies..."
npm install --quiet
echo -e "${GREEN} Dependencies installed.${NC}"

# 3. Build the project
echo -e " Compiling TypeScript..."
npm run build --quiet
echo -e "${GREEN} Build successful.${NC}"

# 4. Setup .env if not exists
if [ ! -f .env ]; then
  echo -e "\n Let's configure your local database connection."
  read -p "MySQL Host (default: localhost): " db_host
  db_host=${db_host:-localhost}
  read -p "MySQL User (default: root): " db_user
  db_user=${db_user:-root}
  read -sp "MySQL Password: " db_pass
  echo ""
  read -p "MySQL Database (default: university): " db_name
  db_name=${db_name:-university}

  echo "MYSQL_HOST=$db_host" > .env
  echo "MYSQL_USER=$db_user" >> .env
  echo "MYSQL_PASSWORD=$db_pass" >> .env
  echo "MYSQL_DATABASE=$db_name" >> .env
  echo -e "${GREEN} .env file created.${NC}"
fi

# 5. Show config for agents
echo -e "\n${BLUE} All set! Now configure your favorite AI Agent:${NC}"
echo -e "\n${YELLOW}For Claude Desktop (claude_desktop_config.json):${NC}"
echo -e "{"
echo -e " \"mcpServers\": {"
echo -e "  \"unimysql-ts\": {"
echo -e "   \"command\": \"node\","
echo -e "   \"args\": [\"$(pwd)/dist/index.js\"]"
echo -e "  }"
echo -e " }"
echo -e "}"

echo -e "\n${YELLOW}For Cursor:${NC}"
echo -e "Add a new MCP server with the path: $(pwd)/dist/index.js"

echo -e "\n${GREEN}Happy learning! Enjoy your new SQL tutor! ${NC}"
