const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
const User = require('../models/User');
const Device = require('../models/Device');
const Alert = require('../models/Alert');
const Reading = require('../models/Reading');
const Session = require('../models/Session');
const AdminAction = require('../models/AdminAction');
const realtimeGateway = require('./RealtimeGateway');

class AdminService {
  async listUsers(query, page, limit) {
    return User.search(query, page, limit);
  }

  async getUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    return user;
  }

  async getUserWithDevices(userId) {
    const user = await this.getUser(userId);
    const devices = await Device.findByOwner(user.id);
    return { user, devices };
  }

  async updateUser(userId, changes, admin) {
    const user = await this.getUser(userId);
    return user.adminUpdate(changes, admin);
  }

  async deleteUser(userId, admin) {
    const user = await this.getUser(userId);
    await user.delete(admin);
    realtimeGateway.disconnectUser(String(user.id));
  }

  async signOutUser(userId, admin) {
    const user = await this.getUser(userId);
    await Session.revokeAll(user.id);
    await AdminAction.log(prisma, admin, 'user.logout_all', user.logTarget());
    realtimeGateway.disconnectUser(String(user.id));
  }

  async listDevices(query, page, limit) {
    return Device.adminSearch(query, page, limit);
  }

  async getDevice(mac) {
    const device = await Device.adminFind(Device.normalizeMac(mac));
    if (!device) {
      throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
    }
    return device;
  }

  async registerDevice(mac, name, location, admin) {
    return Device.register(Device.normalizeMac(mac), name, location, admin);
  }

  async updateDevice(mac, changes, admin) {
    const device = await this.getDevice(mac);
    let newOwner = null;
    if (changes.owner_id !== undefined && changes.owner_id !== null) {
      newOwner = await this.getUser(changes.owner_id);
    }
    await device.adminUpdate(changes, admin, newOwner);
    return this.getDevice(mac);
  }

  async deleteDevice(mac, admin) {
    const device = await this.getDevice(mac);
    await device.adminDelete(admin);
  }

  async replacePairingCode(mac, admin) {
    const device = await this.getDevice(mac);
    return device.replacePairingCode(admin);
  }

  async getReadings(mac, from, to, page, limit) {
    const device = await this.getDevice(mac);
    const { data, total } = await Reading.findByDevice(device.device_id, from, to, page, limit);
    return { data, page, limit, total };
  }

  async listAlerts(filters) {
    return Alert.adminList(filters);
  }

  // The owner's dashboard gets the same alert:new event as when the device
  // itself ends the alarm, so it updates without a refresh.
  async closeAlert(alertId, admin) {
    const alert = await Alert.closeByAdmin(alertId, admin);
    const ownerId = alert.device.owner_id;
    delete alert.device;
    realtimeGateway.emitToOwner(ownerId, 'alert:new', alert);
    return alert;
  }
}

module.exports = new AdminService();
