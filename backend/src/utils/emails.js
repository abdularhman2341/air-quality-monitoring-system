// The text of every email the backend sends. Each one is in Arabic and
// English, because the backend does not know which language the reader uses.

function passwordResetEmail(code, minutes) {
  return {
    subject: `${code} رمز استعادة كلمة المرور | AQMS password reset code`,
    text: [
      `رمز استعادة كلمة المرور: ${code}`,
      `الرمز صالح لمدة ${minutes} دقيقة ويُستخدم مرة واحدة.`,
      'إذا لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة. كلمة مرورك لم تتغير.',
      '',
      `Your password reset code: ${code}`,
      `The code works once and expires in ${minutes} minutes.`,
      'If you did not ask to reset your password, ignore this email. Your password has not changed.',
    ].join('\n'),
  };
}

function passwordChangedEmail() {
  return {
    subject: 'تم تغيير كلمة المرور | Your AQMS password was changed',
    text: [
      'تم تغيير كلمة مرور حسابك، وتم تسجيل الخروج من كل الأجهزة.',
      'إذا لم تكن أنت من غيّرها، استعد كلمة المرور فورًا من صفحة تسجيل الدخول.',
      '',
      'The password of your account was changed, and every device was signed out.',
      'If this was not you, reset your password now from the sign-in page.',
    ].join('\n'),
  };
}

function emailVerificationEmail(code, minutes) {
  return {
    subject: `${code} رمز تأكيد البريد الإلكتروني | Gas Monitor email verification code`,
    text: [
      `رمز تأكيد بريدك الإلكتروني: ${code}`,
      `الرمز صالح لمدة ${minutes} دقيقة ويُستخدم مرة واحدة.`,
      'إذا لم تنشئ حسابًا في Gas Monitor، تجاهل هذه الرسالة.',
      '',
      `Your email verification code: ${code}`,
      `The code works once and expires in ${minutes} minutes.`,
      'If you did not create a Gas Monitor account, ignore this email.',
    ].join('\n'),
  };
}

function emailChangeEmail(code, minutes) {
  return {
    subject: `${code} رمز تغيير البريد الإلكتروني | Gas Monitor email change code`,
    text: [
      `رمز تأكيد بريدك الإلكتروني الجديد: ${code}`,
      `الرمز صالح لمدة ${minutes} دقيقة ويُستخدم مرة واحدة.`,
      'إذا لم تطلب استخدام هذا البريد في Gas Monitor، تجاهل هذه الرسالة.',
      '',
      `The code to confirm your new email: ${code}`,
      `The code works once and expires in ${minutes} minutes.`,
      'If you did not ask to use this email in Gas Monitor, ignore this email.',
    ].join('\n'),
  };
}

// Sent to the old address after the email of an account changes.
function emailChangedEmail(newEmail) {
  return {
    subject: 'تم تغيير بريد حسابك | Your Gas Monitor email was changed',
    text: [
      `تم تغيير البريد الإلكتروني لحسابك إلى: ${newEmail}`,
      'لن تصل رسائل الحساب إلى هذا العنوان بعد الآن.',
      'إذا لم تكن أنت من غيّره، تواصل مع مسؤول الموقع فورًا.',
      '',
      `The email of your account was changed to: ${newEmail}`,
      'Account emails will no longer be sent to this address.',
      'If this was not you, contact the site administrator now.',
    ].join('\n'),
  };
}

module.exports = {
  passwordResetEmail, passwordChangedEmail, emailVerificationEmail, emailChangeEmail, emailChangedEmail,
};
