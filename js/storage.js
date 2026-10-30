const PREFIX = "tm_portal_v2_";

export const STORAGE_KEYS = {
  user: `${PREFIX}user`,
  cards: `${PREFIX}cards`,
  theme: `${PREFIX}theme`,
  favorites: `${PREFIX}favorites`,
  lastRoute: `${PREFIX}last_route`,
  notificationsRead: `${PREFIX}notifications_read`,
};

// Получение данных.

export function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn(`Не удалось прочитать ${key}:`, error);

    return fallback;
  }
}

// Сохранение данных.

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));

    return true;
  } catch (error) {
    console.error(`Не удалось сохранить ${key}:`, error);

    return false;
  }
}

// Удаление данных.

export function removeStorage(key) {
  localStorage.removeItem(key);
}

// Защита HTML-строк от вставки разметки.

export function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

// Оставляем в строке только цифры.

export function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}
