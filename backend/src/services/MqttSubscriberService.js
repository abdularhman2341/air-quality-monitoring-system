const HttpError = require('../errors/HttpError');

class MqttSubscriberService {
  async connect() {
    throw HttpError.notImplemented('MqttSubscriberService.connect()', 'S1-10');
  }

  subscribe(topic) {
    throw HttpError.notImplemented('MqttSubscriberService.subscribe()', 'S1-10');
  }

  async handleMessage(topic, payload) {
    throw HttpError.notImplemented('MqttSubscriberService.handleMessage()', 'S1-10');
  }
}

module.exports = new MqttSubscriberService();
