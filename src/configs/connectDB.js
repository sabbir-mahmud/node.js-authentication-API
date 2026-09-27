import mongoose from "mongoose";
import { logger } from "../lib/logger.js";
import { DB_NAME, DB_URL, IS_PRODUCTION } from "./settings.js";

mongoose.set("bufferCommands", false);   // fail fast instead of queueing while disconnected
mongoose.set("strictQuery", true);
mongoose.set("autoIndex", !IS_PRODUCTION); // production: run `syncIndexes()` as a deploy step

let connecting = null;

export const connectDB = () => {
    if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
    connecting ??= mongoose
        .connect(DB_URL, { dbName: DB_NAME, maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 })
        .then(({ connection }) => {
            logger.info("MongoDB connected", { db: DB_NAME });
            return connection;
        })
        .catch((err) => {
            connecting = null;   // next request retries
            throw err;
        });
    return connecting;
};

export const disconnectDB = async () => {
    connecting = null;
    await mongoose.disconnect();
};
