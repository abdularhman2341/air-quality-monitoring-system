const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');

class Reading extends BaseModel {
  static async record(deviceId, payload) {
    throw HttpError.notImplemented('Reading.record()', 'S1-10');
  }
}

module.exports = Reading;
