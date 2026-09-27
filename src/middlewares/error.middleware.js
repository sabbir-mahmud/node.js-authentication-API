import { IS_PRODUCTION } from "../configs/settings.js";
import { logger } from "../lib/logger.js";

const normalize = (err) => {
    if (err.isOperational) return { statusCode: err.statusCode, message: err.message, errors: err.errors };
    if (err.name === "CastError") return { statusCode: 400, message: `Invalid ${err.path}` };
    if (err.name === "ValidationError" && err.errors) {
        const errors = Object.values(err.errors).map((e) => e.message);
        return { statusCode: 422, message: errors.join(", "), errors };
    }
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || "field";
        return { statusCode: 409, message: `Duplicate value entered for ${field}` };
    }
    if (err.type === "entity.parse.failed") return { statusCode: 400, message: "Malformed JSON body" };
    if (err.type === "entity.too.large") return { statusCode: 413, message: "Request body too large" };
    if (err.name === "MongoServerSelectionError" || err.name === "MongoNetworkError")
        return { statusCode: 503, message: "Database temporarily unavailable" };
    return { statusCode: 500, message: "Internal Server Error", unexpected: true };
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    const { statusCode, message, errors, unexpected } = normalize(err);
    if (unexpected || statusCode >= 500) {
        logger.error("Request failed", { reqId: req.id, method: req.method, path: req.originalUrl.split("?")[0], statusCode, err });
    }
    if (res.headersSent) return next(err);
    res.status(statusCode).json({
        success: false,
        message: unexpected && !IS_PRODUCTION ? err.message || message : message,   // never leak in prod
        ...(errors?.length ? { errors } : {}),
        ...(req.id ? { requestId: req.id } : {}),
        ...(!IS_PRODUCTION && unexpected ? { stack: err.stack } : {}),
    });
};
