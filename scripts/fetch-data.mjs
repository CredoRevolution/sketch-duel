/**
 * Готовит все данные проекта из открытого датасета Google QuickDraw:
 *   1) качает нужные куски .ndjson по HTTP Range (полные файлы весят 50-150 МБ),
 *   2) растеризует рисунки в 28x28 ТЕМ ЖЕ кодом, что и браузер (shared/sketch.js),
 *   3) складывает обучающую выборку в .cache/dataset.bin,
 *   4) выкладывает штрихи для режима «угадай, что рисует ИИ» в public/replay/.
 *
 * Повторные запуски используют кэш сырых рисунков в .cache/raw/.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES } from '../shared/categories.js'
import { fromQuickDraw, rasterize, strokesBBox, INPUT_SIZE } from '../shared/sketch.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.cache')
const RAW = path.join(CACHE, 'raw')
const REPLAY_DIR = path.join(ROOT, 'public', 'replay')

const N_TRAIN = Number(process.env.N_TRAIN ?? 2400)
const N_VAL = Number(process.env.N_VAL ?? 300)
const N_REPLAY = Number(process.env.N_REPLAY ?? 60)
const N_NEEDED = N_TRAIN + N_VAL + N_REPLAY
const AUG_COPIES = Number(process.env.AUG_COPIES ?? 1) // доп. аугментированных копий на обучающий рисунок
const CHUNK = 4 * 1024 * 1024
const CONCURRENCY = 5
const BASE = 'https://storage.googleapis.com/quickdraw_dataset/full/simplified'

const log = (...a) => console.log(...a)

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/** Годится ли рисунок для показа в режиме «угадай, что рисует ИИ». */
function isGoodForReplay(strokes) {
  if (strokes.length < 1 || strokes.length > 14) return false
  let points = 0
  for (const s of strokes) points += s.length / 2
  if (points < 8 || points > 220) return false
  const bb = strokesBBox(strokes)
  if (!bb) return false
  return Math.max(bb.w, bb.h) > 60 // не микроскопические каракули
}

async function fetchCategory(key) {
  const cacheFile = path.join(RAW, `${key}.json`)
  if (await exists(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'))
    if (cached.length >= N_NEEDED) {
      log(`  [cache] ${key}: ${cached.length}`)
      return cached
    }
  }

  const url = `${BASE}/${encodeURIComponent(key)}.ndjson`
  const drawings = []
  let offset = 0
  let tail = ''
  let guard = 0

  while (drawings.length < N_NEEDED && guard++ < 12) {
    const res = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + CHUNK - 1}` } })
    if (!res.ok && res.status !== 206) throw new Error(`${key}: HTTP ${res.status}`)
    const text = tail + (await res.text())
    const bytes = Number(res.headers.get('content-length') ?? 0)
    offset += CHUNK
    const lines = text.split('\n')
    tail = lines.pop() ?? ''
    for (const line of lines) {
      if (!line) continue
      let row
      try {
        row = JSON.parse(line)
      } catch {
        continue
      }
      if (!row.recognized) continue // берём только «узнанные» — чище метки и приятнее реплеи
      drawings.push(row.drawing)
      if (drawings.length >= N_NEEDED) break
    }
    if (bytes < CHUNK) break // файл кончился
  }

  if (drawings.length < N_NEEDED) {
    throw new Error(`${key}: получено только ${drawings.length} из ${N_NEEDED}`)
  }
  await writeFile(cacheFile, JSON.stringify(drawings))
  log(`  [net]   ${key}: ${drawings.length}`)
  return drawings
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx], idx)
      }
    })
  )
  return out
}

function randAug() {
  return {
    scale: 0.88 + Math.random() * 0.24,
    dx: (Math.random() - 0.5) * 2.4,
    dy: (Math.random() - 0.5) * 2.4,
    rot: (Math.random() - 0.5) * 0.28
  }
}

function toU8(bmp, dst, at) {
  for (let i = 0; i < INPUT_SIZE; i++) dst[at + i] = Math.round(Math.min(1, Math.max(0, bmp[i])) * 255)
}

async function main() {
  await mkdir(RAW, { recursive: true })
  await mkdir(REPLAY_DIR, { recursive: true })

  log(`Скачиваю ${CATEGORIES.length} категорий (нужно ${N_NEEDED} рисунков на каждую)...`)
  const t0 = Date.now()
  const raw = await mapLimit(CATEGORIES, CONCURRENCY, (c) => fetchCategory(c.key))
  log(`Загрузка заняла ${((Date.now() - t0) / 1000).toFixed(0)} с\n`)

  const trainPerCat = N_TRAIN * (1 + AUG_COPIES)
  const trainTotal = trainPerCat * CATEGORIES.length
  const valTotal = N_VAL * CATEGORIES.length
  const trainX = Buffer.allocUnsafe(trainTotal * INPUT_SIZE)
  const trainY = Buffer.allocUnsafe(trainTotal)
  const valX = Buffer.allocUnsafe(valTotal * INPUT_SIZE)
  const valY = Buffer.allocUnsafe(valTotal)

  let tI = 0
  let vI = 0
  const tR = Date.now()

  for (let c = 0; c < CATEGORIES.length; c++) {
    const cat = CATEGORIES[c]
    const items = raw[c]
    // 1. обучающая часть
    for (let i = 0; i < N_TRAIN; i++) {
      const strokes = fromQuickDraw(items[i])
      toU8(rasterize(strokes), trainX, tI * INPUT_SIZE)
      trainY[tI++] = c
      for (let a = 0; a < AUG_COPIES; a++) {
        toU8(rasterize(strokes, randAug()), trainX, tI * INPUT_SIZE)
        trainY[tI++] = c
      }
    }
    // 2. валидация — только чистые, без аугментации
    for (let i = N_TRAIN; i < N_TRAIN + N_VAL; i++) {
      toU8(rasterize(fromQuickDraw(items[i])), valX, vI * INPUT_SIZE)
      valY[vI++] = c
    }
    // 3. реплеи — рисунки, которых модель не видела
    const replay = []
    for (let i = N_TRAIN + N_VAL; i < items.length && replay.length < N_REPLAY; i++) {
      const strokes = fromQuickDraw(items[i])
      if (!isGoodForReplay(strokes)) continue
      replay.push(items[i])
    }
    await writeFile(
      path.join(REPLAY_DIR, `${cat.key}.json`),
      JSON.stringify({ key: cat.key, ru: cat.ru, emoji: cat.emoji, items: replay })
    )
    log(`  ${cat.key.padEnd(12)} train=${N_TRAIN}(+${N_TRAIN * AUG_COPIES} aug) val=${N_VAL} replay=${replay.length}`)
  }

  log(`\nРастеризация заняла ${((Date.now() - tR) / 1000).toFixed(0)} с`)

  const meta = {
    inputSize: INPUT_SIZE,
    numClasses: CATEGORIES.length,
    classes: CATEGORIES.map((c) => c.key),
    train: tI,
    val: vI,
    createdAt: new Date().toISOString()
  }
  await writeFile(path.join(CACHE, 'dataset.meta.json'), JSON.stringify(meta, null, 2))
  await new Promise((res, rej) => {
    const ws = createWriteStream(path.join(CACHE, 'dataset.bin'))
    ws.on('error', rej)
    ws.on('finish', res)
    ws.write(trainX.subarray(0, tI * INPUT_SIZE))
    ws.write(trainY.subarray(0, tI))
    ws.write(valX.subarray(0, vI * INPUT_SIZE))
    ws.write(valY.subarray(0, vI))
    ws.end()
  })

  // Индекс категорий для клиента
  await writeFile(
    path.join(ROOT, 'public', 'replay', 'index.json'),
    JSON.stringify({ categories: CATEGORIES })
  )

  log(`\nГотово: train=${tI}, val=${vI}, файл .cache/dataset.bin`)
}

main().catch((e) => {
  console.error('ОШИБКА:', e.message)
  process.exit(1)
})
