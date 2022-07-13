import express from 'express';
const router = express.Router();
import { createUser, loginUser } from '../controllers/userControllers.js';


// register api
router.post('/register', createUser);
router.post('/login', loginUser);

export default router;