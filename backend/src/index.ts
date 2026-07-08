import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import * as Y from "yjs";
import authRouter from "./routes/auth";
import { exec } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

dotenv.config();

const app = express();
const httpServer = createServer(app);

// const io = new Server(httpServer, {
//   cors: {
//     origin: "http://localhost:3000",
//     methods: ["GET", "POST"],
//   },
// });

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: "*",
  }),
);

const LANGUAGE_CONFIG: Record<string, { ext: string; cmd: string }> = {
  javascript: { ext: "js", cmd: "node" },
  python: { ext: "py", cmd: "python" },
  typescript: { ext: "ts", cmd: "npx ts-node" },
};

//app.post("/execute", async (req, res) => {
// const { language, code } = req.body;
//
//  console.log("Execute request:", { language });
//
//  const config = LANGUAGE_CONFIG[language];
//  if (!config) {
//    res.status(400).json({
//      run: {
//        stdout: "",
//
//        stderr: `Language "${language}" is not supported yet.`,
//        code: 1,
//      },
//    });
//    return;
//  }
//
//  const filename = `collab_${Date.now()}.${config.ext}`;
//  const filepath = join(os.tmpdir(), filename);
//
//  try {
//    // Block dangerous operations
//    const BLOCKED_PATTERNS = [
//      "rmdirSync",
//      "unlinkSync",
//      "rmSync", // file deletion
//      "execSync",
//      "spawnSync", // shell execution
//      "process.exit", // killing server
//      'require("child_process")', // subprocess
//      "require('child_process')",
//      "__dirname",
//      "process.env", // server internals
//    ];
//
//    const isDangerous = BLOCKED_PATTERNS.some((pattern) =>
//      code.includes(pattern),
//    );
//
//    if (isDangerous) {
//      res.json({
//        run: {
//          stdout: "",
//          stderr: "This operation is not allowed for security reasons.",
//          code: 1,
//        },
//      });
//      return;
//    }
//
//    await writeFile(filepath, code, "utf8");
//
//    const { stdout, stderr } = await execAsync(`${config.cmd} "${filepath}"`, {
//      timeout: 10000,
//      maxBuffer: 1024 * 1024,
//    });
//
//  /  res.json({
//      run: { stdout, stderr, code: 0 },
//    });
//  } catch (error: any) {
//    // Clean up temp file path from error messages so users don't see internal paths
//    const cleanError = (error.stderr || error.message || "Execution failed")
//      .replace(/C:\\.*?collab_\d+\.\w+/g, "main")
//      .replace(/\/.*?collab_\d+\.\w+/g, "main");
//
//    res.json({
//      run: {
//        stdout: error.stdout || "",
//        stderr: cleanError,
//        code: 1,
//      },
//    });
//  } finally {
//    unlink(filepath).catch(() => {});
//  }
//});

app.post("/execute", async (req, res) => {
  const { language, code } = req.body;

  console.log("Execute request:", { language });

  const BLOCKED_PATTERNS = [
    "rmdirSync",
    "unlinkSync",
    "rmSync",
    "execSync",
    "spawnSync",
    "process.exit",
    'require("child_process")',
    "require('child_process')",
    "process.env",
  ];

  const isDangerous = BLOCKED_PATTERNS.some((pattern) =>
    code.includes(pattern),
  );
  if (isDangerous) {
    res.json({
      run: {
        stdout: "",
        stderr: "This operation is not allowed for security reasons.",
        code: 1,
      },
    });
    return;
  }

  const LANGUAGE_CONFIG: Record<string, { ext: string; cmd: string }> = {
    javascript: { ext: "js", cmd: "node" },
    typescript: { ext: "ts", cmd: "npx ts-node" },
    python: { ext: "py", cmd: "python3" },
  };

  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    res.json({
      run: {
        stdout: "",
        stderr: `Language "${language}" is not supported yet.`,
        code: 1,
      },
    });
    return;
  }

  const { writeFile, unlink } = require("fs").promises;
  const { join } = require("path");
  const { promisify } = require("util");
  const { exec } = require("child_process");
  const os = require("os");
  const execAsync = promisify(exec);

  const filename = `collab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${config.ext}`;
  const filepath = join(os.tmpdir(), filename);

  try {
    await writeFile(filepath, code, "utf8");

    const { stdout, stderr } = await execAsync(`${config.cmd} "${filepath}"`, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });

    res.json({ run: { stdout, stderr, code: 0 } });
  } catch (error: any) {
    const cleanError = (error.stderr || error.message || "Execution failed")
      .replace(/\/tmp\/collab_[\w.]+/g, "main")
      .replace(/C:\\.*?collab_[\w.]+/g, "main");

    res.json({
      run: {
        stdout: error.stdout || "",
        stderr: cleanError,
        code: 1,
      },
    });
  } finally {
    unlink(filepath).catch(() => {});
  }
});

app.get("/", (req, res) => {
  res.json({ message: "CollabCode backend is running" });
});

// Track users in each room
const rooms = new Map<string, Set<{ socketId: string; username: string }>>();

// Track Yjs document for each room
// This holds the current state of the code in each room
const documents = new Map<string, Y.Doc>();
const lastOutput = new Map<
  string,
  {
    stdout: string;
    stderr: string;
    code: number;
    language: string;
  }
>();

// Proxy route for code execution
app.post("/execute", async (req, res) => {
  try {
    const { language, version, code } = req.body;

    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version,
        files: [{ content: code }],
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to execute code" });
  }
});

io.on("connection", (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  let currentRoom: string | null = null;
  let currentUsername: string | null = null;

  socket.on(
    "join-room",
    ({ roomId, username }: { roomId: string; username: string }) => {
      if (currentRoom) {
        socket.leave(currentRoom);
        removeUserFromRoom(currentRoom, socket.id);
      }

      socket.join(roomId);
      currentRoom = roomId;
      currentUsername = username;

      // Create room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId)!.add({ socketId: socket.id, username });

      // Create Yjs document for room if it doesn't exist
      if (!documents.has(roomId)) {
        documents.set(roomId, new Y.Doc());
      }

      // Send current document state to the new user
      // So they see existing code immediately
      const doc = documents.get(roomId)!;

      const currentState = Y.encodeStateAsUpdate(doc);
      socket.emit("sync-state", { update: Array.from(currentState) });

      // Tell everyone in room about users// Send last output if it exists
      if (lastOutput.has(roomId)) {
        socket.emit("code-output", { output: lastOutput.get(roomId) });
      }
      io.to(roomId).emit("room-users", {
        users: Array.from(rooms.get(roomId)!),
        count: rooms.get(roomId)!.size,
      });

      console.log(`${username} joined room ${roomId}`);
    },
  );

  // When a user makes a change, broadcast it to others
  socket.on(
    "code-update",
    ({ roomId, update }: { roomId: string; update: number[] }) => {
      if (!documents.has(roomId)) return;

      // Apply update to server's document
      const doc = documents.get(roomId)!;
      Y.applyUpdate(doc, new Uint8Array(update));

      // Broadcast to everyone else in the room
      socket.to(roomId).emit("code-update", { update });
    },
  );

  // Broadcast cursor/awareness updates to others in room
  socket.on(
    "awareness-update",
    ({ roomId, update }: { roomId: string; update: number[] }) => {
      socket.to(roomId).emit("awareness-update", { update });
    },
  );

  socket.on("disconnect", () => {
    if (currentRoom) {
      removeUserFromRoom(currentRoom, socket.id);
      if (rooms.has(currentRoom)) {
        io.to(currentRoom).emit("room-users", {
          users: Array.from(rooms.get(currentRoom)!),
          count: rooms.get(currentRoom)!.size,
        });
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });

  // Broadcast code output to everyone in room
  socket.on(
    "code-output",
    ({
      roomId,
      output,
    }: {
      roomId: string;
      output: {
        stdout: string;
        stderr: string;
        code: number;
        language: string;
      };
    }) => {
      // Save last output for this room
      lastOutput.set(roomId, output);

      // Broadcast to everyone in room
      io.to(roomId).emit("code-output", { output });
    },
  );

  // Broadcast that someone is running code
  socket.on("code-running", ({ roomId }: { roomId: string }) => {
    io.to(roomId).emit("code-running");
  });
});

function removeUserFromRoom(roomId: string, socketId: string) {
  if (rooms.has(roomId)) {
    const room = rooms.get(roomId)!;
    room.forEach((user) => {
      if (user.socketId === socketId) {
        room.delete(user);
      }
    });
    if (room.size === 0) {
      rooms.delete(roomId);
      // Clean up document when room is empty
      documents.delete(roomId);
      lastOutput.delete(roomId);
    }
  }
}

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
