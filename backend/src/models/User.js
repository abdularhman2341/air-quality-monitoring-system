const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');

class User extends BaseModel {
  static async register(name, email, password) {
    throw HttpError.notImplemented('User.register()', 'S2-05');
  }

  async login(password) {
    throw HttpError.notImplemented('User.login()', 'S2-05');
  }

  async updateProfile(data) {
    throw HttpError.notImplemented('User.updateProfile()', 'S2-05');
  }

  async getDevices() {
    throw HttpError.notImplemented('User.getDevices()', 'S2-06');
  }
}

module.exports = User;
