/**
 * BLE scanner module.
 *
 * Wraps react-native-ble-plx BleManager. Manages scan sessions.
 * Calls back with a normalized BLEObservation for each scan result delivered
 * by the OS/library. Duplicate results are enabled where supported so that
 * each delivery to the application is recorded — we are not claiming that
 * every RF advertisement transmitted by a peripheral reaches the callback.
 *
 * Usage:
 *   const scanner = BLEScanner.getInstance();
 *   await scanner.start(sessionId, onObservation);
 *   await scanner.stop();
 */
import { BleManager, Device, ScanMode, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { BLEObservation } from './schema';
import { mapDeviceToObservation } from './adapters';

export type ObservationCallback = (obs: BLEObservation) => void;

export class BLEScanner {
  private static instance: BLEScanner | null = null;
  private manager: BleManager;
  private scanning = false;
  private sessionId: string | null = null;

  private constructor() {
    this.manager = new BleManager();
  }

  static getInstance(): BLEScanner {
    if (!BLEScanner.instance) {
      BLEScanner.instance = new BLEScanner();
    }
    return BLEScanner.instance;
  }

  get isScanning(): boolean {
    return this.scanning;
  }

  async checkAndRequestPermissions(): Promise<{ granted: boolean; reason?: string }> {
    if (Platform.OS === 'ios') {
      // iOS permissions are declared in Info.plist and prompted automatically
      // by CoreBluetooth when scanning starts.
      return { granted: true };
    }

    // Android
    const apiLevel = typeof Platform.Version === 'string'
      ? parseInt(Platform.Version, 10)
      : Platform.Version;

    try {
      if (apiLevel >= 31) {
        // Android 12+ (API 31): BLUETOOTH_SCAN + BLUETOOTH_CONNECT + LOCATION
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        const allGranted = Object.values(results).every(
          r => r === PermissionsAndroid.RESULTS.GRANTED,
        );
        return {
          granted: allGranted,
          reason: allGranted ? undefined : 'Bluetooth and location permissions required',
        };
      } else {
        // Android < 12: only fine location needed for BLE scanning
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'BLE scanning requires location permission on Android.',
            buttonPositive: 'Grant',
          },
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        return { granted, reason: granted ? undefined : 'Location permission required for BLE' };
      }
    } catch (e) {
      return { granted: false, reason: String(e) };
    }
  }

  async waitForBluetooth(timeoutMs = 5000): Promise<State> {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(State.Unknown), timeoutMs);
      const sub = this.manager.onStateChange(state => {
        if (
          state === State.PoweredOn ||
          state === State.PoweredOff ||
          state === State.Unsupported
        ) {
          clearTimeout(timer);
          sub.remove();
          resolve(state);
        }
      }, true);
    });
  }

  async start(
    sessionId: string,
    onObservation: ObservationCallback,
    onError?: (error: Error) => void,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (this.scanning) return { ok: false, reason: 'Already scanning' };

    const perms = await this.checkAndRequestPermissions();
    if (!perms.granted) return { ok: false, reason: perms.reason };

    const btState = await this.waitForBluetooth();
    if (btState !== State.PoweredOn) {
      return { ok: false, reason: `Bluetooth not powered on (state: ${btState})` };
    }

    this.sessionId = sessionId;
    this.scanning = true;

    // allowDuplicates:true — request that the OS/library deliver each scan result
    // rather than coalescing duplicates per device. Essential for RSSI tracking
    // and advertising-interval measurement.
    // iOS: maps to CBCentralManagerScanOptionAllowDuplicatesKey = true.
    // Android: ScanMode.LowLatency requests the fastest delivery rate from the stack.
    this.manager.startDeviceScan(
      null, // scan all service UUIDs
      {
        allowDuplicates: true,
        scanMode: Platform.OS === 'android' ? ScanMode.LowLatency : undefined,
      },
      (error, device) => {
        if (error) {
          console.error('[BLEScanner] scan error:', error);
          this.scanning = false;
          onError?.(error);
          return;
        }
        if (!device) return;

        const obs = mapDeviceToObservation(
          device,
          sessionId,
          // iOS CBCentralManagerScanOptionAllowDuplicatesKey = true means filtering OFF
          'off',
        );
        onObservation(obs);
      },
    );

    return { ok: true };
  }

  stop(): void {
    if (!this.scanning) return;
    this.manager.stopDeviceScan();
    this.scanning = false;
    this.sessionId = null;
  }

  destroy(): void {
    this.stop();
    this.manager.destroy();
    BLEScanner.instance = null;
  }
}
