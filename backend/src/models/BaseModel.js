const HttpError = require('../errors/HttpError');

class BaseModel {
  constructor(fields = {}) {
    if (new.target === BaseModel) {
      throw new TypeError('BaseModel is abstract and cannot be created directly.');
    }
    Object.assign(this, fields);
  }

  async save() {
    throw HttpError.notImplemented(`${this.constructor.name}.save()`, 'S1-10');
  }

  async delete() {
    throw HttpError.notImplemented(`${this.constructor.name}.delete()`, 'S2-06');
  }

  validate() {
    throw HttpError.notImplemented(`${this.constructor.name}.validate()`, 'S1-10');
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = BaseModel;
