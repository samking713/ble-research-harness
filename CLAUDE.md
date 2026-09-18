# BLE Research Harness — Claude Code Instructions

## Project Overview
A scientific instrument for recording and analyzing Bluetooth Low Energy (BLE) scan observations on iOS and Android. The goal is to determine which BLE attributes remain stable, which change with address randomization, and whether observations can be probabilistically associated with the same physical device.

**This is a research tool, not a consumer app. Optimize for data completeness, reproducibility, and export — not visual polish.**

## Tech Stack
- **Framework**: React Native + Expo (TypeScript), SDK 52+
- **BLE**: `react-native-ble-plx` (requires bare workflow or dev build — NOT Expo Go)
- **Database**: `expo-sqlite` with SQLite
- **Navigation**: Expo Router v4 (file-based, wraps React Navigation)
- **Export**: `expo-file-system` + `expo-sharing`
- **Location (Phase 8)**: `expo-location`
- **Build**: EAS Build for iOS/Android dev clients

## Critical Principles (from spec)
1. **Raw observations are immutable** — never overwrite original BLE data when deriving features.
2. **Record `null` explicitly** — when the OS does not expose a field, store `null`, not omit it.
3. **Do not invent fields** — only record what the platform API actually exposes.
4. **Flag uncertainty in code** — if a field's semantics are unclear, add a `// UNCERTAIN:` comment.
5. **Platform adapters normalize** — iOS and Android produce different raw data; normalize into a common schema but preserve platform-specific fields.
6. **No stalking/following inference in v0.1** — collect evidence, do not draw proximity conclusions.
7. **No ML models** — deterministic weighted scoring only (Phase 7+).
8. **Only public platform APIs** — no attempts to defeat privacy mechanisms or extract keys.

## Build Phases
- **Phase 1** ✅ IMPLEMENTED: BLE scanner (react-native-ble-plx, allowDuplicates, permissions)
- **Phase 2** ✅ IMPLEMENTED: Raw observation database (SQLite WAL, full schema, batch insert)
- **Phase 3** ✅ IMPLEMENTED: Live dashboard — Scanner, Raw Observation detail, Experiment + ground-truth labeling, Export
- **Phase 4** ✅ IMPLEMENTED: Export (JSONL / JSON / CSV + share sheet)
- Phase 5: Fingerprint analysis (NOT YET)
- Phase 6: Track association / deterministic scoring (NOT YET)
- Phase 7: Location/motion layer (NOT YET)
- Phase 8: Spatial correlation (NOT YET)
- Phase 9: Consumer inference prototype (NOT YET)

## Project Structure (actual)
```
ble-research-harness/
├── app/
│   ├── _layout.tsx             # Root Stack + AppProvider
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab navigator (Scanner / Experiment / Export)
│   │   ├── index.tsx           # Screen 1: Live Scanner
│   │   ├── experiment.tsx      # Screen 3: Experiment + Ground Truth labeling
│   │   └── export.tsx          # Screen 4: Session list + export
│   └── observation/
│       └── [id].tsx            # Screen 2: Raw Observation detail (all fields)
├── src/
│   ├── ble/
│   │   ├── schema.ts           # BLEObservation interface + helpers
│   │   ├── adapters/
│   │   │   └── index.ts        # Single adapter for iOS + Android (Platform.OS branch)
│   │   └── scanner.ts          # BLEScanner singleton (permissions, BT state, scan loop)
│   ├── db/
│   │   ├── database.ts         # SQLite init + all table/index creation
│   │   ├── observations.ts     # insert (single + batch), query
│   │   ├── sessions.ts         # session CRUD
│   │   └── experiments.ts      # experiment + ground-truth device CRUD
│   ├── export/
│   │   └── index.ts            # JSONL / JSON / CSV + share sheet
│   ├── context/
│   │   └── AppContext.tsx      # App state, BLE lifecycle, 500ms batch inserts
│   └── types/
│       └── index.ts            # ScanSession, Experiment, GroundTruthDevice, DeviceEntry
├── CLAUDE.md
├── README.md
├── app.json
├── package.json
├── babel.config.js
└── tsconfig.json
```

## BLEObservation Schema (TypeScript)
All fields from §3 of the spec. Use `null` for unavailable fields.

```typescript
interface BLEObservation {
  // Identity / platform
  observation_id: string;           // UUID v4
  timestamp_utc: string;            // ISO 8601
  timestamp_monotonic: number;      // ms since app start
  platform: 'ios' | 'android';
  os_version: string;
  app_version: string;
  phone_model: string;

  // BLE identity
  platform_peripheral_identifier: string | null;  // iOS: CBPeripheral.identifier; Android: address
  bluetooth_address: string | null;               // iOS: NOT AVAILABLE (OS-sanitized); Android: MAC
  bluetooth_address_type: string | null;          // 'public' | 'random' | null
  device_identifier_available: boolean;           // whether a stable identifier was available

  // Human-readable identity
  local_name: string | null;
  local_name_normalized: string | null;           // trimmed, lowercased
  local_name_length: number | null;

  // Manufacturer information
  manufacturer_id: number | null;                 // 16-bit company ID
  manufacturer_data_raw: number[] | null;         // full byte array including company ID bytes
  manufacturer_data_hex: string | null;           // hex string of raw bytes
  manufacturer_data_length: number | null;

  // Services
  service_uuids: string[] | null;
  service_data_raw: Record<string, number[]> | null;  // uuid -> bytes
  solicited_service_uuids: string[] | null;           // iOS only
  overflow_service_uuids: string[] | null;            // iOS only

  // Radio / advertisement
  rssi: number;                                   // always present
  tx_power: number | null;
  is_connectable: boolean | null;
  advertising_sid: number | null;                 // Android 8+ only
  primary_phy: string | null;                     // Android only
  secondary_phy: string | null;                   // Android only
  periodic_advertising_interval: number | null;   // Android only

  // Scan metadata
  scanner_timestamp: string;                      // our app's receive time (NOT an OS timestamp — ble-plx doesn't expose one)
  duplicate_filtering_state: 'on' | 'off' | 'unknown';
  scan_session_id: string;
}
```

## SQLite Tables (implemented)
```sql
scan_sessions, ble_observations, experiments, ground_truth_devices, experiment_labels
```
Index on: `timestamp_utc`, `scan_session_id`, `platform_peripheral_identifier`,
`bluetooth_address`, `manufacturer_id`, `experiment_id`.

Tables for Phase 5+ (not yet created): `fingerprint_features`, `device_tracks`,
`track_observations`, `location_observations`, `motion_observations`.

## Key Platform Notes
- **iOS**: `CBPeripheral.identifier` is a UUID recorded exactly as CoreBluetooth provides it. Its persistence across app reinstall, BT off/on, phone reboot, and peripheral reboot is an **empirical research question** — do not assume stable or unstable. `bluetooth_address` is NOT exposed by iOS. `solicited_service_uuids` and `overflow_service_uuids` are iOS-specific.
- **Android**: MAC address IS available (though may be randomized). `advertising_sid`, `primary_phy`, `secondary_phy`, `periodic_advertising_interval` are Android-only (API 26+).
- **Background scanning**: iOS CoreBluetooth background mode requires `bluetooth-central` UIBackgroundMode. iOS 26 changed some background CBPeripheral behavior — document what actually works.
- **react-native-ble-plx**: Use `BleManager.startDeviceScan()`. Map its `Device` object to `BLEObservation` in the platform adapter.

## Export Format
- **JSONL**: one observation per line, one file per session (`session_<id>.jsonl`)
- **CSV**: flattened observation fields, one row per observation
- **JSON**: complete session object with all observations in array

## What NOT to Build (v0.1)
- Track association / fingerprint scoring (Phase 7)
- Location/motion correlation (Phase 8-9)
- Consumer inference / "is this person following me" (Phase 10)
- ML models
- Any attempt to defeat BLE privacy / extract IRK

## Commands
```bash
npx expo start              # start dev server
npx expo run:ios            # build + run on iOS simulator/device
npx expo run:android        # build + run on Android
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

## Definition of Done for Phase 1-4
The researcher can:
1. Start a scan session
2. See nearby BLE observations in real time
3. Tap any observation and inspect every available field
4. Observations are stored locally in SQLite
5. Label ground-truth devices
6. Export the complete dataset as JSONL/CSV/JSON
