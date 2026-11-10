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

module.exports = { passwordResetEmail, passwordChangedEmail };
