const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('../models/User');

class RealtimeNotificationGateway {
  constructor() {
    this.io = null;
  }

  initialize(server) {
    if (this.io) return this.io;

    this.io = new Server(server, {
      path: '/socket-notifications',
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://tovus.net', 'https://www.tovus.net']
          : 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(async (socket, next) => {
      try {
        const authToken = socket.handshake?.auth?.token || '';
        const headerToken = socket.handshake?.headers?.authorization || '';
        const token = String(authToken || headerToken || '').replace(/^Bearer\s+/i, '').trim();

        if (!token) {
          return next(new Error('Authentication token missing'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('_id isActive');
        if (!user || !user.isActive) {
          return next(new Error('Unauthorized'));
        }

        socket.userId = String(user._id);
        return next();
      } catch (error) {
        return next(new Error('Unauthorized'));
      }
    });

    this.io.on('connection', (socket) => {
      const userRoom = this.getUserRoom(socket.userId);
      socket.join(userRoom);
      socket.emit('notification:connected', { ok: true, userId: socket.userId });
    });

    return this.io;
  }

  getUserRoom(userId) {
    return `user:${String(userId)}`;
  }

  emitToUser(userId, eventName, payload) {
    if (!this.io || !userId) return;
    this.io.to(this.getUserRoom(userId)).emit(eventName, payload);
  }
}

module.exports = new RealtimeNotificationGateway();
