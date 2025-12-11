#!/bin/bash

# ICAN Scheduler - Database Conflict Resolver
# Run this script whenever you have database connection issues

echo "🔧 ICAN Scheduler - Database Conflict Resolver"
echo "=============================================="
echo ""

# Check what's on port 5432
echo "📊 Checking port 5432..."
PORT_CHECK=$(lsof -i :5432 2>/dev/null)

if [ -z "$PORT_CHECK" ]; then
    echo "⚠️  Port 5432 is not in use"
    echo "   Starting Docker PostgreSQL..."
    cd "$(dirname "$0")"
    docker compose up -d
    sleep 5
    echo "✅ Docker PostgreSQL started"
else
    echo "Port 5432 is in use by:"
    echo "$PORT_CHECK"
    echo ""

    # Check if it's Homebrew PostgreSQL
    if echo "$PORT_CHECK" | grep -q "/opt/homebrew.*postgres"; then
        echo "⚠️  Detected Homebrew PostgreSQL (CONFLICT!)"
        echo "   This should use Docker PostgreSQL instead."
        echo ""
        read -p "Stop Homebrew PostgreSQL and start Docker? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Stopping Homebrew PostgreSQL..."
            brew services stop postgresql@15 2>/dev/null
            pkill -f "/opt/homebrew.*postgres" 2>/dev/null
            sleep 3

            echo "Starting Docker PostgreSQL..."
            cd "$(dirname "$0")"
            docker compose up -d
            sleep 5
            echo "✅ Fixed! Docker PostgreSQL is now running"
        fi
    elif echo "$PORT_CHECK" | grep -q "docker"; then
        echo "✅ Docker PostgreSQL is running (correct)"
    fi
fi

echo ""
echo "📊 Current database status:"
echo "----------------------------"

# Check Docker container
if docker ps --filter "name=scheduling_db" --filter "health=healthy" --format "{{.Names}}" | grep -q scheduling_db; then
    TEACHER_COUNT=$(docker exec scheduling_db psql -U postgres -d scheduling_db -t -c "SELECT COUNT(*) FROM teachers;" 2>/dev/null | xargs)
    echo "✅ Docker PostgreSQL: Running (${TEACHER_COUNT} teachers in database)"
else
    echo "❌ Docker PostgreSQL: Not running"
fi

# Check Homebrew PostgreSQL
if ps aux | grep -v grep | grep -q "/opt/homebrew.*postgres"; then
    echo "⚠️  Homebrew PostgreSQL: Running (SHOULD NOT BE RUNNING)"
else
    echo "✅ Homebrew PostgreSQL: Stopped (correct)"
fi

echo ""
echo "🔧 Configuration check:"
echo "----------------------"
ENV_FILE="$(dirname "$0")/server/.env"
if [ -f "$ENV_FILE" ]; then
    DB_USER=$(grep "^DB_USER=" "$ENV_FILE" | cut -d'=' -f2)
    DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)

    if [ "$DB_USER" = "postgres" ] && [ "$DB_PASSWORD" = "postgres" ]; then
        echo "✅ .env file: Configured correctly for Docker"
    else
        echo "⚠️  .env file: Misconfigured"
        echo "   DB_USER=$DB_USER (should be: postgres)"
        echo "   DB_PASSWORD=$DB_PASSWORD (should be: postgres)"
        echo ""
        read -p "Fix .env configuration? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sed -i.bak 's/^DB_USER=.*/DB_USER=postgres/' "$ENV_FILE"
            sed -i.bak 's/^DB_PASSWORD=.*/DB_PASSWORD=postgres/' "$ENV_FILE"
            echo "✅ Fixed .env configuration"
        fi
    fi
else
    echo "❌ .env file not found"
fi

echo ""
echo "=============================================="
echo "✅ Diagnosis complete!"
echo ""
echo "💡 Tips:"
echo "   • Always use 'Start Scheduling App.command' to launch"
echo "   • Docker PostgreSQL has your data (911 teachers)"
echo "   • Homebrew PostgreSQL should stay stopped"
echo ""
