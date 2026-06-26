import * as SecureStore from 'expo-secure-store';

const PLAYLIST_SESSION_KEY = 'waaf_playlist_rtmp_session';

/** RTMP для режима «плейлист / отдельная трансляция» — на текущий эфир. */
let playlistRtmpUrl = '';
let playlistStreamKey = '';

export function setPlaylistSessionRtmp(rtmpUrl: string, streamKey: string): void {
  playlistRtmpUrl = rtmpUrl.trim();
  playlistStreamKey = streamKey.trim();
  if (playlistRtmpUrl && playlistStreamKey) {
    SecureStore.setItemAsync(
      PLAYLIST_SESSION_KEY,
      JSON.stringify({ rtmpUrl: playlistRtmpUrl, streamKey: playlistStreamKey }),
    ).catch(() => {});
  } else {
    SecureStore.deleteItemAsync(PLAYLIST_SESSION_KEY).catch(() => {});
  }
}

export function getPlaylistSessionRtmp(): { rtmpUrl: string; streamKey: string } | null {
  if (!playlistRtmpUrl || !playlistStreamKey) return null;
  const url = playlistRtmpUrl.endsWith('/') ? playlistRtmpUrl : `${playlistRtmpUrl}/`;
  return { rtmpUrl: url, streamKey: playlistStreamKey };
}

export function clearPlaylistSessionRtmp(): void {
  playlistRtmpUrl = '';
  playlistStreamKey = '';
  SecureStore.deleteItemAsync(PLAYLIST_SESSION_KEY).catch(() => {});
}

export async function hydratePlaylistSessionRtmp(): Promise<void> {
  if (playlistRtmpUrl && playlistStreamKey) return;
  try {
    const raw = await SecureStore.getItemAsync(PLAYLIST_SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { rtmpUrl?: string; streamKey?: string };
    if (parsed.rtmpUrl?.trim() && parsed.streamKey?.trim()) {
      playlistRtmpUrl = parsed.rtmpUrl.trim();
      playlistStreamKey = parsed.streamKey.trim();
    }
  } catch {
    /* ignore */
  }
}
