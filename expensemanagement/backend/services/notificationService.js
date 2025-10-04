const nodemailer = require('nodemailer');

// In a production system we would create transporters per tenant and support
// failover providers. For now we keep a single shared transporter and expose a helper.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

const sendApprovalNotification = async ({ to, subject, text, html }) => {
  if (!to) return;
  try {
    await transporter.sendMail({
      from: process.env.NOTIFICATIONS_FROM || 'approvals@example.com',
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    // We intentionally swallow errors for the MVP but log them for later analysis.
    console.error('Email notification failed:', error.message);
  }
};

module.exports = { sendApprovalNotification };
