import { getActiveRtmpConfig, getStreamSetupHint, loadStreamSettings } from './streamConfig';
import { getStoredVkToken } from './vkAuth';

export type StreamReadiness = { ok: true } | { ok: false; message: string };

export async function checkStreamReadiness(): Promise<StreamReadiness> {
  const settings = await loadStreamSettings();

  if (getActiveRtmpConfig(settings)) {
    return { ok: true };
  }

  // Без ручных ключей — нужен вход VK + сообщество (ключи выдаст VK при старте)
  const token = await getStoredVkToken();
  if (settings.activePlatform === 'vk' && token && settings.vk.communityId) {
    return { ok: true };
  }

  return {
    ok: false,
    message:
      'Укажите RTMP URL и ключ в настройках — или войдите через VK и выберите сообщество, где вы админ (тогда ключи подставятся сами).',
  };
}
