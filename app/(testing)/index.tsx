import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router } from 'expo-router';

import {
  clearSession,
  login,
  restoreSession,
} from '../../services/authSession';
import {
  createAttempt,
  fetchClubPlayers,
  fetchClubs,
  fetchTestTypes,
  uploadAttemptVideo,
  type ClubItem,
  type PlayerItem,
  type SkillTestType,
} from '../../services/skillTestsApi';
import { canAccessTesting, type StaffUser } from '../../utils/roles';

type Screen =
  | 'login'
  | 'clubs'
  | 'tests'
  | 'instruction'
  | 'players'
  | 'record'
  | 'done';

export default function TestingApp() {
  const [screen, setScreen] = useState<Screen>('login');
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [club, setClub] = useState<ClubItem | null>(null);
  const [tests, setTests] = useState<SkillTestType[]>([]);
  const [test, setTest] = useState<SkillTestType | null>(null);
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [player, setPlayer] = useState<PlayerItem | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<{ status: string; confidence?: number } | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await restoreSession();
      if (u && canAccessTesting(u)) {
        setUser(u);
        setScreen('clubs');
        try {
          const list = await fetchClubs();
          setClubs(list);
          if (list.length === 1) {
            setClub(list[0]);
            const t = await fetchTestTypes();
            setTests(t);
            setScreen('tests');
          }
        } catch {
          /* user will retry from clubs screen */
        }
      }
      setBooting(false);
    })();
  }, []);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Ошибка', 'Введите телефон и пароль');
      return;
    }
    setLoading(true);
    const result = await login(phone, password);
    setLoading(false);
    if (!result.ok || !result.user) {
      Alert.alert('Ошибка', result.error || 'Не удалось войти');
      return;
    }
    if (!canAccessTesting(result.user)) {
      await clearSession();
      Alert.alert('Нет доступа', 'Модуль тестирования доступен тренерам и администраторам клуба');
      return;
    }
    setUser(result.user);
    setScreen('clubs');
    await loadClubs();
  };

  const loadClubs = async () => {
    setLoading(true);
    try {
      const list = await fetchClubs();
      setClubs(list);
      if (list.length === 1) {
        setClub(list[0]);
        setScreen('tests');
        await loadTests();
      } else {
        setScreen('clubs');
      }
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось загрузить клубы');
    } finally {
      setLoading(false);
    }
  };

  const loadTests = async () => {
    setLoading(true);
    try {
      setTests(await fetchTestTypes());
      setScreen('tests');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось загрузить тесты');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (clubId: number) => {
    setLoading(true);
    try {
      setPlayers(await fetchClubPlayers(clubId));
      setScreen('players');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось загрузить игроков');
    } finally {
      setLoading(false);
    }
  };

  const selectPlayer = async (p: PlayerItem) => {
    if (!club || !test) return;
    setLoading(true);
    try {
      const id = await createAttempt(club.id, p.id, test.id);
      setPlayer(p);
      setAttemptId(id);
      if (!permission?.granted) await requestPermission();
      if (!micPermission?.granted) await requestMicPermission();
      setScreen('record');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось начать попытку');
    } finally {
      setLoading(false);
    }
  };

  const startRecord = async () => {
    if (!cameraRef.current || recording) return;
    try {
      setRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: test?.max_duration_sec || 120,
      });
      setRecording(false);
      if (!video?.uri || !attemptId) return;
      setLoading(true);
      const result = await uploadAttemptVideo(attemptId, video.uri);
      setUploadResult(result);
      setScreen('done');
    } catch (e) {
      setRecording(false);
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Запись или загрузка не удалась');
    } finally {
      setLoading(false);
    }
  };

  const stopRecord = () => {
    cameraRef.current?.stopRecording();
  };

  const logout = async () => {
    await clearSession();
    setUser(null);
    setScreen('login');
  };

  const header = (title: string, onBack?: () => void) => (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>Назад</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 70 }} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn}>
        <Text style={styles.backText}>Режимы</Text>
      </TouchableOpacity>
    </View>
  );

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4cd964" size="large" />
      </View>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        {header('Тестирование')}
        <View style={styles.center}>
          <Text style={styles.sub}>Вход для тренера или админа клуба</Text>
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
          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Войти</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'clubs') {
    return (
      <SafeAreaView style={styles.root}>
        {header('Клуб', () => logout())}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#4cd964" />
        ) : (
          <FlatList
            data={clubs}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  setClub(item);
                  loadTests();
                }}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.city ? <Text style={styles.cardSub}>{item.city}</Text> : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Клубы не найдены</Text>}
          />
        )}
      </SafeAreaView>
    );
  }

  if (screen === 'tests') {
    return (
      <SafeAreaView style={styles.root}>
        {header('Тест', () => (clubs.length > 1 ? setScreen('clubs') : logout()))}
        <FlatList
          data={tests}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                setTest(item);
                setScreen('instruction');
              }}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.cardSub}>{item.description}</Text> : null}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  if (screen === 'instruction' && test) {
    const steps = test.instruction_json?.steps || [
      'Закрепите телефон на штативе',
      'Игрок полностью в кадре',
      'Не двигайте камеру во время записи',
    ];
    return (
      <SafeAreaView style={styles.root}>
        {header('Инструкция', () => setScreen('tests'))}
        <ScrollView contentContainerStyle={styles.instructBox}>
          <Text style={styles.instructTitle}>{test.title}</Text>
          {steps.map((s, i) => (
            <Text key={i} style={styles.step}>
              {i + 1}. {s}
            </Text>
          ))}
          <Text style={styles.hint}>Макс. {test.max_duration_sec} сек</Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => club && loadPlayers(club.id)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Выбрать игрока</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'players') {
    return (
      <SafeAreaView style={styles.root}>
        {header('Игрок', () => setScreen('instruction'))}
        <FlatList
          data={players}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => selectPlayer(item)} disabled={loading}>
              <Text style={styles.cardTitle}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Нет игроков в клубе</Text>}
        />
      </SafeAreaView>
    );
  }

  if (screen === 'record' && test && player) {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={styles.root}>
          <View style={styles.center}>
            <Text style={styles.sub}>Нужен доступ к камере</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
              <Text style={styles.btnText}>Разрешить</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <View style={styles.recordRoot}>
        <StatusBar barStyle="light-content" />
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode="video" facing="back" />
        <SafeAreaView style={styles.recordOverlay}>
          <Text style={styles.recordTitle}>{player.name}</Text>
          <Text style={styles.recordSub}>{test.title}</Text>
          <View style={styles.recordActions}>
            {!recording ? (
              <TouchableOpacity style={styles.recordBtn} onPress={startRecord} disabled={loading}>
                <Text style={styles.recordBtnText}>● ЗАПИСЬ</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.recordBtn, styles.recordStop]} onPress={stopRecord}>
                <Text style={styles.recordBtnText}>■ СТОП</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => setScreen('players')}>
            <Text style={styles.cancelRec}>Отмена</Text>
          </TouchableOpacity>
        </SafeAreaView>
        {loading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.uploadText}>Загрузка…</Text>
          </View>
        )}
      </View>
    );
  }

  if (screen === 'done') {
    const auto = uploadResult?.status === 'scored_auto';
    return (
      <SafeAreaView style={styles.root}>
        {header('Готово')}
        <View style={styles.center}>
          <Text style={styles.doneIcon}>{auto ? '✓' : '⏳'}</Text>
          <Text style={styles.doneTitle}>
            {auto ? 'Видео принято, оценка рассчитана' : 'Видео отправлено на проверку'}
          </Text>
          {uploadResult?.confidence != null && (
            <Text style={styles.sub}>Уверенность: {Math.round(uploadResult.confidence * 100)}%</Text>
          )}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => {
              setPlayer(null);
              setAttemptId(null);
              setUploadResult(null);
              setScreen('players');
            }}
          >
            <Text style={styles.btnText}>Следующий игрок</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { marginTop: 12 }]}
            onPress={() => setScreen('tests')}
          >
            <Text style={styles.btnTextSecondary}>Другой тест</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  backBtn: { padding: 8, minWidth: 70 },
  backText: { color: '#4cd964', fontWeight: 'bold', fontSize: 13 },
  sub: { color: '#888', marginBottom: 20, textAlign: 'center' },
  input: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  btnPrimary: {
    backgroundColor: '#4cd964',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: '#555',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  btnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  btnTextSecondary: { color: '#ccc', fontWeight: '700' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4cd964',
  },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardSub: { color: '#888', fontSize: 13, marginTop: 4 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
  instructBox: { padding: 20 },
  instructTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  step: { color: '#ccc', fontSize: 16, marginBottom: 10, lineHeight: 22 },
  hint: { color: '#888', marginVertical: 20 },
  recordRoot: { flex: 1, backgroundColor: '#000' },
  recordOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  recordTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  recordSub: { color: '#ccc', marginBottom: 24 },
  recordActions: { marginBottom: 16 },
  recordBtn: {
    backgroundColor: '#e31e24',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 32,
  },
  recordStop: { backgroundColor: '#333' },
  recordBtnText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  cancelRec: { color: '#aaa', marginTop: 8 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: { color: '#fff', marginTop: 12 },
  doneIcon: { fontSize: 48, marginBottom: 16 },
  doneTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
});
