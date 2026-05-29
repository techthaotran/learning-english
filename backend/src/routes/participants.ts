import { Router, type Request, type Response } from 'express';
import { upsertParticipant } from '../services/participantService.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { userName } = req.body as { userName?: string };
  if (!userName?.trim()) {
    res.status(400).json({ error: 'userName không được để trống' });
    return;
  }
  try {
    await upsertParticipant(userName);
    res.status(201).json({ userName: userName.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
