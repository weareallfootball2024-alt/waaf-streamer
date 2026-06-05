import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    FlatList,
    Image,
    Modal,
    NativeModules,
    PermissionsAndroid, Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet, Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { ApiVideoLiveStreamView } from '@api.video/react-native-livestream';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenOrientation from 'expo-screen-orientation';

import { API_URL } from '../../constants/api';
import { parseOperatorToken } from '../../constants/streamPlatforms';
import { StreamSettingsScreen } from '../../components/StreamSettingsScreen';
import {
  fetchTournamentMatches,
  operatorFetch,
  resolveOperatorToken,
} from '../../services/operatorFetch';
import {
  getActiveRtmpConfig,
  loadStreamSettings,
} from '../../services/streamConfig';
import {
  buildStandaloneMatch,
  searchPublicClubs,
  type PublicClub,
  type StandaloneMatchContext,
} from '../../services/standaloneMatch';
import { formatTimer, getActualSeconds } from '../../utils/matchTimer';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

const { AudioHelper } = NativeModules;

// ==================================================
// ЭКРАН 1: ВВОД ID ТУРНИРА
// ==================================================
function TournamentLoginScreen({ onNext, onOpenSettings, onStandalone, initialToken = '', onBackToModules }) {
    const [tokenInput, setTokenInput] = useState(initialToken);
    const [tournId, setTournId] = useState('');
    const [loading, setLoading] = useState(false);
    const [showIdMode, setShowIdMode] = useState(false);

    const handleTokenLogin = async () => {
        const token = parseOperatorToken(tokenInput);
        if (!token) { Alert.alert("Ошибка", "Вставьте ссылку или токен от организатора"); return; }
        setLoading(true);
        try {
            const { tournamentId } = await resolveOperatorToken(token);
            const matches = await fetchTournamentMatches(String(tournamentId));
            onNext(matches, String(tournamentId), token);
        } catch (e) {
            Alert.alert("Ошибка", e instanceof Error ? e.message : "Ссылка недействительна");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!tournId) { Alert.alert("Ошибка", "Введите ID турнира"); return; }
        setLoading(true);
        try {
            const matches = await fetchTournamentMatches(tournId);
            onNext(matches, tournId, null);
        } catch (e) {
            Alert.alert("Не найдено", e instanceof Error ? e.message : "Неверный ID или нет матчей");
        } finally {
            setLoading(false);
        }
    };

    const handleExit = () => {
        Alert.alert("Выход", "Закрыть приложение?", [
            { text: "Нет", style: "cancel" },
            { text: "Да", onPress: () => BackHandler.exitApp() }
        ]);
    };

    const openPrivacy = async () => {
        try {
            await Linking.openURL('https://мывсефутбол.рф/privacy');
        } catch (e) {
            Alert.alert("Ошибка", "Не удалось открыть политику конфиденциальности");
        }
    };

    return (
        <View style={styles.centerContainer}>
            <StatusBar hidden />
            <TouchableOpacity style={styles.settingsBtnPos} onPress={onOpenSettings}>
                <Text style={styles.settingsBtnText}>⚙ НАСТРОЙКИ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exitBtnPos} onPress={handleExit}>
                <Text style={styles.exitBtnText}>🚪 ВЫХОД</Text>
            </TouchableOpacity>
            {onBackToModules && (
            <TouchableOpacity style={styles.modulesBtnPos} onPress={onBackToModules}>
                <Text style={styles.modulesBtnText}>◀ РЕЖИМЫ</Text>
            </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.privacyBtnPos} onPress={openPrivacy}>
                <Text style={styles.privacyBtnText}>🔒 ПОЛИТИКА</Text>
            </TouchableOpacity>

            <Text style={styles.title}>WAAF STREAMER</Text>
            <Text style={styles.subTitle}>Ссылка от организатора</Text>
            <TextInput
                style={[styles.inputBig, { fontSize: 14, minHeight: 48 }]}
                placeholder="https://.../?token=... или токен"
                placeholderTextColor="#666"
                value={tokenInput}
                onChangeText={setTokenInput}
                autoCapitalize="none"
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={handleTokenLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>ОТКРЫТЬ ТУРНИР</Text>}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: '#2a5a2a', marginTop: 14 }]}
                onPress={onStandalone}
            >
                <Text style={styles.btnText}>МАТЧ ВНЕ ТУРНИРА</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowIdMode(!showIdMode)} style={{ marginTop: 20 }}>
                <Text style={{ color: '#888', fontSize: 13 }}>{showIdMode ? '▲ Скрыть ID турнира' : '▼ Или ввести ID турнира'}</Text>
            </TouchableOpacity>

            {showIdMode && (
                <>
                    <TextInput
                        style={[styles.inputBig, { marginTop: 12 }]}
                        placeholder="ID (напр: 1)"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={tournId}
                        onChangeText={setTournId}
                    />
                    <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#555' }]} onPress={handleSearch} disabled={loading}>
                        {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>НАЙТИ МАТЧИ</Text>}
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

// ==================================================
// ЭКРАН 2: ВЫБОР МАТЧА
// ==================================================
function MatchSelectionScreen({ matches, onSelect, onBack, tokenMode = false }) {
    return (
        <SafeAreaView style={styles.listContainer}>
            <View style={styles.listHeader}>
                <TouchableOpacity onPress={onBack} style={styles.backBtnSmall}><Text style={{color:'white', fontWeight:'bold'}}>{tokenMode ? 'НАЗАД' : 'НАЗАД (ID)'}</Text></TouchableOpacity>
                <Text style={styles.titleSmall}>РАСПИСАНИЕ</Text>
                <View style={{width:50}}/>
            </View>
            <FlatList 
                data={matches}
                keyExtractor={item => item.id.toString()}
                renderItem={({item}) => (
                    <TouchableOpacity style={styles.matchCard} onPress={() => onSelect(item)}>
                        <Text style={styles.matchTime}>{new Date(item.start_time).toLocaleTimeString().slice(0,5)}</Text>
                        <View style={styles.matchRow}>
                            <Text style={styles.teamTitle}>{item.team_home}</Text>
                            <Text style={styles.vsText}>vs</Text>
                            <Text style={styles.teamTitle}>{item.team_away}</Text>
                        </View>
                        <Text style={[styles.matchStatus, {color: item.status === 'live' ? '#e31e24' : item.status === 'finished' ? 'gray' : '#4cd964'}]}>
                            {item.status === 'live' ? '🔴 LIVE' : item.status === 'finished' ? '🏁 ЗАВЕРШЕН' : '🟢 ОЖИДАЕТСЯ'}
                        </Text>
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}

// ==================================================
// ЭКРАН: МАТЧ ВНЕ ТУРНИРА — ВЫБОР КЛУБА
// ==================================================
function StandaloneClubScreen({ onStart, onBack, onOpenSettings }) {
    const [search, setSearch] = useState('');
    const [clubs, setClubs] = useState<PublicClub[]>([]);
    const [loading, setLoading] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [manualName, setManualName] = useState('');
    const [manualLogoUri, setManualLogoUri] = useState<string | null>(null);
    const [opponent, setOpponent] = useState('Соперник');
    const [selectedClub, setSelectedClub] = useState<PublicClub | null>(null);

    const runSearch = async () => {
        if (!search.trim()) return;
        setLoading(true);
        try {
            setClubs(await searchPublicClubs(search));
            setManualMode(false);
            setSelectedClub(null);
        } catch (e) {
            Alert.alert('Ошибка', e instanceof Error ? e.message : 'Поиск не удался');
        } finally {
            setLoading(false);
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
            setManualLogoUri(result.assets[0].uri);
        }
    };

    const startFromClub = (club: PublicClub) => {
        const ctx: StandaloneMatchContext = {
            standalone: true,
            clubId: club.id,
            clubName: club.name,
            clubLogoUri: club.logo_url || '',
            teamHome: club.name,
            teamAway: opponent.trim() || 'Соперник',
        };
        onStart(ctx);
    };

    const startManual = () => {
        const name = manualName.trim();
        if (!name) {
            Alert.alert('Ошибка', 'Введите название клуба');
            return;
        }
        const ctx: StandaloneMatchContext = {
            standalone: true,
            clubName: name,
            clubLogoUri: manualLogoUri || '',
            teamHome: name,
            teamAway: opponent.trim() || 'Соперник',
        };
        onStart(ctx);
    };

    return (
        <SafeAreaView style={styles.listContainer}>
            <View style={styles.listHeader}>
                <TouchableOpacity onPress={onBack} style={styles.backBtnSmall}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>НАЗАД</Text>
                </TouchableOpacity>
                <Text style={styles.titleSmall}>ВНЕ ТУРНИРА</Text>
                <TouchableOpacity onPress={onOpenSettings}>
                    <Text style={{ color: '#4cd964', fontWeight: 'bold', fontSize: 12 }}>⚙</Text>
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <Text style={styles.subTitle}>Найдите клуб в системе WAAF</Text>
                <TextInput
                    style={styles.inputBig}
                    placeholder="Название клуба"
                    placeholderTextColor="#666"
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={runSearch}
                />
                <TouchableOpacity style={styles.btnPrimary} onPress={runSearch} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>НАЙТИ</Text>}
                </TouchableOpacity>

                {clubs.map((club) => (
                    <TouchableOpacity
                        key={club.id}
                        style={[styles.matchCard, selectedClub?.id === club.id && { borderColor: '#4cd964', borderWidth: 2 }]}
                        onPress={() => setSelectedClub(club)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {club.logo_url ? (
                                <Image source={{ uri: club.logo_url }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} />
                            ) : (
                                <View style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#333' }} />
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.teamTitle}>{club.name}</Text>
                                {club.city ? <Text style={{ color: '#888', fontSize: 12 }}>{club.city}</Text> : null}
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {selectedClub && (
                    <>
                        <Text style={[styles.subTitle, { marginTop: 16 }]}>Соперник (необязательно)</Text>
                        <TextInput
                            style={styles.inputBig}
                            placeholder="Соперник"
                            placeholderTextColor="#666"
                            value={opponent}
                            onChangeText={setOpponent}
                        />
                        <TouchableOpacity style={styles.btnPrimary} onPress={() => startFromClub(selectedClub)}>
                            <Text style={styles.btnText}>К СТРИМУ</Text>
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity onPress={() => setManualMode(!manualMode)} style={{ marginTop: 24 }}>
                    <Text style={{ color: '#888', textAlign: 'center' }}>
                        {manualMode ? '▲ Скрыть ручной ввод' : '▼ Моего клуба нет в списке'}
                    </Text>
                </TouchableOpacity>

                {manualMode && (
                    <View style={{ marginTop: 12 }}>
                        <TextInput
                            style={styles.inputBig}
                            placeholder="Название клуба"
                            placeholderTextColor="#666"
                            value={manualName}
                            onChangeText={setManualName}
                        />
                        <TextInput
                            style={styles.inputBig}
                            placeholder="Соперник"
                            placeholderTextColor="#666"
                            value={opponent}
                            onChangeText={setOpponent}
                        />
                        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#444' }]} onPress={pickLogo}>
                            <Text style={styles.btnText}>{manualLogoUri ? 'СМЕНИТЬ ЛОГО' : 'ДОБАВИТЬ ЛОГО'}</Text>
                        </TouchableOpacity>
                        {manualLogoUri ? (
                            <Image source={{ uri: manualLogoUri }} style={{ width: 72, height: 72, borderRadius: 36, alignSelf: 'center', marginVertical: 12 }} />
                        ) : null}
                        <TouchableOpacity style={styles.btnPrimary} onPress={startManual}>
                            <Text style={styles.btnText}>К СТРИМУ</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ==================================================
// ЭКРАН 3: ВВОД ПИН-КОДА
// ==================================================
function PinEntryScreen({ match, onSuccess, onBack }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (code.length < 4) return;
        setLoading(true);
        try {
            const deviceId = 'dev_' + Math.floor(Math.random() * 1000000);
            const res = await fetch(`${API_URL}/api/match/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.toUpperCase(), deviceId })
            });
            const data = await res.json();

            if (data.success) {
                if (Number(data.matchId) !== Number(match.id)) {
                    Alert.alert("Ошибка", "Код от другого матча!");
                } else {
                    const sessionToken = data.sessionToken || data.token || null;
                    onSuccess(match, code.toUpperCase(), sessionToken); 
                }
            } else {
                Alert.alert("Ошибка", "Неверный код");
            }
        } catch (e) {
            Alert.alert("Ошибка", "Нет связи");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.centerContainer}>
             <TouchableOpacity onPress={onBack} style={{position:'absolute', top:30, left:30, padding:10}}>
                <Text style={{color:'#e31e24', fontWeight:'bold'}}>НАЗАД</Text>
            </TouchableOpacity>
            
            <Text style={styles.title}>ШАГ 3: КОД ДОСТУПА</Text>
            <Text style={styles.subTitle}>{match.team_home} vs {match.team_away}</Text>
            
            <TextInput 
                style={styles.inputBig} 
                placeholder="PIN" 
                placeholderTextColor="#666" 
                autoCapitalize="characters"
                value={code}
                onChangeText={setCode}
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>ВОЙТИ В ПУЛЬТ</Text>}
            </TouchableOpacity>
        </View>
    );
}

// ==================================================
// ГЛАВНЫЙ КОМПОНЕНТ APP
// ==================================================
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('step1_tourn'); 
  const [foundMatches, setFoundMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchRoster, setMatchRoster] = useState([]); 
  const [allPlayers, setAllPlayers] = useState([]);  
  const [activeTournId, setActiveTournId] = useState(null);
  const [operatorToken, setOperatorToken] = useState<string | null>(null);
  const [pendingLinkToken, setPendingLinkToken] = useState('');
  const [settingsReturnScreen, setSettingsReturnScreen] = useState('step1_tourn');
  const [isStandaloneSession, setIsStandaloneSession] = useState(false);

  const openSettings = (returnTo = 'step1_tourn') => {
      setSettingsReturnScreen(returnTo);
      setCurrentScreen('settings');
  };

  useEffect(() => {
    fetchAllPlayers();

    const handleUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const token = parsed.queryParams?.token;
      if (token && !Array.isArray(token)) {
        setPendingLinkToken(String(token));
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const fetchAllPlayers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/players`);
      const data = await res.json();
      setAllPlayers(data);
    } catch (e) {}
  };

  const goToMatchList = (matches, tournId, token: string | null = null) => {
      setFoundMatches(matches);
      if (tournId) setActiveTournId(tournId);
      setOperatorToken(token);
      setCurrentScreen('step2_list');
  };

  const [matchAccessCode, setMatchAccessCode] = useState<string | null>(null);
  const [matchSessionToken, setMatchSessionToken] = useState<string | null>(null);

  const enterMatch = async (match, accessCode: string | null, sessionToken: string | null) => {
      if (accessCode) setMatchAccessCode(accessCode);
      if (sessionToken) setMatchSessionToken(sessionToken);
      try {
          const res = await fetch(`${API_URL}/api/match/${match.id}/roster`);
          const roster = await res.json();
          if (roster && roster.length > 0) {
              setMatchRoster(roster);
              setCurrentScreen('control');
          } else {
              setCurrentScreen('roster');
          }
      } catch (e) { Alert.alert("Ошибка протокола"); }
  };

  const goToPin = (match) => {
      setSelectedMatch(match);
      if (operatorToken) {
          enterMatch(match, null, null);
          return;
      }
      setCurrentScreen('step3_pin');
  };

  const goToGame = async (match, accessCode, sessionToken) => {
      setSelectedMatch(match);
      await enterMatch(match, accessCode, sessionToken);
  };

  const handleRosterSaved = (newRoster) => {
      setMatchRoster(newRoster);
      setCurrentScreen('control');
  };

  const handleBackToStart = () => {
      setCurrentScreen('step1_tourn');
      setSelectedMatch(null);
      setOperatorToken(null);
      setIsStandaloneSession(false);
  };

  const startStandaloneMatch = (ctx: StandaloneMatchContext) => {
      setSelectedMatch(buildStandaloneMatch(ctx));
      setMatchRoster([]);
      setIsStandaloneSession(true);
      setOperatorToken(null);
      setMatchAccessCode(null);
      setMatchSessionToken(null);
      setCurrentScreen('control');
  };

  const handleBackToSchedule = async () => {
      if (activeTournId) {
          try {
              const res = await fetch(`${API_URL}/api/tournaments/${activeTournId}/matches`);
              if (res.ok) {
                  const updatedMatches = await res.json();
                  setFoundMatches(updatedMatches);
              }
          } catch(e) {}
      }
      setCurrentScreen('step2_list');
      setSelectedMatch(null);
  };

  if (currentScreen === 'settings') {
      return <StreamSettingsScreen onClose={() => setCurrentScreen(settingsReturnScreen)} />;
  }
  if (currentScreen === 'step1_tourn') {
      return (
          <TournamentLoginScreen
              onNext={goToMatchList}
              onStandalone={() => setCurrentScreen('step_standalone_club')}
              onOpenSettings={() => openSettings('step1_tourn')}
              initialToken={pendingLinkToken}
              onBackToModules={() => router.replace('/')}
          />
      );
  }
  if (currentScreen === 'step_standalone_club') {
      return (
          <StandaloneClubScreen
              onStart={startStandaloneMatch}
              onBack={handleBackToStart}
              onOpenSettings={() => openSettings('step_standalone_club')}
          />
      );
  }
  if (currentScreen === 'step2_list') {
      return (
          <MatchSelectionScreen
              matches={foundMatches}
              onSelect={goToPin}
              onBack={handleBackToStart}
              tokenMode={!!operatorToken}
          />
      );
  }
  if (currentScreen === 'step3_pin') return <PinEntryScreen match={selectedMatch} onSuccess={goToGame} onBack={() => setCurrentScreen('step2_list')} />;
  if (currentScreen === 'roster') {
      return (
          <RosterEditScreen
              match={selectedMatch}
              allPlayers={allPlayers}
              onSave={handleRosterSaved}
              onBack={() => setCurrentScreen('step2_list')}
              accessCode={matchAccessCode}
              sessionToken={matchSessionToken}
              operatorToken={operatorToken}
          />
      );
  }
  
  if (currentScreen === 'control') {
      return (
          <MatchControlScreen
              match={selectedMatch}
              matchRoster={matchRoster}
              onBack={isStandaloneSession ? () => setCurrentScreen('step_standalone_club') : handleBackToSchedule}
              accessCode={matchAccessCode}
              sessionToken={matchSessionToken}
              operatorToken={operatorToken}
              onOpenSettings={() => openSettings('control')}
          />
      );
  }

  return null;
}

// ==================================================
// ROSTER EDIT SCREEN
// ==================================================
function RosterEditScreen({ match, allPlayers, onSave, onBack, accessCode = null, sessionToken = null, operatorToken = null }) {
    const [activeTab, setActiveTab] = useState('home');
    const [selectedPlayers, setSelectedPlayers] = useState({});
    const [saving, setSaving] = useState(false);
    const opAuth = { sessionToken, accessCode, operatorToken };

    const currentTeamName = activeTab === 'home' ? match.team_home : match.team_away;
    const normalize = (str) => str ? str.toString().trim().toLowerCase() : '';
    const teamPlayers = allPlayers.filter(p => p.club && normalize(p.club) === normalize(currentTeamName));

    const togglePlayer = (player) => {
        setSelectedPlayers(prev => {
            const newState = { ...prev };
            if (newState[player.id]) delete newState[player.id];
            else {
                const teamId = activeTab === 'home' ? (match.team_home_id) : (match.team_away_id);
                newState[player.id] = { player_id: player.id, team_id: teamId, number: player.number ? player.number.toString() : '', name: player.name };
            }
            return newState;
        });
    };

    const saveRoster = async () => {
        setSaving(true);
        const playersArray = Object.values(selectedPlayers).map(p => ({ player_id: p.player_id, team_id: p.team_id, number: parseInt(p.number) || 0 }));
        try {
            const res = await operatorFetch(`/api/match/${match.id}/roster`, opAuth, {
                method: 'POST', body: JSON.stringify({ players: playersArray }),
            });
            if (!res.ok) {
                Alert.alert("Ошибка", "Не удалось сохранить заявку");
                return;
            }
            const newRosterRes = await fetch(`${API_URL}/api/match/${match.id}/roster`);
            const newRoster = await newRosterRes.json();
            onSave(newRoster);
        } catch (e) { Alert.alert("Ошибка сохранения"); } finally { setSaving(false); }
    };

    return (
        <SafeAreaView style={styles.rosterContainer}>
            <View style={styles.rosterHeader}>
                <TouchableOpacity onPress={onBack}><Text style={styles.backText}>НАЗАД</Text></TouchableOpacity>
                <Text style={styles.rosterTitle}>ЗАЯВКА НА МАТЧ</Text>
                <View style={{width: 50}} />
            </View>
            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, activeTab === 'home' && styles.activeTab]} onPress={() => setActiveTab('home')}><Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>{match.team_home}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'away' && styles.activeTab]} onPress={() => setActiveTab('away')}><Text style={[styles.tabText, activeTab === 'away' && styles.activeTabText]}>{match.team_away}</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.playerList}>
                {teamPlayers.length === 0 && <Text style={styles.emptyText}>Игроки клуба «{currentTeamName}» не найдены</Text>}
                {teamPlayers.map(player => {
                    const isSelected = !!selectedPlayers[player.id];
                    return (
                        <TouchableOpacity key={player.id} style={[styles.rosterRow, isSelected && styles.rosterRowSelected]} onPress={() => togglePlayer(player)}>
                            <View style={styles.checkbox}>{isSelected && <View style={styles.checkboxInner} />}</View>
                            <Text style={styles.rosterName}>{player.name}</Text>
                            {isSelected && <TextInput style={styles.numberInput} keyboardType="numeric" value={selectedPlayers[player.id].number} onChangeText={(t) => setSelectedPlayers(p => ({...p, [player.id]: {...p[player.id], number: t}}))} placeholder="0"/>}
                        </TouchableOpacity>
                    );
                })}
                <View style={{height: 40}} />
            </ScrollView>
            <View style={styles.rosterFooter}>
                <TouchableOpacity style={styles.saveButton} onPress={saveRoster} disabled={saving}>{saving ? <ActivityIndicator color="white"/> : <Text style={styles.saveBtnText}>СОХРАНИТЬ</Text>}</TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// ==================================================
// MATCH CONTROL SCREEN (ГОЛЫ + АССИСТЕНТЫ + JAVA ЗВУК)
// ==================================================
function MatchControlScreen({ match, matchRoster, onBack, accessCode = null, sessionToken = null, operatorToken = null, onOpenSettings }) {
  const videoRef = useRef(null);
  const isStandalone = !!match.standalone;
  const opAuth = { sessionToken, accessCode, operatorToken };
  const opFetch = (path, options = {}) => operatorFetch(path, opAuth, options);
  const matchApi = (path: string, options = {}) => {
    if (!isStandalone && match.id) opFetch(path, options).catch(() => {});
  };
  
  // Состояния
  const [isStreaming, setIsStreaming] = useState(false); 
  const [isLoading, setIsLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isMuted, setIsMuted] = useState(false); 

  // Состояния игры
  const [score, setScore] = useState({ home: match.score_home || 0, away: match.score_away || 0 });
  const [fouls, setFouls] = useState({ home: 0, away: 0 });
  const [period, setPeriod] = useState(match.current_period || 0);

  // Серверные параметры таймера
  const [timerBase, setTimerBase] = useState<number>(0);
  const [timerUpdatedAt, setTimerUpdatedAt] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerDirection, setTimerDirection] = useState<string>('up');
  // Отображаемое значение (тикает локально по серверной формуле)
  const [displaySeconds, setDisplaySeconds] = useState<number>(0);

  // Константы
  const logoHome = match.logo_home; 
  const logoAway = match.logo_away;
  const sportType = match.sport_type || 'football'; 
  const halfDuration = match.half_duration || 45;
  
  // Стриминг: standalone всегда; турнир — allow_stream или operator token
  const canStream = isStandalone || match.allow_stream === 1 || match.allow_stream === true || !!operatorToken;

  useEffect(() => {
    const requestPermissions = async () => {
        if (Platform.OS === 'android' && canStream) {
            try {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                ]);
                if (granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
                    granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED) {
                    setPermissionGranted(true);
                }
            } catch (err) { console.warn(err); }
        }
    };
    requestPermissions();
  }, [canStream]);

  // Загрузка настроек ничьей из конфига турнира
  const [drawEt, setDrawEt] = useState(false);
  const [drawPen, setDrawPen] = useState(false);
  const [penWinPts, setPenWinPts] = useState(2);
  const [penLossPts, setPenLossPts] = useState(1);
  const [penScore, setPenScore] = useState({ home: 0, away: 0 });

  useEffect(() => {
    if (isStandalone) return;
    const tid = match.tournament_id;
    if (!tid) return;
    fetch(`${API_URL}/api/tournaments/${tid}`)
      .then(r => r.json())
      .then(tourData => {
        let cfg: any = {};
        if (tourData.structure_config) {
          cfg = typeof tourData.structure_config === 'string' ? JSON.parse(tourData.structure_config) : tourData.structure_config;
        } else if (tourData.playoff_config) {
          cfg = typeof tourData.playoff_config === 'string' ? JSON.parse(tourData.playoff_config) : tourData.playoff_config;
        }
        const matchStage = match.stage || '';
        const matchRound = match.round || '';
        const isPlayoffMatch = match.type === 'playoff' || match.type === 'final' ||
          /стык|1\/4|1\/2|финал|3-е|плей-офф/i.test(matchRound + ' ' + matchStage);

        if (isPlayoffMatch && cfg.divisions) {
          let foundEt = false, foundPen = false;
          cfg.divisions.forEach((div: any) => {
            (div.cups || []).forEach((cup: any) => {
              if (cup.format === 'playoff') {
                const matchStageLower = matchStage.toLowerCase();
                if (matchStageLower.includes((div.name || '').toLowerCase()) || matchStageLower.includes((cup.name || '').toLowerCase())) {
                  if (cup.draw_et) foundEt = true;
                  if (cup.draw_pen) foundPen = true;
                }
              }
            });
          });
          setDrawEt(foundEt);
          setDrawPen(foundPen || !foundEt);
          setPenWinPts(0);
          setPenLossPts(0);
        } else {
          setDrawEt(!!cfg.p1_draw_et);
          setDrawPen(!!cfg.p1_draw_pen);
          setPenWinPts(cfg.p1_pen_win_pts ?? 2);
          setPenLossPts(cfg.p1_pen_loss_pts ?? 1);
        }
      })
      .catch(() => {});
  }, [match.id, match.tournament_id, isStandalone]);

  // Синхронизация таймера с сервером при входе в экран
  useEffect(() => {
    if (isStandalone || !match.id) return;
    fetch(`${API_URL}/api/match/${match.id}/timer/sync`)
      .then(r => r.json())
      .then(sync => {
        if (sync && !sync.error) {
          if (sync.timer_base_seconds !== undefined) setTimerBase(Number(sync.timer_base_seconds));
          if (sync.timer_updated_at !== undefined)   setTimerUpdatedAt(sync.timer_updated_at ? Number(sync.timer_updated_at) : null);
          if (sync.is_timer_running !== undefined)   setIsTimerRunning(!!sync.is_timer_running);
          if (sync.timer_direction !== undefined)    setTimerDirection(sync.timer_direction || 'up');
          if (sync.current_period !== undefined)     setPeriod(sync.current_period);
          if (sync.actual_seconds !== undefined)     setDisplaySeconds(sync.actual_seconds);
        }
      })
      .catch(() => {});
  }, [match.id, isStandalone]);

  // Локальный визуальный тик — пересчитывает время каждую секунду по серверной формуле
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplaySeconds(getActualSeconds(timerBase, timerUpdatedAt, isTimerRunning, timerDirection));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerBase, timerUpdatedAt, isTimerRunning, timerDirection]);

  useEffect(() => {
      return () => {
          if (AudioHelper && canStream) {
              AudioHelper.setMicrophoneMute(false);
          }
      };
  }, [canStream]);

  const audioConfig = useMemo(() => ({
      bitrate: 128 * 1000,
      sampleRate: 44100,
      isStereo: true,
  }), []); 

  const videoConfig = useMemo(() => ({
      fps: 30,
      resolution: '720p',
      bitrate: 2000 * 1000,
      gopDuration: 1 
  }), []);

  // Получает актуальное время для записи в событие (то, что видит зритель)
  const getCurrentDisplaySeconds = () => {
    return getActualSeconds(timerBase, timerUpdatedAt, isTimerRunning, timerDirection);
  };

  const sendUpdate = (updates: any = {}, eventType: string | null = null, playerId: any = null, teamId: any = null, isHighlight = false, assistantId: any = null) => {
      if (updates.period !== undefined) setPeriod(updates.period);
      if (updates.score_home !== undefined) setScore((s) => ({ ...s, home: updates.score_home }));
      if (updates.score_away !== undefined) setScore((s) => ({ ...s, away: updates.score_away }));
      if (isStandalone) return;

      const currentSec = getCurrentDisplaySeconds();
      const payload: any = {
          score_home: updates.score_home !== undefined ? updates.score_home : score.home,
          score_away: updates.score_away !== undefined ? updates.score_away : score.away,
          status: updates.status || (isStreaming ? 'live' : 'scheduled'), 
          current_period: updates.period !== undefined ? updates.period : period,
          timer_seconds: currentSec,
          is_paused: !isTimerRunning,
          event_type: eventType, 
          player_id: playerId, 
          team_id: teamId,
          assistant_id: assistantId, 
          sport_type: sportType, 
          half_duration: halfDuration,
          is_highlight: isHighlight 
      };

      // 🔥 НОВЫЕ ПОЛЯ: ДОП. ВРЕМЯ И ПЕНАЛЬТИ
      if (updates.score_home_et !== undefined) payload.score_home_et = updates.score_home_et;
      if (updates.score_away_et !== undefined) payload.score_away_et = updates.score_away_et;
      if (updates.score_home_pen !== undefined) payload.score_home_pen = updates.score_home_pen;
      if (updates.score_away_pen !== undefined) payload.score_away_pen = updates.score_away_pen;
      if (updates.finish_type !== undefined) payload.finish_type = updates.finish_type;
      if (updates.winner_team_id !== undefined) payload.winner_team_id = updates.winner_team_id;
      
      // 🔥 Авторизация пульта: access_code (PIN-режим)
      if (accessCode) payload.access_code = accessCode;
      if (operatorToken) payload.operator_token = operatorToken;

      matchApi(`/api/match/${match.id}/update`, {
          method: 'POST', 
          body: JSON.stringify(payload) 
      });
  };

  const handleToggleStream = async () => {
    if (!permissionGranted) {
        Alert.alert("Нет доступа", "Нужны права на камеру и микрофон");
        return;
    }
    if (isLoading) return;
    setIsLoading(true);

    if (isStreaming) {
        try {
            await videoRef.current?.stopStreaming();
            setIsStreaming(false);
            sendUpdate({ status: 'scheduled' });
            Alert.alert("Эфир остановлен");
        } catch (e: any) {
            Alert.alert("Ошибка остановки", e.message);
        } finally { setIsLoading(false); }
    } else {
        try {
            const settings = await loadStreamSettings();
            const rtmp = getActiveRtmpConfig(settings);
            if (!rtmp) {
                Alert.alert(
                    "Настройте трансляцию",
                    "Укажите платформу и RTMP URL + ключ в настройках",
                    [{ text: "Открыть настройки", onPress: onOpenSettings }, { text: "OK" }]
                );
                return;
            }
            await videoRef.current?.startStreaming(rtmp.streamKey, rtmp.rtmpUrl);
            setIsStreaming(true);
            sendUpdate({ status: 'live' });

            if (!isStandalone && rtmp.platform === 'vk' && settings.vk.embedUrl?.trim()) {
                matchApi(`/api/match/${match.id}/stream-config`, {
                    method: 'POST',
                    body: JSON.stringify({
                        vk_stream_url: settings.vk.embedUrl.trim(),
                        match_stream_key: settings.vk.streamKey.trim(),
                    }),
                }).catch(() => {});
            }

            if (AudioHelper) AudioHelper.setMicrophoneMute(isMuted);
        } catch (e: any) {
            console.error(e);
            setIsStreaming(false);
            Alert.alert("Ошибка запуска", "Не удалось начать стрим. Проверьте URL и ключ.");
        } finally { setIsLoading(false); }
    }
  };

  const toggleMic = () => {
      const newState = !isMuted;
      setIsMuted(newState);
      if (AudioHelper) {
          AudioHelper.setMicrophoneMute(newState); 
      }
  };

  const handleTimerAction = (action: string) => {
      if (action === 'start_h1') {
          // Для 'down' (футзал) стартуем с длительности тайма, для 'up' — с 0
          const direction = sportType === 'futsal' ? 'down' : 'up';
          const startBase = sportType === 'futsal' ? halfDuration * 60 : 0;
          const now = Date.now();
          // Обновляем локальное состояние немедленно
          setTimerBase(startBase);
          setTimerUpdatedAt(now);
          setIsTimerRunning(true);
          setTimerDirection(direction);
          setPeriod(1);
          setDisplaySeconds(startBase);
          // Отправляем на сервер
          matchApi(`/api/match/${match.id}/timer/start`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period: 1, timer_base_seconds: startBase, timer_direction: direction })
          });
          sendUpdate({ period: 1 }, 'start_match');
      }
      else if (action === 'pause') {
          const pausedBase = getCurrentDisplaySeconds();
          setTimerBase(pausedBase);
          setTimerUpdatedAt(null);
          setIsTimerRunning(false);
          setDisplaySeconds(pausedBase);
          matchApi(`/api/match/${match.id}/timer/pause`, { method: 'POST' });
          sendUpdate({});
      }
      else if (action === 'resume') {
          const now = Date.now();
          setTimerUpdatedAt(now);
          setIsTimerRunning(true);
          matchApi(`/api/match/${match.id}/timer/start`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period, timer_base_seconds: timerBase, timer_direction: timerDirection })
          });
          sendUpdate({});
      }
      else if (action === 'end_h1') {
          const pausedBase = getCurrentDisplaySeconds();
          setTimerBase(pausedBase);
          setTimerUpdatedAt(null);
          setIsTimerRunning(false);
          setDisplaySeconds(pausedBase);
          setPeriod(2);
          matchApi(`/api/match/${match.id}/timer/pause`, { method: 'POST' });
          sendUpdate({ period: 2 }, 'end_h1');
      }
      else if (action === 'start_h2') {
          // Для 2-го тайма: 'up' продолжает с текущего, 'down' сбрасывается на длительность тайма
          const direction = sportType === 'futsal' ? 'down' : 'up';
          const startBase = sportType === 'futsal' ? halfDuration * 60 : timerBase;
          const now = Date.now();
          setTimerBase(startBase);
          setTimerUpdatedAt(now);
          setIsTimerRunning(true);
          setTimerDirection(direction);
          setPeriod(3);
          setDisplaySeconds(startBase);
          matchApi(`/api/match/${match.id}/timer/start`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period: 3, timer_base_seconds: startBase, timer_direction: direction })
          });
          sendUpdate({ period: 3 }, 'start_h2');
      }
      else if (action === 'end_h2') {
          const pausedBase = getCurrentDisplaySeconds();
          setTimerBase(pausedBase);
          setTimerUpdatedAt(null);
          setIsTimerRunning(false);
          setDisplaySeconds(pausedBase);
          matchApi(`/api/match/${match.id}/timer/pause`, { method: 'POST' });
          // Проверяем ничью
          const isDraw = score.home === score.away;
          if (isDraw && (drawEt || drawPen)) {
              setPeriod(4); // перерыв перед ДВ/пенальти
              sendUpdate({ period: 4 }, 'end_h2');
              Alert.alert('Ничья!', drawEt ? 'Начинается доп. время' : 'Начинается серия пенальти');
          } else {
              setPeriod(8);
              if (isStreaming) { videoRef.current?.stopStreaming(); setIsStreaming(false); }
              sendUpdate({ period: 8, status: 'finished' }, 'end_match');
              Alert.alert('Матч завершён!');
          }
      }
      else if (action === 'end_match') {
          const pausedBase = getCurrentDisplaySeconds();
          setTimerBase(pausedBase);
          setTimerUpdatedAt(null);
          setIsTimerRunning(false);
          setDisplaySeconds(pausedBase);
          matchApi(`/api/match/${match.id}/timer/pause`, { method: 'POST' });

          const isDraw = score.home === score.away;
          const isGroupStage = period <= 3;
          if (isDraw && isGroupStage && (drawEt || drawPen)) {
              setPeriod(4);
              sendUpdate({ period: 4 }, 'end_match');
              Alert.alert('Ничья!', drawEt ? 'Начинается доп. время' : 'Начинается серия пенальти');
          } else {
              setPeriod(8);
              if (isStreaming) { videoRef.current?.stopStreaming(); setIsStreaming(false); }
              sendUpdate({ period: 8, status: 'finished' }, 'end_match');
              Alert.alert("Матч завершен");
          }
      }
      else if (action === 'start_et1') {
          const direction = sportType === 'futsal' ? 'down' : 'up';
          const etDuration = Math.round(halfDuration / 2);
          const startBase = sportType === 'futsal' ? etDuration * 60 : 0;
          const now = Date.now();
          setTimerBase(startBase);
          setTimerUpdatedAt(now);
          setIsTimerRunning(true);
          setTimerDirection(direction);
          setPeriod(5);
          setDisplaySeconds(startBase);
          matchApi(`/api/match/${match.id}/timer/start`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period: 5, timer_base_seconds: startBase, timer_direction: direction })
          });
          sendUpdate({ period: 5 }, 'start_et1');
      }
      else if (action === 'end_et1') {
          const pausedBase = getCurrentDisplaySeconds();
          setTimerBase(pausedBase);
          setTimerUpdatedAt(null);
          setIsTimerRunning(false);
          setDisplaySeconds(pausedBase);
          setPeriod(6);
          matchApi(`/api/match/${match.id}/timer/pause`, { method: 'POST' });
          sendUpdate({ period: 6 }, 'end_et1');
          // Автоматически запускаем ДВ2
          setTimeout(() => handleTimerAction('start_et2'), 1500);
      }
      else if (action === 'start_et2') {
          const direction = sportType === 'futsal' ? 'down' : 'up';
          const etDuration = Math.round(halfDuration / 2);
          const startBase = sportType === 'futsal' ? etDuration * 60 : 0;
          const now = Date.now();
          setTimerBase(startBase);
          setTimerUpdatedAt(now);
          setIsTimerRunning(true);
          setTimerDirection(direction);
          setPeriod(6);
          setDisplaySeconds(startBase);
          matchApi(`/api/match/${match.id}/timer/start`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period: 6, timer_base_seconds: startBase, timer_direction: direction })
          });
          sendUpdate({ period: 6 }, 'start_et2');
      }
      else if (action === 'end_et2') {
          const pausedBase = getCurrentDisplaySeconds();
          setTimerBase(pausedBase);
          setTimerUpdatedAt(null);
          setIsTimerRunning(false);
          setDisplaySeconds(pausedBase);
          matchApi(`/api/match/${match.id}/timer/pause`, { method: 'POST' });
          const isDraw = score.home === score.away;
          if (isDraw && drawPen) {
              setPeriod(7);
              setPenScore({ home: 0, away: 0 });
              sendUpdate({ period: 7 }, 'start_penalties');
              Alert.alert('Ничья в ДВ!', 'Начинается серия пенальти');
          } else {
              setPeriod(8);
              if (isStreaming) { videoRef.current?.stopStreaming(); setIsStreaming(false); }
              sendUpdate({ period: 8, status: 'finished' }, 'end_match');
              Alert.alert('Матч завершён!');
          }
      }
      else if (action === 'start_pen') {
          setPeriod(7);
          setPenScore({ home: 0, away: 0 });
          sendUpdate({ period: 7 }, 'start_penalties');
          Alert.alert('Серия пенальти началась!');
      }
  };

  // 🔥 ИСПРАВЛЕНО: Рабочая функция отмены
  const handleUndo = () => {
      if (isStandalone) {
          Alert.alert('Локальный режим', 'Отмена событий доступна только в турнире на платформе');
          return;
      }
      Alert.alert(
          "Отмена действия",
          "Отменить последнее событие (гол или карточку)?",
          [
              { text: "Нет", style: "cancel" },
              { text: "Да", onPress: async () => {
                  try {
                      setIsLoading(true);
                      const res = await opFetch(`/api/match/${match.id}/undo`, { method: 'POST' });
                      const data = await res.json();
                      
                      if (data.success) {
                          // Скачиваем актуальный счет с бэкенда
                          const matchRes = await fetch(`${API_URL}/api/match/${match.id}`);
                          if (matchRes.ok) {
                              const matchData = await matchRes.json();
                              setScore({ home: matchData.score_home || 0, away: matchData.score_away || 0 });
                          }
                          Alert.alert("Успешно", "Последнее действие отменено");
                      } else {
                          Alert.alert("Ошибка", data.message || "Нечего отменять");
                      }
                  } catch (e) {
                      Alert.alert("Ошибка", "Сбой сети");
                  } finally {
                      setIsLoading(false);
                  }
              }}
          ]
      );
  };
  
  const [modalVisible, setModalVisible] = useState(false);
  const [eventStep, setEventStep] = useState(1);
  const [activeSide, setActiveSide] = useState(null);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [tempScorer, setTempScorer] = useState(null); 
  
  const openEventMenu = (side: string) => { 
      if (displaySeconds === 0 && period === 0) {
          Alert.alert("Внимание", "Матч еще не начат (00:00).", [
              { text: "Отмена", style: 'cancel' },
              { text: "Всё равно", onPress: () => { setActiveSide(side); setEventStep(1); setModalVisible(true); } }
          ]);
          return;
      }
      setActiveSide(side); setEventStep(1); setModalVisible(true); 
  };
  
  const selectEventType = (type) => { 
      setSelectedEventType(type); 
      if (type === 'foul') { handleFoul(activeSide); setModalVisible(false); return; } 
      
      let targetTeamId = (activeSide === 'home' ? match.team_home_id : match.team_away_id); 
      const players = matchRoster.filter(p => Number(p.team_id) === Number(targetTeamId)); 
      
      setFilteredPlayers(players); 
      setEventStep(2); 
  };
  
  const handleFoul = (side) => { 
      let newFouls = {...fouls}; 
      if(side === 'home') newFouls.home++; else newFouls.away++; 
      setFouls(newFouls); 
  };

  const handlePlayerSelect = (player) => {
      if (selectedEventType === 'goal') {
          // 🔥 ЕСЛИ ВЫБРАНА КОМАНДА (id === null), СРАЗУ СОХРАНЯЕМ БЕЗ АССИСТЕНТА
          if (player.id === null) {
              confirmEvent(player, null);
          } else {
              setTempScorer(player); 
              const assistants = filteredPlayers.filter(p => p.id !== player.id);
              setFilteredPlayers(assistants);
              setEventStep(3); 
          }
      } else {
          confirmEvent(player, null);
      }
  };
  
  const confirmEvent = (player, assistant) => { 
      setModalVisible(false);
      const teamId = player.team_id;
      let newHomeScore = score.home; 
      let newAwayScore = score.away;
      
      if (selectedEventType === 'goal' || selectedEventType === 'penalty') { 
          if (activeSide === 'home') newHomeScore++; else newAwayScore++; 
      } else if (selectedEventType === 'own_goal') { 
          if (activeSide === 'home') newAwayScore++; else newHomeScore++; 
      }
      setScore({ home: newHomeScore, away: newAwayScore });
      
      const isHighlight = ['goal', 'penalty', 'own_goal', 'red_card', 'second_yellow_card'].includes(selectedEventType);
      const updates = { score_home: newHomeScore, score_away: newAwayScore };
      
      const assistantId = assistant ? assistant.id : null; 

      if (['goal', 'penalty', 'own_goal'].includes(selectedEventType)) { 
          sendUpdate(updates, selectedEventType, player.id, teamId, isHighlight, assistantId); 
      } else { 
          sendUpdate({}, selectedEventType, player.id, teamId, isHighlight, assistantId); 
          if (selectedEventType === 'second_yellow_card') Alert.alert("Удаление"); 
      }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={StyleSheet.absoluteFill}>
          {/* 🔥 ИСПРАВЛЕНО: Глубокий черный экран для экономии батареи, если стрим выключен */}
          {canStream ? (
            <ApiVideoLiveStreamView 
                ref={videoRef}
                style={{ flex: 1 }}
                camera="back"
                video={videoConfig} 
                audio={audioConfig}
                isZoomEnabled={true}
                onConnectionSuccess={() => { setIsLoading(false); setIsStreaming(true); sendUpdate({ status: 'live' }); Alert.alert("Успех", "Вы в эфире!"); }}
                onConnectionFailed={(e) => { setIsLoading(false); setIsStreaming(false); Alert.alert("Ошибка подключения", "Код: " + e); }}
                onDisconnect={() => { setIsStreaming(false); setIsLoading(false); }}
            />
          ) : ( 
            <View style={{flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center'}}>
                 <Text style={{color: '#333333', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase'}}>Эфир отключен организатором</Text>
            </View> 
          )}
      </View>
      <SafeAreaView style={styles.overlay}>
        
      <View style={styles.header}>
            <TouchableOpacity onPress={() => { if(isStreaming) { videoRef.current?.stopStreaming(); setIsStreaming(false); } onBack(); }} style={styles.backButton}><Text style={styles.backText}>К РАСПИСАНИЮ</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleUndo} style={styles.undoButton}><Text style={styles.undoText}>↩ ОТМЕНА</Text></TouchableOpacity>
            <View style={styles.timerBox}><Text style={styles.timerText}>{formatTimer(displaySeconds)}</Text><Text style={styles.periodText}>{period === 0 ? 'Разминка' : period === 1 ? '1-й Тайм' : period === 2 ? 'Перерыв' : period === 3 ? '2-й Тайм' : period === 4 ? 'Перерыв (ДВ)' : period === 5 ? 'Доп. время 1' : period === 6 ? 'Доп. время 2' : period === 7 ? '⚽ Пенальти' : 'Завершён'}</Text></View>
            <View style={styles.headerInfo}><Text style={styles.matchTitle}>{match.team_home} vs {match.team_away}</Text></View>
        </View>

        <View style={styles.scoreboard}>
            <View style={styles.teamControl}>
                <TouchableOpacity style={[styles.btnAction, {borderColor: '#e31e24'}]} onPress={() => openEventMenu('home')}>{logoHome ? <Image source={{ uri: logoHome.startsWith('http') ? logoHome : `${API_URL}${logoHome}` }} style={{width: 60, height: 60, resizeMode: 'contain'}} /> : <Text style={styles.btnActionText}>⚡</Text>}</TouchableOpacity>
                <Text style={styles.scoreText}>{score.home}</Text><Text style={styles.teamName}>{match.team_home}</Text>{sportType === 'futsal' && <Text style={styles.foulText}>Фолы: {fouls.home}</Text>}
            </View>
            <Text style={styles.vs}>:</Text>
            <View style={styles.teamControl}>
                <TouchableOpacity style={[styles.btnAction, {borderColor: '#1a4384'}]} onPress={() => openEventMenu('away')}>{logoAway ? <Image source={{ uri: logoAway.startsWith('http') ? logoAway : `${API_URL}${logoAway}` }} style={{width: 60, height: 60, resizeMode: 'contain'}} /> : <Text style={styles.btnActionText}>⚡</Text>}</TouchableOpacity>
                <Text style={styles.scoreText}>{score.away}</Text><Text style={styles.teamName}>{match.team_away}</Text>{sportType === 'futsal' && <Text style={styles.foulText}>Фолы: {fouls.away}</Text>}
            </View>
        </View>

        <View style={styles.footer}>
         {period === 0 && <TouchableOpacity style={styles.btnStart} onPress={() => handleTimerAction('start_h1')}><Text style={styles.btnStartText}>НАЧАТЬ 1-Й ТАЙМ</Text></TouchableOpacity>}
            {(period === 1 || period === 3) && isTimerRunning && <TouchableOpacity style={styles.btnPause} onPress={() => handleTimerAction('pause')}><Text style={styles.btnPauseText}>⏸ ПАУЗА</Text></TouchableOpacity>}
            {(period === 1 || period === 3) && !isTimerRunning && (<View style={{flexDirection: 'row', gap: 20}}><TouchableOpacity style={styles.btnResume} onPress={() => handleTimerAction('resume')}><Text style={styles.btnResumeText}>▶ ИГРАТЬ</Text></TouchableOpacity><TouchableOpacity style={styles.btnEndPeriod} onPress={() => handleTimerAction(period === 1 ? 'end_h1' : 'end_match')}><Text style={styles.btnEndPeriodText}>{period === 1 ? 'ЗАКОНЧИТЬ ТАЙМ' : 'ЗАКОНЧИТЬ МАТЧ'}</Text></TouchableOpacity></View>)}
            {period === 2 && <TouchableOpacity style={styles.btnStart} onPress={() => handleTimerAction('start_h2')}><Text style={styles.btnStartText}>НАЧАТЬ 2-Й ТАЙМ</Text></TouchableOpacity>}
            
            {/* Перерыв перед ДВ или пенальти */}
            {period === 4 && (
                <View style={{flexDirection:'row', gap:12, alignItems:'center', flexWrap:'wrap', justifyContent:'center'}}>
                    {drawEt && (
                        <TouchableOpacity style={[styles.btnStart, {backgroundColor:'#1a4384', paddingHorizontal:20}]} onPress={() => handleTimerAction('start_et1')}>
                            <Text style={styles.btnStartText}>▶ ДОП. ВРЕМЯ</Text>
                        </TouchableOpacity>
                    )}
                    {drawPen && !drawEt && (
                        <TouchableOpacity style={[styles.btnStart, {backgroundColor:'#e31e24', paddingHorizontal:20}]} onPress={() => handleTimerAction('start_pen')}>
                            <Text style={styles.btnStartText}>⚽ ПЕНАЛЬТИ</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.btnStart, {backgroundColor:'#555', paddingHorizontal:20}]} onPress={() => handleTimerAction('end_match')}>
                        <Text style={styles.btnStartText}>🏁 ЗАВЕРШИТЬ</Text>
                    </TouchableOpacity>
                </View>
            )}
            {/* Доп. время 1 */}
            {period === 5 && isTimerRunning && (
                <TouchableOpacity style={styles.btnPause} onPress={() => handleTimerAction('pause')}>
                    <Text style={styles.btnPauseText}>⏸ ПАУЗА (ДВ1)</Text>
                </TouchableOpacity>
            )}
            {period === 5 && !isTimerRunning && (
                <View style={{flexDirection:'row', gap:12}}>
                    <TouchableOpacity style={styles.btnResume} onPress={() => handleTimerAction('resume')}>
                        <Text style={styles.btnResumeText}>▶ ИГРАТЬ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnEndPeriod} onPress={() => handleTimerAction('end_et1')}>
                        <Text style={styles.btnEndPeriodText}>КОНЕЦ ДВ1</Text>
                    </TouchableOpacity>
                </View>
            )}
            {/* Доп. время 2 */}
            {period === 6 && isTimerRunning && (
                <TouchableOpacity style={styles.btnPause} onPress={() => handleTimerAction('pause')}>
                    <Text style={styles.btnPauseText}>⏸ ПАУЗА (ДВ2)</Text>
                </TouchableOpacity>
            )}
            {period === 6 && !isTimerRunning && (
                <View style={{flexDirection:'row', gap:12}}>
                    <TouchableOpacity style={styles.btnResume} onPress={() => handleTimerAction('resume')}>
                        <Text style={styles.btnResumeText}>▶ ИГРАТЬ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnEndPeriod} onPress={() => handleTimerAction('end_et2')}>
                        <Text style={styles.btnEndPeriodText}>КОНЕЦ ДВ2</Text>
                    </TouchableOpacity>
                </View>
            )}
            {/* Серия пенальти */}
            {period === 7 && (
                <View style={{flexDirection:'row', gap:10, alignItems:'center', flexWrap:'wrap', justifyContent:'center'}}>
                    <Text style={{color:'#aaa', fontSize:13, fontWeight:'bold'}}>Пен: {penScore.home} : {penScore.away}</Text>
                    <TouchableOpacity style={[styles.btnStart, {backgroundColor:'#e31e24', paddingHorizontal:16, paddingVertical:10}]}
                        onPress={() => { const ns = {...penScore, home: penScore.home+1}; setPenScore(ns); sendUpdate({}, 'penalty_shootout', null, match.team_home_id, false); }}>
                        <Text style={[styles.btnStartText, {fontSize:13}]}>+1 {match.team_home}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnStart, {backgroundColor:'#1a4384', paddingHorizontal:16, paddingVertical:10}]}
                        onPress={() => { const ns = {...penScore, away: penScore.away+1}; setPenScore(ns); sendUpdate({}, 'penalty_shootout', null, match.team_away_id, false); }}>
                        <Text style={[styles.btnStartText, {fontSize:13}]}>+1 {match.team_away}</Text>
                    </TouchableOpacity>
                    {/* 🔥 ЗАВЕРШИТЬ С СОХРАНЕНИЕМ СЧЁТА ПЕНАЛЬТИ */}
                    <TouchableOpacity style={[styles.btnEndPeriod, {paddingHorizontal:16, paddingVertical:10}]} onPress={() => {
                        const winnerId = penScore.home > penScore.away ? match.team_home_id : penScore.away > penScore.home ? match.team_away_id : null;
                        setTimerBase(getCurrentDisplaySeconds());
                        setTimerUpdatedAt(null);
                        setIsTimerRunning(false);
                        setPeriod(8);
                        matchApi(`/api/match/${match.id}/timer/pause`, { method: 'POST' });
                        if (isStreaming) { videoRef.current?.stopStreaming(); setIsStreaming(false); }
                        sendUpdate({
                            period: 8,
                            status: 'finished',
                            score_home_pen: penScore.home,
                            score_away_pen: penScore.away,
                            finish_type: 'penalties',
                            winner_team_id: winnerId
                        }, 'end_match');
                        Alert.alert('Матч завершён!', `Победа по пенальти: ${penScore.home}:${penScore.away}`);
                    }}>
                        <Text style={[styles.btnEndPeriodText, {fontSize:13}]}>🏁 ЗАВЕРШИТЬ</Text>
                    </TouchableOpacity>
                </View>
            )}
            {/* Матч завершён */}
            {period === 8 && (
                <View style={{flexDirection:'row', gap:20, alignItems:'center'}}>
                    <View style={styles.btnFinished}><Text style={styles.btnStartText}>МАТЧ ЗАВЕРШЕН</Text></View>
                    <TouchableOpacity style={[styles.btnStart, {backgroundColor: '#333', borderColor: 'white', borderWidth:1}]} onPress={onBack}>
                        <Text style={styles.btnStartText}>К РАСПИСАНИЮ 📅</Text>
                    </TouchableOpacity>
                </View>
            )}

            {period !== 4 && (
                <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 10, gap: 10}}>
                    <TouchableOpacity style={styles.btnMicSettings} onPress={onOpenSettings}>
                        <Text style={styles.btnMicText}>⚙</Text>
                    </TouchableOpacity>
                    {canStream && (
                    <>
                    <TouchableOpacity style={[styles.btnMic, isMuted && styles.btnMicOff]} onPress={toggleMic}>
                        <Text style={styles.btnMicText}>{isMuted ? "🔇" : "🎙️"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnStream, isStreaming && styles.btnStreamActive, isLoading && { opacity: 0.5 }]} onPress={handleToggleStream} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="white"/> : <Text style={styles.btnStreamText}>{isStreaming ? "СТОП" : "ЭФИР"}</Text>}
                    </TouchableOpacity>
                    </>
                    )}
                </View>
            )}
        </View>
        
        {/* МОДАЛКА (без изменений) */}
        <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
            <View style={styles.modalCenter}><View style={styles.modalContent}>
              {eventStep === 1 && (<><Text style={styles.modalTitle}>ВЫБЕРИТЕ СОБЫТИЕ</Text><View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center', gap: 10}}><TouchableOpacity style={[styles.eventBtn, {backgroundColor: '#e31e24'}]} onPress={() => selectEventType('goal')}><Text style={styles.eventBtnIcon}>⚽</Text><Text style={styles.eventBtnText}>ГОЛ</Text></TouchableOpacity><TouchableOpacity style={[styles.eventBtn, {backgroundColor: '#ffcc00'}]} onPress={() => selectEventType('yellow_card')}><Text style={styles.eventBtnIcon}>🟨</Text><Text style={styles.eventBtnText}>ЖК</Text></TouchableOpacity><TouchableOpacity style={[styles.eventBtn, {backgroundColor: '#cc0000'}]} onPress={() => selectEventType('red_card')}><Text style={styles.eventBtnIcon}>🟥</Text><Text style={styles.eventBtnText}>КК</Text></TouchableOpacity>{sportType === 'futsal' && <TouchableOpacity style={[styles.eventBtn, {backgroundColor: '#555'}]} onPress={() => selectEventType('foul')}><Text style={styles.eventBtnIcon}>✖</Text><Text style={styles.eventBtnText}>ФОЛ</Text></TouchableOpacity>}</View><View style={{marginTop: 20, width: '100%'}}><TouchableOpacity style={[styles.modalListBtn, {backgroundColor: '#333'}]} onPress={() => selectEventType('penalty')}><Text style={styles.modalListBtnText}>🥅 Пенальти</Text></TouchableOpacity><TouchableOpacity style={[styles.modalListBtn, {backgroundColor: '#333', marginTop: 10}]} onPress={() => selectEventType('own_goal')}><Text style={styles.modalListBtnText}>🤦 Автогол</Text></TouchableOpacity>{selectedEventType === 'yellow_card' && <TouchableOpacity style={[styles.modalListBtn, {backgroundColor: '#cc0000', marginTop: 10}]} onPress={() => selectEventType('second_yellow_card')}><Text style={styles.modalListBtnText}>🟥 2-я Желтая (КК)</Text></TouchableOpacity>}</View><TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}><Text style={{color: 'gray'}}>Отмена</Text></TouchableOpacity></>)}
              {eventStep === 2 && (
                <>
                  <Text style={styles.modalTitle}>КТО?</Text>
                  
                  {/* 🔥 НОВАЯ КНОПКА: ЗАПИСАТЬ СОБЫТИЕ НА КОМАНДУ (стили исправлены) */}
                  <TouchableOpacity 
                      style={[styles.modalListBtn, {backgroundColor: '#1a4384', marginBottom: 15}]} 
                      onPress={() => {
                          const targetTeamId = activeSide === 'home' ? match.team_home_id : match.team_away_id;
                          // Передаем id: null, чтобы бэкенд понял, что это гол абстрактной команды
                          handlePlayerSelect({ id: null, team_id: targetTeamId });
                      }}
                  >
                      <Text style={styles.modalListBtnText}>🎯 ЗАПИСАТЬ НА КОМАНДУ</Text>
                  </TouchableOpacity>

                  <FlatList 
                      data={filteredPlayers} 
                      keyExtractor={item => item.id ? item.id.toString() : Math.random().toString()} 
                      style={{maxHeight: 250, width: '100%'}} 
                      renderItem={({item}) => (
                          <TouchableOpacity style={styles.playerRow} onPress={() => handlePlayerSelect(item)}>
                              {/* 🔥 Исправлен пустой стиль у номера игрока */}
                              <View style={[styles.playerNumBadge, {backgroundColor: '#1a4384'}]}>
                                  <Text style={styles.playerNumText}>{item.number}</Text>
                              </View>
                              <Text style={styles.playerName}>{item.name}</Text>
                          </TouchableOpacity>
                      )} 
                  />
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setEventStep(1)}>
                      <Text style={{color: 'gray'}}>Назад</Text>
                  </TouchableOpacity>
                </>
              )}
              {eventStep === 3 && (<><Text style={styles.modalTitle}>КТО ОТДАЛ?</Text><TouchableOpacity style={[styles.modalListBtn, {backgroundColor: '#555', marginBottom: 15}]} onPress={() => confirmEvent(tempScorer, null)}><Text style={styles.modalListBtnText}>🚫 БЕЗ АССИСТЕНТА</Text></TouchableOpacity><FlatList data={filteredPlayers} keyExtractor={item => item.id.toString()} style={{maxHeight: 200, width: '100%'}} renderItem={({item}) => (<TouchableOpacity style={styles.playerRow} onPress={() => confirmEvent(tempScorer, item)}><View style={[styles.playerNumBadge, {backgroundColor: '#e31e24'}]}><Text style={styles.playerNumText}>{item.number}</Text></View><Text style={styles.playerName}>{item.name}</Text></TouchableOpacity>)} /><TouchableOpacity style={styles.closeBtn} onPress={() => setEventStep(2)}><Text style={{color: 'gray'}}>Назад</Text></TouchableOpacity></>)}
            </View></View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  exitBtnPos: { position: 'absolute', top: 40, right: 30, backgroundColor: '#333', padding: 10, borderRadius: 8 },
  modulesBtnPos: { position: 'absolute', top: 90, left: 30, backgroundColor: '#333', padding: 10, borderRadius: 8 },
  modulesBtnText: { color: '#aaa', fontWeight: 'bold', fontSize: 12 },
  settingsBtnPos: { position: 'absolute', top: 40, left: 30, backgroundColor: '#1a4384', padding: 10, borderRadius: 8 },
  privacyBtnPos: { position: 'absolute', top: 40, right: 150, backgroundColor: '#4b5563', padding: 10, borderRadius: 8 },
  settingsBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  exitBtnText: { color: 'white', fontWeight: 'bold' },
  privacyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  centerContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  title: { color: 'white', fontSize: 28, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  subTitle: { color: 'gray', fontSize: 18, marginBottom: 30, textAlign: 'center' },
  inputBig: { width: 250, height: 60, backgroundColor: '#1e1e1e', borderRadius: 12, color: 'white', fontSize: 24, textAlign: 'center', borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  btnPrimary: { backgroundColor: '#e31e24', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  listContainer: { flex: 1, backgroundColor: '#121212', padding: 20 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titleSmall: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  backBtnSmall: { padding: 10, backgroundColor: '#333', borderRadius: 8 },
  matchCard: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 12, marginBottom: 15, borderLeftWidth: 5, borderLeftColor: '#e31e24' },
  matchTime: { color: 'gray', fontSize: 14, marginBottom: 5 },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', width: '40%' },
  vsText: { color: '#e31e24', fontWeight: 'bold' },
  matchStatus: { fontSize: 12, marginTop: 10, fontWeight: 'bold' },
  rosterContainer: { flex: 1, backgroundColor: '#121212' },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  rosterTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  backText: { color: '#e31e24', fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333' },
  tab: { flex: 1, padding: 15, alignItems: 'center', backgroundColor: '#1e1e1e' },
  activeTab: { backgroundColor: '#333', borderBottomWidth: 3, borderBottomColor: '#e31e24' },
  tabText: { color: 'gray', fontWeight: 'bold' },
  activeTabText: { color: 'white' },
  playerList: { flex: 1, padding: 10 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 12, marginBottom: 8, borderRadius: 8 },
  rosterRowSelected: { backgroundColor: '#1a4384', borderColor: '#4a90e2', borderWidth: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'white', marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  checkboxInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#e31e24' },
  rosterName: { color: 'white', fontSize: 16, flex: 1 },
  numberInput: { width: 40, height: 30, backgroundColor:'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16, borderRadius:5 },
  rosterFooter: { padding: 15, borderTopWidth: 1, borderTopColor: '#333', alignItems: 'center' },
  saveButton: { backgroundColor: '#e31e24', width: '100%', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  emptyText: { color: 'gray', textAlign: 'center', marginTop: 20 },
  container: { flex: 1, backgroundColor: 'black' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'space-between', padding: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  matchTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  timerBox: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 25, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#e31e24' },
  timerText: { color: 'white', fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  periodText: { color: '#e31e24', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  scoreboard: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40 },
  teamControl: { alignItems: 'center' },
  btnAction: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', marginBottom: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  btnActionText: { fontSize: 32 },
  foulText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold', marginTop: 4, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 2 },
  scoreText: { color: 'white', fontSize: 70, fontWeight: '900' },
  teamName: { color: 'white', fontSize: 14, fontWeight: 'bold', maxWidth: 150, textAlign: 'center' },
  vs: { color: 'white', fontSize: 40, opacity: 0.8, marginBottom: 30 },
  footer: { alignItems: 'center', marginBottom: 20, flexDirection: 'row', justifyContent: 'center' },
  btnStart: { backgroundColor: '#e31e24', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, elevation: 5 },
  btnStartText: { color: 'white', fontWeight: '900', fontSize: 18 },
  btnPause: { backgroundColor: '#ffcc00', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  btnPauseText: { color: 'black', fontWeight: '900', fontSize: 18 },
  btnResume: { backgroundColor: '#4cd964', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
  btnResumeText: { color: 'black', fontWeight: '900', fontSize: 16 },
  btnEndPeriod: { backgroundColor: '#1a4384', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30 },
  btnEndPeriodText: { color: 'white', fontWeight: '900', fontSize: 16 },
  btnFinished: { backgroundColor: 'gray', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  btnStream: { backgroundColor: '#333', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 30, marginLeft: 15, borderWidth: 1, borderColor: '#555', justifyContent: 'center', alignItems: 'center' },
  btnStreamActive: { backgroundColor: '#e31e24', borderColor: '#ff0000', shadowColor: "red", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
  btnStreamText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  modalCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { width: '65%', backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 20, textTransform: 'uppercase' },
  eventBtn: { width: 80, height: 80, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 5, marginHorizontal: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  eventBtnIcon: { fontSize: 32, marginBottom: 2 },
  eventBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase' },
  modalListBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalListBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  closeBtn: { marginTop: 15, padding: 10 },
  undoButton: { backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#555', marginRight: 10 },
  undoText: { color: '#ffcc00', fontWeight: 'bold', fontSize: 12 },
  playerRow: { width: '100%', padding: 15, borderBottomWidth: 1, borderBottomColor: '#333', flexDirection: 'row', alignItems: 'center' },
  playerNumBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  playerNumText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  playerName: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  headerInfo: { flex: 1, alignItems: 'flex-end' },
  btnMic: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  btnMicSettings: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26,67,132,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a90e2',
  },
  btnMicOff: {
    backgroundColor: '#e31e24', 
    borderColor: 'red',
  },
  btnMicText: {
    fontSize: 24,
  },
});