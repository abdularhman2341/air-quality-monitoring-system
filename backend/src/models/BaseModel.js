// Parent of every model: copies a database row onto the object. toJSON is
// what res.json() sends, so a model that holds secrets (User keeps the
// password hash) or extra fields overrides it and lists what goes out.
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
