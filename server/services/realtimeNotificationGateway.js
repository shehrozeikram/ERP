const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('../models/User');
const ChatConversation = require('../models/chat/ChatConversation');

class RealtimeNotificationGateway {
  constructor() {
    this.io = null;
    /** @type {Map<string, Set<string>>} userId -> socket ids */
    this._userSockets = new Map();
  }

  initialize(server) {
    if (this.io) return this.io;

    this.io = new Server(server, {
      path: '/socket-notifications',
      cors: {
        origin:
          process.env.NODE_ENV === 'production'
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
      this._addSocket(socket.userId, socket.id);
      socket.emit('notification:connected', { ok: true, userId: socket.userId });
      this.io.emit('presence:changed', { userId: socket.userId, online: true });

      socket.on('chat:typing', async (payload) => {
        try {
          const conversationId = payload?.conversationId;
          const typing = !!payload?.typing;
          if (!conversationId) return;
          const conv = await ChatConversation.findById(conversationId).select('participants').lean();
          if (!conv?.participants?.some((p) => String(p) === socket.userId)) return;
          const other = conv.participants.map(String).find((id) => id !== socket.userId);
          if (other) {
            this.emitToUser(other, 'chat:typing', {
              conversationId: String(conversationId),
              userId: socket.userId,
              typing
            });
          }
        } catch {
          /* ignore */
        }
      });

      socket.on('disconnect', () => {
        this._removeSocket(socket.userId, socket.id);
        this.io.emit('presence:changed', { userId: socket.userId, online: this.isUserOnline(socket.userId) });
      });
    });

    return this.io;
  }

  _addSocket(userId, socketId) {
    const key = String(userId);
    let set = this._userSockets.get(key);
    if (!set) {
      set = new Set();
      this._userSockets.set(key, set);
    }
    set.add(socketId);
  }

  _removeSocket(userId, socketId) {
    const key = String(userId);
    const set = this._userSockets.get(key);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) this._userSockets.delete(key);
  }

  isUserOnline(userId) {
    if (!userId) return false;
    const set = this._userSockets.get(String(userId));
    return !!set && set.size > 0;
  }

  getUserRoom(userId) {
    return `user:${String(userId)}`;
  }

  emitToUser(userId, eventName, payload) {
    if (!this.io || !userId) return;
    this.io.to(this.getUserRoom(userId)).emit(eventName, payload);
  }

  getIO() {
    return this.io;
  }

  getOnlineUserIds() {
    return [...this._userSockets.keys()];
  }
}

module.exports = new RealtimeNotificationGateway();
