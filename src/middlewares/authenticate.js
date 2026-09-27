import { asyncHandler, UnauthorizedError } from "../lib/errors.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";
import User from "../modules/auth/user.models.js";

export const isAuthenticated = asyncHandler(async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme !== "Bearer" || !token) throw new UnauthorizedError("Token missing");

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch {
        throw new UnauthorizedError("Invalid or expired token");
    }

    // One indexed read per request buys revocation (tokenVersion) and deleted-user handling.
    const user = await User.findById(payload.sub).select("+tokenVersion email is_staff is_admin");
    if (!user || user.tokenVersion !== payload.tv) throw new UnauthorizedError("Session is no longer valid");

    req.user = { id: String(user._id), email: user.email, is_staff: user.is_staff, is_admin: user.is_admin };
    next();
});
