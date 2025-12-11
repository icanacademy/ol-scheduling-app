#!/bin/bash

# Online Scheduler - Network Access Startup Script
# This script starts the scheduling app accessible from other PCs on the network

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}        Online Scheduler - Network Startup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if Docker is running
echo -e "${YELLOW}🐳 Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Starting Docker Desktop...${NC}"
    open -a Docker
    echo -e "${YELLOW}⏳ Waiting for Docker to start (this may take a minute)...${NC}"

    # Wait for Docker to be ready (max 60 seconds)
    for i in {1..60}; do
        if docker info > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Docker is ready${NC}"
            break
        fi
        sleep 1
        if [ $i -eq 60 ]; then
            echo -e "${RED}❌ Docker failed to start. Please start Docker Desktop manually and try again.${NC}"
            read -p "Press Enter to exit..."
            exit 1
        fi
    done
else
    echo -e "${GREEN}✅ Docker is running${NC}"
fi

# Start PostgreSQL database
echo -e "${YELLOW}📦 Starting PostgreSQL database...${NC}"
cd "$SCRIPT_DIR"
docker compose up -d

# Wait for database to be healthy
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
for i in {1..30}; do
    if docker exec scheduling_db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Database failed to start${NC}"
        read -p "Press Enter to exit..."
        exit 1
    fi
done

# Kill any existing node processes on ports 4477 and 4488
echo -e "${YELLOW}🧹 Cleaning up old processes...${NC}"
lsof -ti:4477 | xargs kill -9 2>/dev/null || true
lsof -ti:4488 | xargs kill -9 2>/dev/null || true

# Start the backend server (API on port 4488)
echo -e "${YELLOW}🚀 Starting backend server...${NC}"
cd "$SCRIPT_DIR/server"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing server dependencies...${NC}"
    npm install
fi

# Start server in background
node src/server.js &
SERVER_PID=$!

# Wait for server to be ready
sleep 3

# Check if server started successfully
if curl -s http://localhost:4488/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server started on port 4488${NC}"
else
    echo -e "${RED}❌ Backend server failed to start${NC}"
    read -p "Press Enter to exit..."
    exit 1
fi

# Start the frontend client (UI on port 4477)
echo -e "${YELLOW}🎨 Starting frontend client...${NC}"
cd "$SCRIPT_DIR/client"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing client dependencies...${NC}"
    npm install
fi

# Start client in background
npm run dev &
CLIENT_PID=$!

# Wait for client to be ready
sleep 5

# Check if client started successfully
if curl -s http://localhost:4477 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend client started on port 4477${NC}"
else
    echo -e "${YELLOW}⏳ Frontend still starting...${NC}"
fi

# Display access information
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Online Scheduler is running!${NC}"
echo ""
echo -e "📱 ${BLUE}Access from THIS computer:${NC}"
echo -e "   http://localhost:4477"
echo ""
echo -e "🌐 ${BLUE}Access from OTHER computers on the network:${NC}"
echo -e "   ${GREEN}http://${LOCAL_IP}:4477${NC}"
echo ""
echo -e "🤖 ${BLUE}AI Chat Assistant:${NC}"
echo -e "   Click the blue chat bubble in the bottom-right corner!"
echo ""
echo -e "⚙️  ${BLUE}API Health Check:${NC}"
echo -e "   http://${LOCAL_IP}:4488/api/health"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Keep this window open to keep the app running.${NC}"
echo -e "${YELLOW}Press Ctrl+C or close this window to stop the app.${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Open browser
open "http://localhost:4477"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping Online Scheduler...${NC}"

    # Kill client
    if [ ! -z "$CLIENT_PID" ]; then
        kill $CLIENT_PID 2>/dev/null
        echo -e "${GREEN}✅ Frontend client stopped${NC}"
    fi

    # Kill server
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        echo -e "${GREEN}✅ Backend server stopped${NC}"
    fi

    # Kill any remaining processes on these ports
    lsof -ti:4477 | xargs kill -9 2>/dev/null || true
    lsof -ti:4488 | xargs kill -9 2>/dev/null || true

    echo -e "${BLUE}👋 Goodbye!${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Keep script running
wait $SERVER_PID
