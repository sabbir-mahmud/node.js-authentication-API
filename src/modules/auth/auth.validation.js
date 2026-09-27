const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;   // bcrypt ignores everything past 72 bytes

const isNonEmptyString = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

const checkEmail = (email, errors) => {
    if (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email.trim())) errors.push("A valid email is required.");
};

const checkNewPassword = (password, confirm, errors, label = "Password") => {
    if (typeof password !== "string" || password.length < PASSWORD_MIN || Buffer.byteLength(password) > PASSWORD_MAX_BYTES) {
        errors.push(`${label} must be ${PASSWORD_MIN}-${PASSWORD_MAX_BYTES} characters.`);
    } else if (password !== confirm) {
        errors.push(`${label} and confirm password do not match.`);
    }
};

const checkRefreshToken = (data) =>
    isNonEmptyString(data.refreshToken, 128) ? [] : ["refreshToken is required."];

export const registerSchema = {
    body: (data) => {
        const errors = [];
        if (!isNonEmptyString(data.first_name, 50)) errors.push("first_name is required (max 50 characters).");
        if (!isNonEmptyString(data.last_name, 50)) errors.push("last_name is required (max 50 characters).");
        checkEmail(data.email, errors);
        checkNewPassword(data.password, data.confirm_password, errors);
        return errors;
    },
};

export const loginSchema = {
    body: (data) => {
        const errors = [];
        checkEmail(data.email, errors);
        if (!isNonEmptyString(data.password, 1024)) errors.push("Password is required.");
        return errors;
    },
};

export const refreshSchema = { body: checkRefreshToken };
export const logoutSchema = { body: checkRefreshToken };

export const changePasswordSchema = {
    body: (data) => {
        const errors = [];
        if (!isNonEmptyString(data.old_password, 1024)) errors.push("old_password is required.");
        checkNewPassword(data.new_password, data.confirm_password, errors, "New password");
        return errors;
    },
};

export const forgotPasswordSchema = {
    body: (data) => {
        const errors = [];
        checkEmail(data.email, errors);
        return errors;
    },
};

export const resetPasswordSchema = {
    body: (data) => {
        const errors = [];
        if (!isNonEmptyString(data.token, 128)) errors.push("token is required.");
        checkNewPassword(data.password, data.confirm_password, errors);
        return errors;
    },
};
