import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import ytSearch from "yt-search";

const PORT = 3000;
const STORAGE_FILE = path.join(process.cwd(), "storage.json");

// Define types
interface User {
  id: string;
  name: string;
}

interface Room {
  id: string;
  users: User[];
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
}

interface StorageData {
  rooms: Record<string, Room>;
}

// Storage functions (JSON file)
function loadStorage(): StorageData {
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      const data = fs.readFileSync(STORAGE_FILE, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading storage", e);
    }
  }
  return { rooms: {} };
}

function saveStorage(data: StorageData) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error saving storage", e);
  }
}

let storage = loadStorage();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  // Setup Socket.io
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  app.use(express.json());

  // API endpoints
  app.get("/api/rooms/:id", (req, res) => {
    const room = storage.rooms[req.params.id];
    if (room) {
      res.json(room);
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  });

  app.post("/api/rooms", (req, res) => {
    // Clean up old rooms (optional, simple cleanup)
    const now = Date.now();
    for (const [id, r] of Object.entries(storage.rooms)) {
      if (now - r.lastUpdated > 24 * 60 * 60 * 1000) {
        delete storage.rooms[id];
      }
    }

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    storage.rooms[roomId] = {
      id: roomId,
      users: [],
      videoUrl: "",
      currentTime: 0,
      isPlaying: false,
      lastUpdated: Date.now(),
    };
    saveStorage(storage);
    res.json({ id: roomId });
  });

  app.get("/api/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      const page = parseInt(req.query.page as string) || 0;
      if (!q) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      const searchResult = await ytSearch(q);
      const videos = searchResult.videos.slice(page * 10, (page + 1) * 10).map(v => ({
        id: v.videoId,
        title: v.title,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        author: v.author.name
      }));
      res.json(videos);
    } catch (e) {
      console.error("Search error", e);
      res.status(500).json({ error: "Failed to search videos" });
    }
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    socket.on("join-room", ({ roomId, user }) => {
      const room = storage.rooms[roomId];
      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      // Check max users
      if (room.users.length >= 2 && !room.users.find(u => u.id === user.id)) {
        socket.emit("error", "Room is full");
        return;
      }

      socket.join(roomId);

      if (!room.users.find(u => u.id === user.id)) {
        room.users.push(user);
      }
      room.lastUpdated = Date.now();
      saveStorage(storage);

      io.to(roomId).emit("user-joined", room.users);
      
      // Auto-sync for new user
      if (room.videoUrl) {
        socket.emit("video-state", {
          videoUrl: room.videoUrl,
          currentTime: room.currentTime,
          isPlaying: room.isPlaying,
        });
      }

      socket.on("chat-message", (msg) => {
        io.to(roomId).emit("chat-message", { ...msg, timestamp: Date.now() });
      });

      socket.on("webrtc-signal", (signal) => {
        socket.to(roomId).emit("webrtc-signal", { from: user.id, signal });
      });

      socket.on("video-update", (state) => {
        room.videoUrl = state.videoUrl ?? room.videoUrl;
        room.currentTime = state.currentTime ?? room.currentTime;
        room.isPlaying = state.isPlaying ?? room.isPlaying;
        room.lastUpdated = Date.now();
        saveStorage(storage);

        // Broadcast to other users in room
        socket.to(roomId).emit("video-state", state);
      });

      socket.on("disconnect", () => {
        const room = storage.rooms[roomId];
        if (room) {
          room.users = room.users.filter(u => u.id !== user.id);
          room.lastUpdated = Date.now();
          saveStorage(storage);
          io.to(roomId).emit("user-left", room.users);
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
