import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const VALID_ID = /^[\w-]{1,64}$/;

export const requestContext = (req, res, next) => {
    const incoming = req.get("X-Request-Id");
    req.id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
    res.set("X-Request-Id", req.id);

    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const status = res.statusCode;
        const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        logger[level]("request", {
            reqId: req.id,
            method: req.method,
            path: req.originalUrl.split("?")[0],
            status,
            durationMs: Number(process.hrtime.bigint() - start) / 1e6,
            userId: req.user?.id,
        });
    });
    next();
};
