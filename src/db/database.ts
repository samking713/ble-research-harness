/**
 * SQLite database initialization.
 *
 * All tables are created here. Schema is append-only — never drop or alter
 * tables; add new columns in future migrations with ALTER TABLE ... ADD COLUMN.
 */
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('ble_research.db');
  await migrate(_db);
  return _db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS scan_sessions (
      id                        TEXT PRIMARY KEY,
      started_at                TEXT NOT NULL,
      ended_at                  TEXT,
      platform                  TEXT NOT NULL,
      os_version                TEXT NOT NULL,
      app_version               TEXT NOT NULL,
      phone_model               TEXT NOT NULL,
      duplicate_filtering_state TEXT NOT NULL DEFAULT 'unknown',
      notes                     TEXT
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      scenario     TEXT,
      notes        TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      gps_enabled  INTEGER NOT NULL DEFAULT 0,
      motion_state TEXT,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ground_truth_devices (
      id                   TEXT PRIMARY KEY,
      experiment_id        TEXT NOT NULL,
      label                TEXT NOT NULL,
      physical_description TEXT,
      device_model         TEXT,
      owner                TEXT,
      notes                TEXT,
      created_at           TEXT NOT NULL,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id)
    );

    CREATE TABLE IF NOT EXISTS ble_observations (
      observation_id                  TEXT PRIMARY KEY,
      timestamp_utc                   TEXT NOT NULL,
      timestamp_monotonic             REAL NOT NULL,
      platform                        TEXT NOT NULL,
      os_version                      TEXT NOT NULL,
      app_version                     TEXT NOT NULL,
      phone_model                     TEXT NOT NULL,
      platform_peripheral_identifier  TEXT,
      bluetooth_address               TEXT,
      bluetooth_address_type          TEXT,
      device_identifier_available     INTEGER NOT NULL DEFAULT 1,
      local_name                      TEXT,
      local_name_normalized           TEXT,
      local_name_length               INTEGER,
      manufacturer_id                 INTEGER,
      manufacturer_data_raw           TEXT,
      manufacturer_data_hex           TEXT,
      manufacturer_data_length        INTEGER,
      service_uuids                   TEXT,
      service_data_raw                TEXT,
      solicited_service_uuids         TEXT,
      overflow_service_uuids          TEXT,
      rssi                            INTEGER NOT NULL,
      tx_power                        INTEGER,
      is_connectable                  INTEGER,
      advertising_sid                 INTEGER,
      primary_phy                     TEXT,
      secondary_phy                   TEXT,
      periodic_advertising_interval   REAL,
      scanner_timestamp               TEXT NOT NULL,
      duplicate_filtering_state       TEXT NOT NULL,
      scan_session_id                 TEXT NOT NULL,
      FOREIGN KEY (scan_session_id) REFERENCES scan_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS experiment_labels (
      id                       TEXT PRIMARY KEY,
      experiment_id            TEXT NOT NULL,
      ground_truth_device_id   TEXT NOT NULL,
      observation_id           TEXT NOT NULL,
      labeled_at               TEXT NOT NULL,
      notes                    TEXT,
      FOREIGN KEY (experiment_id)          REFERENCES experiments(id),
      FOREIGN KEY (ground_truth_device_id) REFERENCES ground_truth_devices(id),
      FOREIGN KEY (observation_id)         REFERENCES ble_observations(observation_id)
    );

    CREATE INDEX IF NOT EXISTS idx_obs_timestamp   ON ble_observations(timestamp_utc);
    CREATE INDEX IF NOT EXISTS idx_obs_session     ON ble_observations(scan_session_id);
    CREATE INDEX IF NOT EXISTS idx_obs_peripheral  ON ble_observations(platform_peripheral_identifier);
    CREATE INDEX IF NOT EXISTS idx_obs_address     ON ble_observations(bluetooth_address);
    CREATE INDEX IF NOT EXISTS idx_obs_mfr         ON ble_observations(manufacturer_id);
    CREATE INDEX IF NOT EXISTS idx_gt_experiment   ON ground_truth_devices(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_label_exp       ON experiment_labels(experiment_id);
    CREATE INDEX IF NOT EXISTS idx_label_obs       ON experiment_labels(observation_id);
  `);
}
