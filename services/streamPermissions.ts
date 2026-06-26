import { Camera } from 'expo-camera';
import { Linking, Platform } from 'react-native';

export type StreamPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

export async function getStreamPermissionState(): Promise<StreamPermissionState> {
  if (Platform.OS !== 'android') return 'granted';

  const [cam, mic] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Camera.getMicrophonePermissionsAsync(),
  ]);

  if (cam.granted && mic.granted) return 'granted';
  if (!cam.canAskAgain && !mic.canAskAgain) return 'blocked';
  if (cam.status === 'undetermined' || mic.status === 'undetermined') return 'unknown';
  return 'denied';
}

export async function requestStreamPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const cam = await Camera.requestCameraPermissionsAsync();
  if (!cam.granted) return false;

  const mic = await Camera.requestMicrophonePermissionsAsync();
  return mic.granted;
}

export function openAppSettings(): void {
  Linking.openSettings().catch(() => {});
}
