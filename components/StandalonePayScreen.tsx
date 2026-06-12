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
  initStandalonePayment,
  type StreamAccess,
} from '../services/streamApi';

type Props = {
  matchContext: StandaloneMatchContext;
  access: StreamAccess;
  onPaid: () => void | Promise<void>;
  onBack: () => void;
  onOpenSettings: () => void;
};

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingPaymentId = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPoll(), []);

  const handlePaid = async () => {
    stopPoll();
    setChecking(true);
    try {
      const latest = await fetchStreamAccess();
      if (latest.can_stream_standalone) {
        await onPaid();
        return;
      }
      Alert.alert('Оплата', 'Платёж ещё обрабатывается. Подождите минуту и нажмите «Проверить оплату».');
    } catch (e: unknown) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось проверить оплату');
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
          await onPaid();
        }
      } catch {
        /* ignore transient errors */
      }
    }, 3000);
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      const { payment_id, paymentUrl } = await initStandalonePayment();
      startPoll(payment_id);
      await WebBrowser.openBrowserAsync(paymentUrl);
    } catch (e: unknown) {
      Alert.alert('Оплата', e instanceof Error ? e.message : 'Не удалось открыть оплату');
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
          await onPaid();
          return;
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
    fetchStreamAccess()
      .then((data) => setPriceRub(data.standalone_match_price_rub))
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← НАЗАД</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ОПЛАТА ЭФИРА</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.matchTitle}>
          {matchContext.teamHome} vs {matchContext.teamAway}
        </Text>
        <Text style={styles.subtitle}>Матч вне турнира</Text>

        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>Стоимость трансляции</Text>
          <Text style={styles.price}>{priceRub} ₽</Text>
        </View>

        <Text style={styles.hint}>
          {access.tournament_hint
            || 'Проведите турнир на платформе WAAF — все матчи турнира в стримере без оплаты.'}
        </Text>

        <TouchableOpacity style={styles.btnPrimary} onPress={handlePay} disabled={loading || checking}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>ОПЛАТИТЬ {priceRub} ₽</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={handleCheck} disabled={checking}>
          {checking ? (
            <ActivityIndicator color="#e31e24" />
          ) : (
            <Text style={styles.btnSecondaryText}>ПРОВЕРИТЬ ОПЛАТУ</Text>
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
  priceBox: {
    backgroundColor: '#1a4384',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  priceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  price: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
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
