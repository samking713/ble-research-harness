export interface ScanSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  platform: 'ios' | 'android';
  os_version: string;
  app_version: string;
  phone_model: string;
  duplicate_filtering_state: 'on' | 'off' | 'unknown';
  notes: string | null;
  obs_count?: number; // computed, not stored
}

export interface Experiment {
  id: string;
  name: string;
  scenario: string | null;
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  gps_enabled: boolean;
  motion_state: string | null;
  created_at: string;
}

export interface GroundTruthDevice {
  id: string;
  experiment_id: string;
  label: string;
  physical_description: string | null;
  device_model: string | null;
  owner: string | null;
  notes: string | null;
  created_at: string;
}

export interface ExperimentLabel {
  id: string;
  experiment_id: string;
  ground_truth_device_id: string;
  observation_id: string;
  labeled_at: string;
  notes: string | null;
}

// In-memory tracking entry for the live scanner UI.
// Groups all observations of a single platform_peripheral_identifier.
export interface DeviceEntry {
  key: string; // platform_peripheral_identifier or observation_id as fallback
  first: import('../ble/schema').BLEObservation;
  latest: import('../ble/schema').BLEObservation;
  count: number;
}

export type ExportFormat = 'jsonl' | 'csv' | 'json';
