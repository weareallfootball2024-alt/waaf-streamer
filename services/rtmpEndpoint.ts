/** Разделяет полный RTMP endpoint на URL сервера и ключ (если вставили одной строкой). */
export function normalizeRtmpFields(
  rtmpUrl: string,
  streamKey: string,
): { rtmpUrl: string; streamKey: string } {
  let url = rtmpUrl.trim();
  let key = streamKey.trim();
  const queryIdx = url.indexOf('?');
  if (queryIdx >= 0) url = url.slice(0, queryIdx);

  if (!key && /^rtmps?:\/\/.+\/.+/i.test(url)) {
    const lastSlash = url.lastIndexOf('/');
    const maybeKey = url.slice(lastSlash + 1);
    const base = url.slice(0, lastSlash + 1);
    if (maybeKey && !maybeKey.includes('.')) {
      return { rtmpUrl: base, streamKey: maybeKey };
    }
  }

  return { rtmpUrl: url, streamKey: key };
}

/** Собирает RTMP endpoint для VK (и других платформ). */
export function buildRtmpEndpoint(rtmpUrl: string, streamKey: string): string {
  const normalized = normalizeRtmpFields(rtmpUrl, streamKey);
  let base = normalized.rtmpUrl.replace(/\/+$/, '');
  const key = normalized.streamKey;
  if (!base) return '';
  if (key && (base.endsWith(`/${key}`) || base.endsWith(key))) {
    base = base.slice(0, base.length - key.length).replace(/\/+$/, '');
  }
  if (!key) return base;
  if (base.includes(`/${key}`)) return base;
  return `${base}/${key}`;
}

/** Проверка, что в настройках RTMP URL, а не ссылка vk.com */
export function validateRtmpSettings(rtmpUrl: string, streamKey: string): string | null {
  const { rtmpUrl: urlRaw, streamKey: keyRaw } = normalizeRtmpFields(rtmpUrl, streamKey);
  const url = urlRaw.toLowerCase();
  if (!url) return 'Укажите RTMP URL сервера из VK Studio';
  if (url.includes('vk.com') || url.includes('vkvideo.ru/watch')) {
    return 'В поле URL нужен адрес сервера (rtmp:// или rtmps://), не ссылка на страницу VK';
  }
  if (!url.startsWith('rtmp://') && !url.startsWith('rtmps://')) {
    return 'URL должен начинаться с rtmp:// или rtmps://';
  }
  const endpoint = buildRtmpEndpoint(urlRaw, keyRaw);
  const pathAfterHost = endpoint.replace(/^rtmps?:\/\/[^/]+/i, '');
  if (!keyRaw && (!pathAfterHost || pathAfterHost === '/')) {
    return 'Укажите ключ трансляции из VK Studio (отдельным полем или в конце URL)';
  }
  return null;
}

/** Маскирует ключ в URL для логов/алертов. */
export function maskRtmpEndpoint(endpoint: string): string {
  if (!endpoint) return '';
  const parts = endpoint.split('/');
  if (parts.length < 2) return endpoint;
  const last = parts[parts.length - 1];
  if (last.length <= 8) return endpoint.replace(last, '***');
  return endpoint.replace(last, `${last.slice(0, 4)}…${last.slice(-4)}`);
}
