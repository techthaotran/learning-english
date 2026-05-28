const REMINDER_KEY = 'learning_english_study_reminder';
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const REMINDER_OFFSETS_MINUTES = [30, 60, 120, 180] as const;

interface ReminderState {
  dayKey: string;
  anchorAtMs: number;
  firedOffsets: number[];
}

export interface ReminderStatus {
  dueNow: boolean;
  nextOffsetMinutes: number | null;
  enabled: boolean;
}

function getVietnamDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function readState(): ReminderState | null {
  const raw = localStorage.getItem(REMINDER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReminderState;
  } catch {
    return null;
  }
}

function writeState(state: ReminderState): void {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(state));
}

function getTodayState(): ReminderState {
  const today = getVietnamDayKey();
  const state = readState();
  if (!state || state.dayKey !== today) {
    const nextState: ReminderState = {
      dayKey: today,
      anchorAtMs: Date.now(),
      firedOffsets: [],
    };
    writeState(nextState);
    return nextState;
  }
  return state;
}

function getDueOffsets(state: ReminderState): number[] {
  const elapsedMinutes = (Date.now() - state.anchorAtMs) / 60000;
  return REMINDER_OFFSETS_MINUTES.filter(
    (offset) => elapsedMinutes >= offset && !state.firedOffsets.includes(offset)
  );
}

export function getReminderStatus(): ReminderStatus {
  const state = getTodayState();
  const dueOffsets = getDueOffsets(state);
  const elapsedMinutes = (Date.now() - state.anchorAtMs) / 60000;
  const nextOffsetMinutes =
    REMINDER_OFFSETS_MINUTES.find((offset) => elapsedMinutes < offset) ?? null;

  return {
    dueNow: dueOffsets.length > 0,
    nextOffsetMinutes,
    enabled: typeof window !== 'undefined' && 'Notification' in window,
  };
}

export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export async function notifyDueReminder(userName: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const state = getTodayState();
  const dueOffsets = getDueOffsets(state);
  if (dueOffsets.length === 0) return;

  if (Notification.permission !== 'granted') return;

  const firstDue = Math.min(...dueOffsets);
  const title = 'Đến giờ ôn tập từ vựng';
  const body = `Hey ${userName || 'bạn'}, đã tới mốc ${firstDue} phút. Mở Flashcard để ôn ngay nhé!`;
  new Notification(title, { body });

  const nextState: ReminderState = {
    ...state,
    firedOffsets: [...new Set([...state.firedOffsets, ...dueOffsets])],
  };
  writeState(nextState);
}

export function resetReminderAnchor(): void {
  const state = getTodayState();
  const nextState: ReminderState = {
    ...state,
    anchorAtMs: Date.now(),
    firedOffsets: [],
  };
  writeState(nextState);
}

export function debugSetElapsedMinutes(minutes: number): void {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const state = getTodayState();
  const nextState: ReminderState = {
    ...state,
    anchorAtMs: Date.now() - safeMinutes * 60 * 1000,
    firedOffsets: [],
  };
  writeState(nextState);
}
