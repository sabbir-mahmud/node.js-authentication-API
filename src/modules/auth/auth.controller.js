import { sendResponse } from "../../configs/utils.js";
import { asyncHandler } from "../../lib/errors.js";
import * as authService from "./auth.service.js";

export const register = asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    return sendResponse(res, 201, true, "User created successfully", { user, accessToken, refreshToken });
});

export const login = asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    return sendResponse(res, 200, true, "User logged in successfully", { user, accessToken, refreshToken });
});

export const refresh = asyncHandler(async (req, res) => {
    const tokens = await authService.refresh(req.body.refreshToken);
    return sendResponse(res, 200, true, "Token refreshed successfully", tokens);
});

export const logout = asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    return sendResponse(res, 200, true, "Logged out successfully");
});

export const logoutAll = asyncHandler(async (req, res) => {
    await authService.logoutAll(req.user.id);
    return sendResponse(res, 200, true, "Logged out from all devices");
});

export const me = asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user.id);
    return sendResponse(res, 200, true, "User fetched successfully", { user });
});

export const changePassword = asyncHandler(async (req, res) => {
    const tokens = await authService.changePassword(req.user.id, req.body);
    return sendResponse(res, 200, true, "Password changed successfully", tokens);
});

export const forgotPassword = asyncHandler(async (req, res) => {
    await authService.requestPasswordReset(req.body.email);
    return sendResponse(res, 200, true, "If an account exists for that email, a password reset link has been sent");
});

export const resetPassword = asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);
    return sendResponse(res, 200, true, "Password has been reset successfully");
});
