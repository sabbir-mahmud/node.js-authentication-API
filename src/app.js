import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { connectDB } from "./configs/connectDB.js";
import { CORS_ORIGINS, IS_PRODUCTION, TRUST_PROXY } from "./configs/settings.js";
import { NotFoundError } from "./lib/errors.js";
import { ensureDb } from "./middlewares/ensureDb.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { apiLimiter } from "./middlewares/rateLimit.js";
import { requestContext } from "./middlewares/requestContext.js";
import { rejectOperatorInjection } from "./middlewares/validate.middleware.js";
import v1Routes from "./routes/v1/index.js";

const app = express();
app.set("trust proxy", TRUST_PROXY);
app.disable("x-powered-by");

app.use(requestContext);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
app.use(cors({
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : !IS_PRODUCTION,   // explicit allowlist in production
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"],
    maxAge: 600,
}));
app.use(express.json({ limit: "100kb" }));
app.use(rejectOperatorInjection);

app.get("/", (req, res) => res.json({ success: true, message: "Authentication Server Running" }));
app.get("/healthz", (req, res) => res.json({ status: "ok" }));
app.get("/readyz", async (req, res) => {
    try {
        await connectDB();
        await mongoose.connection.db.admin().ping();
        res.json({ status: "ready" });
    } catch {
        res.status(503).json({ status: "unavailable" });
    }
});

app.use("/api/v1", apiLimiter, ensureDb, v1Routes);

app.use((req, res, next) => next(new NotFoundError(`Cannot find endpoint ${req.method} ${req.originalUrl.split("?")[0]}`)));
app.use(errorHandler);

export default app;
