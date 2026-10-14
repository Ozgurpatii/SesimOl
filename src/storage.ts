import * as SQLite from 'expo-sqlite';
import { AppSettings, Category, CommunicationButton, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, SEED_BUTTONS } from './types';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync('sesim-ol.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS buttons (
          id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, spoken_text TEXT NOT NULL, emoji TEXT NOT NULL,
          image_uri TEXT, audio_uri TEXT, audio_type TEXT NOT NULL DEFAULT 'tts', category_id TEXT NOT NULL,
          color TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      `);
      await seedIfEmpty(db);
      return db;
    })();
  }
  return databasePromise;
}

async function seedIfEmpty(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM categories');
  if (!row?.count) {
    for (const category of DEFAULT_CATEGORIES) {
      await db.runAsync('INSERT OR IGNORE INTO categories (id, name, color, is_default) VALUES (?, ?, ?, 1)', category.id, category.name, category.color);
    }
  }
  const buttonCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM buttons');
  if (!buttonCount?.count) {
    for (const [position, button] of SEED_BUTTONS.entries()) {
      await db.runAsync(
        'INSERT OR IGNORE INTO buttons (id, title, spoken_text, emoji, image_uri, audio_uri, audio_type, category_id, color, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        button.id, button.title, button.spokenText, button.emoji, button.imageUri, button.audioUri, button.audioType, button.categoryId, button.color, position,
      );
    }
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
  }
}

type ButtonRow = {
  id: string; title: string; spoken_text: string; emoji: string; image_uri: string | null; audio_uri: string | null;
  audio_type: 'tts' | 'recording'; category_id: string; color: string; position: number;
};

export async function listButtons(): Promise<CommunicationButton[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ButtonRow>('SELECT * FROM buttons ORDER BY position, title COLLATE NOCASE');
  return rows.map((row) => ({ id: row.id, title: row.title, spokenText: row.spoken_text, emoji: row.emoji, imageUri: row.image_uri, audioUri: row.audio_uri, audioType: row.audio_type, categoryId: row.category_id, color: row.color, position: row.position }));
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; color: string; is_default: number }>('SELECT * FROM categories ORDER BY is_default DESC, name COLLATE NOCASE');
  return rows.map((row) => ({ id: row.id, name: row.name, color: row.color, isDefault: !!row.is_default }));
}

export async function saveButton(button: CommunicationButton) {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO buttons
    (id, title, spoken_text, emoji, image_uri, audio_uri, audio_type, category_id, color, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, button.id, button.title.trim(), button.spokenText.trim(), button.emoji, button.imageUri, button.audioUri, button.audioType, button.categoryId, button.color, button.position);
}

export async function removeButton(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM buttons WHERE id = ?', id);
}

export async function saveCategory(category: Category) {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO categories (id, name, color, is_default) VALUES (?, ?, ?, ?)', category.id, category.name.trim(), category.color, category.isDefault ? 1 : 0);
}

export async function removeCategory(id: string) {
  const db = await getDatabase();
  await db.runAsync('UPDATE buttons SET category_id = ? WHERE category_id = ?', 'custom', id);
  await db.runAsync('DELETE FROM categories WHERE id = ? AND is_default = 0', id);
}

export async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: keyof AppSettings; value: string }>('SELECT key, value FROM settings');
  const values: Partial<AppSettings> = {};
  for (const row of rows) {
    try { (values as Record<string, unknown>)[row.key] = JSON.parse(row.value); } catch { /* Use the safe default below. */ }
  }
  return { ...DEFAULT_SETTINGS, ...values };
}

export async function reorderButtons(buttons: CommunicationButton[]) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const [position, button] of buttons.entries()) {
      await db.runAsync('UPDATE buttons SET position = ? WHERE id = ?', position, button.id);
    }
  });
}
