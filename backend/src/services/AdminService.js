const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
const User = require('../models/User');
const Device = require('../models/Device');
const Alert = require('../models/Alert');
const Reading = require('../models/Reading');
const Session = require('../models/Session');
const AdminAction = require('../models/AdminAction');
const VerificationCode = require('../models/VerificationCode');
const mailService = require('./MailService');
const { passwordResetEmail, emailVerificationEmail, emailChangedEmail } = require('../utils/emails');
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

  // When the email changes, the new address gets a verification code (the
  // account is unverified until the user types it) and the old address is told.
  async updateUser(userId, changes, admin) {
    const user = await this.getUser(userId);
    const oldEmail = user.email;
    await user.adminUpdate(changes, admin);
    if (user.email !== oldEmail) {
      const code = await VerificationCode.issue(user.id, 'verify_email', { force: true });
      mailService.sendInBackground(user.email, emailVerificationEmail(code, VerificationCode.CODE_MINUTES), 'email verification code');
      mailService.sendInBackground(oldEmail, emailChangedEmail(user.email), 'email changed notice');
    }
    return user;
  }

  async verifyUserEmail(userId, admin) {
    const user = await this.getUser(userId);
    if (user.isEmailVerified()) {
      throw new HttpError(409, 'EMAIL_ALREADY_VERIFIED', 'This email is already verified.');
    }
    return user.adminVerifyEmail(admin);
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

  // The admin never sees or sets a password: the user gets a reset code by
  // email and chooses the new password. The admin is told if the email fails.
  async sendPasswordReset(userId, admin) {
    const user = await this.getUser(userId);
    const code = await VerificationCode.issue(user.id, 'reset_password', { force: true });
    try {
      await mailService.send({ to: user.email, ...passwordResetEmail(code, VerificationCode.CODE_MINUTES) });
    } catch (err) {
      console.error(`Mail not sent (admin password reset): ${err.message}`);
      throw new HttpError(502, 'MAIL_NOT_SENT', 'The email could not be sent. Try again shortly.');
    }
    await AdminAction.log(prisma, admin, 'user.password_reset', user.logTarget());
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
