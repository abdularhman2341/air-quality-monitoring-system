const { Server } = require('socket.io');
const HttpError = require('../errors/HttpError');
const authService = require('./AuthService');
const { corsOrigins } = require('../config/cors');

// The longest delay setTimeout accepts (2^31 - 1 ms, about 24.8 days).
// A longer delay would fire at once and close the socket straight away.
const MAX_TIMER_MS = 2147483647;

// Socket.IO server for live dashboard events. Each socket joins two rooms:
// user:{id} gets the events of that user's devices, and session:{id} lets
// signing out close only the sockets of that one session.
class RealtimeGateway {
  // CORS_ORIGIN is only needed when the site runs on another domain (local
  // Vite). Without it no CORS headers are sent. Either way, every socket must
  // pass authenticateSocket first.
  init(server) {
    this.io = new Server(server, corsOrigins.length > 0 ? { cors: { origin: corsOrigins } } : {});
    this.io.use((socket, next) => this.authenticateSocket(socket, next));
    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  // Same token check as the REST API (AuthService.verifyToken). A refused
  // connection carries the API error code, such as SESSION_ENDED; anything
  // unexpected becomes SERVER_ERROR so no details leak.
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

  // The socket is closed when its token expires, so it cannot outlive the
  // session it was opened with.
  handleConnection(socket) {
    const { userId, sessionId, expiresAt } = socket.data;
    socket.join(`user:${userId}`);
    socket.join(`session:${sessionId}`);
    const timer = setTimeout(() => socket.disconnect(true), Math.min(expiresAt - Date.now(), MAX_TIMER_MS));
    socket.on('disconnect', () => clearTimeout(timer));
  }

  // Does nothing before init (tests, scripts) or for a device with no owner.
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
