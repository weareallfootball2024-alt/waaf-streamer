import { getUser } from './authSession';
import { fetchStreamAccess } from './streamApi';
import type { TokenType } from './operatorFetch';
import { isSuperAdmin } from '../utils/roles';

export type StreamSettingsAccessContext = {
  operatorToken?: string | null;
  tokenType?: TokenType | null;
  /** Уже в пульте матча (оплаченный standalone или турнир с токеном) */
  inMatchControl?: boolean;
  isStandaloneSession?: boolean;
  isFreeTier?: boolean;
};

export type StreamSettingsAccess = {
  allowed: boolean;
  reason: string;
};

export async function canOpenStreamSettings(
  ctx: StreamSettingsAccessContext = {},
): Promise<StreamSettingsAccess> {
  if (ctx.inMatchControl) {
    if (ctx.operatorToken && ctx.tokenType !== 'web_pult') {
      return { allowed: true, reason: '' };
    }
    if (ctx.isStandaloneSession && !ctx.isFreeTier) {
      return { allowed: true, reason: '' };
    }
    return {
      allowed: false,
      reason: 'Настройки трансляции недоступны в этом режиме матча.',
    };
  }

  if (ctx.operatorToken && ctx.tokenType !== 'web_pult') {
    return { allowed: true, reason: '' };
  }

  const user = await getUser();
  if (isSuperAdmin(user)) {
    return { allowed: true, reason: '' };
  }

  try {
    const access = await fetchStreamAccess();
    if (access.can_stream_standalone) {
      return { allowed: true, reason: '' };
    }
    if (access.needs_waaf_login) {
      return {
        allowed: false,
        reason:
          'Войдите в WAAF под аккаунтом администратора платформы. Настройки VK без оплаты недоступны.',
      };
    }
    if (access.needs_payment || access.needs_topup) {
      return {
        allowed: false,
        reason:
          'Настройки трансляции доступны после пополнения баланса, входа суперадмина WAAF или с токеном турнира.',
      };
    }
    return {
      allowed: false,
      reason:
        'Настройки доступны с токеном турнира, после оплаты матча вне турнира или входа суперадмина WAAF.',
    };
  } catch {
    return {
      allowed: false,
      reason:
        'Не удалось проверить доступ. Используйте токен турнира, войдите в WAAF или пополните баланс.',
    };
  }
}
