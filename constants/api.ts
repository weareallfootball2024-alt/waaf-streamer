const DEFAULT_API = 'https://xn--90abjzbpsjij7e.xn--p1ai';

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export const API_URL = trimSlash(process.env.EXPO_PUBLIC_API_URL || DEFAULT_API);

/** Полный RTMP URL до сегмента live/ (для WAAF ingest, если понадобится). */
export function getRtmpLiveUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_RTMP_LIVE_URL;
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`;
  }
  try {
    const { hostname } = new URL(API_URL);
    const port = process.env.EXPO_PUBLIC_RTMP_PORT || '49230';
    return `rtmp://${hostname}:${port}/live/`;
  } catch {
    return 'rtmp://xn--90abjzbpsjij7e.xn--p1ai:49230/live/';
  }
}
