/**
 * Screen 3 — Export
 *
 * Lists all scan sessions. Allows exporting each session as JSONL, JSON, or CSV.
 * JSONL is preferred for large datasets (one observation per line).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { ScanSession } from '../../src/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function sessionDuration(session: ScanSession): string {
  if (!session.ended_at) return 'ongoing';
  const sec = (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000;
  if (sec < 60) return `${sec.toFixed(0)}s`;
  return `${(sec / 60).toFixed(1)}m`;
}

// ── Session Row ────────────────────────────────────────────────────────────

const SessionRow = ({
  session,
  onExport,
  exporting,
}: {
  session: ScanSession;
  onExport: (id: string, format: 'jsonl' | 'json' | 'csv') => void;
  exporting: string | null;
}) => {
  const isExporting = exporting === session.id;

  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionId}>{session.id.slice(0, 16)}…</Text>
        {!session.ended_at && <Text style={styles.onlinePill}>LIVE</Text>}
      </View>

      <View style={styles.sessionMeta}>
        <Text style={styles.metaText}>{formatDate(session.started_at)}</Text>
        <Text style={styles.metaText}>{sessionDuration(session)}</Text>
        <Text style={styles.metaText}>{session.obs_count ?? 0} obs</Text>
        <Text style={styles.metaText}>{session.platform}</Text>
      </View>

      {isExporting ? (
        <ActivityIndicator color="#00ff88" style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.exportButtons}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => onExport(session.id, 'jsonl')}
          >
            <Text style={styles.exportBtnText}>JSONL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => onExport(session.id, 'json')}
          >
            <Text style={styles.exportBtnText}>JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => onExport(session.id, 'csv')}
          >
            <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ExportScreen() {
  const { getAllSessions, exportSession, isDbReady } = useApp();
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!isDbReady) return;
    const s = await getAllSessions();
    setSessions(s);
    setLoading(false);
  }, [isDbReady, getAllSessions]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleExport = useCallback(
    async (sessionId: string, format: 'jsonl' | 'json' | 'csv') => {
      setExporting(sessionId);
      try {
        await exportSession(sessionId, format);
      } catch (e: any) {
        Alert.alert('Export Failed', e.message ?? String(e));
      } finally {
        setExporting(null);
      }
    },
    [exportSession],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00ff88" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          JSONL recommended for large datasets — one observation per line.
          Files are saved to app Documents and shared via the system share sheet.
        </Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No sessions yet. Start scanning to collect data.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={s => s.id}
          renderItem={({ item }) => (
            <SessionRow
              session={item}
              onExport={handleExport}
              exporting={exporting}
            />
          )}
          contentContainerStyle={styles.list}
          onRefresh={loadSessions}
          refreshing={loading}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#444', fontSize: 14 },

  infoBar: {
    backgroundColor: '#111',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  infoText: { color: '#555', fontSize: 12, lineHeight: 18 },

  list: { padding: 12 },

  sessionCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sessionId: { color: '#888', fontSize: 12, fontFamily: 'monospace', flex: 1 },
  onlinePill: {
    backgroundColor: '#1a3a2a',
    color: '#00ff88',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sessionMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metaText: { color: '#555', fontSize: 12 },

  exportButtons: { flexDirection: 'row', gap: 8 },
  exportBtn: {
    flex: 1,
    backgroundColor: '#1a1a2a',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334',
  },
  exportBtnText: { color: '#88aacc', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
