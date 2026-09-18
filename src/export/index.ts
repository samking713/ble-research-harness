/**
 * Export module — produces JSONL, JSON, and CSV files from session observations.
 *
 * JSONL is the preferred format for large datasets.
 * One observation per line. One file per session.
 * File naming: session_<id>_<timestamp>.{jsonl|json|csv}
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BLEObservation } from '../ble/schema';
import { ScanSession } from '../types';
import { getSessionObservations } from '../db/observations';
import { getSession } from '../db/sessions';

const EXPORT_DIR = FileSystem.documentDirectory + 'exports/';

async function ensureExportDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── JSONL ──────────────────────────────────────────────────────────────────

export async function exportJSONL(sessionId: string): Promise<string> {
  await ensureExportDir();
  const observations = await getSessionObservations(sessionId);
  const lines = observations.map(obs => JSON.stringify(obs)).join('\n');
  const path = `${EXPORT_DIR}session_${sessionId}_${timestamp()}.jsonl`;
  await FileSystem.writeAsStringAsync(path, lines, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

// ── JSON ───────────────────────────────────────────────────────────────────

export async function exportJSON(sessionId: string): Promise<string> {
  await ensureExportDir();
  const [session, observations] = await Promise.all([
    getSession(sessionId),
    getSessionObservations(sessionId),
  ]);
  const data = {
    export_version: '1',
    exported_at: new Date().toISOString(),
    session,
    observations,
  };
  const path = `${EXPORT_DIR}session_${sessionId}_${timestamp()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return path;
}

// ── CSV ────────────────────────────────────────────────────────────────────

const CSV_HEADERS: (keyof BLEObservation)[] = [
  'observation_id', 'timestamp_utc', 'timestamp_monotonic',
  'platform', 'os_version', 'app_version', 'phone_model',
  'platform_peripheral_identifier', 'bluetooth_address', 'bluetooth_address_type',
  'device_identifier_available',
  'local_name', 'local_name_normalized', 'local_name_length',
  'manufacturer_id', 'manufacturer_data_raw', 'manufacturer_data_hex', 'manufacturer_data_length',
  'service_uuids', 'service_data_raw', 'solicited_service_uuids', 'overflow_service_uuids',
  'rssi', 'tx_power', 'is_connectable',
  'advertising_sid', 'primary_phy', 'secondary_phy', 'periodic_advertising_interval',
  'scanner_timestamp', 'duplicate_filtering_state', 'scan_session_id',
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object') {
    // Arrays and objects: JSON-encode and CSV-quote
    const s = JSON.stringify(value);
    return `"${s.replace(/"/g, '""')}"`;
  }
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportCSV(sessionId: string): Promise<string> {
  await ensureExportDir();
  const observations = await getSessionObservations(sessionId);
  const headerRow = CSV_HEADERS.join(',');
  const dataRows = observations.map(obs =>
    CSV_HEADERS.map(k => csvCell(obs[k])).join(','),
  );
  const content = [headerRow, ...dataRows].join('\n');
  const path = `${EXPORT_DIR}session_${sessionId}_${timestamp()}.csv`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

// ── Share ──────────────────────────────────────────────────────────────────

export async function shareFile(path: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(path, { UTI: 'public.data', mimeType: 'application/octet-stream' });
}

export async function exportAndShare(
  sessionId: string,
  format: 'jsonl' | 'json' | 'csv',
): Promise<string> {
  let path: string;
  if (format === 'jsonl') path = await exportJSONL(sessionId);
  else if (format === 'json') path = await exportJSON(sessionId);
  else path = await exportCSV(sessionId);

  await shareFile(path);
  return path;
}
