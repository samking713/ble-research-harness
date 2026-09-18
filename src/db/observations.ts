import { getDatabase } from './database';
import { BLEObservation } from '../ble/schema';

// Serialize JSON fields for SQLite storage.
// Arrays and objects are stored as JSON strings.
function serialize(obs: BLEObservation): (string | number | null)[] {
  return [
    obs.observation_id,
    obs.timestamp_utc,
    obs.timestamp_monotonic,
    obs.platform,
    obs.os_version,
    obs.app_version,
    obs.phone_model,
    obs.platform_peripheral_identifier,
    obs.bluetooth_address,
    obs.bluetooth_address_type,
    obs.device_identifier_available ? 1 : 0,
    obs.local_name,
    obs.local_name_normalized,
    obs.local_name_length,
    obs.manufacturer_id,
    obs.manufacturer_data_raw ? JSON.stringify(obs.manufacturer_data_raw) : null,
    obs.manufacturer_data_hex,
    obs.manufacturer_data_length,
    obs.service_uuids ? JSON.stringify(obs.service_uuids) : null,
    obs.service_data_raw ? JSON.stringify(obs.service_data_raw) : null,
    obs.solicited_service_uuids ? JSON.stringify(obs.solicited_service_uuids) : null,
    obs.overflow_service_uuids ? JSON.stringify(obs.overflow_service_uuids) : null,
    obs.rssi,
    obs.tx_power,
    obs.is_connectable === null ? null : obs.is_connectable ? 1 : 0,
    obs.advertising_sid,
    obs.primary_phy,
    obs.secondary_phy,
    obs.periodic_advertising_interval,
    obs.scanner_timestamp,
    obs.duplicate_filtering_state,
    obs.scan_session_id,
  ];
}

// Deserialize a SQLite row back to BLEObservation.
function deserialize(row: Record<string, unknown>): BLEObservation {
  return {
    ...(row as any),
    device_identifier_available: !!row.device_identifier_available,
    is_connectable:
      row.is_connectable === null ? null : !!row.is_connectable,
    manufacturer_data_raw: row.manufacturer_data_raw
      ? JSON.parse(row.manufacturer_data_raw as string)
      : null,
    service_uuids: row.service_uuids
      ? JSON.parse(row.service_uuids as string)
      : null,
    service_data_raw: row.service_data_raw
      ? JSON.parse(row.service_data_raw as string)
      : null,
    solicited_service_uuids: row.solicited_service_uuids
      ? JSON.parse(row.solicited_service_uuids as string)
      : null,
    overflow_service_uuids: row.overflow_service_uuids
      ? JSON.parse(row.overflow_service_uuids as string)
      : null,
  };
}

const INSERT_SQL = `
  INSERT OR IGNORE INTO ble_observations (
    observation_id, timestamp_utc, timestamp_monotonic, platform, os_version,
    app_version, phone_model, platform_peripheral_identifier, bluetooth_address,
    bluetooth_address_type, device_identifier_available, local_name,
    local_name_normalized, local_name_length, manufacturer_id,
    manufacturer_data_raw, manufacturer_data_hex, manufacturer_data_length,
    service_uuids, service_data_raw, solicited_service_uuids, overflow_service_uuids,
    rssi, tx_power, is_connectable, advertising_sid, primary_phy, secondary_phy,
    periodic_advertising_interval, scanner_timestamp, duplicate_filtering_state,
    scan_session_id
  ) VALUES (
    ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
  )
`;

export async function insertObservation(obs: BLEObservation): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(INSERT_SQL, serialize(obs));
}

/** Batch insert — more efficient for high-rate scanning. */
export async function insertObservationsBatch(
  observations: BLEObservation[],
): Promise<void> {
  if (observations.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const obs of observations) {
      await db.runAsync(INSERT_SQL, serialize(obs));
    }
  });
}

export async function getObservation(
  observationId: string,
): Promise<BLEObservation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM ble_observations WHERE observation_id = ?',
    [observationId],
  );
  return row ? deserialize(row) : null;
}

export async function getSessionObservations(
  sessionId: string,
): Promise<BLEObservation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM ble_observations WHERE scan_session_id = ? ORDER BY timestamp_utc ASC',
    [sessionId],
  );
  return rows.map(deserialize);
}

export async function getSessionObservationCount(
  sessionId: string,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ble_observations WHERE scan_session_id = ?',
    [sessionId],
  );
  return result?.count ?? 0;
}

export async function getLatestObservationsPerDevice(
  sessionId: string,
): Promise<BLEObservation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ble_observations
     WHERE scan_session_id = ?
       AND observation_id IN (
         SELECT observation_id FROM ble_observations
         WHERE scan_session_id = ?
         GROUP BY COALESCE(platform_peripheral_identifier, observation_id)
         HAVING observation_id = MAX(observation_id)
       )
     ORDER BY rssi DESC`,
    [sessionId, sessionId],
  );
  return rows.map(deserialize);
}
