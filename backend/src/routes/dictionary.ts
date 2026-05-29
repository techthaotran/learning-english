import { Router, type Request, type Response as ExpressResponse } from 'express';
import { REVIEW_RESULTS } from '../shared/wordStatus.js';
import * as dictionaryService from '../services/dictionaryService.js';

const router = Router();

router.get('/', async (req: Request, res: ExpressResponse) => {
  const { q, status, emptyExample, page, pageSize } = req.query;
  try {
    const result = await dictionaryService.listWords({
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
  const { name, type, transcription, meaning, example } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: 'Tên từ không được để trống' });
    return;
  }
  try {
    const word = await dictionaryService.createWord({
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
  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    res.json([]);
    return;
  }
  try {
    const words = await dictionaryService.searchWords(q);
    res.json(words);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/dashboard', async (req: Request, res: ExpressResponse) => {
  const userName =
    typeof req.query.userName === 'string' ? req.query.userName : undefined;
  try {
    const stats = await dictionaryService.getDashboardStats(userName);
    res.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/flashcards', async (req: Request, res: ExpressResponse) => {
  const userName =
    typeof req.query.userName === 'string' ? req.query.userName : 'guest';
  try {
    const cards = await dictionaryService.getFlashcardBatch(userName);
    res.json(cards);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.post('/flashcards/review', async (req: Request, res: ExpressResponse) => {
  const { dictionaryId, userName, result } = req.body;
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
      userName: userName || 'guest',
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
  try {
    const word = await dictionaryService.getWordById(Number(req.params.id));
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
  const id = Number(req.params.id);
  try {
    const word = await dictionaryService.updateWord(id, req.body);
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
  const id = Number(req.params.id);
  try {
    const deleted = await dictionaryService.deleteWord(id);
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
