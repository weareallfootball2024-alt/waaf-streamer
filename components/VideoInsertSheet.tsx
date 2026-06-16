import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { AdClipPreset } from '../constants/streamPlatforms';

type Props = {
  visible: boolean;
  presets: AdClipPreset[];
  onClose: () => void;
  onPlay: (uri: string, loop: boolean) => void;
  onPickFile: () => void;
};

export function VideoInsertSheet({ visible, presets, onClose, onPlay, onPickFile }: Props) {
  const [loop, setLoop] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Вставить ролик в эфир</Text>
          <Text style={styles.hint}>RTMP не прерывается — зрители увидят видео из файла.</Text>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, !loop && styles.modeChipActive]}
              onPress={() => setLoop(false)}
            >
              <Text style={[styles.modeText, !loop && styles.modeTextActive]}>Один раз</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, loop && styles.modeChipActive]}
              onPress={() => setLoop(true)}
            >
              <Text style={[styles.modeText, loop && styles.modeTextActive]}>По кругу</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {presets.length === 0 ? (
              <Text style={styles.empty}>Нет пресетов. Добавьте ролики в настройках трансляции.</Text>
            ) : (
              presets.map((clip) => (
                <TouchableOpacity
                  key={clip.id}
                  style={styles.presetRow}
                  onPress={() => {
                    onPlay(clip.uri, loop);
                    onClose();
                  }}
                >
                  <Text style={styles.presetTitle}>{clip.title}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.pickRow} onPress={onPickFile}>
              <Text style={styles.pickText}>Выбрать файл с телефона…</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export async function pickVideoFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  hint: { color: '#888', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  modeChipActive: { backgroundColor: '#1a4384', borderColor: '#4a90e2' },
  modeText: { color: '#aaa', fontWeight: '600', fontSize: 13 },
  modeTextActive: { color: '#fff' },
  list: { maxHeight: 240, marginBottom: 12 },
  empty: { color: '#666', fontStyle: 'italic', marginBottom: 12 },
  presetRow: {
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  presetTitle: { color: '#fff', fontWeight: '600' },
  pickRow: {
    borderWidth: 1,
    borderColor: '#e31e24',
    borderStyle: 'dashed',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickText: { color: '#e31e24', fontWeight: 'bold' },
  closeBtn: { alignItems: 'center', paddingVertical: 12 },
  closeText: { color: '#888' },
});
