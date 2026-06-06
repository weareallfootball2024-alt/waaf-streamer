/** RTMP для режима «плейлист / отдельная трансляция» — только на текущий эфир. */
let playlistRtmpUrl = '';
let playlistStreamKey = '';

export function setPlaylistSessionRtmp(rtmpUrl: string, streamKey: string): void {
  playlistRtmpUrl = rtmpUrl.trim();
  playlistStreamKey = streamKey.trim();
}

export function getPlaylistSessionRtmp(): { rtmpUrl: string; streamKey: string } | null {
  if (!playlistRtmpUrl || !playlistStreamKey) return null;
  const url = playlistRtmpUrl.endsWith('/') ? playlistRtmpUrl : `${playlistRtmpUrl}/`;
  return { rtmpUrl: url, streamKey: playlistStreamKey };
}

export function clearPlaylistSessionRtmp(): void {
  playlistRtmpUrl = '';
  playlistStreamKey = '';
}
