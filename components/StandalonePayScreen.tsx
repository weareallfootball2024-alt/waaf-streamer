import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { StandaloneMatchContext } from '../services/standaloneMatch';
import {
  fetchPaymentStatus,
  fetchStreamAccess,
  initBalanceTopup,
  type StreamAccess,
} from '../services/streamApi';

type Props = {
  matchContext: StandaloneMatchContext;
  access: StreamAccess;
  onPaid: () => void | Promise<void>;
  onBack: () => void;
  onOpenSettings: () => void;
};

const TOPUP_PRESETS = [100, 200, 300, 500, 1000];

export function StandalonePayScreen({
  matchContext,
  access,
  onPaid,
  onBack,
  onOpenSettings,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [priceRub, setPriceRub] = useState(access.standalone_match_price_rub);
  const [balanceRub, setBalanceRub] = useState(access.balance_rub ?? 0);
  const [selectedTopup, setSelectedTopup] = useState(
    TOPUP_PRESETS.find((p) => p >= priceRub) || priceRub || 1000,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPaymentId = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPoll(), []);

  const refreshAccess = async () => {
    const latest = await fetchStreamAccess();
    setPriceRub(latest.standalone_match_price_rub);
    setBalanceRub(latest.balance_rub ?? 0);
    return latest;
  };

  const handlePaid = async () => {
    stopPoll();
    setChecking(true);
    try {
      const latest = await refreshAccess();
      if (latest.can_stream_standalone) {
        await onPaid();
        return;
      }
      Alert.alert(
        'Пополнение',
        'Платёж ещё обрабатывается. Подождите минуту и нажмите «Проверить баланс».',
      );
    } catch (e: unknown) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось проверить баланс');
    } finally {
      setChecking(false);
    }
  };

  const startPoll = (paymentId: number) => {
    stopPoll();
    pendingPaymentId.current = paymentId;
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchPaymentStatus(paymentId);
        if (status.status === 'paid') {
          stopPoll();
          const latest = await refreshAccess();
          if (latest.can_stream_standalone) {
            await onPaid();
          }
        }
      } catch {
        /* ignore transient errors */
      }
    }, 3000);
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      const { payment_id, paymentUrl } = await initBalanceTopup(selectedTopup);
      startPoll(payment_id);
      await WebBrowser.openBrowserAsync(paymentUrl);
    } catch (e: unknown) {
      Alert.alert('Пополнение', e instanceof Error ? e.message : 'Не удалось открыть оплату');
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    if (pendingPaymentId.current) {
      setChecking(true);
      try {
        const status = await fetchPaymentStatus(pendingPaymentId.current);
        if (status.status === 'paid') {
          const latest = await refreshAccess();
          if (latest.can_stream_standalone) {
            await onPaid();
            return;
          }
        }
      } catch {
        /* fall through */
      } finally {
        setChecking(false);
      }
    }
    await handlePaid();
  };

  useEffect(() => {
    refreshAccess().catch(() => {});
  }, []);

  const shortfall = Math.max(0, priceRub - balanceRub);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← НАЗАД</Text>
        </TouchableOpacity>
        <Text style={styles.title}>БАЛАНС</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.matchTitle}>
          {matchContext.teamHome} vs {matchContext.teamAway}
        </Text>
        <Text style={styles.subtitle}>Матч вне турнира</Text>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>На балансе</Text>
          <Text style={styles.balance}>{balanceRub} ₽</Text>
          <Text style={styles.balanceHint}>
            Стоимость матча — {priceRub} ₽
            {shortfall > 0 ? ` · не хватает ${shortfall} ₽` : ''}
          </Text>
        </View>

        <Text style={styles.presetLabel}>Сумма пополнения</Text>
        <View style={styles.presetRow}>
          {TOPUP_PRESETS.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[styles.presetBtn, selectedTopup === amount && styles.presetBtnActive]}
              onPress={() => setSelectedTopup(amount)}
            >
              <Text style={[styles.presetText, selectedTopup === amount && styles.presetTextActive]}>
                {amount} ₽
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.hint}>
          Списание — после завершения эфира. Оплата не нужна, если матч не транслировался.
          {'\n\n'}
          {access.tournament_hint
            || 'Проведите турнир на платформе WAAF — все матчи турнира в стримере без оплаты.'}
        </Text>

        <TouchableOpacity style={styles.btnPrimary} onPress={handlePay} disabled={loading || checking}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>ПОПОЛНИТЬ {selectedTopup} ₽</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={handleCheck} disabled={checking}>
          {checking ? (
            <ActivityIndicator color="#e31e24" />
          ) : (
            <Text style={styles.btnSecondaryText}>ПРОВЕРИТЬ БАЛАНС</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onOpenSettings}>
          <Text style={styles.link}>Настройки аккаунта</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://мывсефутбол.рф')}
          style={{ marginTop: 16 }}
        >
          <Text style={styles.link}>Провести турнир на WAAF →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  back: { color: '#e31e24', fontWeight: 'bold', fontSize: 14 },
  title: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  body: { flex: 1, padding: 24, justifyContent: 'center' },
  matchTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 28,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  balanceBox: {
    backgroundColor: '#1a4384',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  balance: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  balanceHint: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 10, textAlign: 'center' },
  presetLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  presetRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  presetBtn: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  presetBtnActive: { borderColor: '#e31e24', backgroundColor: 'rgba(227,30,36,0.15)' },
  presetText: { color: '#aaa', fontWeight: 'bold', fontSize: 14 },
  presetTextActive: { color: '#fff' },
  hint: { color: '#aaa', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 28 },
  btnPrimary: {
    backgroundColor: '#e31e24',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: '#e31e24',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnSecondaryText: { color: '#e31e24', fontWeight: 'bold', fontSize: 14 },
  link: { color: '#4a90e2', textAlign: 'center', fontSize: 14, fontWeight: '600' },
});
