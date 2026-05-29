import { Router, type Request, type Response as ExpressResponse } from 'express';
import { getUserNameFromRequest } from '../lib/authCookie.js';
import { requireAdmin } from '../lib/requireAdmin.js';
import { REVIEW_RESULTS } from '../shared/wordStatus.js';
import * as dictionaryService from '../services/dictionaryService.js';
import { getUserIdByUsername } from '../services/userService.js';

const router = Router();

async function requireUser(
  req: Request,
  res: ExpressResponse
): Promise<{ userId: number; userName: string } | null> {
  const userName = getUserNameFromRequest(req);
  if (!userName) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return null;
  }
  const userId = await getUserIdByUsername(userName);
  if (!userId) {
    res.status(401).json({ error: 'Tài khoản không tồn tại' });
    return null;
  }
  return { userId, userName };
}

router.get('/', async (req: Request, res: ExpressResponse) => {
  if (!(await requireAdmin(req, res))) return;

  const { q, status, emptyExample, page, pageSize } = req.query;
  try {
    const result = await dictionaryService.listWords({
      allUsers: true,
      keyword: typeof q === 'string' ? q : undefined,
      status: typeof status === 'string' ? status : undefined,
      emptyExample: emptyExample === 'true' || emptyExample === '1',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: Request, res: ExpressResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { name, type, transcription, meaning, example } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: 'Tên từ không được để trống' });
    return;
  }
  try {
    const word = await dictionaryService.createWord(user.userId, {
      name,
      type,
      transcription,
      meaning,
      example,
    });
    res.status(201).json(word);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/search', async (req: Request, res: ExpressResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    res.json([]);
    return;
  }
  try {
    const words = await dictionaryService.searchWords(q, user.userId);
    res.json(words);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/dashboard', async (req: Request, res: ExpressResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const stats = await dictionaryService.getDashboardStats(user.userId, user.userName);
    res.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/flashcards', async (req: Request, res: ExpressResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const cards = await dictionaryService.getFlashcardBatch(user.userId);
    res.json(cards);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.post('/flashcards/review', async (req: Request, res: ExpressResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { dictionaryId, result } = req.body;
  if (!dictionaryId || !result) {
    res.status(400).json({ error: 'Thiếu dictionaryId hoặc result' });
    return;
  }
  if (!(REVIEW_RESULTS as readonly string[]).includes(result)) {
    res.status(400).json({ error: 'result phải là "đang học" hoặc "hoàn thành"' });
    return;
  }
  try {
    const word = await dictionaryService.recordFlashcardReview({
      dictionaryId: Number(dictionaryId),
      userId: user.userId,
      userName: user.userName,
      result,
    });
    if (!word) {
      res.status(404).json({ error: 'Không tìm thấy từ' });
      return;
    }
    res.json(word);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', async (req: Request, res: ExpressResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const word = await dictionaryService.getWordById(Number(req.params.id), user.userId);
    if (!word) {
      res.status(404).json({ error: 'Không tìm thấy từ' });
      return;
    }
    res.json(word);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.put('/:id', async (req: Request, res: ExpressResponse) => {
  if (!(await requireAdmin(req, res))) return;

  const id = Number(req.params.id);
  try {
    const word = await dictionaryService.updateWord(id, req.body, undefined, true);
    if (!word) {
      res.status(404).json({ error: 'Không tìm thấy từ' });
      return;
    }
    res.json(word);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

router.delete('/:id', async (req: Request, res: ExpressResponse) => {
  if (!(await requireAdmin(req, res))) return;

  const id = Number(req.params.id);
  try {
    const deleted = await dictionaryService.deleteWord(id, undefined, true);
    if (!deleted) {
      res.status(404).json({ error: 'Không tìm thấy từ' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
