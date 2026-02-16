import type { GameRecording } from './types';

const STORAGE_KEY = 'solitary_recordings';
const MAX_RECORDINGS = 50;

export class RecordingStorage {
  static save(recording: GameRecording): void {
    const list = this.list();
    list.unshift(recording);
    if (list.length > MAX_RECORDINGS) list.length = MAX_RECORDINGS;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch { /* quota exceeded — silently drop */ }
  }

  static list(): GameRecording[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static load(id: string): GameRecording | null {
    return this.list().find(r => r.id === id) ?? null;
  }

  static delete(id: string): void {
    const list = this.list().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
