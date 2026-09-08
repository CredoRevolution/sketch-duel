/**
 * Общий модуль растеризации штрихов.
 *
 * ВАЖНО: этот файл используется ОДНОВРЕМЕННО
 *   - в scripts/fetch-data.mjs при подготовке обучающей выборки (Node)
 *   - в браузере, когда пользователь рисует (Nuxt)
 * Любое расхождение между обучением и инференсом убивает точность,
 * поэтому препроцессинг существует ровно в одном экземпляре.
 *
 * Формат штриха — плоский массив координат: [x0, y0, x1, y1, ...].
 * Система координат произвольная: всё нормализуется по bbox.
 */

export const RASTER = 28 // сторона итогового битмапа (вход модели)
export const SS = 4 // коэффициент суперсемплинга
export const HI = RASTER * SS // 112 — разрешение, в котором реально рисуем
export const MARGIN = 2 // поля в координатах 28x28
export const BOX = RASTER - MARGIN * 2 // 24 — в этот квадрат вписываем рисунок
export const INPUT_SIZE = RASTER * RASTER // 784

const LINE_R = 3.0 // радиус пера в HI-координатах (~1.5px после даунсемпла)
const STEP = 0.6 // шаг семплирования вдоль сегмента, HI-пиксели

/** QuickDraw хранит штрих как [[x...], [y...]] — приводим к плоскому виду. */
export function fromQuickDraw(drawing) {
  const out = []
  for (const [xs, ys] of drawing) {
    const n = Math.min(xs.length, ys.length)
    if (n === 0) continue
    const flat = new Array(n * 2)
    for (let i = 0; i < n; i++) {
      flat[i * 2] = xs[i]
      flat[i * 2 + 1] = ys[i]
    }
    out.push(flat)
  }
  return out
}

/** Обратное преобразование — для компактного хранения реплеев. */
export function toQuickDraw(strokes) {
  return strokes.map((s) => {
    const xs = []
    const ys = []
    for (let i = 0; i < s.length; i += 2) {
      xs.push(Math.round(s[i]))
      ys.push(Math.round(s[i + 1]))
    }
    return [xs, ys]
  })
}

export function strokesBBox(strokes) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of strokes) {
    for (let i = 0; i < s.length; i += 2) {
      const x = s[i]
      const y = s[i + 1]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (minX === Infinity) return null
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

export function isEmpty(strokes) {
  return !strokes || strokes.length === 0 || strokes.every((s) => s.length < 2)
}

function stamp(buf, px, py, r) {
  const x0 = Math.max(0, Math.floor(px - r - 1))
  const x1 = Math.min(HI - 1, Math.ceil(px + r + 1))
  const y0 = Math.max(0, Math.floor(py - r - 1))
  const y1 = Math.min(HI - 1, Math.ceil(py + r + 1))
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - py
    const row = y * HI
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - px
      const d = Math.sqrt(dx * dx + dy * dy)
      let a = r - d + 0.5
      if (a <= 0) continue
      if (a > 1) a = 1
      const idx = row + x
      if (a > buf[idx]) buf[idx] = a // max-блендинг: повторный проход не «пережигает» линию
    }
  }
}

/**
 * Штрихи -> Float32Array(784) со значениями 0..1.
 * aug — опциональная аугментация (только на обучении):
 *   { scale: 0.9..1.1, dx, dy: сдвиг в 28-координатах, rot: радианы }
 */
export function rasterize(strokes, aug) {
  const out = new Float32Array(INPUT_SIZE)
  if (isEmpty(strokes)) return out
  const bb = strokesBBox(strokes)
  if (!bb) return out

  const span = Math.max(bb.w, bb.h)
  const augScale = aug?.scale ?? 1
  // Вписываем bbox в квадрат BOX с сохранением пропорций.
  const scale = (span > 1e-6 ? (BOX * SS) / span : 1) * augScale
  const cx = (bb.minX + bb.maxX) / 2
  const cy = (bb.minY + bb.maxY) / 2
  const rot = aug?.rot ?? 0
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const ox = HI / 2 + (aug?.dx ?? 0) * SS
  const oy = HI / 2 + (aug?.dy ?? 0) * SS

  const hi = new Float32Array(HI * HI)
  const tx = (x, y) => ox + ((x - cx) * cos - (y - cy) * sin) * scale
  const ty = (x, y) => oy + ((x - cx) * sin + (y - cy) * cos) * scale

  for (const s of strokes) {
    const n = s.length / 2
    if (n === 0) continue
    if (n === 1) {
      stamp(hi, tx(s[0], s[1]), ty(s[0], s[1]), LINE_R)
      continue
    }
    for (let i = 0; i < n - 1; i++) {
      const ax = tx(s[i * 2], s[i * 2 + 1])
      const ay = ty(s[i * 2], s[i * 2 + 1])
      const bx = tx(s[i * 2 + 2], s[i * 2 + 3])
      const by = ty(s[i * 2 + 2], s[i * 2 + 3])
      const dx = bx - ax
      const dy = by - ay
      const len = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(len / STEP))
      for (let k = 0; k <= steps; k++) {
        const t = k / steps
        stamp(hi, ax + dx * t, ay + dy * t, LINE_R)
      }
    }
  }

  // Даунсемпл усреднением блоков SS x SS — даёт мягкое сглаживание.
  const inv = 1 / (SS * SS)
  for (let y = 0; y < RASTER; y++) {
    for (let x = 0; x < RASTER; x++) {
      let sum = 0
      for (let j = 0; j < SS; j++) {
        const row = (y * SS + j) * HI + x * SS
        for (let i = 0; i < SS; i++) sum += hi[row + i]
      }
      out[y * RASTER + x] = sum * inv
    }
  }
  return out
}

/** Отладочный вывод битмапа в ASCII — используется тестами. */
export function bitmapToAscii(bmp) {
  const chars = ' .:-=+*#%@'
  let s = ''
  for (let y = 0; y < RASTER; y++) {
    for (let x = 0; x < RASTER; x++) {
      const v = bmp[y * RASTER + x]
      s += chars[Math.min(chars.length - 1, Math.round(v * (chars.length - 1)))]
    }
    s += '\n'
  }
  return s
}
