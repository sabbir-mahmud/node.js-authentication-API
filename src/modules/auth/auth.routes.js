import { Router } from "express";
import { isAuthenticated } from "../../middlewares/authenticate.js";
import { authLimiter, resetLimiter } from "../../middlewares/rateLimit.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import * as controller from "./auth.controller.js";
import {
    changePasswordSchema, forgotPasswordSchema, loginSchema, logoutSchema, refreshSchema, registerSchema,
    resetPasswordSchema,
} from "./auth.validation.js";

const router = Router();

router.post("/register", authLimiter, validateRequest(registerSchema), controller.register);
router.post("/login", authLimiter, validateRequest(loginSchema), controller.login);
router.post("/refresh", authLimiter, validateRequest(refreshSchema), controller.refresh);
router.post("/logout", validateRequest(logoutSchema), controller.logout);

router.post("/forgot-password", resetLimiter, validateRequest(forgotPasswordSchema), controller.forgotPassword);
router.post("/reset-password", resetLimiter, validateRequest(resetPasswordSchema), controller.resetPassword);

router.get("/me", isAuthenticated, controller.me);
router.post("/change-password", authLimiter, isAuthenticated, validateRequest(changePasswordSchema), controller.changePassword);
router.post("/logout-all", isAuthenticated, controller.logoutAll);

export default router;
