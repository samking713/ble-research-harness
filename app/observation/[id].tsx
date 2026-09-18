/**
 * Screen 2 — Raw Observation
 *
 * Displays every available field of a single BLE observation.
 * Fields are grouped by category matching the spec §3.
 *
 * This screen is the primary tool for verifying what the OS actually exposes.
 * null values are shown explicitly — never hidden.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { BLEObservation, companyName } from '../../src/ble/schema';

// ── Field Availability Tags ────────────────────────────────────────────────

type Tag = 'ios-only' | 'android-only' | 'uncertain' | 'os-sanitized';

const FIELD_TAGS: Partial<Record<keyof BLEObservation, Tag[]>> = {
  bluetooth_address:              ['os-sanitized'],      // null on iOS
  solicited_service_uuids:        ['ios-only'],
  overflow_service_uuids:         ['ios-only'],
  advertising_sid:                ['android-only', 'uncertain'],
  primary_phy:                    ['android-only', 'uncertain'],
  secondary_phy:                  ['android-only', 'uncertain'],
  periodic_advertising_interval:  ['android-only', 'uncertain'],
};

const TAG_COLORS: Record<Tag, string> = {
  'ios-only':     '#aaddff',
  'android-only': '#aaffcc',
  'uncertain':    '#ffdd88',
  'os-sanitized': '#ffaaaa',
};

// ── Components ─────────────────────────────────────────────────────────────

const FieldRow = ({
  label,
  value,
  fieldKey,
}: {
  label: string;
  value: unknown;
  fieldKey?: keyof BLEObservation;
}) => {
  const isNull = value === null || value === undefined;
  const tags = fieldKey ? (FIELD_TAGS[fieldKey] ?? []) : [];

  let display: string;
  if (isNull) display = 'null';
  else if (Array.isArray(value)) display = JSON.stringify(value, null, 0);
  else if (typeof value === 'object') display = JSON.stringify(value, null, 2);
  else display = String(value);

  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {tags.map(t => (
          <Text key={t} style={[styles.tag, { color: TAG_COLORS[t], borderColor: TAG_COLORS[t] }]}>
            {t}
          </Text>
        ))}
      </View>
      <Text
        style={[styles.fieldValue, isNull && styles.fieldNull]}
        selectable
      >
        {display}
      </Text>
    </View>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ObservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getObservationById } = useApp();
  const [obs, setObs] = useState<BLEObservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getObservationById(id).then(o => {
      setObs(o);
      setLoading(false);
    });
  }, [id, getObservationById]);

  const shareRaw = () => {
    if (!obs) return;
    Share.share({ message: JSON.stringify(obs, null, 2) });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00ff88" />
      </View>
    );
  }

  if (!obs) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Observation not found</Text>
      </View>
    );
  }

  const mfrDesc = obs.manufacturer_id !== null
    ? `${obs.manufacturer_id} (0x${obs.manufacturer_id.toString(16).toUpperCase().padStart(4, '0')})${companyName(obs.manufacturer_id) ? ` — ${companyName(obs.manufacturer_id)}` : ''}`
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <TouchableOpacity style={styles.shareButton} onPress={shareRaw}>
        <Text style={styles.shareButtonText}>Share Raw JSON</Text>
      </TouchableOpacity>

      <Section title="Identity / Platform">
        <FieldRow label="observation_id"     value={obs.observation_id} />
        <FieldRow label="timestamp_utc"      value={obs.timestamp_utc} />
        <FieldRow label="timestamp_monotonic" value={`${obs.timestamp_monotonic.toFixed(1)} ms`} />
        <FieldRow label="platform"           value={obs.platform} />
        <FieldRow label="os_version"         value={obs.os_version} />
        <FieldRow label="app_version"        value={obs.app_version} />
        <FieldRow label="phone_model"        value={obs.phone_model} />
      </Section>

      <Section title="BLE Identity">
        <FieldRow
          label="platform_peripheral_identifier"
          value={obs.platform_peripheral_identifier}
          fieldKey="platform_peripheral_identifier"
        />
        <FieldRow
          label="bluetooth_address"
          value={obs.bluetooth_address}
          fieldKey="bluetooth_address"
        />
        <FieldRow
          label="bluetooth_address_type"
          value={obs.bluetooth_address_type}
          fieldKey="bluetooth_address_type"
        />
        <FieldRow label="device_identifier_available" value={obs.device_identifier_available} />
      </Section>

      <Section title="Human-Readable Identity">
        <FieldRow label="local_name"            value={obs.local_name} />
        <FieldRow label="local_name_normalized" value={obs.local_name_normalized} />
        <FieldRow label="local_name_length"     value={obs.local_name_length} />
      </Section>

      <Section title="Manufacturer Information">
        <FieldRow label="manufacturer_id"          value={mfrDesc} fieldKey="manufacturer_id" />
        <FieldRow label="manufacturer_data_raw"    value={obs.manufacturer_data_raw} fieldKey="manufacturer_data_raw" />
        <FieldRow label="manufacturer_data_hex"    value={obs.manufacturer_data_hex} fieldKey="manufacturer_data_hex" />
        <FieldRow label="manufacturer_data_length" value={obs.manufacturer_data_length} />
      </Section>

      <Section title="Services">
        <FieldRow label="service_uuids"             value={obs.service_uuids} />
        <FieldRow label="service_data_raw"          value={obs.service_data_raw} />
        <FieldRow
          label="solicited_service_uuids"
          value={obs.solicited_service_uuids}
          fieldKey="solicited_service_uuids"
        />
        <FieldRow
          label="overflow_service_uuids"
          value={obs.overflow_service_uuids}
          fieldKey="overflow_service_uuids"
        />
      </Section>

      <Section title="Radio / Advertisement">
        <FieldRow label="rssi"          value={`${obs.rssi} dBm`} />
        <FieldRow label="tx_power"      value={obs.tx_power !== null ? `${obs.tx_power} dBm` : null} />
        <FieldRow label="is_connectable" value={obs.is_connectable} />
        <FieldRow
          label="advertising_sid"
          value={obs.advertising_sid}
          fieldKey="advertising_sid"
        />
        <FieldRow
          label="primary_phy"
          value={obs.primary_phy}
          fieldKey="primary_phy"
        />
        <FieldRow
          label="secondary_phy"
          value={obs.secondary_phy}
          fieldKey="secondary_phy"
        />
        <FieldRow
          label="periodic_advertising_interval"
          value={obs.periodic_advertising_interval}
          fieldKey="periodic_advertising_interval"
        />
      </Section>

      <Section title="Scan Metadata">
        <FieldRow label="scanner_timestamp"           value={obs.scanner_timestamp} />
        <FieldRow label="duplicate_filtering_state"   value={obs.duplicate_filtering_state} />
        <FieldRow label="scan_session_id"             value={obs.scan_session_id} />
      </Section>

    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 60 },
  center: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#ff4444', fontSize: 14 },

  shareButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#1a1a2a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334',
    marginBottom: 16,
  },
  shareButtonText: { color: '#88aacc', fontSize: 12, fontWeight: '600' },

  section: { marginBottom: 28 },
  sectionTitle: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 6,
  },

  fieldRow: { marginBottom: 10 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  fieldLabel: { color: '#668899', fontSize: 11, fontFamily: 'monospace' },
  tag: {
    fontSize: 9,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  fieldValue: {
    color: '#ccddee',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  fieldNull: { color: '#3a3a4a' },
});
