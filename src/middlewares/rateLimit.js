import rateLimit from "express-rate-limit";
import { IS_TEST } from "../configs/settings.js";

// In-memory store is per instance. Use a shared store (rate-limit-redis) when scaling out.
const base = {
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => IS_TEST,
    handler: (req, res, next, options) =>
        res.status(options.statusCode).json({ success: false, message: "Too many requests, please try again later.", requestId: req.id }),
};

export const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 300 });
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 20 });   // login / register / refresh
export const resetLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 5 });   // password reset emails
