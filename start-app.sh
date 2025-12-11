#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Scheduling App...${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

# Start PostgreSQL
echo -e "${YELLOW}📦 Starting PostgreSQL database...${NC}"
cd /Users/mungmoong/Desktop/scheduling-app
docker compose up -d

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 5

# Check if database is running
if docker ps | grep -q scheduling_db; then
    echo -e "${GREEN}✅ Database is running${NC}"
else
    echo -e "${RED}❌ Database failed to start${NC}"
    exit 1
fi

# Start backend server
echo -e "${YELLOW}🔧 Starting backend server...${NC}"
cd /Users/mungmoong/Desktop/scheduling-app/server

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
    npm install
fi

# Start backend in background
npm run dev &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"

# Wait a moment for backend to initialize
sleep 3

# Start frontend
echo -e "${YELLOW}🎨 Starting frontend...${NC}"
cd /Users/mungmoong/Desktop/scheduling-app/client

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend in background
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"

# Display access information
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Scheduling App is running!${NC}"
echo ""
echo -e "📱 ${BLUE}Frontend:${NC} http://localhost:5173"
echo -e "⚙️  ${BLUE}Backend API:${NC} http://localhost:5555/api/health"
echo -e "🗄️  ${BLUE}Database:${NC} PostgreSQL on port 5432"
echo ""
echo -e "${YELLOW}To stop all services, press Ctrl+C${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    
    # Kill backend and frontend
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${GREEN}✅ Backend stopped${NC}"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo -e "${GREEN}✅ Frontend stopped${NC}"
    fi
    
    # Stop Docker
    cd /Users/mungmoong/Desktop/scheduling-app
    docker compose down
    echo -e "${GREEN}✅ Database stopped${NC}"
    
    echo -e "${BLUE}👋 Goodbye!${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Keep script running
while true; do
    sleep 1
done