const { Server } = require('socket.io');
const HttpError = require('../errors/HttpError');
const authService = require('./AuthService');
const { corsOrigins } = require('../config/cors');

const MAX_TIMER_MS = 2147483647;

class RealtimeGateway {
  init(server) {
    this.io = new Server(server, corsOrigins.length > 0 ? { cors: { origin: corsOrigins } } : {});
    this.io.use((socket, next) => this.authenticateSocket(socket, next));
    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  async authenticateSocket(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('MISSING_TOKEN'));
    }
    try {
      const { userId, sessionId, expiresAt } = await authService.verifyToken(token);
      socket.data.userId = userId;
      socket.data.sessionId = sessionId;
      socket.data.expiresAt = expiresAt;
      return next();
    } catch (err) {
      if (err instanceof HttpError) {
        return next(new Error(err.code));
      }
      console.error(`Socket auth failed: ${err.message}`);
      return next(new Error('SERVER_ERROR'));
    }
  }

  handleConnection(socket) {
    const { userId, sessionId, expiresAt } = socket.data;
    socket.join(`user:${userId}`);
    socket.join(`session:${sessionId}`);
    const timer = setTimeout(() => socket.disconnect(true), Math.min(expiresAt - Date.now(), MAX_TIMER_MS));
    socket.on('disconnect', () => clearTimeout(timer));
  }

  emitToOwner(userId, event, data) {
    if (!this.io || userId === null || userId === undefined) {
      return;
    }
    this.io.to(`user:${userId}`).emit(event, data);
  }

  disconnectSession(sessionId) {
    if (!this.io) {
      return;
    }
    this.io.in(`session:${sessionId}`).disconnectSockets(true);
  }

  // Every open tab of a deleted account, on any device.
  disconnectUser(userId) {
    if (!this.io) {
      return;
    }
    this.io.in(`user:${userId}`).disconnectSockets(true);
  }
}

module.exports = new RealtimeGateway();
