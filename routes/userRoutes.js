import express from 'express';
const router = express.Router();
import {
    createUser,
    loginUser,
    changePassword,
    passwordResetEmailSender,
    resetPassword
} from '../controllers/userControllers.js';
import checkUserAuth from '../middlewares/authMiddleware.js';

// router layer middleware
router.use('/change_password', checkUserAuth);

// register api
router.post('/register', createUser);
router.post('/login', loginUser);
router.post('/change_password', changePassword);
router.post('/reset_password', passwordResetEmailSender);
router.post('/reset_password/:id/:token', resetPassword);

export default router;