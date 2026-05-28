import type { ParticipantStats } from '@learning-english/shared';
import { getDb } from '../db.js';

export function upsertParticipant(userName: string): void {
  const name = userName.trim();
  if (!name) return;
  const db = getDb();
  db.prepare(
    `INSERT INTO participants (user_name, last_seen_at)
     VALUES (?, datetime('now', 'localtime'))
     ON CONFLICT(user_name) DO UPDATE SET last_seen_at = datetime('now', 'localtime')`
  ).run(name);
}

interface StatsRow {
  user_name: string;
  studied_today: number;
  total_reviews: number;
  completed_reviews: number;
  last_active_at: string | null;
}

export function getAllParticipantStats(): ParticipantStats[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         p.user_name,
         COALESCE(s.studied_today, 0) AS studied_today,
         COALESCE(s.total_reviews, 0) AS total_reviews,
         COALESCE(s.completed_reviews, 0) AS completed_reviews,
         COALESCE(s.last_active_at, p.last_seen_at) AS last_active_at
       FROM participants p
       LEFT JOIN (
         SELECT
           user_name,
           COUNT(*) AS total_reviews,
           SUM(CASE WHEN result = 'hoàn thành' THEN 1 ELSE 0 END) AS completed_reviews,
           COUNT(DISTINCT CASE
             WHEN date(reviewed_at) = date('now', 'localtime') THEN dictionary_id
           END) AS studied_today,
           MAX(reviewed_at) AS last_active_at
         FROM study_history
         GROUP BY user_name
       ) s ON p.user_name = s.user_name
       ORDER BY studied_today DESC, total_reviews DESC, p.user_name ASC`
    )
    .all() as unknown as StatsRow[];

  return rows.map((row) => ({
    userName: row.user_name,
    studiedToday: row.studied_today,
    totalReviews: row.total_reviews,
    completedReviews: row.completed_reviews,
    lastActiveAt: row.last_active_at,
  }));
}
