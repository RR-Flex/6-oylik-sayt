import { LINES, TRANSFERS } from "./data.js";

// Получаем все станции без повторений.

export function getAllStations() {
  return [...new Set(LINES.flatMap((line) => line.stations))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

// Определяем линию станции.

export function findStationLine(station) {
  return LINES.find((line) => line.stations.includes(station)) ?? null;
}

// Создаём граф метро.

function makeGraph() {
  const graph = new Map();

  const connect = (from, to) => {
    if (!graph.has(from)) {
      graph.set(from, []);
    }

    graph.get(from).push(to);
  };

  // Связываем соседние станции одной линии.

  for (const line of LINES) {
    line.stations.forEach((station, index) => {
      if (index === 0) return;

      const previous = line.stations[index - 1];

      connect(station, previous);
      connect(previous, station);
    });
  }

  // Добавляем пересадки.

  for (const [first, second] of TRANSFERS) {
    connect(first, second);
    connect(second, first);
  }

  return graph;
}

const graph = makeGraph();

// Поиск кратчайшего пути.

export function findShortestPath(start, finish) {
  if (!start || !finish || !graph.has(start) || !graph.has(finish)) {
    return null;
  }

  if (start === finish) {
    return [start];
  }

  const queue = [start];

  const previous = new Map([[start, null]]);

  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex++];

    for (const next of graph.get(current) ?? []) {
      if (previous.has(next)) continue;

      previous.set(next, current);

      if (next === finish) {
        const path = [finish];

        let step = finish;

        while (previous.get(step) !== null) {
          step = previous.get(step);

          path.unshift(step);
        }

        return path;
      }

      queue.push(next);
    }
  }

  return null;
}

// Проверяем, является ли станция пересадочной.

export function isTransferStation(station) {
  return TRANSFERS.some((pair) => pair.includes(station));
}

// Получаем названия всех линий.

export function getLineNames() {
  return LINES.map((line) => line.name);
}
