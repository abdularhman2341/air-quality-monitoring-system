class BaseModel {
  constructor(fields = {}) {
    if (new.target === BaseModel) {
      throw new TypeError('BaseModel is abstract and cannot be created directly.');
    }
    Object.assign(this, fields);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = BaseModel;
