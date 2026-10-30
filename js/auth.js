import {
  readStorage,
  writeStorage,
  removeStorage,
  STORAGE_KEYS,
} from "./storage.js";

let mode = "login";

export function getCurrentUser() {
  return readStorage(STORAGE_KEYS.user, null);
}

export function setAuthMode(nextMode) {
  mode = nextMode;

  return mode;
}

export function getAuthMode() {
  return mode;
}

// Создаём демо-профиль.

export function saveDemoUser({ name, phone }) {
  const user = {
    name: name.trim() || "Пассажир",
    phone: phone.replace(/\s/g, ""),
    createdAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.user, user);

  return user;
}

// Выход из профиля.

export function logoutUser() {
  removeStorage(STORAGE_KEYS.user);
}
