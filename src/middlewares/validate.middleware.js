import { BadRequestError, ValidationError } from "../lib/errors.js";

const MAX_DEPTH = 10;

const hasOperatorKey = (value, depth = 0) => {
    if (depth > MAX_DEPTH) return true;
    if (Array.isArray(value)) return value.some((v) => hasOperatorKey(v, depth + 1));
    if (value && typeof value === "object") {
        return Object.entries(value).some(([k, v]) => k.startsWith("$") || k.includes(".") || hasOperatorKey(v, depth + 1));
    }
    return false;
};

// Blocks `{ "email": { "$ne": null } }` style NoSQL injection at the edge.
export const rejectOperatorInjection = (req, res, next) => {
    if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) {
        return next(new BadRequestError("Request contains forbidden keys"));
    }
    next();
};

// schema: { body?, query?, params? } — each a function returning an array of error strings.
export const validateRequest = (schema) => (req, res, next) => {
    const errors = ["params", "query", "body"].flatMap((part) => (schema[part] ? schema[part](req[part] ?? {}) : []));
    if (errors.length) return next(new ValidationError("Invalid input parameters", errors));
    next();
};
