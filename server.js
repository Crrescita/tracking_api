require("dotenv").config();
const express = require("express");
require("./config/until");
require("./middleware/validation");
const cron = require("node-cron");
const { checkStationaryEmployees } = require("./services/stationaryCheckService");

// every 5 minutes
// cron.schedule("*/5  * * * *", async () => {
//   console.log("⏱ Running stationary cron...");
//   await checkStationaryEmployees();
// });


const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

process.env.TZ = 'Asia/Kolkata';
const port = 3000;

// Create HTTP server using the app
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:4200",
      "http://localhost:3000",
      "http://localhost:6000",
      "http://localhost:60912",
      "https://emptracking.crrescita.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.set('io', io);
// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });

  socket.on("sendMessage", ({ roomId, message }) => {
    io.to(roomId).emit("newMessage", message);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ✅ Listen using `server`, not `app`
server.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
