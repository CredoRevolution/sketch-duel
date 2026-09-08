/**
 * Обучение классификатора рисунков.
 *
 * Архитектура: MLP 784 -> 256 -> 128 -> 30, ReLU, dropout, Adam.
 * Всё на чистом JS/Float32Array — проекту не нужны ни Python, ни нативные пакеты.
 * На выходе — int8-квантованные веса (~240 КБ) в public/model/, которые
 * браузер разворачивает в Float32Array и считает за доли миллисекунды.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, '.cache')
const OUT = path.join(ROOT, 'public', 'model')

const H1 = Number(process.env.H1 ?? 256)
const H2 = Number(process.env.H2 ?? 128)
const EPOCHS = Number(process.env.EPOCHS ?? 14)
const BATCH = Number(process.env.BATCH ?? 128)
const LR = Number(process.env.LR ?? 1.2e-3)
const DROPOUT = Number(process.env.DROPOUT ?? 0.15)
const L2REG = Number(process.env.L2 ?? 1e-5)

// ---------- слой ----------
function makeLayer(inN, outN) {
  const w = new Float32Array(outN * inN)
  const std = Math.sqrt(2 / inN) // He-инициализация под ReLU
  for (let i = 0; i < w.length; i++) {
    const u = Math.random() || 1e-9
    const v = Math.random()
    w[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std
  }
  return {
    inN,
    outN,
    w,
    b: new Float32Array(outN),
    gw: new Float32Array(outN * inN),
    gb: new Float32Array(outN),
    mw: new Float32Array(outN * inN),
    vw: new Float32Array(outN * inN),
    mb: new Float32Array(outN),
    vb: new Float32Array(outN)
  }
}

/** out[s][o] = sum_i x[s][i] * w[o][i] + b[o] */
function forwardLinear(L, x, out, B) {
  const inN = L.inN
  const outN = L.outN
  const w = L.w
  const b = L.b
  for (let s = 0; s < B; s++) {
    const xo = s * inN
    const oo = s * outN
    for (let o = 0; o < outN; o++) {
      const wo = o * inN
      let sum = b[o]
      for (let i = 0; i < inN; i++) sum += x[xo + i] * w[wo + i]
      out[oo + o] = sum
    }
  }
}

/** Градиенты линейного слоя: gw += dz^T x, gb += dz, dx = dz * w */
function backwardLinear(L, x, dz, dx, B) {
  const inN = L.inN
  const outN = L.outN
  const w = L.w
  const gw = L.gw
  const gb = L.gb
  if (dx) dx.fill(0, 0, B * inN)
  for (let s = 0; s < B; s++) {
    const xo = s * inN
    const zo = s * outN
    for (let o = 0; o < outN; o++) {
      const g = dz[zo + o]
      if (g === 0) continue
      const wo = o * inN
      gb[o] += g
      if (dx) {
        for (let i = 0; i < inN; i++) {
          gw[wo + i] += g * x[xo + i]
          dx[xo + i] += g * w[wo + i]
        }
      } else {
        for (let i = 0; i < inN; i++) gw[wo + i] += g * x[xo + i]
      }
    }
  }
}

function adam(L, lr, t) {
  const b1 = 0.9
  const b2 = 0.999
  const eps = 1e-8
  const c1 = 1 - Math.pow(b1, t)
  const c2 = 1 - Math.pow(b2, t)
  const { w, b, gw, gb, mw, vw, mb, vb } = L
  for (let i = 0; i < w.length; i++) {
    const g = gw[i] + L2REG * w[i]
    mw[i] = b1 * mw[i] + (1 - b1) * g
    vw[i] = b2 * vw[i] + (1 - b2) * g * g
    w[i] -= (lr * (mw[i] / c1)) / (Math.sqrt(vw[i] / c2) + eps)
    gw[i] = 0
  }
  for (let i = 0; i < b.length; i++) {
    const g = gb[i]
    mb[i] = b1 * mb[i] + (1 - b1) * g
    vb[i] = b2 * vb[i] + (1 - b2) * g * g
    b[i] -= (lr * (mb[i] / c1)) / (Math.sqrt(vb[i] / c2) + eps)
    gb[i] = 0
  }
}

function softmaxInPlace(z, off, n) {
  let max = -Infinity
  for (let i = 0; i < n; i++) if (z[off + i] > max) max = z[off + i]
  let sum = 0
  for (let i = 0; i < n; i++) {
    const e = Math.exp(z[off + i] - max)
    z[off + i] = e
    sum += e
  }
  for (let i = 0; i < n; i++) z[off + i] /= sum
}

/**
 * Квантует веса в int8 (своя шкала на каждый выходной нейрон) и пишет в public/model/.
 * Вызывается после КАЖДОЙ эпохи, которая улучшила точность, — тогда оборванный
 * прогон не пропадает: на диске всегда лежит лучшая модель на текущий момент.
 */
async function exportModel(bestW, classes, inputSize, metrics, quiet) {
  await mkdir(OUT, { recursive: true })
  const chunks = []
  const layersMeta = []
  let byteOff = 0
  for (const L of bestW) {
    const scales = new Float32Array(L.outN)
    const q = new Int8Array(L.outN * L.inN)
    for (let o = 0; o < L.outN; o++) {
      let max = 0
      for (let i = 0; i < L.inN; i++) {
        const a = Math.abs(L.w[o * L.inN + i])
        if (a > max) max = a
      }
      const sc = max / 127 || 1e-8
      scales[o] = sc
      for (let i = 0; i < L.inN; i++) {
        q[o * L.inN + i] = Math.max(-127, Math.min(127, Math.round(L.w[o * L.inN + i] / sc)))
      }
    }
    const sB = Buffer.from(scales.buffer, scales.byteOffset, scales.byteLength)
    const qB = Buffer.from(q.buffer, q.byteOffset, q.byteLength)
    const bB = Buffer.from(L.b.buffer, L.b.byteOffset, L.b.byteLength)
    const scalesOff = byteOff
    const weightsOff = scalesOff + sB.length
    const biasOff = weightsOff + qB.length
    layersMeta.push({
      inN: L.inN,
      outN: L.outN,
      scales: { offset: scalesOff, bytes: sB.length },
      weights: { offset: weightsOff, bytes: qB.length },
      bias: { offset: biasOff, bytes: bB.length }
    })
    byteOff = biasOff + bB.length
    chunks.push(sB, qB, bB)
  }
  const bin = Buffer.concat(chunks)
  await writeFile(path.join(OUT, 'model.bin'), bin)
  await writeFile(
    path.join(OUT, 'model.json'),
    JSON.stringify(
      {
        format: 'mlp-int8-v1',
        inputSize,
        classes,
        layers: layersMeta,
        activation: 'relu',
        metrics,
        trainedAt: new Date().toISOString()
      },
      null,
      2
    )
  )
  if (!quiet) {
    console.log(`Модель сохранена: public/model/model.bin (${(bin.length / 1024).toFixed(0)} КБ) + model.json`)
  }
  return bin.length
}

async function main() {
  const meta = JSON.parse(await readFile(path.join(CACHE, 'dataset.meta.json'), 'utf8'))
  const D = meta.inputSize
  const C = meta.numClasses
  const buf = await readFile(path.join(CACHE, 'dataset.bin'))
  let off = 0
  const trainX = buf.subarray(off, (off += meta.train * D))
  const trainY = buf.subarray(off, (off += meta.train))
  const valX = buf.subarray(off, (off += meta.val * D))
  const valY = buf.subarray(off, (off += meta.val))
  console.log(`Данные: train=${meta.train}, val=${meta.val}, классов=${C}`)
  console.log(`Сеть: ${D} -> ${H1} -> ${H2} -> ${C}, batch=${BATCH}, epochs=${EPOCHS}\n`)

  const L1 = makeLayer(D, H1)
  const L2 = makeLayer(H1, H2)
  const L3 = makeLayer(H2, C)

  const x = new Float32Array(BATCH * D)
  const z1 = new Float32Array(BATCH * H1)
  const a1 = new Float32Array(BATCH * H1)
  const z2 = new Float32Array(BATCH * H2)
  const a2 = new Float32Array(BATCH * H2)
  const z3 = new Float32Array(BATCH * C)
  const d3 = new Float32Array(BATCH * C)
  const d2 = new Float32Array(BATCH * H2)
  const d1 = new Float32Array(BATCH * H1)
  const m1 = new Uint8Array(BATCH * H1)
  const m2 = new Uint8Array(BATCH * H2)

  const idx = new Int32Array(meta.train)
  for (let i = 0; i < idx.length; i++) idx[i] = i

  const best = { acc: 0, w: null, top3: 0, ev: null }
  let step = 0

  const evaluate = () => {
    let top1 = 0
    let top3 = 0
    const perClass = new Int32Array(C)
    const perClassOk = new Int32Array(C)
    for (let s0 = 0; s0 < meta.val; s0 += BATCH) {
      const B = Math.min(BATCH, meta.val - s0)
      for (let s = 0; s < B; s++) {
        const src = (s0 + s) * D
        for (let i = 0; i < D; i++) x[s * D + i] = valX[src + i] / 255
      }
      forwardLinear(L1, x, z1, B)
      for (let i = 0; i < B * H1; i++) a1[i] = z1[i] > 0 ? z1[i] : 0
      forwardLinear(L2, a1, z2, B)
      for (let i = 0; i < B * H2; i++) a2[i] = z2[i] > 0 ? z2[i] : 0
      forwardLinear(L3, a2, z3, B)
      for (let s = 0; s < B; s++) {
        const y = valY[s0 + s]
        perClass[y]++
        const o = s * C
        let bestI = -1
        let bestV = -Infinity
        for (let c = 0; c < C; c++) {
          if (z3[o + c] > bestV) {
            bestV = z3[o + c]
            bestI = c
          }
        }
        if (bestI === y) {
          top1++
          perClassOk[y]++
        }
        let better = 0
        for (let c = 0; c < C; c++) if (z3[o + c] > z3[o + y]) better++
        if (better < 3) top3++
      }
    }
    return { top1: top1 / meta.val, top3: top3 / meta.val, perClass, perClassOk }
  }

  for (let ep = 1; ep <= EPOCHS; ep++) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0
      const t = idx[i]
      idx[i] = idx[j]
      idx[j] = t
    }
    const lr = LR * Math.pow(0.72, Math.max(0, ep - 5)) // затухание после 5-й эпохи
    const t0 = Date.now()
    let loss = 0
    let seen = 0

    for (let s0 = 0; s0 + BATCH <= meta.train; s0 += BATCH) {
      const B = BATCH
      for (let s = 0; s < B; s++) {
        const src = idx[s0 + s] * D
        const dst = s * D
        for (let i = 0; i < D; i++) x[dst + i] = trainX[src + i] / 255
      }
      forwardLinear(L1, x, z1, B)
      for (let i = 0; i < B * H1; i++) {
        const v = z1[i] > 0 ? z1[i] : 0
        const keep = Math.random() >= DROPOUT ? 1 : 0
        m1[i] = keep
        a1[i] = keep ? v / (1 - DROPOUT) : 0
      }
      forwardLinear(L2, a1, z2, B)
      for (let i = 0; i < B * H2; i++) {
        const v = z2[i] > 0 ? z2[i] : 0
        const keep = Math.random() >= DROPOUT ? 1 : 0
        m2[i] = keep
        a2[i] = keep ? v / (1 - DROPOUT) : 0
      }
      forwardLinear(L3, a2, z3, B)

      for (let s = 0; s < B; s++) {
        const o = s * C
        softmaxInPlace(z3, o, C)
        const y = trainY[idx[s0 + s]]
        loss += -Math.log(Math.max(1e-9, z3[o + y]))
        seen++
        for (let c = 0; c < C; c++) d3[o + c] = (z3[o + c] - (c === y ? 1 : 0)) / B
      }

      backwardLinear(L3, a2, d3, d2, B)
      for (let i = 0; i < B * H2; i++) d2[i] = z2[i] > 0 && m2[i] ? d2[i] / (1 - DROPOUT) : 0
      backwardLinear(L2, a1, d2, d1, B)
      for (let i = 0; i < B * H1; i++) d1[i] = z1[i] > 0 && m1[i] ? d1[i] / (1 - DROPOUT) : 0
      backwardLinear(L1, x, d1, null, B)

      step++
      adam(L1, lr, step)
      adam(L2, lr, step)
      adam(L3, lr, step)
    }

    const ev = evaluate()
    console.log(
      `эпоха ${String(ep).padStart(2)}/${EPOCHS}  loss=${(loss / seen).toFixed(4)}  ` +
        `val top1=${(ev.top1 * 100).toFixed(2)}%  top3=${(ev.top3 * 100).toFixed(2)}%  ` +
        `lr=${lr.toExponential(2)}  ${((Date.now() - t0) / 1000).toFixed(0)}с`
    )
    if (ev.top1 > best.acc) {
      best.acc = ev.top1
      best.top3 = ev.top3
      best.ev = ev
      best.w = [L1, L2, L3].map((L) => ({
        w: Float32Array.from(L.w),
        b: Float32Array.from(L.b),
        inN: L.inN,
        outN: L.outN
      }))
      // Чекпоинт на диск: обрыв обучения больше не обнуляет прогон.
      await exportModel(best.w, meta.classes, D, { top1: best.acc, top3: best.top3 }, true)
      console.log('      ↳ чекпоинт сохранён в public/model/')
    }
  }

  console.log(
    `
Лучшая точность: top1=${(best.acc * 100).toFixed(2)}%  top3=${(best.top3 * 100).toFixed(2)}%`
  )
  const worst = meta.classes
    .map((k, i) => ({ k, acc: best.ev.perClassOk[i] / best.ev.perClass[i] }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 5)
  console.log('Хуже всего узнаются: ' + worst.map((w) => `${w.k} ${(w.acc * 100).toFixed(0)}%`).join(', '))
  const bytes = await exportModel(
    best.w,
    meta.classes,
    D,
    { top1: best.acc, top3: best.top3 },
    false
  )
  console.log(`Размер весов: ${(bytes / 1024).toFixed(0)} КБ`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
