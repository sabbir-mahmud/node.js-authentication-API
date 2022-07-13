import express from 'express';
const router = express.Router();
import { createUser } from '../controllers/userControllers.js';


// register api
router.post('/register', createUser);

export default router;