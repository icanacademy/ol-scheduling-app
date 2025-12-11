#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping Scheduling App...${NC}"

# Stop any running node processes for the app
echo -e "${YELLOW}Stopping Node.js processes...${NC}"
pkill -f "node.*scheduling-app" || true
pkill -f "vite" || true

# Stop Docker containers
echo -e "${YELLOW}Stopping PostgreSQL database...${NC}"
cd /Users/mungmoong/Desktop/scheduling-app
docker compose down

echo -e "${GREEN}✅ All services stopped!${NC}"