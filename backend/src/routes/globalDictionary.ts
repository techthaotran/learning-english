import { Router, type Request, type Response } from 'express';
import { getUserNameFromRequest } from '../lib/authCookie.js';
import * as globalDictionaryService from '../services/globalDictionaryService.js';
import { getUserIdByUsername } from '../services/userService.js';

const router = Router();

async function resolveOptionalUserId(req: Request): Promise<number | undefined> {
  const userName = getUserNameFromRequest(req);
  if (!userName) return undefined;
  const userId = await getUserIdByUsername(userName);
  return userId ?? undefined;
}

router.get('/levels', async (_req: Request, res: Response) => {
  try {
    const levels = await globalDictionaryService.listLevelSummaries();
    res.json(levels);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/types', async (req: Request, res: Response) => {
  const { level } = req.query;
  if (typeof level !== 'string' || !level.trim()) {
    res.status(400).json({ error: 'Thiếu tham số level (CEFR)' });
    return;
  }
  try {
    const types = await globalDictionaryService.listTypesByLevel(level);
    res.json(types);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/words', async (req: Request, res: Response) => {
  const { level, page, pageSize, excludeNotInFlashcard, type } = req.query;
  if (typeof level !== 'string' || !level.trim()) {
    res.status(400).json({ error: 'Thiếu tham số level (CEFR)' });
    return;
  }
  try {
    const userId = await resolveOptionalUserId(req);
    const result = await globalDictionaryService.listWordsByLevel({
      level,
      page: page ? Number(page) : 1,
      pageSize: pageSize
        ? Number(pageSize)
        : globalDictionaryService.GLOBAL_DICTIONARY_PAGE_SIZE,
      userId,
      excludeNotInFlashcard:
        excludeNotInFlashcard === 'true' || excludeNotInFlashcard === '1',
      type: typeof type === 'string' ? type : undefined,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
