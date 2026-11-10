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

const riyadhTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh',
});

// Device names are typed by users: keep them on one line in a subject.
const oneLine = (text) => String(text).replace(/\s+/g, ' ').trim();

function deviceLines(device) {
  const name = oneLine(device.name || 'Sensor');
  const location = device.location ? oneLine(device.location) : null;
  return {
    name,
    ar: location ? `${name} (${location})` : name,
    en: location ? `${name} (${location})` : name,
  };
}

// Sent when a device starts an alarm. The buzzer on the device is the real
// alarm; this email is a backup for someone who is not in the room.
function gasAlertEmail({ device, ppm, thresholdPpm, startedAt, appUrl }) {
  const label = deviceLines(device);
  const time = `${riyadhTime.format(startedAt)} (Riyadh time)`;
  const link = appUrl ? [`${appUrl}`] : [];
  return {
    subject: `تنبيه تسرب غاز: ${label.name} | Gas leak alert: ${label.name}`,
    text: [
      `الحساس «${label.ar}» رصد تركيز غاز أعلى من حد الإنذار.`,
      `القراءة: ${Math.round(ppm)} جزء في المليون (تقديري). حد الإنذار: ${Math.round(thresholdPpm)}.`,
      `الوقت: ${time}`,
      '',
      'ماذا تفعل الآن:',
      '- لا تشعل ناراً ولا تشغّل أو تطفئ أي مفتاح كهرباء.',
      '- افتح النوافذ والأبواب.',
      '- أغلق محبس الغاز إذا كان الوصول إليه آمناً.',
      '- اخرج من المكان، واتصل بالدفاع المدني على 998 إذا استمرت الرائحة.',
      '',
      `Sensor "${label.en}" measured gas above the alarm limit.`,
      `Reading: ${Math.round(ppm)} ppm (estimate). Alarm limit: ${Math.round(thresholdPpm)}.`,
      `Time: ${time}`,
      '',
      'What to do now:',
      '- Do not light a flame and do not switch anything electrical on or off.',
      '- Open the windows and doors.',
      '- Close the gas valve if it is safe to reach.',
      '- Leave the area, and call Civil Defense on 998 if the smell stays.',
      '',
      ...link,
      'يمكنك إيقاف هذه الرسائل من الملف الشخصي. | You can turn these emails off in your profile.',
    ].join('\n'),
  };
}

function gasAlertEndedEmail({ device, peakPpm, endedAt, appUrl }) {
  const label = deviceLines(device);
  const time = `${riyadhTime.format(endedAt)} (Riyadh time)`;
  const link = appUrl ? [`${appUrl}`] : [];
  return {
    subject: `انتهى تنبيه الغاز: ${label.name} | Gas alert ended: ${label.name}`,
    text: [
      `الحساس «${label.ar}» عاد إلى ما دون حد الإنذار.`,
      `أعلى قراءة أثناء التنبيه: ${Math.round(peakPpm)} جزء في المليون (تقديري).`,
      `الوقت: ${time}`,
      'تأكد من مصدر التسرب قبل استخدام الغاز من جديد.',
      '',
      `Sensor "${label.en}" is back below the alarm limit.`,
      `Highest reading during the alert: ${Math.round(peakPpm)} ppm (estimate).`,
      `Time: ${time}`,
      'Find the source of the leak before using gas again.',
      '',
      ...link,
      'يمكنك إيقاف هذه الرسائل من الملف الشخصي. | You can turn these emails off in your profile.',
    ].join('\n'),
  };
}

module.exports = {
  passwordResetEmail, passwordChangedEmail, emailVerificationEmail, emailChangeEmail, emailChangedEmail,
  gasAlertEmail, gasAlertEndedEmail,
};
