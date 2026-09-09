/**
 * Настройки игры, общие для обоих режимов: выбранная сложность и накопленный счёт.
 * Сложность переживает перезагрузку страницы (localStorage), счёт — нет.
 */
import { computed, watch, onMounted } from 'vue'
import {
  DEFAULT_DIFFICULTY,
  difficultyById,
  categoriesForTier,
  drawableForTier
} from '~~/shared/categories.js'

const STORAGE_KEY = 'sketch-duel:difficulty'

export function useGameSettings() {
  // useState — состояние Nuxt, общее для всех страниц и безопасное при SSR.
  const difficultyId = useState('sd:difficulty', () => DEFAULT_DIFFICULTY)
  const totals = useState('sd:totals', () => ({ score: 0, wins: 0, rounds: 0, best: 0 }))

  const difficulty = computed(() => difficultyById(difficultyId.value))
  const pool = computed(() => categoriesForTier(difficulty.value.maxTier))
  // Рисовать просим только то, что модель реально способна узнать.
  const drawPool = computed(() => drawableForTier(difficulty.value.maxTier))

  onMounted(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) difficultyId.value = difficultyById(saved).id
    } catch {
      /* приватный режим — просто играем со сложностью по умолчанию */
    }
  })

  watch(difficultyId, (id) => {
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* не смогли сохранить — не беда */
    }
  })

  function setDifficulty(id) {
    difficultyId.value = difficultyById(id).id
  }

  return { difficultyId, difficulty, pool, drawPool, totals, setDifficulty }
}
