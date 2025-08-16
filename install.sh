#!/bin/bash
set -e
# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
echo "${GREEN}Installing LLM-Chatter v0.2.5...${NC}"
echo ""
# Create main directory
mkdir -p llm-chatter/client
cd llm-chatter
# Download server files
echo "${GREEN}Downloading server files...${NC}"
wget -q https://raw.githubusercontent.com/gemini2463/llm-chatter/master/server/index.js
wget -q https://raw.githubusercontent.com/gemini2463/llm-chatter/master/server/config.js
wget -q https://raw.githubusercontent.com/gemini2463/llm-chatter/master/server/package.json
wget -q https://raw.githubusercontent.com/gemini2463/llm-chatter/master/server/.env
wget -q https://raw.githubusercontent.com/gemini2463/llm-chatter/master/server/relay.js
echo ""
# Download client file
echo "${GREEN}Downloading client files...${NC}"
echo ""
wget -q https://raw.githubusercontent.com/gemini2463/llm-chatter/master/dist/index.html -O client/index.html
# Install dependencies
echo "${GREEN}Installing dependencies...${NC}"
npm install >/dev/null 2>&1
# Prompt for .env configuration
echo ""
echo "${YELLOW}Configuration needed:${NC}"
echo ""
echo "Please configure your .env file at $(pwd)/.env with the following:"
echo ""
echo ""
echo "- LLM_CHATTER_PASSPHRASE (generate at https://bcrypt.online/) This is used to encrypt the password for each user. Usernames and passwords stored here."
echo "Default username: user1"
echo "Default password: password"
echo ""
echo "- LLM_SERVER_HASH (You should generate a fresh 32-character string: https://duckduckgo.com/?q=generate+password+32+characters)"
echo ""
echo "- ALIBABA_API_KEY (from https://modelstudio.console.alibabacloud.com/)"
echo ""
echo "- ANTHROPIC_API_KEY (from https://www.anthropic.com/api)"
echo ""
echo "- DEEPSEEK_API_KEY (from https://platform.deepseek.com/api_keys)"
echo ""
echo "- GOOGLE_API_KEY (from https://ai.google.dev/gemini-api/docs/billing)"
echo ""
echo "- GROK_API_KEY (from https://console.x.ai/)"
echo ""
echo "- META_API_KEY (from https://llama.developer.meta.com/)"
echo ""
echo "- OPENAI_API_KEY (from https://platform.openai.com/account/billing)"
# Create start scripts
echo ""
echo ""
echo ""
echo "${GREEN}Creating scripts...${NC}"
# Create server start script
cat >start-server.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
node index.js
EOF
chmod +x start-server.sh
# Create client start script
cat >start-client.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")/client"
echo "Client running at http://localhost:8181"
python3 -m http.server 8181
EOF
chmod +x start-client.sh
# Create stop-all script
cat >stop-all.sh <<'EOF'
#!/bin/bash
echo "Stopped client and server."
pkill -f 'node index.js'
pkill -f 'python3 -m http.server 8181'
EOF
chmod +x stop-all.sh
# Create combined start script
cat >start-all.sh <<'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Starting server and client..."
echo ""
./start-server.sh > server.log 2>&1 &
echo "Server started"
./start-client.sh > client.log 2>&1 &
echo "Client started"
echo ""
echo "Both services are running in the background."
echo "View logs in server.log and client.log"
echo "To stop both services, run:"
echo "./stop-all.sh"
echo ""
echo "To stop the server only, run:"
echo "pkill -f 'python3 -m http.server 8181'"
echo ""
echo "To stop the client only, run:"
echo "pkill -f 'node index.js';"
echo ""
echo "Access the client at http://localhost:8181"
EOF
chmod +x start-all.sh
echo "${GREEN}Installation complete!${NC}"
echo ""
echo ""
echo "Navigate to the installation: ${YELLOW}cd llm-chatter${NC}"
echo ""
echo "To start both server and client: ${YELLOW}./start-all.sh${NC}"
echo "To stop both server and client: ${YELLOW}./stop-all.sh${NC}"
echo ""
echo ""
echo ""
echo "Then open ${YELLOW}http://localhost:8181${NC} in your browser"
# Option to start services immediately
echo ""
echo ""
echo ""
read -p "Would you like to start the server and client now? (y/n): " START_NOW
if [[ $START_NOW == "y" || $START_NOW == "Y" ]]; then
    echo "${YELLOW}Default passphrase is 'password'${NC}"
    ./start-all.sh
fi
