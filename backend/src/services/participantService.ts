import type { ParticipantStats } from '../shared/types.js';
import { queryAll, run } from '../db.js';

export async function upsertParticipant(userName: string): Promise<void> {
  const name = userName.trim();
  if (!name) return;
  await run(
    `INSERT INTO participants (user_name, last_seen_at)
     VALUES (?, datetime('now', 'localtime'))
     ON CONFLICT(user_name) DO UPDATE SET last_seen_at = datetime('now', 'localtime')`,
    [name]
  );
}

interface StatsRow {
  user_name: string;
  studied_today: number;
  total_reviews: number;
  completed_reviews: number;
  last_active_at: string | null;
}

export async function getAllParticipantStats(): Promise<ParticipantStats[]> {
  const rows = await queryAll<StatsRow>(
    `SELECT
       p.user_name,
       COALESCE(s.studied_today, 0) AS studied_today,
       COALESCE(s.total_reviews, 0) AS total_reviews,
       COALESCE(s.completed_reviews, 0) AS completed_reviews,
       COALESCE(s.last_active_at, p.last_seen_at) AS last_active_at
     FROM participants p
     LEFT JOIN (
       SELECT
         u.username,
         COUNT(*) AS total_reviews,
         SUM(CASE WHEN sh.result = 'hoàn thành' THEN 1 ELSE 0 END) AS completed_reviews,
         COUNT(DISTINCT CASE
           WHEN date(sh.reviewed_at) = date('now', 'localtime') THEN sh.dictionary_id
         END) AS studied_today,
         MAX(sh.reviewed_at) AS last_active_at
       FROM study_history sh
       INNER JOIN users u ON u.id = sh.user_id
       GROUP BY sh.user_id
     ) s ON p.user_name = s.username COLLATE NOCASE
     ORDER BY studied_today DESC, total_reviews DESC, p.user_name ASC`
  );

  return rows.map((row) => ({
    userName: row.user_name,
    studiedToday: row.studied_today,
    totalReviews: row.total_reviews,
    completedReviews: row.completed_reviews,
    lastActiveAt: row.last_active_at,
  }));
}
