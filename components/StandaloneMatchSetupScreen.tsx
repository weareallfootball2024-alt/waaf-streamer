import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  searchPublicClubs,
  type PublicClub,
  type StandaloneMatchContext,
} from '../services/standaloneMatch';

type TeamSlot = {
  search: string;
  clubs: PublicClub[];
  selected: PublicClub | null;
  manualName: string;
  manualLogoUri: string | null;
  loading: boolean;
};

const emptySlot = (): TeamSlot => ({
  search: '',
  clubs: [],
  selected: null,
  manualName: '',
  manualLogoUri: null,
  loading: false,
});

type Props = {
  onStart: (ctx: StandaloneMatchContext) => void | Promise<void>;
  onBack: () => void;
  onOpenSettings: () => void;
};

function teamDisplayName(slot: TeamSlot): string {
  if (slot.selected) return slot.selected.name;
  return slot.manualName.trim();
}

function teamLogo(slot: TeamSlot): string {
  if (slot.selected?.logo_url) return slot.selected.logo_url;
  return slot.manualLogoUri || '';
}

function ClubLogo({ uri, size = 40 }: { uri?: string; size?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, marginRight: 10 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        marginRight: 10,
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#555',
      }}
    />
  );
}

function TeamPicker({
  title,
  slot,
  onChange,
  accentColor,
}: {
  title: string;
  slot: TeamSlot;
  onChange: (patch: Partial<TeamSlot>) => void;
  accentColor: string;
}) {
  const runSearch = async () => {
    if (!slot.search.trim()) return;
    onChange({ loading: true });
    try {
      const clubs = await searchPublicClubs(slot.search);
      onChange({ clubs, loading: false, selected: null });
    } catch (e) {
      onChange({ loading: false });
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Поиск не удался');
    }
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нужен доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onChange({ manualLogoUri: result.assets[0].uri, selected: null });
    }
  };

  return (
    <View style={[styles.teamColumn, { borderColor: accentColor }]}>
      <Text style={[styles.teamColumnTitle, { color: accentColor }]}>{title}</Text>

      <TextInput
        style={styles.input}
        placeholder="Поиск клуба в WAAF"
        placeholderTextColor="#666"
        value={slot.search}
        onChangeText={(search) => onChange({ search })}
        onSubmitEditing={runSearch}
      />
      <TouchableOpacity
        style={[styles.btnSearch, { borderColor: accentColor }]}
        onPress={runSearch}
        disabled={slot.loading}
      >
        {slot.loading ? (
          <ActivityIndicator color={accentColor} />
        ) : (
          <Text style={[styles.btnSearchText, { color: accentColor }]}>НАЙТИ</Text>
        )}
      </TouchableOpacity>

      {slot.clubs.length > 0 && (
        <View style={styles.clubList}>
          {slot.clubs.map((club) => {
            const active = slot.selected?.id === club.id;
            return (
              <TouchableOpacity
                key={club.id}
                style={[styles.clubRow, active && { borderColor: accentColor, backgroundColor: '#1a2a1a' }]}
                onPress={() => onChange({ selected: club, manualName: '', manualLogoUri: null })}
              >
                <ClubLogo uri={club.logo_url} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.clubName}>{club.name}</Text>
                  {club.city ? <Text style={styles.clubCity}>{club.city}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.orDivider}>или введите вручную</Text>
      <TextInput
        style={styles.input}
        placeholder="Название команды"
        placeholderTextColor="#666"
        value={slot.manualName}
        onChangeText={(manualName) => onChange({ manualName, selected: null })}
      />
      <TouchableOpacity style={styles.btnGhost} onPress={pickLogo}>
        <Text style={styles.btnGhostText}>
          {slot.manualLogoUri ? 'СМЕНИТЬ ЛОГО' : 'ДОБАВИТЬ ЛОГО'}
        </Text>
      </TouchableOpacity>
      {slot.manualLogoUri ? (
        <Image source={{ uri: slot.manualLogoUri }} style={styles.manualLogoPreview} />
      ) : null}
    </View>
  );
}

export function StandaloneMatchSetupScreen({ onStart, onBack, onOpenSettings }: Props) {
  const [home, setHome] = useState<TeamSlot>(emptySlot);
  const [away, setAway] = useState<TeamSlot>(emptySlot);
  const [submitting, setSubmitting] = useState(false);

  const homeName = teamDisplayName(home);
  const awayName = teamDisplayName(away);
  const canStart = homeName.length > 0 && awayName.length > 0 && !submitting;

  const preview = useMemo(
    () => ({
      homeName: homeName || 'Клуб 1',
      awayName: awayName || 'Клуб 2',
      homeLogo: teamLogo(home),
      awayLogo: teamLogo(away),
    }),
    [home, away, homeName, awayName],
  );

  const handleStart = async () => {
    if (!canStart) return;
    setSubmitting(true);
    try {
      const ctx: StandaloneMatchContext = {
        standalone: true,
        clubId: home.selected?.id,
        clubName: homeName,
        clubLogoUri: teamLogo(home),
        teamHome: homeName,
        teamAway: awayName,
        awayClubId: away.selected?.id,
        awayLogoUri: teamLogo(away) || undefined,
      };
      await onStart(ctx);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>НАЗАД</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Быстрый матч</Text>
        <TouchableOpacity onPress={onOpenSettings}>
          <Text style={styles.settingsBtn}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.previewCard}>
          <View style={styles.previewSide}>
            <ClubLogo uri={preview.homeLogo} size={48} />
            <Text style={styles.previewTeam} numberOfLines={2}>
              {preview.homeName}
            </Text>
          </View>
          <View style={styles.previewScore}>
            <Text style={styles.previewScoreText}>0 : 0</Text>
            <Text style={styles.previewHint}>превью матча</Text>
          </View>
          <View style={[styles.previewSide, { alignItems: 'flex-end' }]}>
            <ClubLogo uri={preview.awayLogo} size={48} />
            <Text style={[styles.previewTeam, { textAlign: 'right' }]} numberOfLines={2}>
              {preview.awayName}
            </Text>
          </View>
        </View>

        <View style={styles.columns}>
          <TeamPicker
            title="Ваша команда (клуб 1)"
            slot={home}
            onChange={(patch) => setHome((s) => ({ ...s, ...patch }))}
            accentColor="#4cd964"
          />
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <TeamPicker
            title="Соперник (клуб 2)"
            slot={away}
            onChange={(patch) => setAway((s) => ({ ...s, ...patch }))}
            accentColor="#e31e24"
          />
        </View>

        <TouchableOpacity
          style={[styles.btnStart, !canStart && styles.btnStartDisabled]}
          onPress={handleStart}
          disabled={!canStart}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnStartText}>▶ НАЧАТЬ ТРАНСЛЯЦИЮ</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: { padding: 8 },
  backText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  settingsBtn: { color: '#4cd964', fontSize: 20, padding: 8 },
  scroll: { padding: 16, paddingBottom: 40 },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewSide: { flex: 1 },
  previewTeam: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginTop: 4 },
  previewScore: { alignItems: 'center', paddingHorizontal: 12 },
  previewScoreText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  previewHint: { color: '#666', fontSize: 10, marginTop: 4, textTransform: 'uppercase' },
  columns: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  teamColumn: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  teamColumnTitle: { fontSize: 12, fontWeight: '900', marginBottom: 10, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  btnSearch: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSearchText: { fontWeight: 'bold', fontSize: 12 },
  clubList: { marginBottom: 8, maxHeight: 140 },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 6,
    backgroundColor: '#1e1e1e',
  },
  clubName: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  clubCity: { color: '#888', fontSize: 11 },
  orDivider: { color: '#666', fontSize: 11, textAlign: 'center', marginVertical: 8 },
  btnGhost: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnGhostText: { color: '#ccc', fontWeight: 'bold', fontSize: 11 },
  manualLogoPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: 'center',
    marginBottom: 4,
  },
  vsBadge: {
    alignSelf: 'center',
    backgroundColor: '#222',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  vsText: { color: '#888', fontWeight: '900', fontSize: 12 },
  btnStart: {
    backgroundColor: '#e31e24',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  btnStartDisabled: { opacity: 0.4 },
  btnStartText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
