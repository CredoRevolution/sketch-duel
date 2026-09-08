/**
 * Проверка артефактов, которые уедут в браузер.
 *
 * Берёт public/model/*, прогоняет через shared/model.js (тот же самый код,
 * что исполняется у пользователя) на отложенной выборке и сверяет:
 *   - формат и целостность весов,
 *   - точность после int8-квантования,
 *   - что реплеи для второго режима валидны и рисуются,
 *   - что растеризатор детерминирован и инвариантен к масштабу/сдвигу.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadModel, predict, topK } from '../shared/model.js'
import { rasterize, fromQuickDraw, strokesBBox, INPUT_SIZE } from '../shared/sketch.js'
import { CATEGORIES } from '../shared/categories.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.cache')
const PUB = path.join(ROOT, 'public')

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

async function main() {
  console.log('\n=== 1. Модель ===')
  const meta = JSON.parse(await readFile(path.join(PUB, 'model', 'model.json'), 'utf8'))
  const binBuf = await readFile(path.join(PUB, 'model', 'model.bin'))
  const bin = binBuf.buffer.slice(binBuf.byteOffset, binBuf.byteOffset + binBuf.byteLength)
  const model = loadModel(meta, bin)
  check('модель загружается', true, `${meta.layers.map((l) => l.inN).join('->')}->${meta.classes.length}`)
  check('классы совпадают с shared/categories.js', JSON.stringify(meta.classes) === JSON.stringify(CATEGORIES.map((c) => c.key)))
  check('размер весов', binBuf.length < 700 * 1024, `${(binBuf.length / 1024).toFixed(0)} КБ`)

  const expectedBytes = meta.layers.reduce((a, l) => a + l.scales.bytes + l.weights.bytes + l.bias.bytes, 0)
  check('размер .bin соответствует описанию слоёв', expectedBytes === binBuf.length, `${expectedBytes} vs ${binBuf.length}`)

  let finite = true
  for (const L of model.layers) {
    for (let i = 0; i < L.w.length; i++) if (!Number.isFinite(L.w[i])) finite = false
    for (let i = 0; i < L.b.length; i++) if (!Number.isFinite(L.b[i])) finite = false
  }
  check('все веса конечны (нет NaN/Infinity)', finite)

  console.log('\n=== 2. Точность на отложенной выборке ===')
  const dmeta = JSON.parse(await readFile(path.join(CACHE, 'dataset.meta.json'), 'utf8'))
  const data = await readFile(path.join(CACHE, 'dataset.bin'))
  const valOff = dmeta.train * INPUT_SIZE + dmeta.train
  const valX = data.subarray(valOff, valOff + dmeta.val * INPUT_SIZE)
  const valY = data.subarray(valOff + dmeta.val * INPUT_SIZE, valOff + dmeta.val * INPUT_SIZE + dmeta.val)

  const input = new Float32Array(INPUT_SIZE)
  let top1 = 0
  let top3 = 0
  const perCls = new Int32Array(meta.classes.length)
  const perOk = new Int32Array(meta.classes.length)
  const t0 = Date.now()
  for (let s = 0; s < dmeta.val; s++) {
    for (let i = 0; i < INPUT_SIZE; i++) input[i] = valX[s * INPUT_SIZE + i] / 255
    const probs = predict(model, input)
    const y = valY[s]
    perCls[y]++
    let best = 0
    for (let c = 1; c < probs.length; c++) if (probs[c] > probs[best]) best = c
    if (best === y) {
      top1++
      perOk[y]++
    }
    let better = 0
    for (let c = 0; c < probs.length; c++) if (probs[c] > probs[y]) better++
    if (better < 3) top3++
  }
  const acc1 = top1 / dmeta.val
  const acc3 = top3 / dmeta.val
  const perMs = (Date.now() - t0) / dmeta.val
  console.log(`  top1 = ${(acc1 * 100).toFixed(2)}%   top3 = ${(acc3 * 100).toFixed(2)}%   (${dmeta.val} примеров)`)
  console.log(`  один прогон ≈ ${perMs.toFixed(3)} мс`)
  check('точность после квантования не просела', Math.abs(acc1 - meta.metrics.top1) < 0.01, `в обучении было ${(meta.metrics.top1 * 100).toFixed(2)}%`)
  check('top1 приемлема для игры', acc1 > 0.8)
  check('top3 приемлема для игры', acc3 > 0.94)
  check('инференс укладывается в кадр', perMs < 5)

  const ranked = meta.classes
    .map((k, i) => ({ k, acc: perOk[i] / perCls[i] }))
    .sort((a, b) => b.acc - a.acc)
  console.log(`  лучшие: ${ranked.slice(0, 3).map((r) => `${r.k} ${(r.acc * 100).toFixed(0)}%`).join(', ')}`)
  console.log(`  худшие: ${ranked.slice(-3).map((r) => `${r.k} ${(r.acc * 100).toFixed(0)}%`).join(', ')}`)
  check('нет полностью нерабочих классов', ranked[ranked.length - 1].acc > 0.4, `худший ${ranked[ranked.length - 1].k}`)

  console.log('\n=== 3. Растеризатор ===')
  const sample = [
    [[20, 60, 100, 140, 180, 220], [40, 30, 35, 30, 40, 45]],
    [[120, 120], [45, 200]]
  ]
  const strokes = fromQuickDraw(sample)
  const a = rasterize(strokes)
  const b = rasterize(strokes)
  check('детерминирован', a.every((v, i) => v === b[i]))

  // Тот же рисунок, увеличенный в 3 раза и сдвинутый, должен дать почти тот же битмап.
  const scaled = strokes.map((s) => s.map((v, i) => v * 3 + (i % 2 ? 500 : 250)))
  const c = rasterize(scaled)
  let maxDiff = 0
  for (let i = 0; i < a.length; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i] - c[i]))
  check('инвариантен к масштабу и сдвигу', maxDiff < 0.12, `макс. расхождение пикселя ${maxDiff.toFixed(3)}`)

  const blank = rasterize([])
  check('пустой ввод не ломает', blank.length === INPUT_SIZE && blank.every((v) => v === 0))
  const dot = rasterize([[500, 500]])
  check('одиночная точка рисуется', dot.some((v) => v > 0.2))

  console.log('\n=== 4. Реплеи для режима 2 ===')
  const files = (await readdir(path.join(PUB, 'replay'))).filter((f) => f.endsWith('.json') && f !== 'index.json')
  check('файл на каждую категорию', files.length === CATEGORIES.length, `${files.length} файлов`)

  let totalItems = 0
  let minItems = Infinity
  let badGeometry = 0
  let recognizedByModel = 0
  for (const cat of CATEGORIES) {
    const j = JSON.parse(await readFile(path.join(PUB, 'replay', `${cat.key}.json`), 'utf8'))
    totalItems += j.items.length
    minItems = Math.min(minItems, j.items.length)
    for (const item of j.items) {
      const st = fromQuickDraw(item)
      const bb = strokesBBox(st)
      if (!bb || Math.max(bb.w, bb.h) < 40 || !st.length) badGeometry++
    }
    // Реплеи — рисунки, которых модель не видела при обучении: заодно честная проверка обобщения.
    for (const item of j.items.slice(0, 20)) {
      const probs = predict(model, rasterize(fromQuickDraw(item)))
      if (topK(model, probs, 3).some((t) => t.key === cat.key)) recognizedByModel++
    }
  }
  check('в каждой категории достаточно рисунков', minItems >= 40, `минимум ${minItems}`)
  check('геометрия рисунков валидна', badGeometry === 0, `${badGeometry} проблемных`)
  const genRate = recognizedByModel / (CATEGORIES.length * 20)
  check('модель узнаёт невиданные рисунки (top3)', genRate > 0.9, `${(genRate * 100).toFixed(1)}%`)
  console.log(`  всего рисунков для реплея: ${totalItems}`)

  console.log(`\n${failures === 0 ? 'ВСЁ ХОРОШО' : `ПРОБЛЕМ: ${failures}`}\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
