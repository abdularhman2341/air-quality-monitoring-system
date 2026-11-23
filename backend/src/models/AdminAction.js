const BaseModel = require('./BaseModel');
const prisma = require('../db/prisma');

class AdminAction extends BaseModel {
  // db is prisma or a transaction, so the log row is saved together with the
  // change it describes. admin is null when the make-admin script made the change.
  // target is { type, id, label }.
  static async log(db, admin, action, target, details = null) {
    await db.adminAction.create({
      data: {
        admin_id: admin ? Number(admin.id) : null,
        admin_email: admin ? admin.email : null,
        action,
        target_type: target.type,
        target_id: String(target.id),
        target_label: target.label ?? null,
        details: details ?? undefined,
      },
    });
  }

  static async list(page, limit) {
    const [rows, total] = await Promise.all([
      prisma.adminAction.findMany({
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.adminAction.count(),
    ]);
    return { data: rows.map((row) => new AdminAction(row)), total };
  }

  toJSON() {
    return {
      id: this.id,
      admin: this.admin_email ? { id: this.admin_id === null ? null : String(this.admin_id), email: this.admin_email } : null,
      action: this.action,
      target_type: this.target_type,
      target_id: this.target_id,
      target_label: this.target_label,
      details: this.details,
      created_at: this.created_at,
    };
  }
}

module.exports = AdminAction;
