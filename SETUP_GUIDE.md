# Setup Guide - Class Scheduling System

This guide will walk you through setting up the scheduling application from scratch.

## Prerequisites Check

Before starting, make sure you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Docker Desktop installed and running
- [ ] Git (optional, for version control)

## Step-by-Step Setup

### Step 1: Install Docker Desktop

If you don't have Docker installed:

1. Go to https://www.docker.com/products/docker-desktop/
2. Download for your operating system (macOS/Windows/Linux)
3. Install and start Docker Desktop
4. Verify: Run `docker --version` in terminal

### Step 2: Start the Database

```bash
# Navigate to the project root
cd scheduling-app

# Start PostgreSQL with Docker
docker compose up -d

# Verify the container is running
docker ps

# You should see a container named "scheduling_db"
```

### Step 3: Seed the Database

The database schema is automatically created when Docker starts. Now add sample data:

```bash
# Navigate to server directory
cd server

# Install dependencies (if not already done)
npm install

# Run the seed script
node src/db/seed.js
```

Expected output:
```
Starting database seeding...
Clearing existing data...
✓ Cleared existing data
Inserting teachers...
✓ Inserted 36 teachers
Inserting students...
✓ Inserted 26 students
Database seeding completed successfully! 🎉
```

### Step 4: Start the Backend Server

```bash
# In the server directory
npm run dev
```

Expected output:
```
✓ Connected to PostgreSQL database
🚀 Server running on port 5000
📍 Health check: http://localhost:5000/api/health
```

Test the server:
```bash
# In a new terminal
curl http://localhost:5000/api/health
```

### Step 5: Start the Frontend

```bash
# Open a new terminal
cd scheduling-app/client

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 6: Open the Application

1. Open your browser
2. Navigate to http://localhost:5173
3. You should see the Class Scheduling System interface

## Using the Application

### Creating an Assignment

1. Click on any empty cell in the scheduling grid
2. A modal will open showing:
   - Available teachers for that time slot
   - Available students for that time slot
3. Select up to 2 teachers (mark as substitute if needed)
4. Select up to 5 students
5. Add optional notes
6. Click "Validate" to check for conflicts
7. Click "Save" to create the assignment

### Editing an Assignment

1. Click on any filled cell
2. Modify teachers, students, or notes
3. Click "Save" to update

### Deleting an Assignment

1. Click on a filled cell
2. Click the "Delete" button at the bottom left
3. Confirm deletion

### Filtering Students by Color

1. Open an assignment modal
2. Use the "Color" dropdown in the Students section
3. Select a color to filter students

### Managing Teachers and Students

To add/edit teacher and student data:

**Option 1: Using API directly**
```bash
# Add a teacher
curl -X POST http://localhost:5000/api/teachers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Teacher",
    "availability": [1, 2, 3]
  }'

# Add a student
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Student",
    "english_name": "Nick",
    "availability": [4, 5],
    "color_keyword": "blue",
    "weakness_level": 5
  }'
```

**Option 2: Directly in database**
```bash
# Connect to PostgreSQL
docker exec -it scheduling_db psql -U postgres -d scheduling_db

# Example: Add a teacher
INSERT INTO teachers (name, availability)
VALUES ('New Teacher', '[1, 2, 3]');

# Example: Add a student with color
INSERT INTO students (name, english_name, availability, color_keyword, weakness_level)
VALUES ('Kim Min', 'Mike', '[4, 5, 6]', 'blue', 7);

# Exit
\q
```

## Troubleshooting

### Problem: Docker not found

**Solution:** Install Docker Desktop from https://www.docker.com/products/docker-desktop/

### Problem: Port 5432 already in use

**Solution:** Stop any other PostgreSQL instances:
```bash
# On macOS
brew services stop postgresql

# Or change the port in docker-compose.yml and server/.env
```

### Problem: Port 5000 already in use

**Solution:** Change the port in `server/.env`:
```
PORT=5001
```
Also update `client/.env`:
```
VITE_API_URL=http://localhost:5001/api
```

### Problem: Can't connect to database

**Solution:**
```bash
# Check if Docker container is running
docker ps

# Restart the container
docker compose restart

# Check logs
docker compose logs
```

### Problem: Frontend shows blank page

**Solution:**
1. Check browser console for errors (F12)
2. Verify backend is running on port 5000
3. Check `client/.env` has correct API URL

## Database Management

### View all tables
```bash
docker exec -it scheduling_db psql -U postgres -d scheduling_db

\dt  # List all tables
```

### Reset database
```bash
# Stop and remove containers and volumes
docker compose down -v

# Start fresh
docker compose up -d

# Re-seed
cd server && node src/db/seed.js
```

### Backup database
```bash
docker exec scheduling_db pg_dump -U postgres scheduling_db > backup.sql
```

### Restore database
```bash
docker exec -i scheduling_db psql -U postgres scheduling_db < backup.sql
```

## Time Slot IDs Reference

When working with the API or database:

- **1** = 8AM to 10AM
- **2** = 10AM to 12PM
- **3** = 1PM to 3PM
- **4** = 3PM to 5PM
- **5** = 5PM to 7PM
- **6** = 7PM to 9PM

## Color Keywords Reference

Available color keywords for students:
- red
- blue
- green
- yellow
- purple
- orange
- pink

## Next Steps

1. **Customize Time Slots:** Edit `server/src/db/schema.sql` and rebuild database
2. **Add More Rooms:** Update the rooms INSERT in `schema.sql`
3. **Build Management UI:** Create pages to add/edit teachers and students
4. **Add Authentication:** Implement user login system
5. **Deploy:** Consider services like Railway, Render, or AWS

## Support

For issues or questions:
1. Check the main README.md
2. Review API endpoints documentation
3. Check browser console and server logs
4. Verify all services are running

## Quick Reference

**Start everything:**
```bash
# Terminal 1 - Database
docker compose up -d

# Terminal 2 - Backend
cd server && npm run dev

# Terminal 3 - Frontend
cd client && npm run dev
```

**Stop everything:**
```bash
# Stop Docker
docker compose down

# Press Ctrl+C in backend and frontend terminals
```

**Check status:**
```bash
docker ps                              # Database
curl http://localhost:5000/api/health  # Backend
curl http://localhost:5173             # Frontend
```
