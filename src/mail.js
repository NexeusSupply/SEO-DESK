import nodemailer from 'nodemailer';
import { config } from './config.js';

let transport = null;

/** Sends one email through the SMTP server in SMTP_HOST. Throws if sending isn't set up. */
export async function sendMail({ to, subject, html }) {
  if (!config.smtp.ready) throw new Error('Email sending isn’t set up yet. Add SMTP_HOST, SMTP_USER and SMTP_PASS on the server.');
  transport ||= nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined });
  await transport.sendMail({ from: config.smtp.from || config.smtp.user, to: [].concat(to).join(', '), subject, html });
}
