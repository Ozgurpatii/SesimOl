import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getSettings,
  listButtons,
  listCategories,
  removeButton,
  removeCategory,
  reorderButtons,
  saveButton,
  saveCategory,
  updateSetting,
} from './src/storage';
import {
  AppSettings,
  Category,
  CommunicationButton,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
} from './src/types';

type FormState = Omit<CommunicationButton, 'position'>;
type Screen = 'home' | 'caregiver';
const EMOJIS = ['🍽️', '💧', '🚻', '🌙', '🛟', '😊', '😢', '🩹', '👍', '👎', '🙏', '🏠', '👩', '👨', '🐶', '🎵', '🧸', '🚗', '📚', '🧥', '⚽', '🛁', '🧃', '⭐'];
const COLORS = ['#DCEFE8', '#E3F4FA', '#EEE9FC', '#FCE8D6', '#F7DFE2', '#E4EEF9', '#FFF0DA', '#E1F3E8', '#F4EBD3', '#E8E8F5'];

const lightColors = { bg: '#F5F8F6', surface: '#FFFFFF', text: '#1D2D29', muted: '#687873', line: '#E5ECE8', primary: '#356B59', primaryText: '#FFFFFF', soft: '#E4F0EB', field: '#F7FAF8', danger: '#B83C45', selected: '#DDEEE7' };
const darkColors = { bg: '#141C19', surface: '#202B26', text: '#F2F7F4', muted: '#ADBCB5', line: '#34433C', primary: '#9ED0BA', primaryText: '#14221B', soft: '#293E34', field: '#29332E', danger: '#FF9299', selected: '#324A3E' };

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function Panel({ visible, children, onRequestClose }: { visible: boolean; children: React.ReactNode; onRequestClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onRequestClose}>
      <View style={{ flex: 1 }}>{children}</View>
    </Modal>
  );
}

function ActionButton({ label, onPress, colors, secondary = false, danger = false, compact = false, accessibilityLabel }: {
  label: string; onPress: () => void; colors: typeof lightColors; secondary?: boolean; danger?: boolean; compact?: boolean; accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { minHeight: compact ? 42 : 50, paddingHorizontal: compact ? 14 : 18, backgroundColor: danger ? colors.danger : secondary ? colors.soft : colors.primary, opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <Text style={{ color: danger ? '#FFFFFF' : secondary ? colors.text : colors.primaryText, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children, colors }: { children: React.ReactNode; colors: typeof lightColors }) {
  return <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 7, marginTop: 15 }}>{children}</Text>;
}

export default function App() {
  const { width } = useWindowDimensions();
  const [buttons, setButtons] = useState<CommunicationButton[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [editor, setEditor] = useState<FormState | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(COLORS[0]);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [turkishVoiceAvailable, setTurkishVoiceAvailable] = useState<boolean | null>(null);
  const [playingHint, setPlayingHint] = useState('');
  const player = useAudioPlayer(null);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder);
  const audioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalAudioUri = useRef<string | null>(null);
  const originalImageUri = useRef<string | null>(null);
  const currentEditorFileUris = useRef<string[]>([]);
  const colors = settings.theme === 'dark' ? darkColors : lightColors;

  const refresh = async () => {
    const [nextButtons, nextCategories, nextSettings] = await Promise.all([listButtons(), listCategories(), getSettings()]);
    setButtons(nextButtons);
    setCategories(nextCategories);
    setSettings(nextSettings);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false });
        await refresh();
        const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
        if (mounted) setTurkishVoiceAvailable(voices.some((voice) => voice.language.toLowerCase().startsWith('tr')));
      } catch (error) {
        Alert.alert('Uygulama açılamadı', 'Yerel veriler okunamadı. Uygulamayı kapatıp yeniden açın.');
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; if (audioTimer.current) clearTimeout(audioTimer.current); Speech.stop(); };
    // Startup hydration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') {
        Speech.stop();
        player.pause();
        setActiveButton(null);
        if (recorderState.isRecording) {
          try { await recorder.stop(); } catch { /* The app can be interrupted while the recorder closes. */ }
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
          Alert.alert('Kayıt durduruldu', 'Uygulama arka plana geçtiği için ses kaydı güvenle durduruldu.');
        }
      }
    });
    return () => subscription.remove();
  }, [player, recorder, recorderState.isRecording]);

  const visibleButtons = useMemo(() => buttons.filter((button) => activeCategory === 'all' || button.categoryId === activeCategory), [buttons, activeCategory]);
  const columns = width < 360 ? Math.min(settings.columns, 3) : settings.columns;
  const tileGap = 12;
  const horizontalPadding = width >= 700 ? 28 : 18;
  const tileWidth = Math.max(84, (width - horizontalPadding * 2 - tileGap * (columns - 1)) / columns);

  const showMessage = (message: string, title = 'Sesim Ol') => Alert.alert(title, message);

  const finishFeedback = () => {
    if (audioTimer.current) clearTimeout(audioTimer.current);
    audioTimer.current = setTimeout(() => setActiveButton(null), 350);
  };

  const speakButton = async (button: CommunicationButton) => {
    if (recorderState.isRecording) return;
    if (audioTimer.current) clearTimeout(audioTimer.current);
    setActiveButton(button.id);
    setPlayingHint(button.title);
    try {
      if (button.audioType === 'recording' && button.audioUri) {
        const info = await FileSystem.getInfoAsync(button.audioUri);
        if (!info.exists) {
          showMessage('Bu kaydın dosyası bulunamadı. Bakıcı modunda butona yeni bir kayıt ekleyebilirsiniz.', 'Ses bulunamadı');
          setActiveButton(null);
          return;
        }
        Speech.stop();
        player.pause();
        player.replace({ uri: button.audioUri });
        player.play();
        audioTimer.current = setTimeout(finishFeedback, 5000);
      } else {
        if (turkishVoiceAvailable === false) {
          finishFeedback();
          showMessage('Bu telefonda Türkçe konuşma sesi bulunamadı. Ayarlardan Türkçe ses paketi ekleyebilir veya bakıcı modunda kendi sesinizi kaydedebilirsiniz.', 'Türkçe ses gerekli');
          return;
        }
        player.pause();
        await Speech.stop();
        Speech.speak(button.spokenText, {
          language: 'tr-TR',
          rate: settings.speechRate,
          onDone: finishFeedback,
          onStopped: finishFeedback,
          onError: () => { finishFeedback(); showMessage('Telefon bu metni seslendiremedi. Ayarlardan Türkçe ses denetleyin veya butona kendi sesinizi kaydedin.', 'Ses oluşturulamadı'); },
        });
        audioTimer.current = setTimeout(finishFeedback, Math.max(2400, button.spokenText.length * 120));
      }
    } catch {
      finishFeedback();
      showMessage('Ses çalınamadı. Kayıt dosyasını veya telefonun ses ayarlarını kontrol edin.', 'Ses çalınamadı');
    }
  };

  const persistSettings = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try { await updateSetting(key, value); }
    catch { showMessage('Ayar kaydedilemedi. Biraz boş alan açıp yeniden deneyin.'); }
  };

  const openNewButton = () => {
    const category = categories.find((item) => item.id === 'custom') ?? categories[0];
    const form: FormState = { id: newId(), title: '', spokenText: '', emoji: '⭐', imageUri: null, audioUri: null, audioType: 'tts', categoryId: category?.id ?? 'custom', color: COLORS[0] };
    originalAudioUri.current = null;
    originalImageUri.current = null;
    currentEditorFileUris.current = [];
    setEditor(form);
  };

  const openEditButton = (button: CommunicationButton) => {
    originalAudioUri.current = button.audioUri;
    originalImageUri.current = button.imageUri;
    currentEditorFileUris.current = [];
    setEditor({ ...button });
  };

  const closeEditor = () => {
    if (recorderState.isRecording) {
      Alert.alert('Kayıt sürüyor', 'Önce kaydı durdurun.', [{ text: 'Tamam' }]);
      return;
    }
    const filesToRemove = currentEditorFileUris.current.filter((uri) => uri !== originalAudioUri.current && uri !== originalImageUri.current);
    filesToRemove.forEach((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined));
    currentEditorFileUris.current = [];
    setEditor(null);
  };

  const copyImageToDocuments = async (uri: string) => {
    if (!FileSystem.documentDirectory) throw new Error('Uygulama dosya alanına erişilemiyor.');
    const directory = `${FileSystem.documentDirectory}sesim-ol/media/`;
    const directoryInfo = await FileSystem.getInfoAsync(directory);
    if (!directoryInfo.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const suffix = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
    const extension = suffix && suffix.length < 6 ? suffix : 'jpg';
    const destination = `${directory}${newId()}.${extension}`;
    await FileSystem.copyAsync({ from: uri, to: destination });
    currentEditorFileUris.current.push(destination);
    return destination;
  };

  const pickImage = async (camera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { showMessage('Kamera izni verilmedi. Telefon ayarlarından izin verebilir veya galeriden fotoğraf seçebilirsiniz.', 'Kamera izni gerekli'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      }
      if (result.canceled || !result.assets[0]?.uri) return;
      if (!editor) return;
      const savedUri = await copyImageToDocuments(result.assets[0].uri);
      setEditor((current) => current ? { ...current, imageUri: savedUri } : current);
    } catch {
      showMessage('Fotoğraf eklenemedi. Depolama alanını kontrol edip yeniden deneyin.', 'Fotoğraf eklenemedi');
    }
  };

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) { showMessage('Mikrofon izni verilmedi. Telefon ayarlarından izin verebilir veya metinden sese seçeneğini kullanabilirsiniz.', 'Mikrofon izni gerekli'); return; }
      Speech.stop();
      player.pause();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      showMessage('Kayıt başlatılamadı. Mikrofon kullanımda olabilir veya depolama alanı yetersizdir.', 'Kayıt başlatılamadı');
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) { showMessage('Kayıt dosyası oluşturulamadı. Yeniden deneyin.', 'Kayıt bulunamadı'); return; }
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || (info.exists && (info as FileSystem.FileInfo & { size?: number }).size === 0)) {
        showMessage('Ses boş görünüyor. Mikrofonunuzu kontrol edip yeniden kayıt yapın.', 'Boş kayıt');
        return;
      }
      currentEditorFileUris.current.push(uri);
      setEditor((current) => current ? { ...current, audioUri: uri, audioType: 'recording' } : current);
      showMessage('Ses kaydedildi. İsterseniz dinleyip butona atayabilirsiniz.', 'Kayıt hazır');
    } catch {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
      showMessage('Kayıt durdurulamadı. Biraz sonra yeniden deneyin.', 'Kayıt hatası');
    }
  };

  const previewRecording = async () => {
    if (!editor?.audioUri) { showMessage('Önce bir ses kaydedin.'); return; }
    try {
      const info = await FileSystem.getInfoAsync(editor.audioUri);
      if (!info.exists) { showMessage('Kayıt dosyası bulunamadı. Yeniden kayıt yapın.', 'Ses bulunamadı'); return; }
      await Speech.stop();
      player.replace({ uri: editor.audioUri });
      player.play();
    } catch { showMessage('Kayıt dinletilemedi. Yeniden kayıt yapmayı deneyin.', 'Ses çalınamadı'); }
  };

  const saveEditor = async () => {
    if (!editor || !editor.title.trim() || !editor.spokenText.trim()) { showMessage('Buton adı ve söylenecek cümle boş bırakılamaz.', 'Eksik bilgi'); return; }
    if (editor.audioType === 'recording' && !editor.audioUri) { showMessage('Bu buton için bir ses kaydedin ya da metinden sese seçeneğini işaretleyin.', 'Ses seçilmedi'); return; }
    if (!categories.some((category) => category.id === editor.categoryId)) { showMessage('Bir kategori seçin.'); return; }
    try {
      const existing = buttons.find((button) => button.id === editor.id);
      const position = existing?.position ?? buttons.length;
      const buttonToSave = { ...editor, audioUri: editor.audioType === 'recording' ? editor.audioUri : null, title: editor.title.trim(), spokenText: editor.spokenText.trim(), position };
      await saveButton(buttonToSave);
      for (const oldUri of [originalAudioUri.current, originalImageUri.current]) {
        if (oldUri && oldUri !== buttonToSave.audioUri && oldUri !== buttonToSave.imageUri) await FileSystem.deleteAsync(oldUri, { idempotent: true }).catch(() => undefined);
      }
      for (const unusedUri of currentEditorFileUris.current) {
        if (unusedUri !== buttonToSave.audioUri && unusedUri !== buttonToSave.imageUri) await FileSystem.deleteAsync(unusedUri, { idempotent: true }).catch(() => undefined);
      }
      currentEditorFileUris.current = [];
      setEditor(null);
      await refresh();
    } catch {
      showMessage('Buton kaydedilemedi. Telefonunuzda yeterli boş alan olduğundan emin olun.', 'Kayıt tamamlanamadı');
    }
  };

  const deleteButton = (button: CommunicationButton) => {
    Alert.alert('Buton silinsin mi?', `“${button.title}” butonu ve ona ait yerel medya silinecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try {
          await removeButton(button.id);
          for (const uri of [button.imageUri, button.audioUri]) {
            if (uri && !buttons.some((other) => other.id !== button.id && (other.imageUri === uri || other.audioUri === uri))) {
              await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
            }
          }
          await refresh();
        } catch { showMessage('Buton silinemedi. Yeniden deneyin.'); }
      } },
    ]);
  };

  const duplicateButton = async (button: CommunicationButton) => {
    try {
      const copy = { ...button, id: newId(), title: `${button.title} (kopya)`, position: buttons.length };
      await saveButton(copy);
      await refresh();
      showMessage('Buton kopyalandı. İsterseniz şimdi düzenleyebilirsiniz.', 'Kopya oluşturuldu');
    } catch { showMessage('Buton kopyalanamadı.'); }
  };

  const moveButton = async (button: CommunicationButton, direction: -1 | 1) => {
    const from = buttons.findIndex((item) => item.id === button.id);
    const to = from + direction;
    if (to < 0 || to >= buttons.length) return;
    const next = [...buttons];
    [next[from], next[to]] = [next[to], next[from]];
    setButtons(next.map((item, position) => ({ ...item, position })));
    try { await reorderButtons(next); await refresh(); }
    catch { showMessage('Sıralama kaydedilemedi.'); }
  };

  const openCategory = (category?: Category) => {
    setCategoryName(category?.name ?? '');
    setCategoryColor(category?.color ?? COLORS[0]);
    setCategoryEditor(category ?? { id: newId(), name: '', color: COLORS[0] });
  };

  const saveCategoryForm = async () => {
    if (!categoryEditor || !categoryName.trim()) { showMessage('Kategori adı boş bırakılamaz.', 'Eksik bilgi'); return; }
    try {
      await saveCategory({ ...categoryEditor, name: categoryName.trim(), color: categoryColor, isDefault: categoryEditor.isDefault });
      setCategoryEditor(null);
      await refresh();
    } catch { showMessage('Kategori kaydedilemedi.'); }
  };

  const removeCategoryConfirm = (category: Category) => {
    if (category.isDefault) return;
    Alert.alert('Kategori silinsin mi?', `${category.name} içindeki butonlar “Özel Butonlar” kategorisine taşınacak.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await removeCategory(category.id); if (activeCategory === category.id) setActiveCategory('all'); await refresh(); }
        catch { showMessage('Kategori silinemedi.'); }
      } },
    ]);
  };

  const openCaregiver = () => { setPinInput(''); setPinError(''); setPinOpen(true); };
  const submitPin = () => {
    if (pinInput === settings.caregiverPin) { setPinOpen(false); setScreen('caregiver'); return; }
    setPinError('PIN eşleşmedi. Yeniden deneyin.');
    setPinInput('');
  };

  const changePin = async () => {
    if (!/^\d{4,8}$/.test(newPin)) { showMessage('PIN 4–8 rakamdan oluşmalı.', 'Geçersiz PIN'); return; }
    await persistSettings('caregiverPin', newPin);
    setNewPin('');
    setPinChangeOpen(false);
    showMessage('Bakıcı PIN’i güncellendi.', 'PIN değiştirildi');
  };

  const changeAudioType = (audioType: 'tts' | 'recording') => {
    if (!editor) return;
    if (audioType === 'recording' && !editor.audioUri) {
      setEditor({ ...editor, audioType });
    } else setEditor({ ...editor, audioType });
  };

  const renderTile = ({ item }: { item: CommunicationButton }) => {
    const cardSize = Math.min(178, Math.max(112, tileWidth * 1.05 * settings.tileScale));
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.spokenText}. Seslendirmek için dokunun.`}
        accessibilityHint="Tek dokunuşta ses çalar. Düzenleme bakıcı modundadır."
        accessibilityState={{ selected: activeButton === item.id }}
        onPress={() => speakButton(item)}
        style={({ pressed }) => [
          styles.tile,
          {
            width: tileWidth,
            minHeight: cardSize,
            backgroundColor: settings.highContrast ? colors.surface : (settings.theme === 'dark' ? colors.surface : item.color),
            borderColor: settings.highContrast ? colors.text : activeButton === item.id ? colors.primary : 'transparent',
            borderWidth: activeButton === item.id || settings.highContrast ? 3 : 0,
            transform: [{ scale: pressed || activeButton === item.id ? 0.97 : 1 }],
          },
        ]}
      >
        {item.imageUri ? <Image source={{ uri: item.imageUri }} accessibilityLabel={`${item.title} görseli`} style={{ width: '100%', height: cardSize * 0.68, borderRadius: 18, marginBottom: 5 }} resizeMode="cover" /> : <Text style={{ fontSize: Math.min(62, cardSize * 0.46), marginBottom: 6 }} accessibilityElementsHidden>{item.emoji}</Text>}
        <Text numberOfLines={2} style={{ color: colors.text, fontSize: Math.max(15, Math.min(19, tileWidth * 0.125)), fontWeight: '700', textAlign: 'center', lineHeight: 23 }}>{item.title}</Text>
        {activeButton === item.id && <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 }}>▶︎ {playingHint}</Text>}
      </Pressable>
    );
  };

  if (!ready) return <SafeAreaView style={[styles.loading, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ color: colors.muted, marginTop: 12 }}>Hazırlanıyor…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.page}>
        {screen === 'home' ? (
          <>
            <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
              <View style={styles.brandRow}>
                <View style={[styles.brandMark, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryText, fontWeight: '900', fontSize: 15 }}>SO</Text></View>
                <View><Text style={[styles.brandTitle, { color: colors.text }]}>Sesim Ol</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }}>Söylemek istediğini seç.</Text></View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Bakıcı moduna gir" onPress={openCaregiver} style={({ pressed }) => [styles.headerButton, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ fontSize: 17 }}>⚙</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Bakıcı</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryStrip, { paddingHorizontal: horizontalPadding }]}>
              <CategoryChip title="Tümü" selected={activeCategory === 'all'} onPress={() => setActiveCategory('all')} colors={colors} />
              {categories.map((category) => <CategoryChip key={category.id} title={category.name} selected={activeCategory === category.id} onPress={() => setActiveCategory(category.id)} colors={colors} />)}
            </ScrollView>

            {visibleButtons.length ? (
              <FlatList
                key={`${columns}-${width >= 700 ? 'wide' : 'phone'}`}
                data={visibleButtons}
                numColumns={columns}
                renderItem={renderTile}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingTop: 10, paddingBottom: 18, alignItems: 'center' }}
                columnWrapperStyle={{ gap: tileGap, marginBottom: tileGap }}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyArea}><Text style={{ fontSize: 50 }}>🗂️</Text><Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>Bu kategoride buton yok</Text><Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>Bakıcı modunda yeni bir buton ekleyebilirsiniz.</Text></View>
            )}
          </>
        ) : (
          <CaregiverScreen
            buttons={buttons} categories={categories} settings={settings} colors={colors}
            onBack={() => setScreen('home')} onAdd={openNewButton} onEdit={openEditButton}
            onDelete={deleteButton} onDuplicate={duplicateButton} onMove={moveButton}
            onEditCategory={openCategory} onDeleteCategory={removeCategoryConfirm}
            onSetting={persistSettings} onChangePin={() => { setNewPin(''); setPinChangeOpen(true); }}
          />
        )}

        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.line }]}>
          <Pressable accessibilityRole="tab" accessibilityLabel="İletişim ekranı" onPress={() => setScreen('home')} style={styles.navItem}>
            <Text style={{ fontSize: 18 }}>▦</Text><Text style={{ fontSize: 12, marginTop: 3, color: screen === 'home' ? colors.primary : colors.muted, fontWeight: screen === 'home' ? '800' : '600' }}>İletişim</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityLabel="Bakıcı ayarları" onPress={screen === 'caregiver' ? () => setScreen('home') : openCaregiver} style={styles.navItem}>
            <Text style={{ fontSize: 18 }}>⚙</Text><Text style={{ fontSize: 12, marginTop: 3, color: screen === 'caregiver' ? colors.primary : colors.muted, fontWeight: screen === 'caregiver' ? '800' : '600' }}>Bakıcı</Text>
          </Pressable>
        </View>
      </View>

      <Panel visible={!!editor} onRequestClose={closeEditor}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <EditorPanel
            editor={editor} categories={categories} colors={colors} recorderState={recorderState}
            onClose={closeEditor} onSave={saveEditor} onChange={(update) => setEditor((current) => current ? { ...current, ...update } : current)}
            onPick={(camera) => pickImage(camera)} onRecord={recorderState.isRecording ? stopRecording : startRecording}
            onPreview={previewRecording} onClearRecording={() => editor && setEditor({ ...editor, audioUri: null, audioType: 'tts' })}
            onAudioType={changeAudioType}
          />
        </KeyboardAvoidingView>
      </Panel>

      <Panel visible={!!categoryEditor} onRequestClose={() => setCategoryEditor(null)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.bg }]}>
          <ModalHeader title={categoryEditor?.isDefault ? 'Kategori adı' : 'Kategori oluştur'} colors={colors} onClose={() => setCategoryEditor(null)} />
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <FieldLabel colors={colors}>Kategori adı</FieldLabel>
            <TextInput value={categoryName} onChangeText={setCategoryName} placeholder="Örn. Okul" placeholderTextColor={colors.muted} maxLength={32} accessibilityLabel="Kategori adı" style={[styles.input, { color: colors.text, backgroundColor: colors.field, borderColor: colors.line }]} />
            <FieldLabel colors={colors}>Renk</FieldLabel>
            <View style={styles.swatchRow}>{COLORS.map((color) => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Renk ${color}`} onPress={() => setCategoryColor(color)} style={[styles.swatch, { backgroundColor: color, borderColor: categoryColor === color ? colors.text : colors.line, borderWidth: categoryColor === color ? 3 : 1 }]} />)}</View>
            <View style={{ marginTop: 24 }}><ActionButton label="Kaydet" onPress={saveCategoryForm} colors={colors} /></View>
          </ScrollView>
        </View>
      </Panel>

      <Panel visible={pinOpen} onRequestClose={() => setPinOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
          <View style={styles.pinCard}>
            <Text style={{ fontSize: 38, textAlign: 'center' }}>🔒</Text>
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center', marginTop: 10 }]}>Bakıcı modu</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>Devam etmek için PIN’i girin.</Text>
            <TextInput value={pinInput} onChangeText={(value) => { setPinInput(value.replace(/\D/g, '').slice(0, 8)); setPinError(''); }} keyboardType="number-pad" secureTextEntry maxLength={8} accessibilityLabel="Bakıcı PIN’i" style={[styles.input, styles.pinInput, { color: colors.text, backgroundColor: colors.field, borderColor: colors.line }]} />
            {!!pinError && <Text style={{ color: colors.danger, marginTop: 8, textAlign: 'center' }}>{pinError}</Text>}
            <View style={{ marginTop: 18 }}><ActionButton label="Devam" onPress={submitPin} colors={colors} /></View>
            <Pressable accessibilityRole="button" onPress={() => setPinOpen(false)} style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: colors.muted, fontWeight: '700' }}>Vazgeç</Text></Pressable>
          </View>
        </View>
      </Panel>

      <Panel visible={pinChangeOpen} onRequestClose={() => setPinChangeOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
          <View style={styles.pinCard}>
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center' }]}>Yeni PIN belirle</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 7 }}>4–8 rakam girin.</Text>
            <TextInput value={newPin} onChangeText={(value) => setNewPin(value.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" secureTextEntry maxLength={8} accessibilityLabel="Yeni bakıcı PIN’i" style={[styles.input, styles.pinInput, { color: colors.text, backgroundColor: colors.field, borderColor: colors.line }]} />
            <View style={{ marginTop: 18 }}><ActionButton label="PIN’i kaydet" onPress={changePin} colors={colors} /></View>
            <Pressable accessibilityRole="button" onPress={() => setPinChangeOpen(false)} style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: colors.muted, fontWeight: '700' }}>Vazgeç</Text></Pressable>
          </View>
        </View>
      </Panel>
    </SafeAreaView>
  );
}

function CategoryChip({ title, selected, onPress, colors }: { title: string; selected: boolean; onPress: () => void; colors: typeof lightColors }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.categoryChip, { backgroundColor: selected ? colors.primary : colors.surface, opacity: pressed ? 0.78 : 1 }]}><Text style={{ color: selected ? colors.primaryText : colors.text, fontSize: 13, fontWeight: '700' }}>{title}</Text></Pressable>;
}

function ModalHeader({ title, colors, onClose, rightLabel, onRight }: { title: string; colors: typeof lightColors; onClose: () => void; rightLabel?: string; onRight?: () => void }) {
  return (
    <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={onClose} hitSlop={10} style={styles.headerSide}><Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>Kapat</Text></Pressable>
      <Text numberOfLines={1} style={[styles.modalTitle, { color: colors.text, flex: 1, textAlign: 'center' }]}>{title}</Text>
      {rightLabel && onRight ? <Pressable accessibilityRole="button" onPress={onRight} style={[styles.headerSide, { alignItems: 'flex-end' }]}><Text style={{ color: colors.primary, fontSize: 16, fontWeight: '800' }}>{rightLabel}</Text></Pressable> : <View style={styles.headerSide} />}
    </View>
  );
}

function EditorPanel({ editor, categories, colors, recorderState, onClose, onSave, onChange, onPick, onRecord, onPreview, onClearRecording, onAudioType }: {
  editor: FormState | null; categories: Category[]; colors: typeof lightColors; recorderState: { isRecording: boolean; durationMillis?: number };
  onClose: () => void; onSave: () => void; onChange: (update: Partial<FormState>) => void;
  onPick: (camera: boolean) => void; onRecord: () => void; onPreview: () => void; onClearRecording: () => void; onAudioType: (type: 'tts' | 'recording') => void;
}) {
  if (!editor) return null;
  const inputStyle = [styles.input, { color: colors.text, backgroundColor: colors.field, borderColor: colors.line }];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title="İletişim butonu" colors={colors} onClose={onClose} rightLabel="Kaydet" onRight={onSave} />
      <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
        <FieldLabel colors={colors}>Buton adı</FieldLabel>
        <TextInput value={editor.title} onChangeText={(title) => onChange({ title })} placeholder="Örn. Annemi istiyorum" placeholderTextColor={colors.muted} maxLength={32} accessibilityLabel="Buton adı" style={inputStyle} />

        <FieldLabel colors={colors}>Buton görseli</FieldLabel>
        <View style={[styles.imagePreview, { backgroundColor: editor.color, borderColor: colors.line }]}>
          {editor.imageUri ? <Image source={{ uri: editor.imageUri }} accessibilityLabel="Seçilen buton görseli" style={{ width: '100%', height: '100%', borderRadius: 22 }} resizeMode="cover" /> : <Text style={{ fontSize: 48 }}>{editor.emoji}</Text>}
        </View>
        <View style={styles.wrapRow}>
          <ActionButton label="Galeriden seç" onPress={() => onPick(false)} colors={colors} secondary compact />
          <ActionButton label="Fotoğraf çek" onPress={() => onPick(true)} colors={colors} secondary compact />
          {editor.imageUri ? <ActionButton label="Görseli kaldır" onPress={() => onChange({ imageUri: null })} colors={colors} danger compact /> : null}
        </View>
        <FieldLabel colors={colors}>Hazır simgeler</FieldLabel>
        <View style={styles.emojiGrid}>{EMOJIS.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Simge ${emoji}`} onPress={() => onChange({ emoji, imageUri: null })} style={[styles.emojiChoice, { backgroundColor: editor.emoji === emoji && !editor.imageUri ? colors.selected : colors.surface, borderColor: editor.emoji === emoji && !editor.imageUri ? colors.primary : colors.line }]}><Text style={{ fontSize: 26 }}>{emoji}</Text></Pressable>)}</View>

        <FieldLabel colors={colors}>Söylenecek cümle</FieldLabel>
        <TextInput value={editor.spokenText} onChangeText={(spokenText) => onChange({ spokenText })} multiline placeholder="Örn. Anne, yanıma gelir misin?" placeholderTextColor={colors.muted} maxLength={240} accessibilityLabel="Seslendirilecek cümle" style={[inputStyle, styles.multiline]} />

        <FieldLabel colors={colors}>Ses yöntemi</FieldLabel>
        <View style={styles.wrapRow}>
          <ChoicePill label="Metinden sese" selected={editor.audioType === 'tts'} onPress={() => onAudioType('tts')} colors={colors} />
          <ChoicePill label="Kendi sesim" selected={editor.audioType === 'recording'} onPress={() => onAudioType('recording')} colors={colors} />
        </View>
        {editor.audioType === 'recording' && <View style={[styles.recordingBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>Mikrofon izni yalnızca kayıt başlattığınızda istenir. Kayıt bu telefonda kalır.</Text>
          <View style={[styles.wrapRow, { marginTop: 14 }]}>
            <ActionButton label={recorderState.isRecording ? '■ Kaydı durdur' : '● Kaydı başlat'} onPress={onRecord} colors={colors} danger={recorderState.isRecording} compact />
            {!!editor.audioUri && <ActionButton label="▶ Dinle" onPress={onPreview} colors={colors} secondary compact />}
            {!!editor.audioUri && <ActionButton label="Kaydı sil" onPress={onClearRecording} colors={colors} secondary compact />}
          </View>
          {recorderState.isRecording && <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontWeight: '700', marginTop: 10 }}>● Kayıt yapılıyor… Kaydı bitirmek için düğmeye dokunun.</Text>}
          {!recorderState.isRecording && !!editor.audioUri && <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 10 }}>✓ Bu cümleye özel kayıt hazır</Text>}
        </View>}

        <FieldLabel colors={colors}>Kategori</FieldLabel>
        <View style={styles.wrapRow}>{categories.map((category) => <ChoicePill key={category.id} label={category.name} selected={editor.categoryId === category.id} onPress={() => onChange({ categoryId: category.id })} colors={colors} />)}</View>

        <FieldLabel colors={colors}>Kart rengi</FieldLabel>
        <View style={styles.swatchRow}>{COLORS.map((color) => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Kart rengi ${color}`} onPress={() => onChange({ color })} style={[styles.swatch, { backgroundColor: color, borderColor: editor.color === color ? colors.text : colors.line, borderWidth: editor.color === color ? 3 : 1 }]} />)}</View>
        <View style={{ height: 24 }} />
        <ActionButton label="Kaydet" onPress={onSave} colors={colors} />
        <View style={{ height: 22 }} />
      </ScrollView>
    </View>
  );
}

function ChoicePill({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: typeof lightColors }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choicePill, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.line }]}><Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: '700', fontSize: 13 }}>{selected ? '✓ ' : ''}{label}</Text></Pressable>;
}

function CaregiverScreen({ buttons, categories, settings, colors, onBack, onAdd, onEdit, onDelete, onDuplicate, onMove, onEditCategory, onDeleteCategory, onSetting, onChangePin }: {
  buttons: CommunicationButton[]; categories: Category[]; settings: AppSettings; colors: typeof lightColors; onBack: () => void;
  onAdd: () => void; onEdit: (button: CommunicationButton) => void; onDelete: (button: CommunicationButton) => void;
  onDuplicate: (button: CommunicationButton) => void; onMove: (button: CommunicationButton, direction: -1 | 1) => void;
  onEditCategory: (category?: Category) => void; onDeleteCategory: (category: Category) => void;
  onSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>; onChangePin: () => void;
}) {
  const [tab, setTab] = useState<'buttons' | 'categories' | 'settings'>('buttons');
  const colorsOptions = ['#356B59', '#DCEFE8', '#FCE8D6', '#E4E4F7', '#E4EEF9', '#F7DFE2'];
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.caregiverHeader, { backgroundColor: colors.surface, borderBottomColor: colors.line }]}>
        <View style={{ flex: 1 }}><Text style={[styles.caregiverTitle, { color: colors.text }]}>Bakıcı modu</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 3 }}>İletişim ekranını kişiselleştir.</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="İletişim ekranına dön" onPress={onBack} style={[styles.headerButton, { backgroundColor: colors.soft }]}><Text style={{ color: colors.text, fontWeight: '700' }}>Çıkış</Text></Pressable>
      </View>
      <View style={[styles.manageTabs, { backgroundColor: colors.surface }]}>
        {(['buttons', 'categories', 'settings'] as const).map((item) => {
          const label = item === 'buttons' ? 'Butonlar' : item === 'categories' ? 'Kategoriler' : 'Ayarlar';
          return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.manageTab, tab === item && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}><Text style={{ color: tab === item ? colors.primary : colors.muted, fontWeight: '800' }}>{label}</Text></Pressable>;
        })}
      </View>
      {tab === 'buttons' && <ScrollView contentContainerStyle={styles.manageContent}>
        <ActionButton label="＋ Yeni buton ekle" onPress={onAdd} colors={colors} />
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 6 }}>Ana ekranda görünme sırası · taşıma okları</Text>
        {buttons.map((button, index) => <View key={button.id} style={[styles.manageRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.manageIcon, { backgroundColor: button.color }]}>{button.imageUri ? <Image source={{ uri: button.imageUri }} style={{ width: 48, height: 48, borderRadius: 13 }} resizeMode="cover" /> : <Text style={{ fontSize: 25 }}>{button.emoji}</Text>}</View>
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{button.title}</Text><Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{button.audioType === 'recording' ? '● Kendi sesi' : '◖ Metinden sese'} · {categories.find((c) => c.id === button.categoryId)?.name ?? 'Kategori yok'}</Text></View>
          <View style={styles.rowActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${button.title} yukarı taşı`} disabled={index === 0} onPress={() => onMove(button, -1)} style={[styles.iconAction, { backgroundColor: colors.field, opacity: index === 0 ? 0.35 : 1 }]}><Text style={{ color: colors.text, fontSize: 17 }}>↑</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${button.title} aşağı taşı`} disabled={index === buttons.length - 1} onPress={() => onMove(button, 1)} style={[styles.iconAction, { backgroundColor: colors.field, opacity: index === buttons.length - 1 ? 0.35 : 1 }]}><Text style={{ color: colors.text, fontSize: 17 }}>↓</Text></Pressable>
          </View>
          <View style={styles.rowActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${button.title} düzenle`} onPress={() => onEdit(button)} style={[styles.iconAction, { backgroundColor: colors.soft }]}><Text style={{ color: colors.primary, fontSize: 17 }}>✎</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${button.title} çoğalt`} onPress={() => onDuplicate(button)} style={[styles.iconAction, { backgroundColor: colors.field }]}><Text style={{ color: colors.text, fontSize: 16 }}>▣</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${button.title} sil`} onPress={() => onDelete(button)} style={[styles.iconAction, { backgroundColor: colors.field }]}><Text style={{ color: colors.danger, fontSize: 16 }}>×</Text></Pressable>
          </View>
        </View>)}
      </ScrollView>}

      {tab === 'categories' && <ScrollView contentContainerStyle={styles.manageContent}>
        <ActionButton label="＋ Kategori ekle" onPress={() => onEditCategory()} colors={colors} />
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 6 }}>Var olan kategoriler</Text>
        {categories.map((category) => <View key={category.id} style={[styles.manageRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
          <Text numberOfLines={1} style={{ color: colors.text, flex: 1, fontWeight: '700', fontSize: 15 }}>{category.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${category.name} düzenle`} onPress={() => onEditCategory(category)} style={[styles.iconAction, { backgroundColor: colors.soft }]}><Text style={{ color: colors.primary, fontSize: 17 }}>✎</Text></Pressable>
          {!category.isDefault && <Pressable accessibilityRole="button" accessibilityLabel={`${category.name} sil`} onPress={() => onDeleteCategory(category)} style={[styles.iconAction, { backgroundColor: colors.field }]}><Text style={{ color: colors.danger, fontSize: 16 }}>×</Text></Pressable>}
        </View>)}
      </ScrollView>}

      {tab === 'settings' && <ScrollView contentContainerStyle={styles.manageContent}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Ekran düzeni</Text>
        <SettingCard title="Sütun sayısı" subtitle="Kartların yan yana görünümü" colors={colors}>
          <View style={styles.segmentRow}>{([2, 3, 4] as const).map((value) => <ChoicePill key={value} label={`${value} sütun`} selected={settings.columns === value} onPress={() => onSetting('columns', value)} colors={colors} />)}</View>
        </SettingCard>
        <SettingCard title="Buton boyutu" subtitle="İletişim ekranında kartların boyutu" colors={colors}>
          <View style={styles.segmentRow}>{([{ value: 0.84, label: 'Küçük' }, { value: 1, label: 'Orta' }, { value: 1.15, label: 'Büyük' }] as const).map((entry) => <ChoicePill key={entry.value} label={entry.label} selected={settings.tileScale === entry.value} onPress={() => onSetting('tileScale', entry.value)} colors={colors} />)}</View>
        </SettingCard>
        <SettingCard title="Tema" subtitle="Açık veya koyu görünüm" colors={colors}>
          <View style={styles.segmentRow}><ChoicePill label="Açık" selected={settings.theme === 'light'} onPress={() => onSetting('theme', 'light')} colors={colors} /><ChoicePill label="Koyu" selected={settings.theme === 'dark'} onPress={() => onSetting('theme', 'dark')} colors={colors} /></View>
        </SettingCard>
        <SettingCard title="Yüksek kontrast" subtitle="Kart kenarlarını ve metinleri belirginleştir" colors={colors}>
          <Switch value={settings.highContrast} onValueChange={(value) => onSetting('highContrast', value)} trackColor={{ true: colors.primary }} accessibilityLabel="Yüksek kontrast" />
        </SettingCard>
        <SettingCard title="Türkçe ses hızı" subtitle={`Yavaş  ·  ${settings.speechRate.toFixed(1)}×  ·  Hızlı`} colors={colors}>
          <View style={styles.segmentRow}>{([0.7, 0.9, 1.1, 1.3] as const).map((value) => <ChoicePill key={value} label={`${value}×`} selected={settings.speechRate === value} onPress={() => onSetting('speechRate', value)} colors={colors} />)}</View>
        </SettingCard>
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 18 }]}>Erişim güvenliği</Text>
        <View style={[styles.settingCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Bakıcı PIN’i</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Düzenleme bölümünü korur.</Text></View>
          <ActionButton label="Değiştir" onPress={onChangePin} colors={colors} secondary compact />
        </View>
        <View style={[styles.privacyNote, { backgroundColor: colors.soft }]}><Text style={{ fontSize: 18 }}>🔐</Text><Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 }}>Butonlar, fotoğraflar ve kayıtlar bu telefonda saklanır. İnternete gönderilmez. Uygulama silinirse yerel veriler de silinir.</Text></View>
      </ScrollView>}
    </View>
  );
}

function SettingCard({ title, subtitle, colors, children }: { title: string; subtitle: string; colors: typeof lightColors; children: React.ReactNode }) {
  return <View style={[styles.settingCard, { backgroundColor: colors.surface, borderColor: colors.line }]}><View style={{ marginBottom: 13 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{subtitle}</Text></View>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, page: { flex: 1 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { minHeight: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, brandMark: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.4 }, headerButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  categoryStrip: { gap: 9, paddingTop: 5, paddingBottom: 9 }, categoryChip: { borderRadius: 20, paddingHorizontal: 15, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  tile: { borderRadius: 24, padding: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#23332D', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 1 },
  emptyArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  bottomBar: { minHeight: 62, paddingBottom: 2, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' }, navItem: { minWidth: 100, minHeight: 54, justifyContent: 'center', alignItems: 'center' },
  actionButton: { borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  modalRoot: { flex: 1 }, modalHeader: { minHeight: 58, borderBottomWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 18, fontWeight: '900' }, headerSide: { width: 72, minHeight: 45, justifyContent: 'center' }, modalContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 34 },
  input: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, minHeight: 52, fontSize: 16 }, multiline: { minHeight: 96, paddingTop: 13, textAlignVertical: 'top' },
  imagePreview: { height: 158, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' }, emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, emojiChoice: { width: 52, height: 52, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choicePill: { borderWidth: 1, borderRadius: 18, minHeight: 40, paddingHorizontal: 13, justifyContent: 'center', alignItems: 'center' }, recordingBox: { padding: 15, borderRadius: 18, borderWidth: 1, marginTop: 13 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, swatch: { width: 38, height: 38, borderRadius: 19 }, pinCard: { marginHorizontal: 22, padding: 24, borderRadius: 26, backgroundColor: '#FFFFFF' }, pinInput: { marginTop: 20, textAlign: 'center', letterSpacing: 8, fontSize: 23 },
  caregiverHeader: { minHeight: 82, borderBottomWidth: 1, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, caregiverTitle: { fontSize: 21, fontWeight: '900' }, manageTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5ECE8' },
  manageTab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' }, manageContent: { padding: 18, paddingBottom: 30, gap: 10 }, manageRow: { minHeight: 72, borderWidth: 1, borderRadius: 19, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, manageIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, rowActions: { flexDirection: 'row', gap: 5 }, iconAction: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, categoryDot: { width: 38, height: 38, borderRadius: 14 },
  settingCard: { borderRadius: 19, borderWidth: 1, padding: 16, marginBottom: 2 }, sectionTitle: { fontSize: 17, fontWeight: '900', marginTop: 8, marginBottom: 1 }, segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, privacyNote: { marginTop: 10, borderRadius: 17, padding: 14, gap: 10, flexDirection: 'row', alignItems: 'flex-start' },
});
