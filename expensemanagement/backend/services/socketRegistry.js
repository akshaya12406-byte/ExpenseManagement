const jwt = require('jsonwebtoken');

let ioInstance = null;
const userSocketMap = new Map();

const registerSocketServer = (io) => {
  if (ioInstance) return ioInstance;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
      socket.user = payload;
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.sub;
    if (userId) {
      const connections = userSocketMap.get(userId) || new Set();
      connections.add(socket.id);
      userSocketMap.set(userId, connections);
    }

    socket.on('disconnect', () => {
      const connections = userSocketMap.get(userId);
      if (connections) {
        connections.delete(socket.id);
        if (connections.size === 0) {
          userSocketMap.delete(userId);
        } else {
          userSocketMap.set(userId, connections);
        }
      }
    });
  });

  ioInstance = io;
  return ioInstance;
};

const emitToUser = (userId, event, data) => {
  if (!ioInstance || !userId) return;
  const connections = userSocketMap.get(userId.toString());
  if (!connections) return;

  connections.forEach((socketId) => {
    ioInstance.to(socketId).emit(event, data);
  });
};

const emitToUsers = (userIds, event, data) => {
  if (!Array.isArray(userIds)) return;
  userIds.forEach((userId) => emitToUser(userId, event, data));
};

module.exports = {
  registerSocketServer,
  emitToUser,
  emitToUsers,
};
