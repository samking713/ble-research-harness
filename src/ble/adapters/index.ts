/**
 * Platform adapter — maps a react-native-ble-plx Device to a BLEObservation.
 *
 * Both iOS and Android go through this single adapter; Platform.OS controls
 * which fields are populated vs. left null.
 *
 * Field availability by platform:
 *
 *   Field                          iOS       Android   Notes
 *   platform_peripheral_identifier  ✓ (rot)  ✓ (MAC)  iOS rotates per app/BT restart
 *   bluetooth_address               ✗        ✓         iOS never exposes MAC
 *   bluetooth_address_type          ✗        partial   ble-plx does not expose this
 *   local_name                      ✓        ✓
 *   manufacturer_data_raw           ✓        ✓
 *   service_uuids                   ✓        ✓
 *   service_data_raw                ✓        ✓
 *   solicited_service_uuids         ✓        ✗
 *   overflow_service_uuids          ✓        ✗
 *   rssi                            ✓        ✓
 *   tx_power                        ✓        ✓
 *   is_connectable                  ✓        ✓
 *   advertising_sid                 ✗        partial   raw scan record parsing needed
 *   primary_phy                     ✗        partial   raw scan record parsing needed
 *   secondary_phy                   ✗        partial   raw scan record parsing needed
 *   periodic_advertising_interval   ✗        partial   raw scan record parsing needed
 */
import { Platform } from 'react-native';
import { Device } from 'react-native-ble-plx';
import * as ExpoDevice from 'expo-device';
import Constants from 'expo-constants';
import {
  BLEObservation,
  generateId,
  base64ToBytes,
  bytesToHex,
  extractManufacturerId,
  normalizeName,
  parseServiceData,
} from '../schema';

const APP_START_TIME = Date.now() - performance.now();

export function mapDeviceToObservation(
  device: Device,
  sessionId: string,
  duplicateFilteringState: 'on' | 'off' | 'unknown',
): BLEObservation {
  const now = new Date();
  const rawManufacturerBytes = device.manufacturerData
    ? base64ToBytes(device.manufacturerData)
    : null;

  const isIOS = Platform.OS === 'ios';

  return {
    // ── Identity / platform ────────────────────────────────────────────────
    observation_id: generateId(),
    timestamp_utc: now.toISOString(),
    timestamp_monotonic: performance.now(),
    platform: Platform.OS as 'ios' | 'android',
    os_version: ExpoDevice.osVersion ?? 'unknown',
    app_version: Constants.expoConfig?.version ?? '0.1.0',
    phone_model: [ExpoDevice.manufacturer, ExpoDevice.modelName]
      .filter(Boolean)
      .join(' ') || 'unknown',

    // ── BLE identity ──────────────────────────────────────────────────────
    // iOS: device.id is a CBPeripheral UUID — NOT a hardware address.
    //      It rotates when the app is reinstalled or Bluetooth is toggled.
    // Android: device.id IS the MAC address string (may be randomized).
    platform_peripheral_identifier: device.id ?? null,
    bluetooth_address: isIOS ? null : (device.id ?? null),
    // UNCERTAIN: react-native-ble-plx does not expose address type directly.
    // Android rawScanRecord could be parsed to determine random vs. public.
    bluetooth_address_type: null,
    device_identifier_available: !!device.id,

    // ── Human-readable identity ────────────────────────────────────────────
    // device.localName is the GAP Local Name from the advertisement.
    // device.name may come from the OS cache (can be stale).
    // Prefer localName; fall back to name.
    local_name: device.localName ?? device.name ?? null,
    local_name_normalized: normalizeName(device.localName ?? device.name),
    local_name_length: (device.localName ?? device.name)?.length ?? null,

    // ── Manufacturer information ───────────────────────────────────────────
    manufacturer_id: rawManufacturerBytes
      ? extractManufacturerId(rawManufacturerBytes)
      : null,
    manufacturer_data_raw: rawManufacturerBytes,
    manufacturer_data_hex: rawManufacturerBytes
      ? bytesToHex(rawManufacturerBytes)
      : null,
    manufacturer_data_length: rawManufacturerBytes?.length ?? null,

    // ── Services ──────────────────────────────────────────────────────────
    service_uuids: device.serviceUUIDs ?? null,
    service_data_raw: parseServiceData(device.serviceData),
    solicited_service_uuids: isIOS ? (device.solicitedServiceUUIDs ?? null) : null,
    overflow_service_uuids: isIOS ? (device.overflowServiceUUIDs ?? null) : null,

    // ── Radio / advertisement ──────────────────────────────────────────────
    rssi: device.rssi ?? -127,
    tx_power: device.txPowerLevel ?? null,
    is_connectable: device.isConnectable ?? null,

    // UNCERTAIN: advertising_sid, primary_phy, secondary_phy, and
    // periodic_advertising_interval require parsing device.rawScanRecord
    // (Android-only field). These are not directly exposed by ble-plx.
    // Set to null for v0.1; future work: implement rawScanRecord parser.
    advertising_sid: null,
    primary_phy: null,
    secondary_phy: null,
    periodic_advertising_interval: null,

    // ── Scan metadata ──────────────────────────────────────────────────────
    scanner_timestamp: now.toISOString(),
    duplicate_filtering_state: duplicateFilteringState,
    scan_session_id: sessionId,
  };
}
