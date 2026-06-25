import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';

import { parseOperatorToken } from '../../constants/streamPlatforms';
import { login, restoreSession } from '../../services/authSession';
import { getStoredVkUserId, loginWithVk } from '../../services/vkAuth';
import { resolveOperatorToken } from '../../services/operatorFetch';
import type { TokenType } from '../../services/operatorFetch';
import { fetchStreamBalance } from '../../services/streamApi';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 18,
  },
  balanceCard: {
    backgroundColor: '#1a4384',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  balanceValue: { color: '#fff', fontSize: 32, fontWeight: '900' },
  balanceHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 },
  hashTag: {
    color: '#e31e24',
    fontWeight: '800',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 2,
  },
  cardPrimary: { backgroundColor: '#1a4384', borderColor: '#4a90e2' },
  cardSecondary: { backgroundColor: '#1e293b', borderColor: '#475569' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cardDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },
  hint: {
    color: '#6b7280',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1e1e1e',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 14,
  },
  btn: {
    backgroundColor: '#1a4384',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnGreen: { backgroundColor: '#166534' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  back: { color: '#e31e24', fontWeight: 'bold', marginBottom: 20 },
  exitPos: { position: 'absolute', top: 16, right: 16, padding: 8 },
  exitText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
  privacyPos: { position: 'absolute', top: 16, left: 16, padding: 8 },
  privacyText: { color: '#666', fontWeight: 'bold', fontSize: 11 },
  stub: {
    backgroundColor: '#292524',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#44403c',
  },
  stubText: { color: '#a8a29e', fontSize: 11, lineHeight: 16 },
});

type HomeProps = {
  onAnonymous: () => void;
  onAuth: () => void;
  onDeepLinkToken?: string;
};

export function MainHomeScreen({ onAnonymous, onAuth, onDeepLinkToken }: HomeProps) {
  const openPrivacy = () => {
    Linking.openURL('https://мывсефутбол.рф/privacy').catch(() => {});
  };

  const handleExit = () => {
    Alert.alert('Выход', 'Закрыть приложение?', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Да', onPress: () => BackHandler.exitApp() },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <TouchableOpacity style={styles.privacyPos} onPress={openPrivacy}>
        <Text style={styles.privacyText}>🔒 ПОЛИТИКА</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exitPos} onPress={handleExit}>
        <Text style={styles.exitText}>🚪 ВЫХОД</Text>
      </TouchableOpacity>

      <Text style={styles.title}>WAAF-STREAMER</Text>
      <Text style={styles.subtitle}>
        Трансляции футбольных матчей{'\n'}
        <Text style={styles.hashTag}>#МЫВСЕФУТБОЛ</Text>
      </Text>

      {!!onDeepLinkToken && (
        <View style={styles.stub}>
          <Text style={styles.stubText}>Обнаружена ссылка с токеном — войдите в аккаунт или вставьте токен после авторизации.</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.card, styles.cardPrimary]} onPress={onAnonymous}>
        <Text style={styles.cardTitle}>1. Трансляция без авторизации</Text>
        <Text style={styles.cardDesc}>
          RTMP + ключ, табло со счётом и логотипами. Минимальное качество, водяной знак #мывсефутбол.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.card, styles.cardSecondary]} onPress={onAuth}>
        <Text style={styles.cardTitle}>2. Авторизация</Text>
        <Text style={styles.cardDesc}>
          VK или МЫВСЕФУТБОЛ — турниры, баланс, качество, повторы, без водяного знака.
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Приложение для стримов — только Android.{'\n'}
        Трансляция в VK Видео (не на стену сообщества).
      </Text>
    </View>
  );
}

type AnonymousProps = {
  onBack: () => void;
  onStart: (payload: {
    rtmpUrl: string;
    streamKey: string;
    teamHome: string;
    teamAway: string;
  }) => void;
};

export function AnonymousStreamScreen({ onBack, onStart }: AnonymousProps) {
  const [rtmpUrl, setRtmpUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [teamHome, setTeamHome] = useState('');
  const [teamAway, setTeamAway] = useState('');

  const handleStart = () => {
    if (!rtmpUrl.trim() || !streamKey.trim()) {
      Alert.alert('Ошибка', 'Укажите RTMP URL и ключ трансляции');
      return;
    }
    if (!teamHome.trim() || !teamAway.trim()) {
      Alert.alert('Ошибка', 'Укажите названия команд для табло');
      return;
    }
    onStart({
      rtmpUrl: rtmpUrl.trim(),
      streamKey: streamKey.trim(),
      teamHome: teamHome.trim(),
      teamAway: teamAway.trim(),
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#121212' }} contentContainerStyle={{ padding: 24, paddingTop: 48 }}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>◀ НАЗАД</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Трансляция вне платформы</Text>
      <Text style={styles.subtitle}>
        Укажите RTMP и ключ (VK Видео, YouTube и др.).{'\n'}
        Настройки качества недоступны — минимальное качество.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="RTMP URL (rtmp://...)"
        placeholderTextColor="#666"
        value={rtmpUrl}
        onChangeText={setRtmpUrl}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Ключ трансляции (stream key)"
        placeholderTextColor="#666"
        value={streamKey}
        onChangeText={setStreamKey}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Команда хозяев"
        placeholderTextColor="#666"
        value={teamHome}
        onChangeText={setTeamHome}
      />
      <TextInput
        style={styles.input}
        placeholder="Команда гостей"
        placeholderTextColor="#666"
        value={teamAway}
        onChangeText={setTeamAway}
      />

      <TouchableOpacity style={styles.btn} onPress={handleStart}>
        <Text style={styles.btnText}>НАЧАТЬ ТРАНСЛЯЦИЮ</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        На углах эфира — водяной знак #мывсефутбол.{'\n'}
        С авторизацией и оплатой: выбор качества, повторы, без водяного знака.
      </Text>
    </ScrollView>
  );
}

type AuthChoiceProps = {
  onBack: () => void;
  onVk: () => void;
  onWaaf: () => void;
};

export function AuthChoiceScreen({ onBack, onVk, onWaaf }: AuthChoiceProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>◀ НАЗАД</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Вход</Text>
      <Text style={styles.subtitle}>Выберите способ авторизации</Text>

      <TouchableOpacity style={[styles.card, styles.cardSecondary]} onPress={onVk}>
        <Text style={styles.cardTitle}>VK</Text>
        <Text style={styles.cardDesc}>Для матчей вне платформы и оплаты трансляций</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.card, styles.cardPrimary]} onPress={onWaaf}>
        <Text style={styles.cardTitle}>МЫВСЕФУТБОЛ</Text>
        <Text style={styles.cardDesc}>Телефон и пароль аккаунта платформы</Text>
      </TouchableOpacity>
    </View>
  );
};

type WaafLoginProps = {
  onBack: () => void;
  onSuccess: () => void;
};

type VkLoginProps = {
  onBack: () => void;
  onSuccess: () => void;
};

export function VkLoginScreen({ onBack, onSuccess }: VkLoginProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await loginWithVk();
      onSuccess();
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось войти через VK');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} disabled={loading}>
        <Text style={styles.back}>◀ НАЗАД</Text>
      </TouchableOpacity>
      <Text style={styles.title}>VK</Text>
      <Text style={styles.subtitle}>
        Вход для матчей вне платформы и трансляций в VK Видео
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: '#0077FF' }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>ВОЙТИ ЧЕРЕЗ VK</Text>}
      </TouchableOpacity>
    </View>
  );
}

export function WaafLoginScreen({ onBack, onSuccess }: WaafLoginProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const result = await login(phone.trim(), password);
    setLoading(false);
    if (!result.ok) {
      Alert.alert('Ошибка', result.error || 'Не удалось войти');
      return;
    }
    onSuccess();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>◀ НАЗАД</Text>
      </TouchableOpacity>
      <Text style={styles.title}>МЫВСЕФУТБОЛ</Text>
      <TextInput
        style={styles.input}
        placeholder="Телефон"
        placeholderTextColor="#666"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>ВОЙТИ</Text>}
      </TouchableOpacity>
    </View>
  );
};

type AuthHomeProps = {
  initialToken?: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onTokenResolved: (tournamentId: string, token: string, tokenType: TokenType) => void;
  onStandalone: () => void;
  onVkRequired: () => void;
};

export function AuthenticatedHomeScreen({
  initialToken = '',
  onBack,
  onOpenSettings,
  onTokenResolved,
  onStandalone,
  onVkRequired,
}: AuthHomeProps) {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [balanceRub, setBalanceRub] = useState<number | null>(null);
  const [matchPriceRub, setMatchPriceRub] = useState<number | null>(null);

  useEffect(() => {
    fetchStreamBalance()
      .then((b) => {
        setBalanceRub(b.balance_rub);
        setMatchPriceRub(b.standalone_match_price_rub);
      })
      .catch(() => {});
  }, []);

  const handleToken = async () => {
    const token = parseOperatorToken(tokenInput);
    if (!token) {
      Alert.alert('Ошибка', 'Вставьте токен или ссылку от организатора');
      return;
    }
    setLoading(true);
    try {
      const data = await resolveOperatorToken(token);
      if (data.tokenType === 'web_pult') {
        Alert.alert(
          'Токен веб-пульта',
          'Это токен веб-пульта: камера недоступна, только счёт и табло. Продолжить без трансляции?',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Продолжить',
              onPress: () => onTokenResolved(String(data.tournamentId), token, 'web_pult'),
            },
          ],
        );
        return;
      }
      onTokenResolved(String(data.tournamentId), token, data.tokenType);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Токен недействителен');
    } finally {
      setLoading(false);
    }
  };

  const handleStandalone = async () => {
    const vk = await getStoredVkUserId();
    const user = await restoreSession();
    if (!vk && !user) {
      Alert.alert('Нужна авторизация', 'Войдите через VK в настройках или привяжите аккаунт WAAF', [
        { text: 'В настройки', onPress: onOpenSettings },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }
    onStandalone();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#121212' }} contentContainerStyle={{ padding: 24, paddingTop: 48 }}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>◀ ВЫХОД ИЗ АККАУНТА</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onOpenSettings} style={{ marginBottom: 16 }}>
        <Text style={{ color: '#4a90e2', fontWeight: 'bold' }}>⚙ НАСТРОЙКИ ТРАНСЛЯЦИИ</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Личный кабинет</Text>
      <Text style={styles.subtitle}>Токен турнира или матч вне платформы</Text>

      {balanceRub != null && (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Баланс трансляций</Text>
          <Text style={styles.balanceValue}>{balanceRub} ₽</Text>
          {matchPriceRub != null && (
            <Text style={styles.balanceHint}>{matchPriceRub} ₽ за матч вне турнира</Text>
          )}
        </View>
      )}

      <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>ТОКЕН ТУРНИРА</Text>
      <TextInput
        style={styles.input}
        placeholder="Токен трансляции или ссылка"
        placeholderTextColor="#666"
        value={tokenInput}
        onChangeText={setTokenInput}
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.btn} onPress={handleToken} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>ОТКРЫТЬ ТУРНИР</Text>}
      </TouchableOpacity>
      <Text style={styles.hint}>
        Токен трансляции — камера и эфир (бесплатно в турнире).{'\n'}
        Токен веб-пульта — только табло, без камеры.
      </Text>

      <TouchableOpacity style={[styles.btn, styles.btnGreen, { marginTop: 24 }]} onPress={handleStandalone}>
        <Text style={styles.btnText}>МАТЧ ВНЕ ПЛАТФОРМЫ МЫВСЕФУТБОЛ</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        Пополнение баланса, списание за трансляцию после матча.{'\n'}
        Эфир в VK Видео.
      </Text>

      <View style={styles.stub}>
        <Text style={styles.stubText}>ID турнира + PIN — скоро (заглушка)</Text>
      </View>
    </ScrollView>
  );
}
