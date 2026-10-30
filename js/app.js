import { LINES, DEMO_TRIPS, NOTIFICATIONS } from "./data.js";

import {
  STORAGE_KEYS,
  readStorage,
  writeStorage,
  escapeHTML,
  onlyDigits,
} from "./storage.js";

import {
  getAllStations,
  findStationLine,
  findShortestPath,
  isTransferStation,
  getLineNames,
} from "./metro.js";

import {
  getCurrentUser,
  setAuthMode,
  getAuthMode,
  saveDemoUser,
  logoutUser,
} from "./auth.js";

import { getCards, addDemoCard, removeDemoCard } from "./cards.js";

const $ = (selector, root = document) => root.querySelector(selector);

const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let pendingCard = null;
let toastTimer = null;
let welcomeMessage = "";

let activeLineFilter = "all";
let stationQuery = "";

// ======================================
// TOAST MESSAGE
// ======================================

function toast(message) {
  const element = $("#toast");

  element.textContent = message;

  element.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2600);
}

// ======================================
// PAGE NAVIGATION
// ======================================

function showPage(pageName) {
  $$(".page").forEach((page) => {
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });

  $$("[data-page-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === pageName);
  });

  $("#mobileMenu").hidden = true;

  if (pageName === "profile") {
    renderProfile();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function setupNavigation() {
  $$("[data-page-link]").forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.pageLink);
    });
  });

  $$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.go);
    });
  });

  $("#mobileMenuButton").addEventListener("click", () => {
    $("#mobileMenu").hidden = !$("#mobileMenu").hidden;
  });

  $("#authButton").addEventListener("click", () => {
    if (getCurrentUser()) {
      showPage("profile");
    } else {
      openAuthModal();
    }
  });

  $("#profileLogin").addEventListener("click", openAuthModal);
}

// ======================================
// MODALS
// ======================================

function setupModals() {
  $$("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      $(`#${button.dataset.close}`).hidden = true;
    });
  });

  $$(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.hidden = true;
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $$(".modal").forEach((modal) => {
        modal.hidden = true;
      });
    }
  });
}

// ======================================
// LIGHT / DARK THEME
// ======================================

function setupTheme() {
  const savedTheme = readStorage(STORAGE_KEYS.theme, "light");

  document.documentElement.dataset.theme = savedTheme;

  updateThemeButton();

  $("#themeToggle").addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";

    document.documentElement.dataset.theme = nextTheme;

    writeStorage(STORAGE_KEYS.theme, nextTheme);

    updateThemeButton();

    toast(
      nextTheme === "dark" ? "Включена тёмная тема" : "Включена светлая тема",
    );
  });
}

function updateThemeButton() {
  const isLight = document.documentElement.dataset.theme === "light";

  $("#themeToggle").textContent = isLight ? "☾" : "☼";

  $("#themeToggle").title = isLight
    ? "Включить тёмную тему"
    : "Включить светлую тему";
}

// ======================================
// LIVE CLOCK
// ======================================

function setupClock() {
  const update = () => {
    const now = new Date();

    $("#liveClock").textContent = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    }).format(now);

    $("#liveDate").textContent = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Asia/Tashkent",
    }).format(now);
  };

  update();

  setInterval(update, 30_000);
}

// ======================================
// NOTIFICATIONS
// ======================================

function setupNotifications() {
  const read = readStorage(STORAGE_KEYS.notificationsRead, false);

  renderNotifications();

  $("#notificationDot").classList.toggle("read", read);

  $("#notificationToggle").addEventListener("click", () => {
    $("#notificationPanel").hidden = !$("#notificationPanel").hidden;

    if (!$("#notificationPanel").hidden) {
      writeStorage(STORAGE_KEYS.notificationsRead, true);

      $("#notificationDot").classList.add("read");
    }
  });

  $("#markNotificationsRead").addEventListener("click", () => {
    writeStorage(STORAGE_KEYS.notificationsRead, true);

    $("#notificationDot").classList.add("read");

    toast("Уведомления отмечены прочитанными");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#notificationPanel, #notificationToggle")) {
      $("#notificationPanel").hidden = true;
    }
  });
}

function renderNotifications() {
  $("#notificationList").innerHTML = NOTIFICATIONS.map(
    (item) => `

      <article class="notification-item">

        <span class="n-icon">
          ${escapeHTML(item.icon)}
        </span>

        <div>

          <b>${escapeHTML(item.title)}</b>

          <p>${escapeHTML(item.text)}</p>

        </div>

      </article>

    `,
  ).join("");
}

// ======================================
// METRO MAP
// ======================================

function renderLineFilters() {
  const filters = $("#lineFilters");

  filters.innerHTML =
    `

    <button class="filter active" data-line="all">
      Все линии
    </button>

  ` +
    getLineNames()
      .map(
        (name) => `

    <button
      class="filter"
      data-line="${escapeHTML(name)}"
    >
      ${escapeHTML(name)}
    </button>

  `,
      )
      .join("");

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-line]");

    if (!button) return;

    activeLineFilter = button.dataset.line;

    $$(".filter", filters).forEach((filter) => {
      filter.classList.toggle("active", filter === button);
    });

    renderMap();
  });
}

// Render metro stations.

function renderMap() {
  const target = $("#metroMap");

  const favoriteStations = readStorage(STORAGE_KEYS.favorites, []);

  const query = stationQuery.trim().toLocaleLowerCase("ru");

  const visibleLines = LINES.filter(
    (line) => activeLineFilter === "all" || line.name === activeLineFilter,
  );

  target.innerHTML = "";

  for (const line of visibleLines) {
    const matchedStations = line.stations.filter((station) =>
      station.toLocaleLowerCase("ru").includes(query),
    );

    if (!matchedStations.length) continue;

    const block = document.createElement("article");

    block.className = "line-block";

    block.innerHTML = `

      <div class="line-title">

        <span
          class="line-dot"
          style="
            --line-color:${line.color};
            background:${line.color}
          "
        ></span>

        ${escapeHTML(line.name)}

        <span style="color:var(--muted);font-weight:500">
          · ${matchedStations.length}
        </span>

      </div>


      <div class="station-pills">

        ${matchedStations
          .map(
            (station) => `

          <button
            class="station-pill ${
              favoriteStations.includes(station) ? "favorite" : ""
            }"
            data-station="${escapeHTML(station)}"
            aria-label="Открыть ${escapeHTML(station)}"
          >

            ${escapeHTML(station)}

            ${
              favoriteStations.includes(station)
                ? '<span class="star">★</span>'
                : ""
            }

          </button>

        `,
          )
          .join("")}

      </div>

    `;

    target.append(block);
  }

  if (!target.children.length) {
    target.innerHTML = `

      <p class="empty-state">
        Станция не найдена. Попробуй изменить запрос.
      </p>

    `;
  }

  $$(".station-pill", target).forEach((button) => {
    button.addEventListener("click", () => {
      showStationInfo(button.dataset.station);
    });
  });
}

// Show information about selected station.

function showStationInfo(station) {
  const line = findStationLine(station);

  if (!line) return;

  const favorites = readStorage(STORAGE_KEYS.favorites, []);

  const isFavorite = favorites.includes(station);

  const info = $("#stationInfo");

  info.hidden = false;

  info.innerHTML = `

    <b>${escapeHTML(station)}</b>

    <p>
      ${escapeHTML(line.name)} линия ·
      ${line.stations.indexOf(station) + 1}-я станция
      в демо-списке
    </p>

    <button id="favoriteStationButton">
      ${isFavorite ? "★ Убрать из избранного" : "☆ Добавить в избранное"}
    </button>

  `;

  $("#favoriteStationButton").addEventListener("click", () => {
    const next = readStorage(STORAGE_KEYS.favorites, []);

    const updated = next.includes(station)
      ? next.filter((item) => item !== station)
      : [...next, station];

    writeStorage(STORAGE_KEYS.favorites, updated);

    renderMap();

    showStationInfo(station);

    toast(
      updated.includes(station)
        ? "Станция добавлена в избранное"
        : "Станция удалена из избранного",
    );
  });
}

function setupMapSearch() {
  renderLineFilters();

  renderMap();

  $("#stationSearch").addEventListener("input", (event) => {
    stationQuery = event.target.value;

    renderMap();
  });
}

// ======================================
// ROUTE PLANNER
// ======================================

function fillStationSelects() {
  const stations = getAllStations();

  for (const selector of ["#routeFrom", "#routeTo"]) {
    const select = $(selector);

    select.innerHTML =
      `

      <option value="">
        Выбери станцию
      </option>

    ` +
      stations
        .map(
          (station) => `

      <option value="${escapeHTML(station)}">
        ${escapeHTML(station)}
      </option>

    `,
        )
        .join("");
  }
}

function setupRoutePlanner() {
  fillStationSelects();

  // Swap route start and finish.

  $("#swapStations").addEventListener("click", () => {
    const from = $("#routeFrom");
    const to = $("#routeTo");

    [from.value, to.value] = [to.value, from.value];
  });

  $("#calculateRoute").addEventListener("click", calculateRoute);

  // Restore last route.

  const lastRoute = readStorage(STORAGE_KEYS.lastRoute, null);

  if (lastRoute) {
    $("#lastRoute").hidden = false;

    $("#restoreLastRoute").textContent = `${lastRoute.from} → ${lastRoute.to}`;

    $("#restoreLastRoute").addEventListener("click", () => {
      $("#routeFrom").value = lastRoute.from;

      $("#routeTo").value = lastRoute.to;

      calculateRoute();
    });
  }
}

// Calculate route.

function calculateRoute() {
  const start = $("#routeFrom").value;

  const finish = $("#routeTo").value;

  const result = $("#routeResult");

  if (!start || !finish) {
    return toast("Выбери начальную и конечную станции");
  }

  if (start === finish) {
    return toast("Выбери две разные станции");
  }

  const path = findShortestPath(start, finish);

  result.hidden = false;

  if (!path) {
    result.innerHTML = `

      <p class="empty-state">
        В демонстрационной схеме путь не найден.
      </p>

    `;

    return;
  }

  const transferCount = path.filter(isTransferStation).length;

  result.innerHTML = `

    <div class="route-summary">

      <span>МАРШРУТ ПОСТРОЕН</span>

      <b>${path.length - 1} перегонов</b>

      <small>
        Пересадочных станций на пути: ${transferCount}.
        Расписание и время в пути не подключены.
      </small>

    </div>


    <div>

      ${path
        .map(
          (station, index) => `

        <div class="route-step">

          <span class="route-step-marker"></span>

          <div>

            <b>${escapeHTML(station)}</b>

            <small>

              ${
                index === 0
                  ? "Начальная станция"
                  : index === path.length - 1
                    ? "Пункт назначения"
                    : isTransferStation(station)
                      ? "Возможная пересадка"
                      : "Следующая станция"
              }

            </small>

          </div>

        </div>

      `,
        )
        .join("")}

    </div>


    <button
      class="button button-outline full-button"
      id="copyRouteButton"
      type="button"
    >
      Скопировать маршрут
    </button>

  `;

  // Save last route.

  writeStorage(STORAGE_KEYS.lastRoute, {
    from: start,
    to: finish,
  });

  $("#lastRoute").hidden = false;

  $("#restoreLastRoute").textContent = `${start} → ${finish}`;

  // Copy route to clipboard.

  $("#copyRouteButton").addEventListener("click", async () => {
    const text = path.join(" → ");

    try {
      await navigator.clipboard.writeText(text);

      toast("Маршрут скопирован");
    } catch {
      toast("Не удалось скопировать. Выдели маршрут вручную.");
    }
  });
}

// ======================================
// AUTHENTICATION
// ======================================

function openAuthModal() {
  setAuthMode("login");

  updateAuthModeUI();

  $("#authModal").hidden = false;
}

function updateAuthModeUI() {
  const isLogin = getAuthMode() === "login";

  $("#authTitle").textContent = isLogin ? "Войти" : "Создать аккаунт";

  $("#authNameWrap").hidden = isLogin;

  $("#toggleAuthMode").textContent = isLogin
    ? "Создать аккаунт"
    : "У меня уже есть аккаунт";

  $("#authPassword").autocomplete = isLogin
    ? "current-password"
    : "new-password";

  $("#authError").textContent = "";
}

function setupAuth() {
  // Switch between login and registration.

  $("#toggleAuthMode").addEventListener("click", () => {
    setAuthMode(getAuthMode() === "login" ? "register" : "login");

    updateAuthModeUI();
  });

  // Submit auth form.

  $("#authForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const phone = $("#authPhone").value.trim();

    const password = $("#authPassword").value;

    const name = $("#authName").value.trim();

    if (!/^\+?[0-9 ()-]{9,18}$/.test(phone)) {
      $("#authError").textContent = "Проверь номер телефона.";

      return;
    }

    if (password.length < 6) {
      $("#authError").textContent = "Пароль должен быть не короче 6 символов.";

      return;
    }

    if (getAuthMode() === "register" && !name) {
      $("#authError").textContent = "Укажи имя.";

      return;
    }

    // В демо пароль намеренно не сохраняется.
    // Реальную проверку выполняет только backend.

    saveDemoUser({
      name: name || "Пассажир",
      phone,
    });

    welcomeMessage =
      getAuthMode() === "register"
        ? "Аккаунт создан в демо-режиме. Добро пожаловать!"
        : "С возвращением!";

    $("#authModal").hidden = true;

    $("#authForm").reset();

    syncAuthButton();

    showPage("profile");

    toast(welcomeMessage);
  });

  // Logout.

  $("#logoutButton").addEventListener("click", () => {
    logoutUser();

    syncAuthButton();

    showPage("home");

    toast("Ты вышел из демо-аккаунта");
  });

  syncAuthButton();
}

function syncAuthButton() {
  $("#authButton").textContent = getCurrentUser() ? "Профиль" : "Войти";
}

// ======================================
// PROFILE
// ======================================

function renderProfile() {
  const user = getCurrentUser();

  $("#profileGuest").hidden = Boolean(user);

  $("#profileContent").hidden = !user;

  if (!user) return;

  $("#profileName").textContent = user.name;

  $("#welcomeNotice").hidden = !welcomeMessage;

  $("#welcomeNotice").textContent = welcomeMessage;

  welcomeMessage = "";

  const cards = getCards();

  $("#cardCount").textContent = cards.length;

  $("#tripCount").textContent = DEMO_TRIPS.length;

  renderCards(cards);

  renderTrips();
}

// Render cards.

function renderCards(cards = getCards()) {
  $("#cardsList").innerHTML = cards
    .map(
      (card) => `

    <article class="transport-card ${card.type.toLowerCase()}">

      <div class="transport-card-top">

        <b>${escapeHTML(card.type)}</b>

        <span>DEMO CARD</span>

      </div>


      <div class="transport-card-number">

        •••• •••• •••• ${escapeHTML(card.last4)}

      </div>


      <div class="transport-card-bottom">

        <span>${escapeHTML(card.phoneMasked)}</span>

        <span>ДОБАВЛЕНА</span>

      </div>


      <button
        class="remove-card"
        data-remove-card="${escapeHTML(card.id)}"
      >
        Удалить
      </button>

    </article>

  `,
    )
    .join("");

  $("#emptyCards").hidden = cards.length > 0;

  // Remove card buttons.

  $$("[data-remove-card]").forEach((button) => {
    button.addEventListener("click", () => {
      removeDemoCard(button.dataset.removeCard);

      renderCards();

      $("#cardCount").textContent = getCards().length;

      toast("Карта удалена из демо-профиля");
    });
  });
}

// Render trip history.

function renderTrips() {
  const filter = $("#tripFilter").value;

  const trips = DEMO_TRIPS.filter(
    (trip) => filter === "all" || trip.type === filter,
  );

  $("#tripsList").innerHTML =
    trips
      .map(
        (trip) => `

    <article class="trip-row">

      <div>

        <div class="trip-route">

          ${escapeHTML(trip.from)}

          <span style="color:var(--blue)">→</span>

          ${escapeHTML(trip.to)}

        </div>

        <div class="trip-meta">

          ${escapeHTML(trip.date)}
          ·
          ${escapeHTML(trip.vehicle)}

        </div>

      </div>


      <div class="trip-cost">

        ${trip.cost.toLocaleString("ru-RU")} сум

      </div>

    </article>

  `,
      )
      .join("") ||
    `

    <p class="empty-state">
      Нет поездок для выбранного фильтра.
    </p>

  `;
}

// ======================================
// PROFILE EVENTS
// ======================================

function setupProfile() {
  $("#tripFilter").addEventListener("change", renderTrips);

  // Open add card modal.

  $("#addCardButton").addEventListener("click", () => {
    $("#cardForm").reset();

    $("#cardError").textContent = "";

    updateCardPreview();

    $("#cardModal").hidden = false;
  });

  $("#cardType").addEventListener("change", updateCardPreview);

  $("#cardForm").addEventListener("submit", handleCardSubmit);

  $("#otpForm").addEventListener("submit", handleOtpSubmit);
}

// Update card design.

function updateCardPreview() {
  const type = $("#cardType").value;

  const preview = $("#selectedCardPreview");

  preview.className = `card-preview ${type.toLowerCase()}`;

  preview.innerHTML = `

    <b>${escapeHTML(type)}</b>

    <small>•••• •••• •••• 0000</small>

  `;
}

// Mask phone.

function maskPhone(phone) {
  const digits = onlyDigits(phone);

  return digits.length >= 4 ? `••• ••• ${digits.slice(-4)}` : "•••";
}

// ======================================
// ADD CARD
// ======================================

function handleCardSubmit(event) {
  event.preventDefault();

  if (!getCurrentUser()) {
    return toast("Сначала войди в демо-аккаунт");
  }

  const type = $("#cardType").value;

  const number = onlyDigits($("#cardNumber").value);

  const phone = $("#cardPhone").value.trim();

  const minDigits = type === "ATTO" ? 8 : 16;

  if (number.length < minDigits || number.length > 19) {
    $("#cardError").textContent =
      `Номер должен содержать ${minDigits}–19 цифр.`;

    return;
  }

  if (!/^\+?[0-9 ()-]{9,18}$/.test(phone)) {
    $("#cardError").textContent = "Проверь номер телефона.";

    return;
  }

  // Сохраняем только тип карты,
  // последние четыре цифры и замаскированный телефон.

  pendingCard = {
    type,

    last4: number.slice(-4),

    phoneMasked: maskPhone(phone),

    channel: $("#verifyChannel").value,
  };

  // Очищаем полное значение номера.

  $("#cardNumber").value = "";

  $("#cardModal").hidden = true;

  $("#otpDescription").textContent = `

    Демо-подтверждение ${type}
    •••• ${pendingCard.last4}
    через ${pendingCard.channel.toUpperCase()}.
    Реальная отправка кода не подключена.

  `;

  $("#otpCode").value = "";

  $("#otpError").textContent = "";

  $("#otpModal").hidden = false;
}

// ======================================
// CONFIRM CARD
// ======================================

function handleOtpSubmit(event) {
  event.preventDefault();

  if ($("#otpCode").value !== "123456") {
    $("#otpError").textContent = "Неверный тестовый код. Используй 123456.";

    return;
  }

  if (!pendingCard) return;

  const result = addDemoCard(pendingCard);

  if (!result.ok && result.reason === "duplicate") {
    $("#otpError").textContent =
      "Такая карта уже добавлена (совпадает тип и последние 4 цифры).";

    return;
  }

  pendingCard = null;

  $("#otpModal").hidden = true;

  renderProfile();

  toast("Карта добавлена в демо-профиль");
}

// ======================================
// INIT
// ======================================

function init() {
  setupNavigation();

  setupModals();

  setupTheme();

  setupClock();

  setupNotifications();

  setupMapSearch();

  setupRoutePlanner();

  setupAuth();

  setupProfile();

  renderProfile();
}

// Start application.

init();
