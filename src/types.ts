export type AudioType = 'tts' | 'recording';
export type ThemeMode = 'light' | 'dark';

export type Category = {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
};

export type CommunicationButton = {
  id: string;
  title: string;
  spokenText: string;
  emoji: string;
  imageUri: string | null;
  audioUri: string | null;
  audioType: AudioType;
  categoryId: string;
  color: string;
  position: number;
};

export type AppSettings = {
  columns: number;
  tileScale: number;
  theme: ThemeMode;
  speechRate: number;
  caregiverPin: string;
  highContrast: boolean;
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'needs', name: 'Temel İhtiyaçlar', color: '#DCEFE8', isDefault: true },
  { id: 'feelings', name: 'Duygular', color: '#FCE8D6', isDefault: true },
  { id: 'health', name: 'Sağlık', color: '#F7DFE2', isDefault: true },
  { id: 'people', name: 'Aile ve İnsanlar', color: '#E4E4F7', isDefault: true },
  { id: 'daily', name: 'Günlük Yaşam', color: '#E4EEF9', isDefault: true },
  { id: 'custom', name: 'Özel Butonlar', color: '#F4EBD3', isDefault: true },
];

export const DEFAULT_SETTINGS: AppSettings = {
  columns: 3,
  tileScale: 1,
  theme: 'light',
  speechRate: 0.9,
  caregiverPin: '2468',
  highContrast: false,
};

export const SEED_BUTTONS: Omit<CommunicationButton, 'position'>[] = [
  { id: 'food', title: 'Yemek', spokenText: 'Acıktım.', emoji: '🍽️', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'needs', color: '#FFF0DA' },
  { id: 'water', title: 'Su', spokenText: 'Susadım.', emoji: '💧', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'needs', color: '#E3F4FA' },
  { id: 'toilet', title: 'Tuvalet', spokenText: 'Tuvalete gitmek istiyorum.', emoji: '🚻', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'needs', color: '#E8F1FF' },
  { id: 'sleep', title: 'Uyku', spokenText: 'Uykum geldi.', emoji: '🌙', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'needs', color: '#EEE9FC' },
  { id: 'help', title: 'Yardım', spokenText: 'Yardıma ihtiyacım var.', emoji: '🛟', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'needs', color: '#FCE7E2' },
  { id: 'happy', title: 'Mutlu', spokenText: 'Mutluyum.', emoji: '😊', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'feelings', color: '#FFF1C9' },
  { id: 'sad', title: 'Üzgün', spokenText: 'Üzgünüm.', emoji: '😢', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'feelings', color: '#E7EEF9' },
  { id: 'pain', title: 'Ağrı', spokenText: 'Canım acıyor.', emoji: '🩹', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'health', color: '#FBE4E3' },
  { id: 'yes', title: 'Evet', spokenText: 'Evet.', emoji: '👍', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'daily', color: '#E1F3E8' },
  { id: 'no', title: 'Hayır', spokenText: 'Hayır.', emoji: '👎', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'daily', color: '#FCE5E3' },
  { id: 'thanks', title: 'Teşekkür', spokenText: 'Teşekkür ederim.', emoji: '🙏', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'daily', color: '#F7EBD8' },
  { id: 'home', title: 'Ev', spokenText: 'Eve gitmek istiyorum.', emoji: '🏠', imageUri: null, audioUri: null, audioType: 'tts', categoryId: 'daily', color: '#E4EFF8' },
];
