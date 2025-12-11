#!/bin/bash

# Online Scheduling App Stop Script
# Double-click this file to stop all services

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Clear screen for clean output
clear

echo "🛑 Stopping Online Scheduling App..."
echo "===================================="
echo ""

# Stop Node processes
echo "📍 Stopping Node.js processes..."
pkill -f "node.*scheduling-app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "npm.*dev.*scheduling-app" 2>/dev/null || true

# Give processes time to stop
sleep 2

# Stop Docker containers
echo "📍 Stopping PostgreSQL database..."
cd "$DIR"
docker compose down

echo ""
echo "===================================="
echo "✅ All services stopped!"
echo "===================================="
echo ""
echo "👋 The Online Scheduling App has been shut down."
echo ""
echo "Press Enter to close this window..."
read