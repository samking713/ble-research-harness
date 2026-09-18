/**
 * Application context.
 *
 * Owns the BLE scanner lifecycle, database initialization, and all shared state.
 * UI components read state and call actions from this context.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as ExpoDevice from 'expo-device';
import Constants from 'expo-constants';
import { BLEObservation, generateId } from '../ble/schema';
import { BLEScanner } from '../ble/scanner';
import { DeviceEntry, Experiment, GroundTruthDevice, ScanSession } from '../types';
import { getDatabase } from '../db/database';
import { insertObservation, getObservation, getSessionObservations } from '../db/observations';
import {
  createSession, endSession, getSessions, getSession,
} from '../db/sessions';
import {
  createExperiment as dbCreateExperiment,
  endExperiment as dbEndExperiment,
  getExperiments,
  addGroundTruthDevice as dbAddGroundTruthDevice,
  removeGroundTruthDevice as dbRemoveGroundTruthDevice,
  getGroundTruthDevices,
} from '../db/experiments';
import { exportAndShare } from '../export';

// ── Types ──────────────────────────────────────────────────────────────────

interface AppState {
  isDbReady: boolean;
  isScanning: boolean;
  currentSession: ScanSession | null;
  devices: DeviceEntry[];        // sorted by RSSI descending
  obsCount: number;
  scanError: string | null;
  currentExperiment: Experiment | null;
  groundTruthDevices: GroundTruthDevice[];
}

interface AppActions {
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  getObservationById: (id: string) => Promise<BLEObservation | null>;
  getSessionObservationsById: (sessionId: string) => Promise<BLEObservation[]>;
  getAllSessions: () => Promise<ScanSession[]>;
  createNewExperiment: (
    data: Pick<Experiment, 'name' | 'scenario' | 'notes' | 'gps_enabled' | 'motion_state'>,
  ) => Promise<void>;
  closeExperiment: () => Promise<void>;
  addGroundTruthDevice: (
    data: Pick<
      GroundTruthDevice,
      'label' | 'physical_description' | 'device_model' | 'owner' | 'notes'
    >,
  ) => Promise<void>;
  removeGroundTruthDevice: (id: string) => Promise<void>;
  exportSession: (sessionId: string, format: 'jsonl' | 'json' | 'csv') => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────────────

const AppContext = createContext<(AppState & AppActions) | null>(null);

export function useApp(): AppState & AppActions {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isDbReady, setIsDbReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [currentSession, setCurrentSession] = useState<ScanSession | null>(null);
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [obsCount, setObsCount] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentExperiment, setCurrentExperiment] = useState<Experiment | null>(null);
  const [groundTruthDevices, setGroundTruthDevices] = useState<GroundTruthDevice[]>([]);

  // In-memory device map for the live scanner.
  // Keyed by platform_peripheral_identifier (falls back to observation_id).
  const deviceMapRef = useRef<Map<string, DeviceEntry>>(new Map());
  const pendingObsRef = useRef<BLEObservation[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize DB on mount.
  useEffect(() => {
    getDatabase()
      .then(() => setIsDbReady(true))
      .catch(e => console.error('[AppContext] DB init failed:', e));
  }, []);

  // Flush pending observations to DB and refresh UI on interval.
  const scheduleBatch = useCallback(() => {
    if (batchTimerRef.current) return;
    batchTimerRef.current = setTimeout(async () => {
      batchTimerRef.current = null;

      const batch = pendingObsRef.current.splice(0);
      if (batch.length > 0) {
        // Persist to SQLite
        try {
          for (const obs of batch) await insertObservation(obs);
        } catch (e) {
          console.error('[AppContext] DB insert error:', e);
        }
        setObsCount(n => n + batch.length);
      }

      // Update sorted device list from in-memory map
      const sorted = [...deviceMapRef.current.values()].sort(
        (a, b) => b.latest.rssi - a.latest.rssi,
      );
      setDevices(sorted);
    }, 500); // batch every 500ms
  }, []);

  const startScan = useCallback(async () => {
    if (isScanning) return;
    setScanError(null);

    const sessionId = generateId();
    const now = new Date().toISOString();
    const session: ScanSession = {
      id: sessionId,
      started_at: now,
      ended_at: null,
      platform: Platform.OS as 'ios' | 'android',
      os_version: ExpoDevice.osVersion ?? 'unknown',
      app_version: Constants.expoConfig?.version ?? '0.1.0',
      phone_model: [ExpoDevice.manufacturer, ExpoDevice.modelName]
        .filter(Boolean)
        .join(' ') || 'unknown',
      duplicate_filtering_state: 'off',
      notes: null,
    };

    await createSession(session);
    setCurrentSession(session);
    deviceMapRef.current.clear();
    setDevices([]);
    setObsCount(0);

    const scanner = BLEScanner.getInstance();
    const result = await scanner.start(
      sessionId,
      obs => {
        // Called for every BLE packet (potentially hundreds/second).
        // Do minimal work here — queue for batch processing.
        const key = obs.platform_peripheral_identifier ?? obs.observation_id;
        const existing = deviceMapRef.current.get(key);
        if (existing) {
          deviceMapRef.current.set(key, {
            ...existing,
            latest: obs,
            count: existing.count + 1,
          });
        } else {
          deviceMapRef.current.set(key, {
            key,
            first: obs,
            latest: obs,
            count: 1,
          });
        }
        pendingObsRef.current.push(obs);
        scheduleBatch();
      },
      err => {
        setScanError(err.message);
        setIsScanning(false);
      },
    );

    if (!result.ok) {
      setScanError(result.reason ?? 'Failed to start scan');
      await endSession(sessionId, new Date().toISOString());
      return;
    }

    setIsScanning(true);
  }, [isScanning, scheduleBatch]);

  const stopScan = useCallback(async () => {
    BLEScanner.getInstance().stop();
    setIsScanning(false);
    if (currentSession) {
      const endedAt = new Date().toISOString();
      await endSession(currentSession.id, endedAt);
      setCurrentSession(s => s ? { ...s, ended_at: endedAt } : null);
    }
  }, [currentSession]);

  const createNewExperiment = useCallback(
    async (
      data: Pick<Experiment, 'name' | 'scenario' | 'notes' | 'gps_enabled' | 'motion_state'>,
    ) => {
      const exp: Experiment = {
        id: generateId(),
        ...data,
        started_at: new Date().toISOString(),
        ended_at: null,
        created_at: new Date().toISOString(),
      };
      await dbCreateExperiment(exp);
      setCurrentExperiment(exp);
      setGroundTruthDevices([]);
    },
    [],
  );

  const closeExperiment = useCallback(async () => {
    if (!currentExperiment) return;
    const endedAt = new Date().toISOString();
    await dbEndExperiment(currentExperiment.id, endedAt);
    setCurrentExperiment(exp => exp ? { ...exp, ended_at: endedAt } : null);
  }, [currentExperiment]);

  const addGroundTruthDevice = useCallback(
    async (
      data: Pick<
        GroundTruthDevice,
        'label' | 'physical_description' | 'device_model' | 'owner' | 'notes'
      >,
    ) => {
      if (!currentExperiment) return;
      const device: GroundTruthDevice = {
        id: generateId(),
        experiment_id: currentExperiment.id,
        ...data,
        created_at: new Date().toISOString(),
      };
      await dbAddGroundTruthDevice(device);
      setGroundTruthDevices(prev => [...prev, device]);
    },
    [currentExperiment],
  );

  const removeGroundTruthDevice = useCallback(async (id: string) => {
    await dbRemoveGroundTruthDevice(id);
    setGroundTruthDevices(prev => prev.filter(d => d.id !== id));
  }, []);

  const exportSession = useCallback(
    async (sessionId: string, format: 'jsonl' | 'json' | 'csv') => {
      await exportAndShare(sessionId, format);
    },
    [],
  );

  return (
    <AppContext.Provider
      value={{
        isDbReady,
        isScanning,
        currentSession,
        devices,
        obsCount,
        scanError,
        currentExperiment,
        groundTruthDevices,
        startScan,
        stopScan,
        getObservationById: getObservation,
        getSessionObservationsById: getSessionObservations,
        getAllSessions: getSessions,
        createNewExperiment,
        closeExperiment,
        addGroundTruthDevice,
        removeGroundTruthDevice,
        exportSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
