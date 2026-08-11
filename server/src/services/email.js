const nodemailer = require("nodemailer");

const hasSmtpConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendEmail({ to, subject, text }) {
  if (!transporter) {
    // Dev fallback — log instead of failing when SMTP isn't configured.
    console.log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });
}

async function sendAppointmentConfirmation(toEmail, appointment) {
  return sendEmail({
    to: toEmail,
    subject: "Your appointment is confirmed",
    text: `Your appointment is confirmed for ${appointment.slotStart}. See you then!`,
  });
}

async function sendAppointmentReminder(toEmail, appointment) {
  return sendEmail({
    to: toEmail,
    subject: "Reminder: upcoming appointment",
    text: `This is a reminder of your appointment at ${appointment.slotStart}.`,
  });
}

module.exports = { sendEmail, sendAppointmentConfirmation, sendAppointmentReminder };
