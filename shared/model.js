/**
 * Рантайм классификатора: разворачивает int8-веса и считает предсказание.
 *
 * Используется и браузером, и scripts/verify.mjs — то есть проверяется
 * ровно тот код, который потом работает у пользователя.
 */

/**
 * @param {object} meta       содержимое public/model/model.json
 * @param {ArrayBuffer} buf   содержимое public/model/model.bin
 */
export function loadModel(meta, buf) {
  if (meta.format !== 'mlp-int8-v1') throw new Error(`Неизвестный формат модели: ${meta.format}`)
  const layers = meta.layers.map((L) => {
    const scales = new Float32Array(buf.slice(L.scales.offset, L.scales.offset + L.scales.bytes))
    const q = new Int8Array(buf, L.weights.offset, L.weights.bytes)
    const bias = new Float32Array(buf.slice(L.bias.offset, L.bias.offset + L.bias.bytes))
    // Деквантование: у каждого выходного нейрона своя шкала.
    const w = new Float32Array(L.outN * L.inN)
    for (let o = 0; o < L.outN; o++) {
      const sc = scales[o]
      const base = o * L.inN
      for (let i = 0; i < L.inN; i++) w[base + i] = q[base + i] * sc
    }
    return { inN: L.inN, outN: L.outN, w, b: bias }
  })

  const scratch = layers.map((L) => new Float32Array(L.outN))
  return { classes: meta.classes, inputSize: meta.inputSize, layers, scratch, metrics: meta.metrics }
}

/**
 * @param {ReturnType<typeof loadModel>} model
 * @param {Float32Array} input длиной inputSize, значения 0..1
 * @returns {Float32Array} вероятности по классам
 */
export function predict(model, input) {
  let cur = input
  for (let li = 0; li < model.layers.length; li++) {
    const L = model.layers[li]
    const out = model.scratch[li]
    for (let o = 0; o < L.outN; o++) {
      const base = o * L.inN
      let sum = L.b[o]
      for (let i = 0; i < L.inN; i++) sum += cur[i] * L.w[base + i]
      out[o] = sum
    }
    if (li < model.layers.length - 1) {
      for (let o = 0; o < L.outN; o++) if (out[o] < 0) out[o] = 0 // ReLU
    }
    cur = out
  }
  // softmax
  let max = -Infinity
  for (let i = 0; i < cur.length; i++) if (cur[i] > max) max = cur[i]
  let sum = 0
  for (let i = 0; i < cur.length; i++) {
    const e = Math.exp(cur[i] - max)
    cur[i] = e
    sum += e
  }
  for (let i = 0; i < cur.length; i++) cur[i] /= sum
  return cur
}

/** Топ-K предсказаний в виде [{ key, p }]. */
export function topK(model, probs, k = 3) {
  const arr = []
  for (let i = 0; i < probs.length; i++) arr.push({ key: model.classes[i], p: probs[i] })
  arr.sort((a, b) => b.p - a.p)
  return arr.slice(0, k)
}
