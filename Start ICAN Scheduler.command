#!/bin/bash

# Get the directory where this script is located
cd "$(dirname "$0")"

echo "🚀 Starting ICAN Scheduler..."
echo ""

# Kill any existing processes on ports 5001 and 5173
echo "📋 Cleaning up existing processes..."
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# Start backend server
echo "🔧 Starting backend server..."
cd server
npm run dev > /tmp/ican-backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend server
echo "🎨 Starting frontend server..."
cd client
npm run dev > /tmp/ican-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to be ready
echo "⏳ Waiting for servers to start..."
sleep 3

# Get local network IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

# Check if servers are running
if lsof -ti:5001 > /dev/null && lsof -ti:5173 > /dev/null; then
    echo ""
    echo "✅ ICAN Scheduler is running!"
    echo ""
    echo "   📍 On this computer:"
    echo "      http://localhost:5173"
    echo ""
    echo "   🌐 From other computers on your network:"
    echo "      http://${LOCAL_IP}:5173"
    echo ""
    echo "🌐 Opening browser..."
    sleep 1

    # Open in default browser
    open http://localhost:5173

    echo ""
    echo "📝 Logs saved to:"
    echo "   Backend:  /tmp/ican-backend.log"
    echo "   Frontend: /tmp/ican-frontend.log"
    echo ""
    echo "⚠️  Keep this terminal window open while using the app"
    echo "   Press Ctrl+C to stop the servers"
    echo ""

    # Keep script running and handle Ctrl+C
    trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; lsof -ti:5001 | xargs kill -9 2>/dev/null; lsof -ti:5173 | xargs kill -9 2>/dev/null; echo '✅ Servers stopped'; exit" INT

    # Wait indefinitely
    while true; do
        sleep 1
    done
else
    echo ""
    echo "❌ Error: Servers failed to start"
    echo "   Check logs at /tmp/ican-backend.log and /tmp/ican-frontend.log"
    exit 1
fi
