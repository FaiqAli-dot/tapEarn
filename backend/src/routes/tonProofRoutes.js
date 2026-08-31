import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { tonProofChallenge, tonProofVerify } from '../controllers/tonProofController.js';

const router = express.Router();

router.use(requireAuth);

router.post('/challenge', tonProofChallenge);
router.post('/verify', tonProofVerify);

export default router;
