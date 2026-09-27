import nodemailer from "nodemailer";
import {
    EMAIL_FROM, EMAIL_HOST, EMAIL_PASS, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, IS_TEST, MAIL_CONFIGURED,
} from "../configs/settings.js";

// Tests capture outgoing mail here instead of talking to SMTP.
export const sentMail = [];

const transporter = MAIL_CONFIGURED && !IS_TEST
    ? nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_SECURE,
        auth: EMAIL_USER ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
    })
    : null;

export const isMailEnabled = () => IS_TEST || Boolean(transporter);

export const sendMail = async ({ to, subject, text, html }) => {
    if (IS_TEST) {
        sentMail.push({ to, subject, text, html });
        return;
    }
    await transporter.sendMail({ from: EMAIL_FROM, to, subject, text, html });
};
