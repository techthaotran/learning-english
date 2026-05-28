import { Router, type Request, type Response } from 'express';
import { fetchWordFromGoogle } from '../lib/googleTranslate.js';

const router = Router();

/** Proxy Google translate_a/single — tránh CORS từ trình duyệt */
router.get('/lookup', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) {
    res.status(400).json({ error: 'Tham số q không được để trống' });
    return;
  }
  try {
    const result = await fetchWordFromGoogle(q);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
});

export default router;
