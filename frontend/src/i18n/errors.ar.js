// Arabic text for the error codes the backend sends. English shows the
// server message itself, so it needs no file of its own.
const errorsAr = {
  NETWORK_ERROR: 'تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.',
  VALIDATION_ERROR: 'تحقق من البيانات المدخلة.',
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  EMAIL_TAKEN: 'هذا البريد مسجّل مسبقاً.',
  INVALID_TOKEN: 'انتهت الجلسة. سجّل الدخول مرة أخرى.',
  SESSION_ENDED: 'انتهت الجلسة. سجّل الدخول مرة أخرى.',
  MISSING_TOKEN: 'سجّل الدخول للمتابعة.',
  USER_NOT_FOUND: 'هذا الحساب غير موجود.',
  INVALID_MAC: 'عنوان MAC يجب أن يتكون من 12 خانة (أرقام وحروف من A إلى F).',
  DEVICE_NOT_FOUND: 'لا يوجد جهاز بهذا العنوان ورمز الاقتران.',
  DEVICE_ALREADY_LINKED: 'هذا الجهاز مرتبط بحساب آخر.',
  WRONG_PASSWORD: 'كلمة المرور الحالية غير صحيحة.',
  INVALID_CODE: 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.',
  MAIL_NOT_SENT: 'تعذّر إرسال البريد الإلكتروني. حاول مرة أخرى بعد قليل.',
  EMAIL_NOT_VERIFIED: 'فعّل حسابك بالرمز الذي أرسلناه إلى بريدك.',
  CODE_RECENTLY_SENT: 'أُرسل رمز قبل أقل من دقيقة. انتظر قليلاً ثم اطلب رمزاً جديداً.',
  TOO_MANY_ATTEMPTS: 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.',
  EMAIL_ALREADY_VERIFIED: 'هذا البريد متحقق منه مسبقاً.',
  NO_PENDING_EMAIL: 'لا يوجد تغيير بريد بانتظار التأكيد.',
  SAME_EMAIL: 'هذا هو بريدك الحالي.',
  ADMIN_ONLY: 'هذه الصفحة للمديرين فقط.',
  LAST_ADMIN: 'يجب أن يبقى مدير واحد على الأقل. اجعل حساباً آخر مديراً أولاً.',
  DEVICE_EXISTS: 'يوجد جهاز مسجّل بهذا العنوان.',
  ALERT_NOT_FOUND: 'التنبيه غير موجود.',
  ALERT_ALREADY_CLOSED: 'هذا التنبيه انتهى مسبقاً.',
  NO_READINGS: 'لم يرسل هذا الحساس أي قراءة بعد.',
  DATABASE_UNAVAILABLE: 'قاعدة البيانات غير متاحة الآن. حاول مرة أخرى بعد قليل.',
  BAD_REQUEST: 'تعذّر فهم الطلب. حدّث الصفحة وحاول مرة أخرى.',
  ROUTE_NOT_FOUND: 'هذه الصفحة أو الخدمة غير موجودة.',
  INTERNAL_ERROR: 'حدث خطأ في الخادم. حاول مرة أخرى بعد قليل.',
  UNKNOWN_ERROR: 'حدث خطأ غير متوقع. حاول مرة أخرى.'
}

export default errorsAr
