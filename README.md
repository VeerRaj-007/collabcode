# CollabCode

A real-time collaborative code editor built for pair programming and technical interviews. Multiple users can write, edit, and execute code simultaneously in the same room with live cursor presence, conflict-free sync, and shared output.

**Live Demo:** https://collabcode-livid.vercel.app

---

## Features

- **Real-time sync** : Multiple users edit the same file simultaneously. Changes appear instantly across all connected tabs using CRDTs (Conflict-free Replicated Data Types) via Yjs.
- **Live cursor presence** : See where every collaborator's cursor is in real time, with colored labels showing their username.
- **Code execution** : Run JavaScript, TypeScript, and Python directly in the browser. Output is broadcast to everyone in the room simultaneously.
- **Room-based sessions** : Create a room and share the URL. Anyone with the link can join and collaborate instantly.
- **Persistent state** : New users joining an existing room immediately see the current code and last output — no manual sync needed.
- **Authentication** : Register and log in with email and password. JWT-based sessions persist across browser reloads.
- **Language switching** : Switch between JavaScript, TypeScript, and Python mid-session.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 15 + TypeScript | Framework and routing |
| Monaco Editor | VS Code's editor, embedded in the browser |
| Yjs | CRDT library for conflict-free real-time sync |
| Socket.io Client | WebSocket connection to backend |
| Tailwind CSS v4 | Styling |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | HTTP server and REST API |
| Socket.io | WebSocket server for real-time events |
| Yjs | Server-side document state management |
| Prisma ORM | Database access layer |
| PostgreSQL | Persistent storage for users and rooms |
| bcryptjs | Password hashing |
| JSON Web Tokens | Authentication |
| child_process | Sandboxed code execution |

---

## Architecture

```
┌─────────────────────────────────────┐
│           Next.js Frontend           │
│   Monaco Editor + Yjs CRDT client   │
└────────────────┬────────────────────┘
                 │ WebSocket (Socket.io)
┌────────────────▼────────────────────┐
│         Node.js / Express            │
│   Socket.io server + Yjs document   │
│   REST API (auth, code execution)   │
└──────────┬──────────────────────────┘
           │
    ┌──────▼──────┐
    │  PostgreSQL  │
    │   (Prisma)   │
    └─────────────┘
```

### How Real-time Sync Works

When a user types a character:

1. Monaco Editor detects the change
2. MonacoBinding updates the shared Yjs document
3. Yjs creates a binary update packet (position + content + metadata)
4. Socket.io sends the update to the backend
5. Backend applies the update to its own Yjs document and broadcasts to all room members
6. Each client's Yjs receives the update and resolves any conflicts automatically
7. Monaco Editor reflects the change — under 100ms end-to-end

### Why CRDTs instead of Operational Transformation

Operational Transformation (used by Google Docs) requires a central server to coordinate all operations. CRDTs resolve conflicts by design at the data structure level — making them more suitable for distributed systems and offline-first scenarios. Yjs implements a variant of the YATA algorithm which provides O(1) conflict resolution.

### Code Execution Flow

```
User clicks Run
      ↓
Frontend sends POST /execute to backend
      ↓
Backend writes code to a temp file
      ↓
Backend spawns child process: node tempfile.js
      ↓
Captures stdout + stderr (10s timeout)
      ↓
Returns result to frontend via HTTP
      ↓
Frontend emits result via Socket.io to room
      ↓
Backend saves output to room state
      ↓
All connected clients receive and display output
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Docker Desktop (for PostgreSQL)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/VeerRaj-007/collabcode.git
cd collabcode
```

### 2. Start the database

```bash
docker run --name collabcode-db \
  -e POSTGRES_USER=collabcode \
  -e POSTGRES_PASSWORD=collabcode123 \
  -e POSTGRES_DB=collabcode \
  -p 5432:5432 \
  -d postgres
```

### 3. Setup backend

```bash
cd backend
npm install
```

Create `.env`:
```
PORT=5000
DATABASE_URL="postgresql://collabcode:collabcode123@localhost:5432/collabcode"
JWT_SECRET="your_secret_key"
```

Run migrations and start:
```bash
npx prisma migrate dev
npm run dev
```

### 4. Setup frontend

```bash
cd frontend
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

Start:
```bash
npm run dev
```

### 5. Open the app

Go to `http://localhost:3000`, register an account, and create a room.
Open the same room URL in a second browser tab to test real-time collaboration.

---

## Deployment

| Service | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | Render PostgreSQL |

---

## Project Structure

```
collabcode/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── editor/[roomId]/
│       │   │   ├── page.tsx           # Dynamic editor route
│       │   │   ├── EditorComponent.tsx # Monaco + Yjs + Socket.io
│       │   │   └── OutputPanel.tsx     # Execution output
│       │   ├── login/page.tsx
│       │   ├── register/page.tsx
│       │   └── page.tsx               # Home / room creation
│       ├── context/
│       │   └── AuthContext.tsx        # JWT auth state
│       └── lib/
│           ├── socket.ts              # Socket.io singleton
│           └── piston.ts             # Code execution API
└── backend/
    ├── src/
    │   ├── index.ts                   # Express + Socket.io server
    │   ├── prisma.ts                  # Prisma client
    │   └── routes/
    │       └── auth.ts               # Register / login / me
    └── prisma/
        └── schema.prisma             # User, Room, RoomParticipant
```

---

## Key Engineering Decisions

**Why separate frontend and backend?**
Socket.io requires a persistent, stateful WebSocket connection. Next.js API routes are stateless and terminate after each request — making them unsuitable for real-time connections.

**Why Yjs over a custom sync solution?**
Building a correct CRDT or OT implementation from scratch is a research-level problem. Yjs is a battle-tested library used in production by tools like Jupyter and ProseMirror. Using it lets us focus on the product layer.

**Why child_process for code execution?**
For a portfolio-scale project, spinning up a sandboxed process per execution is sufficient. Production-scale tools like Replit use per-user Docker containers — a natural next step.

---

## Author

Veer Raj — [GitHub](https://github.com/VeerRaj-007)
## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
