/**
 * Platform adapter — maps a react-native-ble-plx Device to a BLEObservation.
 *
 * Both iOS and Android go through this single adapter; Platform.OS controls
 * which fields are populated vs. left null.
 *
 * Field availability by platform:
 *
 *   Field                          iOS       Android   Notes
 *   platform_peripheral_identifier  ✓        ✓ (MAC)  iOS: CBPeripheral UUID; persistence is a research question
 *   bluetooth_address               ✗        ✓         iOS: not exposed by OS
 *   bluetooth_address_type          ✗        null      not exposed by ble-plx on either platform
 *   local_name                      ✓        ✓
 *   manufacturer_data_raw           ✓        ✓
 *   service_uuids                   ✓        ✓
 *   service_data_raw                ✓        ✓
 *   solicited_service_uuids         ✓        ✗
 *   overflow_service_uuids          ✓        ✗
 *   rssi                            ✓        ✓
 *   tx_power                        ✓        ✓
 *   is_connectable                  ✓        ✓
 *   advertising_sid                 ✗        null      not exposed by ble-plx Device API
 *   primary_phy                     ✗        null      not exposed by ble-plx Device API
 *   secondary_phy                   ✗        null      not exposed by ble-plx Device API
 *   periodic_advertising_interval   ✗        null      not exposed by ble-plx Device API
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
    //      Whether it persists across app reinstall, BT off/on, phone reboot, or
    //      peripheral reboot is an empirical research question this harness measures.
    //      Record it exactly as CoreBluetooth provides it.
    // Android: device.id IS the MAC address string (may be randomized by the OS).
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

    // NOT AVAILABLE in current adapter: advertising_sid, primary_phy, secondary_phy,
    // and periodic_advertising_interval are not exposed by the react-native-ble-plx
    // Device object. They are retained in the schema for future collection and are
    // stored as null by this adapter. Do not implement rawScanRecord parsing until
    // it can be done reliably and validated against ground-truth devices.
    advertising_sid: null,
    primary_phy: null,
    secondary_phy: null,
    periodic_advertising_interval: null,

    // ── Scan metadata ──────────────────────────────────────────────────────
    // Our app's receive time — when this scan callback fired in our JS process.
    // react-native-ble-plx does not provide an OS-level BLE scanner timestamp.
    scanner_timestamp: now.toISOString(),
    duplicate_filtering_state: duplicateFilteringState,
    scan_session_id: sessionId,
  };
}
