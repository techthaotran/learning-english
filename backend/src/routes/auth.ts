import { Router, type Request, type Response } from 'express';
import {
  clearUserNameCookie,
  getUserNameFromRequest,
  setUserNameCookie,
} from '../lib/authCookie.js';
import { upsertParticipant } from '../services/participantService.js';
import {
  authenticateUser,
  DuplicateUsernameError,
  InvalidCredentialsError,
  isAdminUser,
  registerUser,
} from '../services/userService.js';

const router = Router();

async function sessionPayload(userName: string): Promise<{ userName: string; isAdmin: boolean }> {
  return {
    userName,
    isAdmin: await isAdminUser(userName),
  };
}

async function establishSession(res: Response, userName: string): Promise<void> {
  await upsertParticipant(userName);
  setUserNameCookie(res, userName);
}

router.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username?.trim() || !password) {
    res.status(400).json({ error: 'Username và mật khẩu không được để trống' });
    return;
  }

  try {
    const userName = await registerUser(username, password);
    await establishSession(res, userName);
    res.status(201).json(await sessionPayload(userName));
  } catch (err) {
    if (err instanceof DuplicateUsernameError) {
      res.status(409).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username?.trim() || !password) {
    res.status(400).json({ error: 'Username và mật khẩu không được để trống' });
    return;
  }

  try {
    const userName = await authenticateUser(username, password);
    await establishSession(res, userName);
    res.json(await sessionPayload(userName));
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  clearUserNameCookie(res);
  res.status(204).send();
});

router.get('/me', async (req: Request, res: Response) => {
  const userName = getUserNameFromRequest(req);
  if (!userName) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return;
  }
  res.json(await sessionPayload(userName));
});

export default router;
