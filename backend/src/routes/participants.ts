import { Router } from 'express';
import { upsertParticipant } from '../services/participantService.js';

const router = Router();

router.post('/', (req, res) => {
  const { userName } = req.body as { userName?: string };
  if (!userName?.trim()) {
    res.status(400).json({ error: 'userName không được để trống' });
    return;
  }
  upsertParticipant(userName);
  res.status(201).json({ userName: userName.trim() });
});

export default router;
