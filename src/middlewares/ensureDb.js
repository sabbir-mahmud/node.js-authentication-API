import { connectDB } from "../configs/connectDB.js";
import { asyncHandler } from "../lib/errors.js";

// Serverless-safe: reuses the cached connection, reconnects after a drop.
export const ensureDb = asyncHandler(async (req, res, next) => {
    await connectDB();
    next();
});
