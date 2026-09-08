/**
 * Загружает модель один раз на всё приложение и классифицирует штрихи.
 * Работает целиком в браузере — бэкенд не нужен.
 */
import { ref } from 'vue'
import { loadModel, predict, topK } from '~~/shared/model.js'
import { rasterize } from '~~/shared/sketch.js'
import { categoryByKey } from '~~/shared/categories.js'

const state = {
  model: null,
  promise: null
}

export function useClassifier() {
  const ready = ref(!!state.model)
  const loading = ref(false)
  const error = ref(null)

  async function ensureLoaded() {
    if (state.model) {
      ready.value = true
      return state.model
    }
    loading.value = true
    error.value = null
    try {
      if (!state.promise) {
        state.promise = (async () => {
          const [metaRes, binRes] = await Promise.all([
            fetch('/model/model.json'),
            fetch('/model/model.bin')
          ])
          if (!metaRes.ok || !binRes.ok) {
            throw new Error('не найдены файлы модели — выполни npm run data:all')
          }
          const meta = await metaRes.json()
          const bin = await binRes.arrayBuffer()
          return loadModel(meta, bin)
        })()
      }
      state.model = await state.promise
      ready.value = true
      return state.model
    } catch (e) {
      state.promise = null
      error.value = e.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Один прогон сети по рисунку.
   * @param {number[][]} strokes штрихи в любых координатах
   * @param {number} k сколько вариантов вернуть
   * @returns {{top: object[], probOf: (key:string)=>number}}
   */
  function analyze(strokes, k = 3) {
    if (!state.model) return { top: [], probOf: () => 0 }
    const probs = predict(state.model, rasterize(strokes))
    const top = topK(state.model, probs, k).map((r) => ({ ...r, ...categoryByKey(r.key) }))
    const byKey = new Map(state.model.classes.map((c, i) => [c, probs[i]]))
    return { top, probOf: (key) => byKey.get(key) ?? 0 }
  }

  return {
    ready,
    loading,
    error,
    ensureLoaded,
    analyze,
    metrics: () => state.model?.metrics ?? null
  }
}
