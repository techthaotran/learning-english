import type { Request, Response } from 'express';
import { getUserNameFromRequest } from './authCookie.js';
import { isAdminUser } from '../services/userService.js';

export async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const userName = getUserNameFromRequest(req);
  if (!userName) {
    res.status(401).json({ error: 'Chưa đăng nhập' });
    return false;
  }
  if (!(await isAdminUser(userName))) {
    res.status(403).json({ error: 'Chỉ admin mới có quyền truy cập' });
    return false;
  }
  return true;
}
