/** Собирает RTMP endpoint для VK (и других платформ). */
export function buildRtmpEndpoint(rtmpUrl: string, streamKey: string): string {
  let base = rtmpUrl.trim().replace(/\/+$/, '');
  const key = streamKey.trim();
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
  const url = rtmpUrl.trim().toLowerCase();
  if (!url) return 'Укажите RTMP URL сервера из VK Studio';
  if (url.includes('vk.com') || url.includes('vkvideo.ru/watch')) {
    return 'В поле URL нужен адрес сервера (rtmp:// или rtmps://), не ссылка на страницу VK';
  }
  if (!url.startsWith('rtmp://') && !url.startsWith('rtmps://')) {
    return 'URL должен начинаться с rtmp:// или rtmps://';
  }
  if (!streamKey.trim()) return 'Укажите ключ трансляции из VK Studio';
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
