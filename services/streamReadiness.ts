import { getActiveRtmpConfig, getStreamSetupHint, loadStreamSettings } from './streamConfig';
import { getStoredVkToken } from './vkAuth';

export type StreamReadiness = { ok: true } | { ok: false; message: string };

export async function checkStreamReadiness(): Promise<StreamReadiness> {
  const token = await getStoredVkToken();
  if (!token) {
    return {
      ok: false,
      message:
        'Для матча вне турнира нужно войти через VK в настройках трансляции и выбрать сообщество.',
    };
  }

  const settings = await loadStreamSettings();
  if (!settings.vk.communityId) {
    return {
      ok: false,
      message: 'Выберите сообщество VK в настройках — туда пойдёт трансляция.',
    };
  }

  if (!getActiveRtmpConfig(settings)) {
    return { ok: false, message: getStreamSetupHint(settings) };
  }

  return { ok: true };
}
