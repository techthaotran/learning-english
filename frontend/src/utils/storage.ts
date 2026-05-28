const USER_KEY = 'learning_english_user';

export function getUserName(): string {
  return localStorage.getItem(USER_KEY) || '';
}

export function setUserName(name: string): void {
  localStorage.setItem(USER_KEY, name.trim());
}

export function clearUserName(): void {
  localStorage.removeItem(USER_KEY);
}
