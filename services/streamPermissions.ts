import { Linking, PermissionsAndroid, Platform } from 'react-native';

export type StreamPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

async function androidPermissionsGranted(): Promise<boolean> {
  const cam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
  const mic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return cam && mic;
}

export async function getStreamPermissionState(): Promise<StreamPermissionState> {
  if (Platform.OS !== 'android') return 'granted';
  if (await androidPermissionsGranted()) return 'granted';
  return 'unknown';
}

export async function requestStreamPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (await androidPermissionsGranted()) return true;

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);

  return (
    granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
    granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}
