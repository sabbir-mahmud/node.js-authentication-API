import mongoose from "mongoose";

const SECRET_FIELDS = ["password", "tokenVersion", "resetTokenHash", "resetTokenExpires", "resetRequestedAt", "__v"];

const userSchema = new mongoose.Schema(
    {
        first_name: { type: String, required: true, trim: true, maxlength: 50 },
        last_name: { type: String, required: true, trim: true, maxlength: 50 },
        email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
        password: { type: String, required: true, select: false },
        is_staff: { type: Boolean, default: false },
        is_admin: { type: Boolean, default: false },

        // Bumped on password change/reset and "log out everywhere": revokes every access token.
        tokenVersion: { type: Number, default: 0, select: false },
        resetTokenHash: { type: String, select: false },
        resetTokenExpires: { type: Date, select: false },
        resetRequestedAt: { type: Date, select: false },
    },
    { timestamps: true }
);

userSchema.index({ resetTokenHash: 1 }, { sparse: true });

// Second layer behind `select: false`. Note: `.lean()` bypasses this.
userSchema.set("toJSON", {
    transform: (_doc, ret) => {
        for (const field of SECRET_FIELDS) delete ret[field];
        return ret;
    },
});

const User = mongoose.model("user", userSchema);

export default User;
