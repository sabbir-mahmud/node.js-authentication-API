import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_TTL, JWT_SECRET, REFRESH_TOKEN_TTL_DAYS } from "../../configs/settings.js";
import { hmac, randomToken } from "../../lib/crypto.js";
import RefreshToken from "./refreshToken.models.js";

const ALGORITHM = "HS256";

export const signAccessToken = (user) =>
    jwt.sign({ tv: user.tokenVersion ?? 0 }, JWT_SECRET, {
        algorithm: ALGORITHM,
        subject: String(user._id),
        expiresIn: ACCESS_TOKEN_TTL,
    });

// Algorithm pinned: no alg-confusion / "none" tokens.
export const verifyAccessToken = (token) => jwt.verify(token, JWT_SECRET, { algorithms: [ALGORITHM] });

export const createRefreshToken = async (userId) => {
    const token = randomToken();
    await RefreshToken.create({
        user: userId,
        tokenHash: hmac(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000),
    });
    return token;
};

export const issueTokens = async (user) => ({
    accessToken: signAccessToken(user),
    refreshToken: await createRefreshToken(user._id),
});
