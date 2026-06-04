import { useEffect } from 'react';
import { BackHandler, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function ModulePickerScreen() {
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
  }, []);

  const pick = (module: 'streaming' | 'testing') => {
    if (module === 'streaming') router.push('/(streaming)');
    else router.push('/(testing)');
  };

  const handleExit = () => {
    BackHandler.exitApp();
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Text style={styles.title}>WAAF STREAMER</Text>
      <Text style={styles.sub}>Выберите режим работы</Text>

      <TouchableOpacity style={[styles.card, styles.cardStream]} onPress={() => pick('streaming')}>
        <Text style={styles.cardIcon}>📡</Text>
        <Text style={styles.cardTitle}>Стриминг</Text>
        <Text style={styles.cardDesc}>Пульт матча: счёт, таймер, RTMP-эфир</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.card, styles.cardTest]} onPress={() => pick('testing')}>
        <Text style={styles.cardIcon}>🎯</Text>
        <Text style={styles.cardTitle}>Тестирование</Text>
        <Text style={styles.cardDesc}>Запись навыков игроков (тренер / админ клуба)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.exitBtn} onPress={handleExit}>
        <Text style={styles.exitText}>Выход</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#888', fontSize: 14, marginBottom: 32 },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  cardStream: { backgroundColor: '#1a4384', borderColor: '#4a90e2' },
  cardTest: { backgroundColor: '#1e3a1e', borderColor: '#4cd964' },
  cardIcon: { fontSize: 36, marginBottom: 8 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6 },
  exitBtn: { marginTop: 24, padding: 12 },
  exitText: { color: '#666', fontWeight: 'bold' },
});
