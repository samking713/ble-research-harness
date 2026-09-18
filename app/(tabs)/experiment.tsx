/**
 * Screen 4 — Experiment & Ground Truth
 *
 * Create an experiment, define ground-truth devices present during the session.
 * Ground truth is the reference against which fingerprint algorithms are validated.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { GroundTruthDevice } from '../../src/types';

// ── Ground Truth Device Row ────────────────────────────────────────────────

const DeviceRow = ({
  device,
  onRemove,
}: {
  device: GroundTruthDevice;
  onRemove: (id: string) => void;
}) => (
  <View style={styles.gtRow}>
    <View style={styles.gtInfo}>
      <Text style={styles.gtLabel}>{device.label}</Text>
      {device.device_model ? (
        <Text style={styles.gtMeta}>{device.device_model}</Text>
      ) : null}
      {device.physical_description ? (
        <Text style={styles.gtMeta}>{device.physical_description}</Text>
      ) : null}
    </View>
    <TouchableOpacity
      onPress={() =>
        Alert.alert('Remove', `Remove "${device.label}"?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => onRemove(device.id) },
        ])
      }
    >
      <Text style={styles.removeBtn}>✕</Text>
    </TouchableOpacity>
  </View>
);

// ── Add Device Form ────────────────────────────────────────────────────────

const AddDeviceForm = ({ onAdd }: { onAdd: (data: any) => void }) => {
  const [label, setLabel] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');

  const submit = () => {
    if (!label.trim()) return;
    onAdd({
      label: label.trim(),
      device_model: model.trim() || null,
      physical_description: description.trim() || null,
      owner: null,
      notes: null,
    });
    setLabel('');
    setModel('');
    setDescription('');
  };

  return (
    <View style={styles.addForm}>
      <Text style={styles.addFormTitle}>Add Ground Truth Device</Text>
      <TextInput
        style={styles.input}
        placeholder="Label (e.g. GT-001 Research iPhone)"
        placeholderTextColor="#444"
        value={label}
        onChangeText={setLabel}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Device model (e.g. iPhone 17)"
        placeholderTextColor="#444"
        value={model}
        onChangeText={setModel}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Physical description (optional)"
        placeholderTextColor="#444"
        value={description}
        onChangeText={setDescription}
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={[styles.btn, !label.trim() && styles.btnDisabled]}
        onPress={submit}
        disabled={!label.trim()}
      >
        <Text style={styles.btnText}>+ ADD DEVICE</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ExperimentScreen() {
  const {
    currentExperiment,
    groundTruthDevices,
    createNewExperiment,
    closeExperiment,
    addGroundTruthDevice,
    removeGroundTruthDevice,
  } = useApp();

  const [name, setName] = useState('');
  const [scenario, setScenario] = useState('');
  const [notes, setNotes] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createNewExperiment({
      name: name.trim(),
      scenario: scenario.trim() || null,
      notes: notes.trim() || null,
      gps_enabled: false,
      motion_state: null,
    });
    setName('');
    setScenario('');
    setNotes('');
  };

  const handleClose = () => {
    Alert.alert('End Experiment', 'Mark this experiment as ended?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', onPress: () => closeExperiment() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Active experiment */}
        {currentExperiment ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Experiment</Text>
              <View style={[styles.dot, { backgroundColor: currentExperiment.ended_at ? '#555' : '#00ff88' }]} />
            </View>

            <View style={styles.expCard}>
              <Text style={styles.expName}>{currentExperiment.name}</Text>
              {currentExperiment.scenario ? (
                <Text style={styles.expMeta}>Scenario: {currentExperiment.scenario}</Text>
              ) : null}
              {currentExperiment.notes ? (
                <Text style={styles.expMeta}>{currentExperiment.notes}</Text>
              ) : null}
              <Text style={styles.expMeta}>
                Started: {new Date(currentExperiment.started_at!).toLocaleString()}
              </Text>
              {currentExperiment.ended_at ? (
                <Text style={styles.expMeta}>
                  Ended: {new Date(currentExperiment.ended_at).toLocaleString()}
                </Text>
              ) : (
                <TouchableOpacity style={[styles.btn, styles.btnDestructive]} onPress={handleClose}>
                  <Text style={styles.btnText}>END EXPERIMENT</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Ground truth devices */}
            <Text style={styles.subsectionTitle}>
              Ground Truth Devices ({groundTruthDevices.length})
            </Text>
            <Text style={styles.hint}>
              List every physical device actually present during this experiment.
              The algorithm must not be trained using its own conclusions.
            </Text>

            {groundTruthDevices.map(d => (
              <DeviceRow key={d.id} device={d} onRemove={removeGroundTruthDevice} />
            ))}

            {!currentExperiment.ended_at && (
              <AddDeviceForm onAdd={addGroundTruthDevice} />
            )}
          </View>
        ) : (
          // New experiment form
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New Experiment</Text>
            <Text style={styles.hint}>
              Create an experiment before scanning to associate ground-truth
              labels with observations.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Experiment name (e.g. Stationary Baseline)"
              placeholderTextColor="#444"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Scenario (optional)"
              placeholderTextColor="#444"
              value={scenario}
              onChangeText={setScenario}
              autoCapitalize="sentences"
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Notes (optional)"
              placeholderTextColor="#444"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              autoCapitalize="sentences"
            />
            <TouchableOpacity
              style={[styles.btn, !name.trim() && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={styles.btnText}>CREATE EXPERIMENT</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reference scenarios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experiment Templates</Text>
          {SCENARIOS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={styles.scenarioRow}
              onPress={() => {
                setName(s.name);
                setScenario(s.id);
                setNotes(s.objective);
              }}
            >
              <Text style={styles.scenarioName}>{s.name}</Text>
              <Text style={styles.scenarioDesc}>{s.objective}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const SCENARIOS = [
  { id: 'stationary', name: 'Stationary', objective: 'Determine baseline fingerprint stability.' },
  { id: 'walk', name: 'Walk Toward / Away', objective: 'Study RSSI trajectory and advertisement behavior.' },
  { id: 'same_vehicle', name: 'Same Vehicle', objective: 'Continuous tracking while moving together.' },
  { id: 'separation', name: 'Vehicle Separation', objective: 'Measure whether spatial correlation separates tracks.' },
  { id: 'false_positive', name: 'Stationary False Positive', objective: 'Repeated encounters — false persistent-device associations.' },
  { id: 'identical', name: 'Identical Devices', objective: 'Measure device-instance discrimination.' },
  { id: 'address_change', name: 'Address Change', objective: 'Determine which fields remain correlated across rotation.' },
  { id: 'restart', name: 'Restart Conditions', objective: 'Persistence of identifiers across BT/app/phone restart.' },
];

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { padding: 16, paddingBottom: 80 },

  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  subsectionTitle: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hint: { color: '#444', fontSize: 12, marginBottom: 16, lineHeight: 18 },

  expCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 16,
    gap: 6,
  },
  expName: { color: '#e0e0e0', fontSize: 17, fontWeight: '600' },
  expMeta: { color: '#666', fontSize: 13 },

  gtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  gtInfo: { flex: 1 },
  gtLabel: { color: '#00ff88', fontSize: 14, fontWeight: '600' },
  gtMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  removeBtn: { color: '#555', fontSize: 18, paddingHorizontal: 8 },

  addForm: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
    gap: 10,
  },
  addFormTitle: { color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },

  input: {
    backgroundColor: '#1a1a1a',
    color: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },

  btn: {
    backgroundColor: '#1a3a2a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.3 },
  btnDestructive: { backgroundColor: '#3a1a1a', borderColor: '#ff4444', marginTop: 12 },
  btnText: { color: '#00ff88', fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  scenarioRow: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  scenarioName: { color: '#88aacc', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  scenarioDesc: { color: '#555', fontSize: 12 },
});
