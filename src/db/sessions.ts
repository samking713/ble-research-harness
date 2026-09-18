import { getDatabase } from './database';
import { ScanSession } from '../types';

export async function createSession(session: ScanSession): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO scan_sessions
     (id, started_at, ended_at, platform, os_version, app_version, phone_model,
      duplicate_filtering_state, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.started_at,
      session.ended_at,
      session.platform,
      session.os_version,
      session.app_version,
      session.phone_model,
      session.duplicate_filtering_state,
      session.notes,
    ],
  );
}

export async function endSession(id: string, endedAt: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE scan_sessions SET ended_at = ? WHERE id = ?',
    [endedAt, id],
  );
}

export async function getSessions(): Promise<ScanSession[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ScanSession & { obs_count: number }>(
    `SELECT s.*, COUNT(o.observation_id) as obs_count
     FROM scan_sessions s
     LEFT JOIN ble_observations o ON o.scan_session_id = s.id
     GROUP BY s.id
     ORDER BY s.started_at DESC`,
  );
  return rows.map(r => ({ ...r, obs_count: r.obs_count ?? 0 }));
}

export async function getSession(id: string): Promise<ScanSession | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ScanSession>(
    'SELECT * FROM scan_sessions WHERE id = ?',
    [id],
  );
}
