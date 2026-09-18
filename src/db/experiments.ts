import { getDatabase } from './database';
import { Experiment, GroundTruthDevice, ExperimentLabel } from '../types';

function rowToExperiment(row: any): Experiment {
  return { ...row, gps_enabled: !!row.gps_enabled };
}

// ── Experiments ────────────────────────────────────────────────────────────

export async function createExperiment(exp: Experiment): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO experiments
     (id, name, scenario, notes, started_at, ended_at, gps_enabled, motion_state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exp.id,
      exp.name,
      exp.scenario,
      exp.notes,
      exp.started_at,
      exp.ended_at,
      exp.gps_enabled ? 1 : 0,
      exp.motion_state,
      exp.created_at,
    ],
  );
}

export async function endExperiment(id: string, endedAt: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE experiments SET ended_at = ? WHERE id = ?',
    [endedAt, id],
  );
}

export async function getExperiments(): Promise<Experiment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM experiments ORDER BY created_at DESC',
  );
  return rows.map(rowToExperiment);
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM experiments WHERE id = ?',
    [id],
  );
  return row ? rowToExperiment(row) : null;
}

// ── Ground Truth Devices ───────────────────────────────────────────────────

export async function addGroundTruthDevice(
  device: GroundTruthDevice,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO ground_truth_devices
     (id, experiment_id, label, physical_description, device_model, owner, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      device.id,
      device.experiment_id,
      device.label,
      device.physical_description,
      device.device_model,
      device.owner,
      device.notes,
      device.created_at,
    ],
  );
}

export async function removeGroundTruthDevice(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM ground_truth_devices WHERE id = ?', [id]);
}

export async function getGroundTruthDevices(
  experimentId: string,
): Promise<GroundTruthDevice[]> {
  const db = await getDatabase();
  return db.getAllAsync<GroundTruthDevice>(
    'SELECT * FROM ground_truth_devices WHERE experiment_id = ? ORDER BY created_at ASC',
    [experimentId],
  );
}

// ── Experiment Labels ──────────────────────────────────────────────────────

export async function addLabel(label: ExperimentLabel): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO experiment_labels
     (id, experiment_id, ground_truth_device_id, observation_id, labeled_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      label.id,
      label.experiment_id,
      label.ground_truth_device_id,
      label.observation_id,
      label.labeled_at,
      label.notes,
    ],
  );
}

export async function getLabelsForExperiment(
  experimentId: string,
): Promise<ExperimentLabel[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExperimentLabel>(
    'SELECT * FROM experiment_labels WHERE experiment_id = ? ORDER BY labeled_at ASC',
    [experimentId],
  );
}
