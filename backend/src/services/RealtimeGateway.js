const HttpError = require('../errors/HttpError');

class RealtimeGateway {
  authenticateSocket(socket, next) {
    throw HttpError.notImplemented('RealtimeGateway.authenticateSocket()', 'S2-08');
  }

  emitToOwner(userId, event, data) {
    throw HttpError.notImplemented('RealtimeGateway.emitToOwner()', 'S2-08');
  }
}

module.exports = new RealtimeGateway();
