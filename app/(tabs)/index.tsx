/**
 * Screen 1 — Live Scanner
 *
 * Shows all BLE devices seen in the current scan session, sorted by RSSI.
 * Each row summarizes the latest observation for a unique identifier.
 * Tap a row to view the full raw observation.
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { DeviceEntry } from '../../src/types';
import { companyName } from '../../src/ble/schema';

// ── Helpers ────────────────────────────────────────────────────────────────

function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 12 ? id.slice(0, 8) + '…' + id.slice(-4) : id;
}

function relativeTime(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 2) return 'just now';
  if (diff < 60) return `${diff.toFixed(0)}s ago`;
  return `${(diff / 60).toFixed(0)}m ago`;
}

function rssiPercent(rssi: number): number {
  return Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100));
}

function rssiColor(rssi: number): string {
  if (rssi > -60) return '#00ff88';
  if (rssi > -75) return '#ffcc00';
  return '#ff4444';
}

function manufacturerLabel(entry: DeviceEntry): string {
  const obs = entry.latest;
  if (obs.manufacturer_id === null) return '';
  const hex = `0x${obs.manufacturer_id.toString(16).toUpperCase().padStart(4, '0')}`;
  const name = companyName(obs.manufacturer_id);
  return name ? `${hex} ${name}` : hex;
}

// ── Device Row ─────────────────────────────────────────────────────────────

const DeviceRow = React.memo(({ entry }: { entry: DeviceEntry }) => {
  const obs = entry.latest;
  const pct = rssiPercent(obs.rssi);
  const color = rssiColor(obs.rssi);
  const mfrLabel = manufacturerLabel(entry);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/observation/${obs.observation_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowTop}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {obs.local_name ?? '(no name)'}
        </Text>
        <View style={styles.rssiContainer}>
          <View style={[styles.rssiBar, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.rssiText, { color }]}>{obs.rssi} dBm</Text>
      </View>

      <View style={styles.rowMid}>
        <Text style={styles.monospace} numberOfLines={1}>
          {shortId(obs.platform_peripheral_identifier)}
        </Text>
        {mfrLabel ? (
          <Text style={styles.manufacturer} numberOfLines={1}>{mfrLabel}</Text>
        ) : null}
      </View>

      <View style={styles.rowBottom}>
        <Text style={styles.meta}>{entry.count} obs</Text>
        <Text style={styles.meta}>
          first {relativeTime(entry.first.timestamp_utc)}
        </Text>
        <Text style={styles.meta}>
          last {relativeTime(entry.latest.timestamp_utc)}
        </Text>
      </View>

      {obs.service_uuids && obs.service_uuids.length > 0 && (
        <Text style={styles.services} numberOfLines={1}>
          {obs.service_uuids.join(' · ')}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  const {
    isDbReady, isScanning, currentSession, devices, obsCount, scanError,
    startScan, stopScan,
  } = useApp();

  const handleToggle = useCallback(async () => {
    if (isScanning) await stopScan();
    else await startScan();
  }, [isScanning, startScan, stopScan]);

  const keyExtractor = useCallback((item: DeviceEntry) => item.key, []);
  const renderItem = useCallback(
    ({ item }: { item: DeviceEntry }) => <DeviceRow entry={item} />,
    [],
  );

  if (!isDbReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00ff88" />
        <Text style={styles.loadingText}>Initializing database…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Session bar */}
      <View style={styles.sessionBar}>
        <View style={styles.sessionInfo}>
          {currentSession ? (
            <>
              <View style={[styles.dot, { backgroundColor: isScanning ? '#00ff88' : '#555' }]} />
              <Text style={styles.sessionText}>
                {currentSession.id.slice(0, 8)}
              </Text>
              <Text style={styles.sessionText}>  {obsCount} obs</Text>
            </>
          ) : (
            <Text style={styles.sessionHint}>No active session</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonActive]}
          onPress={handleToggle}
        >
          <Text style={styles.scanButtonText}>
            {isScanning ? 'STOP' : 'START SCAN'}
          </Text>
        </TouchableOpacity>
      </View>

      {scanError && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{scanError}</Text>
        </View>
      )}

      {/* Device list */}
      {devices.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {isScanning
              ? 'Scanning… waiting for advertisements'
              : 'Press START SCAN to begin'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {isScanning && devices.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {devices.length} unique identifier{devices.length !== 1 ? 's' : ''} · {obsCount} total observations
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },

  sessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sessionInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sessionText: { color: '#aaa', fontSize: 12, fontFamily: 'monospace' },
  sessionHint: { color: '#555', fontSize: 12 },
  scanButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#1a3a2a',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  scanButtonActive: { backgroundColor: '#3a1a1a', borderColor: '#ff4444' },
  scanButtonText: { color: '#00ff88', fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  errorBar: {
    backgroundColor: '#3a1a1a',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ff4444',
  },
  errorText: { color: '#ff4444', fontSize: 12 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#444', fontSize: 14 },

  list: { padding: 8 },
  separator: { height: 1, backgroundColor: '#1a1a1a' },

  row: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginVertical: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  deviceName: { color: '#e0e0e0', fontSize: 15, fontWeight: '600', flex: 1 },
  rssiContainer: {
    width: 60,
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  rssiBar: { height: '100%', borderRadius: 3 },
  rssiText: { fontSize: 12, fontWeight: '600', width: 56, textAlign: 'right' },

  rowMid: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  monospace: { color: '#888', fontSize: 11, fontFamily: 'monospace', flex: 1 },
  manufacturer: { color: '#6688aa', fontSize: 11, flex: 1, textAlign: 'right' },

  rowBottom: { flexDirection: 'row', gap: 12 },
  meta: { color: '#555', fontSize: 11 },

  services: {
    color: '#445566',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },

  footer: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  footerText: { color: '#444', fontSize: 11 },
});
