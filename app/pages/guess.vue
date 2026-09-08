<script setup>
/**
 * Режим 2: холст проигрывает настоящий человеческий рисунок из QuickDraw
 * штрих за штрихом, игрок угадывает по четырём вариантам.
 * Чем раньше ответ — тем больше очков.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { CATEGORIES } from '~~/shared/categories.js'

useHead({ title: 'ИИ рисует — ты угадываешь · Sketch Duel' })

const MAX_POINTS = 100
const MIN_POINTS = 30
const WRONG_PENALTY = 25
const MAX_WRONG = 2
const GRACE_MS = 10000 // время на ответ после того, как рисунок дорисован

const replay = useReplay()
const canvas = ref(null)

const state = ref('loading') // loading | playing | won | lost | error
const drawing = ref(null)
const answer = ref(null)
const options = ref([])
const wrongKeys = ref([])
const progress = ref(0)
const finishedDrawing = ref(false)
const graceLeft = ref(GRACE_MS)
const lastPoints = ref(0)
const score = ref(0)
const rounds = ref(0)
const wins = ref(0)
const streak = ref(0)
const loadError = ref(null)

const seen = new Set()
const recentCats = []
let graceTimer = null
let graceStartedAt = 0
let hiddenAt = 0

const points = computed(() => {
  const base = MAX_POINTS - (MAX_POINTS - MIN_POINTS) * Math.min(1, progress.value)
  return Math.max(0, Math.round(base - wrongKeys.value.length * WRONG_PENALTY))
})

function shuffle(a) {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

function pickCategory() {
  const pool = CATEGORIES.filter((c) => !recentCats.includes(c.key))
  const c = pool[Math.floor(Math.random() * pool.length)]
  recentCats.push(c.key)
  if (recentCats.length > 8) recentCats.shift()
  return c
}

function stopGrace() {
  if (graceTimer) {
    clearInterval(graceTimer)
    graceTimer = null
  }
}

async function startRound() {
  stopGrace()
  state.value = 'loading'
  progress.value = 0
  finishedDrawing.value = false
  graceLeft.value = GRACE_MS
  wrongKeys.value = []
  try {
    const cat = pickCategory()
    const distractors = shuffle(CATEGORIES.filter((c) => c.key !== cat.key)).slice(0, 3)
    const { drawing: d, id } = await replay.randomDrawing(cat.key, seen)
    seen.add(id)
    answer.value = cat
    options.value = shuffle([cat, ...distractors])
    drawing.value = d
    state.value = 'playing'
    // Заранее тянем следующие категории, чтобы между раундами не было паузы.
    replay.prefetch(shuffle(CATEGORIES).slice(0, 3).map((c) => c.key))
  } catch (e) {
    loadError.value = e.message || String(e)
    state.value = 'error'
  }
}

function onProgress(p) {
  progress.value = p
}

function onDone() {
  if (state.value !== 'playing') return
  finishedDrawing.value = true
  graceStartedAt = Date.now()
  hiddenAt = 0
  stopGrace()
  graceTimer = setInterval(() => {
    if (document.hidden) return
    graceLeft.value = GRACE_MS - (Date.now() - graceStartedAt)
    if (graceLeft.value <= 0) {
      graceLeft.value = 0
      lose()
    }
  }, 100)
}

function choose(cat) {
  if (state.value !== 'playing' || wrongKeys.value.includes(cat.key)) return
  if (cat.key === answer.value.key) {
    stopGrace()
    lastPoints.value = points.value
    score.value += points.value
    wins.value++
    rounds.value++
    streak.value++
    state.value = 'won'
    canvas.value?.finish()
  } else {
    wrongKeys.value = [...wrongKeys.value, cat.key]
    if (wrongKeys.value.length >= MAX_WRONG) lose()
  }
}

function lose() {
  stopGrace()
  rounds.value++
  streak.value = 0
  lastPoints.value = 0
  state.value = 'lost'
  canvas.value?.finish()
}

/** Скрытая вкладка не должна съедать время на ответ. */
function onVisibility() {
  if (document.hidden) {
    hiddenAt = Date.now()
  } else if (hiddenAt) {
    graceStartedAt += Date.now() - hiddenAt
    hiddenAt = 0
  }
}

function onKey(e) {
  if (state.value === 'playing') {
    const n = Number(e.key)
    if (n >= 1 && n <= options.value.length) {
      e.preventDefault()
      choose(options.value[n - 1])
    }
    return
  }
  if ((e.key === 'Enter' || e.code === 'Space') && (state.value === 'won' || state.value === 'lost')) {
    e.preventDefault()
    startRound()
  }
}

onMounted(() => {
  startRound()
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopGrace()
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="wrap">
    <header class="topbar">
      <NuxtLink to="/" class="brand"><span class="dot" /> Sketch Duel</NuxtLink>
      <div class="spacer" />
      <span class="pill">🏆 {{ score }}</span>
      <span class="pill">🔥 серия {{ streak }}</span>
      <span class="pill">{{ wins }} / {{ rounds }}</span>
      <NuxtLink to="/draw" class="btn ghost">Другой режим</NuxtLink>
    </header>

    <div v-if="state === 'error'" class="card err">
      <h3>Не удалось загрузить рисунки</h3>
      <p class="muted">{{ loadError }}</p>
      <p class="muted">Собери данные командой <code>npm run data:all</code> и перезагрузи страницу.</p>
    </div>

    <div v-else class="game">
      <div class="left">
        <div class="task card">
          <div>
            <div class="task-label">что это будет?</div>
            <div class="task-word">
              <template v-if="state === 'won'">{{ answer.emoji }} {{ answer.ru }}</template>
              <template v-else-if="state === 'lost'">это был {{ answer.emoji }} {{ answer.ru }}</template>
              <template v-else>рисую…</template>
            </div>
          </div>
          <div class="points" :class="{ low: points <= 40 }">
            +{{ state === 'playing' ? points : lastPoints }}<small>очк</small>
          </div>
        </div>
        <div class="timebar" :class="{ grace: finishedDrawing && state === 'playing' }">
          <i
            :style="{
              width:
                (finishedDrawing && state === 'playing'
                  ? (graceLeft / GRACE_MS) * 100
                  : Math.min(100, progress * 100)) + '%'
            }"
          />
        </div>

        <ReplayCanvas
          ref="canvas"
          :drawing="drawing"
          :paused="state !== 'playing'"
          @progress="onProgress"
          @done="onDone"
        />

        <div class="tools">
          <span v-if="state === 'playing' && finishedDrawing" class="pill warn">
            ⏳ осталось {{ (graceLeft / 1000).toFixed(1) }} с
          </span>
          <span v-else-if="state === 'playing'" class="pill">
            очки тают по мере того, как рисунок проявляется
          </span>
          <div class="spacer" />
          <button v-if="state === 'playing'" class="btn ghost" @click="lose">Сдаюсь →</button>
          <button v-else-if="state !== 'loading'" class="btn primary" @click="startRound">
            Следующий раунд →
          </button>
        </div>
      </div>

      <aside class="right">
        <div class="card panel">
          <h3>Варианты</h3>
          <div class="opts">
            <button
              v-for="(o, i) in options"
              :key="o.key"
              class="opt"
              :class="{
                wrong: wrongKeys.includes(o.key),
                right: state !== 'playing' && o.key === answer?.key,
                dim: state !== 'playing' && o.key !== answer?.key
              }"
              :disabled="state !== 'playing' || wrongKeys.includes(o.key)"
              @click="choose(o)"
            >
              <span class="kbd">{{ i + 1 }}</span>
              <span class="emoji">{{ o.emoji }}</span>
              <span class="label">{{ o.ru }}</span>
            </button>
          </div>
          <p class="muted tiny">
            Ошибок осталось: {{ Math.max(0, MAX_WRONG - wrongKeys.length) }} · каждая минус
            {{ WRONG_PENALTY }} очков · клавиши 1–4
          </p>
        </div>

        <Transition name="pop">
          <div v-if="state === 'won'" class="card verdict win">
            <div class="big">🎯</div>
            <h3>В точку!</h3>
            <p class="muted">+{{ lastPoints }} очков. Серия: {{ streak }}.</p>
            <button class="btn primary" @click="startRound">Ещё раз</button>
          </div>
          <div v-else-if="state === 'lost'" class="card verdict lose">
            <div class="big">🙈</div>
            <h3>Мимо</h3>
            <p class="muted">Это был {{ answer?.emoji }} {{ answer?.ru }}.</p>
            <button class="btn primary" @click="startRound">Дальше</button>
          </div>
        </Transition>

        <div class="card panel meta">
          <div class="row">
            <span class="muted">откуда рисунки</span><b>QuickDraw</b>
          </div>
          <div class="row">
            <span class="muted">рисунков в базе</span><b>{{ CATEGORIES.length * 60 }}</b>
          </div>
          <div class="row"><span class="muted">горячие клавиши</span><b>1–4, Пробел</b></div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.game {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.8fr);
  gap: 20px;
  align-items: start;
}

@media (max-width: 900px) {
  .game {
    /* minmax(0, 1fr), а не 1fr: иначе минимальным размером колонки становится
       min-content её содержимого — а холст имеет заданную в пикселях ширину,
       и колонка отказывалась сжиматься при сужении окна. */
    grid-template-columns: minmax(0, 1fr);
  }
}

.left {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  gap: 12px;
}

.task-label {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 700;
}

.task-word {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.points {
  font-size: 28px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--good);
}

.points.low {
  color: var(--accent-2);
}

.points small {
  font-size: 13px;
  color: var(--muted);
  margin-left: 3px;
}

.timebar {
  height: 5px;
  border-radius: 4px;
  background: var(--panel-2);
  overflow: hidden;
}

.timebar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}

/* Когда рисунок дорисован, та же полоска показывает остаток времени на ответ. */
.timebar.grace {
  height: 7px;
}

.timebar.grace i {
  background: var(--bad);
  transition: width 0.1s linear;
}

.tools {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  min-height: 42px;
}

.pill.warn {
  border-color: rgba(255, 176, 32, 0.5);
  color: var(--accent-2);
}

.right {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.panel {
  padding: 18px;
}

.panel h3 {
  margin: 0 0 14px;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.opts {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.opt {
  display: grid;
  grid-template-columns: 22px 26px 1fr;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 11px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  text-align: left;
  font-weight: 600;
  font-size: 15.5px;
  transition: 0.15s;
}

.opt:hover:not(:disabled) {
  background: #2a3450;
  border-color: #46527a;
  transform: translateX(2px);
}

.opt .kbd {
  font-size: 11px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 5px;
  text-align: center;
  padding: 1px 0;
}

.opt .emoji {
  font-size: 18px;
}

.opt.wrong {
  background: rgba(255, 93, 108, 0.12);
  border-color: rgba(255, 93, 108, 0.4);
  text-decoration: line-through;
  opacity: 0.65;
  animation: shake 0.3s;
}

.opt.right {
  background: rgba(47, 212, 122, 0.16);
  border-color: rgba(47, 212, 122, 0.5);
  opacity: 1;
}

.opt.dim:disabled {
  opacity: 0.35;
}

.opt:disabled {
  cursor: default;
}

.tiny {
  font-size: 12px;
  margin: 14px 0 0;
  line-height: 1.5;
}

.verdict {
  padding: 20px;
  text-align: center;
}

.verdict .big {
  font-size: 40px;
}

.verdict h3 {
  margin: 6px 0 4px;
  font-size: 20px;
}

.verdict p {
  margin: 0 0 14px;
  font-size: 14px;
}

.verdict.win {
  box-shadow: inset 0 0 0 1px rgba(47, 212, 122, 0.4);
}

.verdict.lose {
  box-shadow: inset 0 0 0 1px rgba(255, 93, 108, 0.35);
}

.meta .row {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 13.5px;
}

.err {
  padding: 26px;
}

.err h3 {
  margin: 0 0 8px;
}

.pop-enter-active {
  animation: pop 0.28s ease;
}
</style>
