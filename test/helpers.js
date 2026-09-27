import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";

/** Env must be set BEFORE the app is imported: settings.js validates at import time. */
export const startTestApp = async () => {
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    process.env.NODE_ENV = "test";
    process.env.DB_URL = replSet.getUri();
    process.env.DB_NAME = `test-${process.pid}`;
    process.env.JWT_SECRET_KEY = "test-secret-that-is-at-least-32-characters-long";

    try {
        const { default: app } = await import("../src/app.js");
        const { connectDB, disconnectDB } = await import("../src/configs/connectDB.js");
        const { sentMail } = await import("../src/lib/mailer.js");
        await connectDB();
        await (await import("mongoose")).default.connection.syncIndexes();   // unique indexes are under test
        return {
            api: request(app),
            sentMail,
            stop: async () => {
                await disconnectDB();
                await replSet.stop();
            },
        };
    } catch (err) {
        await replSet.stop();
        throw err;
    }
};

let counter = 0;
export const PASSWORD = "correct-horse-battery";

export const registerUser = async (api, overrides = {}) => {
    counter += 1;
    const body = {
        first_name: "Test",
        last_name: "User",
        email: `user${counter}-${Date.now()}@example.com`,
        password: PASSWORD,
        confirm_password: PASSWORD,
        ...overrides,
    };
    const res = await api.post("/api/v1/auth/register").send(body);
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    const { accessToken, refreshToken, user } = res.body.data;
    return { email: body.email, user, accessToken, refreshToken, auth: (req) => req.set("Authorization", `Bearer ${accessToken}`) };
};

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });
