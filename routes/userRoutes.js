import express from 'express';
import {
    changePassword, createUser,
    loginUser, passwordResetEmailSender, refreshToken, resetPassword
} from '../controllers/userControllers.js';
import checkUserAuth from '../middlewares/authMiddleware.js';
const router = express.Router();

// router layer middleware
router.use('/change_password', checkUserAuth);

// register api
router.post('/register', createUser);
router.post('/login', loginUser);
router.post('/refresh', refreshToken);
router.post('/change_password', changePassword);
router.post('/reset_password', passwordResetEmailSender);
router.post('/reset_password/:id/:token', resetPassword);

export default router;