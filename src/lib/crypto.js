import crypto from "node:crypto";
import { JWT_SECRET } from "../configs/settings.js";

// Opaque 256-bit tokens (refresh, password reset). Only the HMAC is stored.
export const randomToken = () => crypto.randomBytes(32).toString("base64url");
export const hmac = (value) => crypto.createHmac("sha256", JWT_SECRET).update(String(value)).digest("hex");
