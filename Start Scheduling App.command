#!/bin/bash

# Online Scheduling App Startup Script
# Double-click this file to start both backend and frontend servers

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Clear screen for clean output
clear

echo "🚀 Starting Online Scheduling App..."
echo "===================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo ""
    echo "⚠️  Please start Docker Desktop and try again."
    echo "   Opening Docker Desktop now..."
    open -a Docker
    echo ""
    echo "Press Enter to exit..."
    read
    exit 1
fi

# Check for port 5432 conflicts (Homebrew PostgreSQL)
echo "🔍 Checking for port conflicts..."
if lsof -i :5432 | grep -q "postgres"; then
    echo "⚠️  Found PostgreSQL already running on port 5432"
    if command -v brew &> /dev/null; then
        echo "   Stopping Homebrew PostgreSQL..."
        brew services stop postgresql 2>/dev/null || true
        brew services stop postgresql@15 2>/dev/null || true
        brew services stop postgresql@16 2>/dev/null || true
    fi
    sleep 2
fi

# Start Docker PostgreSQL
echo "📊 Starting Docker PostgreSQL..."
cd "$DIR"
docker compose up -d
echo "⏳ Waiting for database to initialize..."
sleep 5

# Check if database is running
if docker ps | grep -q scheduling_db; then
    echo "✅ Database is running"
else
    echo "❌ Database failed to start"
    echo "Press Enter to exit..."
    read
    exit 1
fi

echo ""
echo "🔧 Starting Backend Server (Port 5555)..."
cd "$DIR/server"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start backend with proper error handling
(npm run dev 2>&1 | tee /tmp/scheduling-backend.log) &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

echo ""
echo "🎨 Starting Frontend Server (Port 5173)..."
cd "$DIR/client"

# Check if node_modules exists or if there's a rollup issue
if [ ! -d "node_modules" ] || [ ! -d "node_modules/@rollup" ]; then
    echo "📦 Installing frontend dependencies..."
    rm -rf node_modules package-lock.json 2>/dev/null
    npm install
fi

# Start frontend with proper error handling
(npm run dev 2>&1 | tee /tmp/scheduling-frontend.log) &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

# Wait for servers to start
echo ""
echo "⏳ Waiting for servers to initialize..."
sleep 6

# Check if servers are running
if kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; then
    echo ""
    echo "===================================="
    echo "✅ Online Scheduling App is running!"
    echo "===================================="
    echo ""
    echo "📍 Access your app at:"
    echo "   Frontend:    http://localhost:5173"
    echo "   Backend API: http://localhost:5555/api/health"
    echo "   Database:    PostgreSQL on port 5432"
    echo ""
    echo "💡 Logs saved to:"
    echo "   Backend:  /tmp/scheduling-backend.log"
    echo "   Frontend: /tmp/scheduling-frontend.log"
    echo ""
    echo "🌐 Opening app in your browser..."
    sleep 2
    open http://localhost:5173
    echo ""
    echo "✋ Keep this window open while using the app"
    echo "🛑 To stop: Close this window or press Ctrl+C"
    echo ""

    # Function to cleanup on exit
    cleanup() {
        echo ""
        echo "🛑 Stopping services..."
        
        # Kill processes
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        pkill -f "node.*scheduling-app" 2>/dev/null || true
        pkill -f "vite" 2>/dev/null || true
        
        # Stop Docker
        cd "$DIR"
        docker compose down
        
        echo "✅ All services stopped"
        echo "👋 Goodbye!"
        
        # Pause before closing
        sleep 2
    }

    # Set trap to cleanup on exit
    trap cleanup EXIT INT TERM

    # Keep script running
    while true; do
        sleep 1
    done
else
    echo ""
    echo "❌ Error: Servers failed to start"
    echo "Check logs at:"
    echo "   /tmp/scheduling-backend.log"
    echo "   /tmp/scheduling-frontend.log"
    echo ""
    echo "Press Enter to exit..."
    read
    exit 1
fi
