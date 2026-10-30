import { readStorage, writeStorage, STORAGE_KEYS } from "./storage.js";

// Получаем сохранённые карты.

export function getCards() {
  return readStorage(STORAGE_KEYS.cards, []);
}

// Добавляем новую демо-карту.

export function addDemoCard(card) {
  const cards = getCards();

  const duplicate = cards.some(
    (item) => item.type === card.type && item.last4 === card.last4,
  );

  if (duplicate) {
    return {
      ok: false,
      reason: "duplicate",
    };
  }

  const newCard = {
    ...card,

    id: globalThis.crypto?.randomUUID?.() ?? `card-${Date.now()}`,

    addedAt: new Date().toISOString(),
  };

  cards.push(newCard);

  writeStorage(STORAGE_KEYS.cards, cards);

  return {
    ok: true,
    card: newCard,
  };
}

// Удаляем карту.

export function removeDemoCard(cardId) {
  const cards = getCards().filter((card) => card.id !== cardId);

  writeStorage(STORAGE_KEYS.cards, cards);

  return cards;
}
