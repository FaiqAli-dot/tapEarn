import { createTonProofChallenge, verifyTonProof } from '../services/tonProofService.js';

export async function tonProofChallenge(req, res) {
  try {
    const challenge = await createTonProofChallenge(req.telegramId);
    res.json({ success: true, data: challenge });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function tonProofVerify(req, res) {
  try {
    const { address, publicKey, proof } = req.body;
    const result = await verifyTonProof(req.telegramId, { address, publicKey, proof });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
