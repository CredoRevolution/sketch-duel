/**
 * Отдаёт человеческие рисунки для режима «угадай, что рисует ИИ».
 * Каждая категория лежит в отдельном файле public/replay/<key>.json и
 * подгружается по требованию, поэтому старт страницы ничего не весит.
 */
const cache = new Map()
const inflight = new Map()

export function useReplay() {
  async function loadCategory(key) {
    if (cache.has(key)) return cache.get(key)
    if (inflight.has(key)) return inflight.get(key)
    const p = (async () => {
      const res = await fetch(`/replay/${encodeURIComponent(key)}.json`)
      if (!res.ok) throw new Error(`не найден набор рисунков «${key}»`)
      const data = await res.json()
      if (!data.items?.length) throw new Error(`пустой набор рисунков «${key}»`)
      cache.set(key, data)
      inflight.delete(key)
      return data
    })()
    inflight.set(key, p)
    return p
  }

  /** Случайный рисунок категории; seen — ключи уже показанных, чтобы не повторяться. */
  async function randomDrawing(key, seen = new Set()) {
    const data = await loadCategory(key)
    const free = data.items.map((_, i) => i).filter((i) => !seen.has(`${key}:${i}`))
    const pool = free.length ? free : data.items.map((_, i) => i)
    const idx = pool[Math.floor(Math.random() * pool.length)]
    return { drawing: data.items[idx], id: `${key}:${idx}` }
  }

  /** Прогреть кэш соседних категорий, чтобы следующий раунд стартовал мгновенно. */
  function prefetch(keys) {
    for (const k of keys) loadCategory(k).catch(() => {})
  }

  return { loadCategory, randomDrawing, prefetch }
}
