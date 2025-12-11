# Scheduling App

A full-stack scheduling application for managing teacher and student assignments across multiple rooms and time slots.

## Features

- **Dashboard Grid**: Visual scheduling grid with time slots and rooms
- **Teacher Management**: Manage teachers with availability schedules
- **Student Management**: Manage students with color keywords, weakness levels, and availability
- **Conflict Detection**: Automatic validation to prevent double-booking
- **Substitute Teachers**: Mark and track substitute teachers
- **Drag-and-Drop**: Intuitive drag-and-drop interface for scheduling
- **Color Keywords**: Filter and organize students by color tags
- **Weakness Tracking**: Track student weakness levels with teacher notes

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL (Docker)
- ES6 Modules

### Frontend
- React + Vite
- Tailwind CSS
- React Query (server state)
- Zustand (client state)
- @dnd-kit (drag-and-drop)
- Axios (API calls)

## Prerequisites

- Node.js 18+
- Docker Desktop
- npm or yarn

## Getting Started

### 1. Install Docker

If you don't have Docker installed, download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### 2. Clone and Setup

```bash
cd scheduling-app
```

### 3. Start Database

```bash
# Start PostgreSQL with Docker
docker compose up -d

# Verify database is running
docker ps
```

### 4. Start Backend

```bash
cd server
npm install
npm run dev
```

Backend will run on `http://localhost:5000`

### 5. Start Frontend

```bash
cd client
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

## API Endpoints

### Teachers
- `GET /api/teachers` - Get all teachers
- `GET /api/teachers/available?timeSlotId=1` - Get available teachers for a time slot
- `GET /api/teachers/:id` - Get teacher by ID
- `POST /api/teachers` - Create teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Students
- `GET /api/students` - Get all students
- `GET /api/students/available?timeSlotId=1` - Get available students for a time slot
- `GET /api/students/by-color?color=blue` - Get students by color keyword
- `GET /api/students/:id` - Get student by ID
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Assignments
- `GET /api/assignments?date=2025-10-14` - Get assignments for a date
- `GET /api/assignments/:id` - Get assignment by ID
- `POST /api/assignments` - Create assignment
- `POST /api/assignments/validate` - Validate assignment (check conflicts)
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment

### Time Slots
- `GET /api/timeslots` - Get all time slots

### Rooms
- `GET /api/rooms` - Get all rooms

## Database Schema

### Tables
- **teachers** - Teacher information and availability
- **students** - Student information with color keywords and weakness tracking
- **time_slots** - Time slot definitions (8AM-10AM, 10AM-12PM, etc.)
- **rooms** - Room definitions (1-37, A1-1, A1-2, etc.)
- **assignments** - Main scheduling table
- **assignment_teachers** - Teachers assigned to a room (with substitute flag)
- **assignment_students** - Students assigned to a room (with submission tracking)

## Environment Variables

### Backend (.env)
```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scheduling_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

## Development

### Reset Database

```bash
docker compose down -v
docker compose up -d
```

### View Database

```bash
docker exec -it scheduling_db psql -U postgres -d scheduling_db
```

## Project Structure

```
scheduling-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API service layer
│   │   ├── hooks/          # Custom React hooks
│   │   └── App.jsx
│   └── package.json
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── db/             # Database connection & schema
│   │   └── server.js       # Entry point
│   └── package.json
│
├── docker-compose.yml      # PostgreSQL setup
└── README.md
```

## License

MIT
