import dotenv from "dotenv";
dotenv.config({ quiet: true });

// The only module that reads process.env. Everything is validated once at boot.
const env = process.env;
const toInt = (v, d) => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : d);
const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

const NODE_ENV = env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const IS_TEST = NODE_ENV === "test";

const PORT = toInt(env.PORT, 5000);
const DB_URL = env.DB_URL;
const DB_NAME = env.DB_NAME || "Auth_Server";
const TRUST_PROXY = toInt(env.TRUST_PROXY, 1);
const CORS_ORIGINS = list(env.CORS_ORIGINS);

const JWT_SECRET = env.JWT_SECRET_KEY;
const ACCESS_TOKEN_TTL = env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_DAYS = toInt(env.REFRESH_TOKEN_TTL_DAYS, 7);
const RESET_TOKEN_TTL_MINUTES = toInt(env.RESET_TOKEN_TTL_MINUTES, 30);
const BCRYPT_ROUNDS = toInt(env.BCRYPT_ROUNDS, IS_TEST ? 4 : 12);

// Frontend page that receives ?token=... and posts it to /auth/reset-password.
const PASSWORD_RESET_URL = env.PASSWORD_RESET_URL || "http://localhost:3000/reset-password";

const EMAIL_HOST = env.EMAIL_HOST;
const EMAIL_PORT = toInt(env.EMAIL_PORT, 587);
const EMAIL_SECURE = env.EMAIL_SECURE === "true";
const EMAIL_USER = env.EMAIL_USER;
const EMAIL_PASS = env.EMAIL_PASS;
const EMAIL_FROM = env.EMAIL_FROM || EMAIL_USER;
const MAIL_CONFIGURED = Boolean(EMAIL_HOST && EMAIL_FROM);

const problems = [];
if (!DB_URL) problems.push("DB_URL is required");
if (!JWT_SECRET) problems.push("JWT_SECRET_KEY is required");
if (IS_PRODUCTION && JWT_SECRET && JWT_SECRET.length < 32) problems.push("JWT_SECRET_KEY must be at least 32 characters in production");
if (IS_PRODUCTION && !CORS_ORIGINS.length) problems.push("CORS_ORIGINS is required in production");
if (problems.length) {
    console.error(`[config] Invalid configuration:\n  - ${problems.join("\n  - ")}`);
    throw new Error("Invalid configuration");
}

export {
    ACCESS_TOKEN_TTL, BCRYPT_ROUNDS, CORS_ORIGINS, DB_NAME, DB_URL, EMAIL_FROM, EMAIL_HOST, EMAIL_PASS,
    EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, IS_PRODUCTION, IS_TEST, JWT_SECRET, MAIL_CONFIGURED, NODE_ENV,
    PASSWORD_RESET_URL, PORT, REFRESH_TOKEN_TTL_DAYS, RESET_TOKEN_TTL_MINUTES, TRUST_PROXY,
};
