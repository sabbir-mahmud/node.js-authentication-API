import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS, PASSWORD_RESET_URL, RESET_TOKEN_TTL_MINUTES } from "../../configs/settings.js";
import { hmac, randomToken } from "../../lib/crypto.js";
import {
    BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError, UnauthorizedError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { isMailEnabled, sendMail } from "../../lib/mailer.js";
import { pick } from "../../lib/request.js";
import { issueTokens } from "./auth.tokens.js";
import RefreshToken from "./refreshToken.models.js";
import User from "./user.models.js";

const REGISTER_FIELDS = ["first_name", "last_name", "email"];   // is_staff / is_admin are never client-writable
const RESEND_COOLDOWN_MS = 60_000;

const normalizeEmail = (email) => email.trim().toLowerCase();
const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

// Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await hashPassword("dummy-password-for-timing"));

const revokeAllSessions = (userId) => RefreshToken.deleteMany({ user: userId });

export const register = async (rawData) => {
    const data = pick(rawData, REGISTER_FIELDS);
    data.email = normalizeEmail(data.email);
    if (await User.exists({ email: data.email })) throw new ConflictError("Email is already registered");

    // The unique index still catches a concurrent duplicate (mapped to 409 by the error handler).
    const user = await User.create({ ...data, password: await hashPassword(rawData.password) });
    return { user, ...(await issueTokens(user)) };
};

export const login = async ({ email, password }) => {
    const user = await User.findOne({ email: normalizeEmail(email) }).select("+password +tokenVersion");
    const isMatch = await bcrypt.compare(password, user?.password ?? (await getDummyHash()));
    if (!user || !isMatch) throw new UnauthorizedError("Invalid email or password");
    return { user, ...(await issueTokens(user)) };
};

// Rotating refresh tokens: each token is single-use. Presenting an already-rotated token means it
// was stolen (or replayed), so every session for that user is revoked.
export const refresh = async (rawToken) => {
    const tokenHash = hmac(rawToken);
    const now = new Date();
    const record = await RefreshToken.findOneAndUpdate(
        { tokenHash, rotatedAt: null, expiresAt: { $gt: now } },
        { $set: { rotatedAt: now } },
    );

    if (!record) {
        const reused = await RefreshToken.findOne({ tokenHash, rotatedAt: { $ne: null } });
        if (reused) {
            logger.warn("Refresh token reuse detected; revoking all sessions", { userId: String(reused.user) });
            await Promise.all([
                revokeAllSessions(reused.user),
                User.updateOne({ _id: reused.user }, { $inc: { tokenVersion: 1 } }),
            ]);
        }
        throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = await User.findById(record.user).select("+tokenVersion");
    if (!user) throw new UnauthorizedError("Invalid or expired refresh token");
    return issueTokens(user);
};

export const logout = async (rawToken) => {
    await RefreshToken.deleteOne({ tokenHash: hmac(rawToken) });
};

export const logoutAll = async (userId) => {
    await Promise.all([
        revokeAllSessions(userId),
        User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
    ]);
};

export const getProfile = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    return user;
};

export const changePassword = async (userId, { old_password, new_password }) => {
    const user = await User.findById(userId).select("+password +tokenVersion");
    if (!user) throw new NotFoundError("User not found");
    if (!(await bcrypt.compare(old_password, user.password))) throw new BadRequestError("Current password is incorrect");
    if (await bcrypt.compare(new_password, user.password)) throw new BadRequestError("New password must be different from the current password");

    user.password = await hashPassword(new_password);
    user.tokenVersion += 1;   // every other device is logged out
    await user.save();
    await revokeAllSessions(user._id);

    return issueTokens(user);   // this device stays signed in
};

// Same response whether or not the email exists.
export const requestPasswordReset = async (email) => {
    if (!isMailEnabled()) throw new ServiceUnavailableError("Password reset is temporarily unavailable");

    const user = await User.findOne({ email: normalizeEmail(email) }).select("+resetRequestedAt");
    if (!user) return;
    if (user.resetRequestedAt && Date.now() - user.resetRequestedAt.getTime() < RESEND_COOLDOWN_MS) return;

    const token = randomToken();
    user.resetTokenHash = hmac(token);
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);
    user.resetRequestedAt = new Date();
    await user.save();

    const link = `${PASSWORD_RESET_URL}?token=${encodeURIComponent(token)}`;
    try {
        await sendMail({
            to: user.email,
            subject: "Reset your password",
            text: `Use this link to reset your password. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes.\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
            html: `<p>Use the link below to reset your password. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p><p><a href="${link}">Reset your password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
        });
    } catch (err) {
        // Don't surface to the client: a different response would reveal the email exists.
        logger.error("Password reset email failed", { userId: String(user._id), err });
    }
};

export const resetPassword = async ({ token, password }) => {
    const passwordHash = await hashPassword(password);

    // Atomic: the token is consumed by the same write that sets the password (single use).
    const user = await User.findOneAndUpdate(
        { resetTokenHash: hmac(token), resetTokenExpires: { $gt: new Date() } },
        {
            $set: { password: passwordHash },
            $unset: { resetTokenHash: 1, resetTokenExpires: 1, resetRequestedAt: 1 },
            $inc: { tokenVersion: 1 },
        },
    );
    if (!user) throw new BadRequestError("Invalid or expired reset token");
    await revokeAllSessions(user._id);
};
