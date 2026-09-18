# BLE Research Harness

**Technical Research Prototype — v0.1**

A scientific instrument for recording and analyzing Bluetooth Low Energy (BLE) scan observations on iOS and Android. Built to answer:

1. Which BLE attributes remain stable over time?
2. Which attributes change when privacy/address randomization occurs?
3. Can multiple observations be probabilistically associated with the same physical device?
4. Can a device be distinguished from another device of the same model?
5. Can BLE observations combined with location/motion data identify persistent proximity patterns?

> **v0.1 scope**: Phases 1–4 only — BLE scanner, raw observation database, live dashboard, and export. No inference, no ML, no stalking detection.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo (TypeScript) |
| BLE | react-native-ble-plx |
| Database | expo-sqlite (SQLite) |
| Navigation | @react-navigation/native |
| Export | expo-file-system + expo-sharing |
| Build | EAS Build |

---

## Phases

| Phase | Status | Description |
|---|---|---|
| 1 | IMPLEMENTED | BLE scanner (react-native-ble-plx, allowDuplicates, permissions) |
| 2 | IMPLEMENTED | Raw observation database (SQLite WAL, all schema fields, batch insert) |
| 3 | IMPLEMENTED | Live dashboard: Scanner, Raw Observation detail, Experiment + ground-truth labeling, Export |
| 4 | IMPLEMENTED | Export: JSONL / JSON / CSV + system share sheet |
| 5 | Planned | Fingerprint analysis (per-byte stability, entropy, service signatures) |
| 6 | Planned | Track association (deterministic weighted scoring) |
| 7 | Planned | Location/motion layer |
| 8 | Planned | Spatial correlation |
| 9 | Planned | Consumer inference prototype |

---

## Setup

### Prerequisites
- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- For iOS: Xcode 15+, Apple Developer account
- For Android: Android Studio, SDK 26+

### Install
```bash
npm install
```

### Run (development build required — not Expo Go)
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Build via EAS
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

---

## Architecture

```
BLE Radio
  ↓ OS BLE Scan API
  ↓ Raw Observation         ← immutable, never modified
  ↓ Normalized Observation  ← common schema across platforms
  ↓ Feature Extraction      ← Phase 6+
  ↓ Fingerprint Candidate   ← Phase 6+
  ↓ Track Association       ← Phase 7+
  ↓ Ground-Truth Comparison ← Phase 5+
  ↓ Research Metrics        ← Phase 7+
```

---

## Privacy & Ethics

This application uses **only information legitimately exposed** through each platform's public APIs.

It does **not**:
- Defeat BLE privacy mechanisms
- Extract private keys or identity-resolving keys
- Bypass OS restrictions
- Deanonymize individuals
- Identify device owners

The research objective is to determine what legitimate observable signals are sufficient for probabilistic device-instance tracking in a controlled research setting.

---

## Experiment Plan

Ground-truth experiment labeling is implemented in Phase 3 (Experiment screen). The controlled experiments below run once the raw capture system is validated:



1. Stationary — baseline fingerprint stability
2. Walk toward/away — RSSI trajectory
3. Same vehicle — continuous tracking while moving
4. Vehicle separation — spatial/motion correlation
5. Stationary false positive — repeated encounters
6. Identical devices — device-instance discrimination
7. Address change — cross-rotation correlation
8. Restart conditions — identifier persistence

---

## License

Research prototype. See individual platform API terms (Apple, Google) for BLE scanning policy.
