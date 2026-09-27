import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import jwt from "jsonwebtoken";
import { bearer, PASSWORD, registerUser, startTestApp } from "./helpers.js";

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await ctx?.stop(); });

const tokenFromMail = (mail) => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get("token");

describe("platform", () => {
    test("health and readiness", async () => {
        assert.equal((await ctx.api.get("/healthz")).status, 200);
        const ready = await ctx.api.get("/readyz");
        assert.equal(ready.status, 200);
        assert.equal(ready.body.status, "ready");
    });

    test("unknown route returns JSON 404 with requestId", async () => {
        const res = await ctx.api.get("/api/v1/nope");
        assert.equal(res.status, 404);
        assert.equal(res.body.success, false);
        assert.ok(res.body.requestId);
        assert.equal(res.headers["x-request-id"], res.body.requestId);
    });

    test("malformed JSON → 400", async () => {
        const res = await ctx.api.post("/api/v1/auth/login").set("Content-Type", "application/json").send("{bad");
        assert.equal(res.status, 400);
        assert.equal(res.body.message, "Malformed JSON body");
    });

    test("operator injection → 400", async () => {
        const res = await ctx.api.post("/api/v1/auth/login").send({ email: { $ne: null }, password: { $ne: null } });
        assert.equal(res.status, 400);
    });

    test("security headers set, x-powered-by removed", async () => {
        const res = await ctx.api.get("/healthz");
        assert.equal(res.headers["x-powered-by"], undefined);
        assert.ok(res.headers["content-security-policy"]);
    });
});

describe("register", () => {
    test("creates user, returns tokens and never the password", async () => {
        const res = await ctx.api.post("/api/v1/auth/register").send({
            first_name: "Ada", last_name: "Lovelace", email: "Ada@Example.com", password: PASSWORD, confirm_password: PASSWORD,
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data.accessToken);
        assert.ok(res.body.data.refreshToken);
        assert.equal(res.body.data.user.email, "ada@example.com");
        assert.equal(res.body.data.user.password, undefined);
        assert.equal(res.body.data.user.tokenVersion, undefined);
    });

    test("duplicate email (case-insensitive) → 409", async () => {
        const { email } = await registerUser(ctx.api);
        const res = await ctx.api.post("/api/v1/auth/register").send({
            first_name: "X", last_name: "Y", email: email.toUpperCase(), password: PASSWORD, confirm_password: PASSWORD,
        });
        assert.equal(res.status, 409);
    });

    test("mass assignment of is_admin / is_staff is ignored", async () => {
        const { user } = await registerUser(ctx.api, { is_admin: true, is_staff: true, tokenVersion: 99 });
        assert.equal(user.is_admin, false);
        assert.equal(user.is_staff, false);
    });

    test("validation → 422 with messages", async () => {
        const res = await ctx.api.post("/api/v1/auth/register").send({ email: "bad", password: "short", confirm_password: "other" });
        assert.equal(res.status, 422);
        assert.ok(res.body.errors.length >= 3);
    });

    test("mismatched confirm_password → 422", async () => {
        const res = await ctx.api.post("/api/v1/auth/register").send({
            first_name: "A", last_name: "B", email: "mismatch@example.com", password: PASSWORD, confirm_password: `${PASSWORD}x`,
        });
        assert.equal(res.status, 422);
    });
});

describe("login", () => {
    test("valid credentials → tokens", async () => {
        const { email } = await registerUser(ctx.api);
        const res = await ctx.api.post("/api/v1/auth/login").send({ email, password: PASSWORD });
        assert.equal(res.status, 200);
        assert.ok(res.body.data.accessToken);
    });

    test("wrong password and unknown email return the same generic 401", async () => {
        const { email } = await registerUser(ctx.api);
        const wrong = await ctx.api.post("/api/v1/auth/login").send({ email, password: "wrong-password" });
        const unknown = await ctx.api.post("/api/v1/auth/login").send({ email: "nobody@example.com", password: "wrong-password" });
        assert.equal(wrong.status, 401);
        assert.equal(unknown.status, 401);
        assert.equal(wrong.body.message, unknown.body.message);
    });
});

describe("authenticated routes", () => {
    test("GET /me with a valid token", async () => {
        const u = await registerUser(ctx.api);
        const res = await u.auth(ctx.api.get("/api/v1/auth/me"));
        assert.equal(res.status, 200);
        assert.equal(res.body.data.user.email, u.email);
    });

    test("no token / garbage token → 401", async () => {
        assert.equal((await ctx.api.get("/api/v1/auth/me")).status, 401);
        assert.equal((await ctx.api.get("/api/v1/auth/me").set(bearer("garbage"))).status, 401);
    });

    test("token signed with alg none is rejected", async () => {
        const u = await registerUser(ctx.api);
        const { sub } = jwt.decode(u.accessToken);
        const forged = jwt.sign({ tv: 0 }, "", { algorithm: "none", subject: sub });
        assert.equal((await ctx.api.get("/api/v1/auth/me").set(bearer(forged))).status, 401);
    });
});

describe("refresh tokens", () => {
    test("rotation: a refresh token works once and yields a new pair", async () => {
        const u = await registerUser(ctx.api);
        const first = await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken });
        assert.equal(first.status, 200);
        assert.ok(first.body.data.accessToken);
        assert.notEqual(first.body.data.refreshToken, u.refreshToken);

        const next = await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: first.body.data.refreshToken });
        assert.equal(next.status, 200);
    });

    test("reuse of a rotated token revokes every session", async () => {
        const u = await registerUser(ctx.api);
        const rotated = await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken });
        const replay = await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken });
        assert.equal(replay.status, 401);

        const latest = await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: rotated.body.data.refreshToken });
        assert.equal(latest.status, 401);
        assert.equal((await ctx.api.get("/api/v1/auth/me").set(bearer(rotated.body.data.accessToken))).status, 401);
    });

    test("unknown refresh token → 401", async () => {
        const res = await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: "not-a-real-token" });
        assert.equal(res.status, 401);
    });

    test("logout revokes the refresh token", async () => {
        const u = await registerUser(ctx.api);
        assert.equal((await ctx.api.post("/api/v1/auth/logout").send({ refreshToken: u.refreshToken })).status, 200);
        assert.equal((await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken })).status, 401);
    });

    test("logout-all revokes access and refresh tokens", async () => {
        const u = await registerUser(ctx.api);
        assert.equal((await u.auth(ctx.api.post("/api/v1/auth/logout-all"))).status, 200);
        assert.equal((await u.auth(ctx.api.get("/api/v1/auth/me"))).status, 401);
        assert.equal((await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken })).status, 401);
    });
});

describe("change password", () => {
    test("wrong old password → 400", async () => {
        const u = await registerUser(ctx.api);
        const res = await u.auth(ctx.api.post("/api/v1/auth/change-password"))
            .send({ old_password: "nope-nope", new_password: "brand-new-password", confirm_password: "brand-new-password" });
        assert.equal(res.status, 400);
    });

    test("success revokes old sessions and returns fresh tokens", async () => {
        const u = await registerUser(ctx.api);
        const res = await u.auth(ctx.api.post("/api/v1/auth/change-password"))
            .send({ old_password: PASSWORD, new_password: "brand-new-password", confirm_password: "brand-new-password" });
        assert.equal(res.status, 200);

        assert.equal((await u.auth(ctx.api.get("/api/v1/auth/me"))).status, 401);
        assert.equal((await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken })).status, 401);
        assert.equal((await ctx.api.get("/api/v1/auth/me").set(bearer(res.body.data.accessToken))).status, 200);

        const login = await ctx.api.post("/api/v1/auth/login").send({ email: u.email, password: "brand-new-password" });
        assert.equal(login.status, 200);
    });
});

describe("password reset", () => {
    test("same response for known and unknown emails; mail only for known", async () => {
        const u = await registerUser(ctx.api);
        const before = ctx.sentMail.length;
        const known = await ctx.api.post("/api/v1/auth/forgot-password").send({ email: u.email });
        const unknown = await ctx.api.post("/api/v1/auth/forgot-password").send({ email: "ghost@example.com" });
        assert.equal(known.status, 200);
        assert.equal(unknown.status, 200);
        assert.equal(known.body.message, unknown.body.message);
        assert.equal(ctx.sentMail.length, before + 1);
        assert.equal(ctx.sentMail.at(-1).to, u.email);
    });

    test("reset token is single-use, sets the password and revokes sessions", async () => {
        const u = await registerUser(ctx.api);
        await ctx.api.post("/api/v1/auth/forgot-password").send({ email: u.email });
        const token = tokenFromMail(ctx.sentMail.at(-1));

        const body = { token, password: "reset-password-123", confirm_password: "reset-password-123" };
        assert.equal((await ctx.api.post("/api/v1/auth/reset-password").send(body)).status, 200);
        assert.equal((await ctx.api.post("/api/v1/auth/reset-password").send(body)).status, 400);

        assert.equal((await u.auth(ctx.api.get("/api/v1/auth/me"))).status, 401);
        assert.equal((await ctx.api.post("/api/v1/auth/refresh").send({ refreshToken: u.refreshToken })).status, 401);
        assert.equal((await ctx.api.post("/api/v1/auth/login").send({ email: u.email, password: "reset-password-123" })).status, 200);
    });

    test("invalid reset token → 400", async () => {
        const res = await ctx.api.post("/api/v1/auth/reset-password")
            .send({ token: "made-up", password: "reset-password-123", confirm_password: "reset-password-123" });
        assert.equal(res.status, 400);
    });
});
