import mongoose from "mongoose";

// One document per issued refresh token. The raw token is never stored, only its HMAC.
const refreshTokenSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
        tokenHash: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
        rotatedAt: { type: Date, default: null },   // set when exchanged; a second use means the token leaked
    },
    { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });   // Mongo purges expired tokens

const RefreshToken = mongoose.model("refreshToken", refreshTokenSchema);

export default RefreshToken;
