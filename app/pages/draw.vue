<script setup>
/**
 * Режим 1: игроку выпадает слово, он рисует, сеть распознаёт холст в реальном времени.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { CATEGORIES } from '~~/shared/categories.js'

useHead({ title: 'Ты рисуешь — ИИ угадывает · Sketch Duel' })

const ROUND_MS = 20000
const WIN_P = 0.55 // уверенность, при которой засчитываем «угадал»
const THROTTLE_MS = 90

const clf = useClassifier()
const pad = ref(null)

const state = ref('loading') // loading | ready | playing | won | lost
const target = ref(null)
const guesses = ref([])
const timeLeft = ref(ROUND_MS)
const score = ref(0)
const streak = ref(0)
const bestStreak = ref(0)
const rounds = ref(0)
const wins = ref(0)
const loadError = ref(null)
const recent = []

let timer = null
let lastRun = 0
let pending = null
let roundStartedAt = 0
let hiddenAt = 0

const secondsLeft = computed(() => Math.max(0, timeLeft.value / 1000))
const timePct = computed(() => Math.max(0, Math.min(100, (timeLeft.value / ROUND_MS) * 100)))
const targetP = ref(0) // вероятность именно загаданного класса, даже если он не в топ-3

function pickTarget() {
  const pool = CATEGORIES.filter((c) => !recent.includes(c.key))
  const c = pool[Math.floor(Math.random() * pool.length)]
  recent.push(c.key)
  if (recent.length > 8) recent.shift()
  return c
}

function startRound() {
  target.value = pickTarget()
  guesses.value = []
  targetP.value = 0
  timeLeft.value = ROUND_MS
  state.value = 'playing'
  pad.value?.clear()
  stopTimer()
  roundStartedAt = Date.now()
  hiddenAt = 0
  timer = setInterval(() => {
    if (document.hidden) return
    timeLeft.value = ROUND_MS - (Date.now() - roundStartedAt)
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      finishRound(false)
    }
  }, 100)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function finishRound(won) {
  stopTimer()
  rounds.value++
  if (won) {
    wins.value++
    // Чем быстрее — тем больше очков: от 100 (мгновенно) до 20 (в последнюю секунду).
    score.value += Math.round(20 + 80 * (timeLeft.value / ROUND_MS))
    streak.value++
    bestStreak.value = Math.max(bestStreak.value, streak.value)
    state.value = 'won'
  } else {
    streak.value = 0
    state.value = 'lost'
  }
}

function runRecognition() {
  if (state.value !== 'playing') return
  const strokes = pad.value?.getStrokes() ?? []
  if (!strokes.length) {
    guesses.value = []
    targetP.value = 0
    return
  }
  const { top, probOf } = clf.analyze(strokes, 3)
  guesses.value = top
  targetP.value = probOf(target.value.key)
  if (top[0] && top[0].key === target.value.key && top[0].p >= WIN_P) finishRound(true)
}

/** Троттлинг: распознавание дешёвое (~0.3 мс), но незачем гонять его на каждое движение мыши. */
function onCanvasChange() {
  if (state.value !== 'playing') return
  const now = performance.now()
  if (now - lastRun >= THROTTLE_MS) {
    lastRun = now
    runRecognition()
  } else if (!pending) {
    pending = setTimeout(() => {
      pending = null
      lastRun = performance.now()
      runRecognition()
    }, THROTTLE_MS - (now - lastRun))
  }
}

function clearCanvas() {
  pad.value?.clear()
  guesses.value = []
  targetP.value = 0
}

function skip() {
  if (state.value !== 'playing') return
  finishRound(false)
}

/**
 * Пока вкладка скрыта, браузер душит таймеры, а игрок всё равно не видит холст.
 * Поэтому просто не засчитываем это время: возвращаемся к раунду там же, где ушли.
 */
function onVisibility() {
  if (document.hidden) {
    hiddenAt = Date.now()
  } else if (hiddenAt) {
    roundStartedAt += Date.now() - hiddenAt
    hiddenAt = 0
  }
}

function onKey(e) {
  if (e.key === 'Enter' || e.code === 'Space') {
    if (state.value === 'won' || state.value === 'lost' || state.value === 'ready') {
      e.preventDefault()
      startRound()
    }
  }
}

onMounted(async () => {
  try {
    await clf.ensureLoaded()
    state.value = 'ready'
    startRound()
  } catch (e) {
    loadError.value = e.message || String(e)
    state.value = 'error'
  }
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopTimer()
  if (pending) clearTimeout(pending)
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
      <NuxtLink to="/guess" class="btn ghost">Другой режим</NuxtLink>
    </header>

    <div v-if="state === 'error'" class="card err">
      <h3>Модель не загрузилась</h3>
      <p class="muted">{{ loadError }}</p>
      <p class="muted">Собери артефакты командой <code>npm run data:all</code> и перезагрузи страницу.</p>
    </div>

    <div v-else-if="state === 'loading'" class="card err">
      <h3>Загружаю нейросеть…</h3>
      <p class="muted">240 КБ весов, дальше всё считается офлайн.</p>
    </div>

    <div v-else class="game">
      <div class="left">
        <div class="task card">
          <div>
            <div class="task-label">нарисуй</div>
            <div class="task-word">{{ target?.emoji }} {{ target?.ru }}</div>
          </div>
          <div class="clock" :class="{ hurry: secondsLeft <= 5 && state === 'playing' }">
            {{ secondsLeft.toFixed(1) }}<small>с</small>
          </div>
        </div>
        <div class="timebar"><i :style="{ width: timePct + '%' }" /></div>

        <SketchPad ref="pad" :disabled="state !== 'playing'" @change="onCanvasChange" />

        <div class="tools">
          <button class="btn" :disabled="state !== 'playing'" @click="pad?.undo()">↩ Отменить</button>
          <button class="btn" :disabled="state !== 'playing'" @click="clearCanvas">🗑 Очистить</button>
          <div class="spacer" />
          <button v-if="state === 'playing'" class="btn ghost" @click="skip">Сдаюсь →</button>
          <button v-else class="btn primary" @click="startRound">Следующий раунд →</button>
        </div>
      </div>

      <aside class="right">
        <div class="card panel">
          <h3>ИИ видит</h3>
          <TransitionGroup name="g" tag="div" class="guesses">
            <div v-for="(g, i) in guesses" :key="g.key" class="guess" :class="{ hit: g.key === target?.key }">
              <span class="rank">{{ i + 1 }}</span>
              <span class="name">{{ g.emoji }} {{ g.ru }}</span>
              <span class="pct">{{ Math.round(g.p * 100) }}%</span>
              <i class="bar" :style="{ width: Math.max(2, g.p * 100) + '%' }" />
            </div>
          </TransitionGroup>
          <p v-if="!guesses.length" class="muted empty">
            {{ state === 'playing' ? 'Холст пустой — сеть ждёт первый штрих.' : 'Раунд окончен.' }}
          </p>

          <div class="progress-to-win">
            <div class="ptw-head">
              <span class="muted">уверенность в «{{ target?.ru }}»</span>
              <b>{{ Math.round(targetP * 100) }}%</b>
            </div>
            <div class="ptw-bar">
              <i :style="{ width: Math.min(100, (targetP / WIN_P) * 100) + '%' }" />
            </div>
            <div class="muted tiny">нужно {{ Math.round(WIN_P * 100) }}%, чтобы засчитать</div>
          </div>
        </div>

        <Transition name="pop">
          <div v-if="state === 'won'" class="card verdict win">
            <div class="big">🎉</div>
            <h3>Угадала!</h3>
            <p class="muted">Это точно {{ target?.emoji }} {{ target?.ru }}. Серия: {{ streak }}.</p>
            <button class="btn primary" @click="startRound">Ещё раз</button>
          </div>
          <div v-else-if="state === 'lost'" class="card verdict lose">
            <div class="big">🫤</div>
            <h3>Не узнала</h3>
            <p class="muted">
              Загадано было «{{ target?.ru }}»<span v-if="guesses[0]">, а сеть решила, что это
              {{ guesses[0].emoji }} {{ guesses[0].ru }}</span
              >.
            </p>
            <button class="btn primary" @click="startRound">Дальше</button>
          </div>
        </Transition>

        <div class="card panel meta">
          <div class="row"><span class="muted">точность модели</span><b>{{ clf.metrics() ? Math.round(clf.metrics().top1 * 100) + '%' : '—' }}</b></div>
          <div class="row"><span class="muted">лучшая серия</span><b>{{ bestStreak }}</b></div>
          <div class="row"><span class="muted">горячие клавиши</span><b>Ctrl+Z, Пробел</b></div>
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
    grid-template-columns: 1fr;
  }
}

.left {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.clock {
  font-size: 28px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.clock small {
  font-size: 14px;
  color: var(--muted);
  margin-left: 2px;
}

.clock.hurry {
  color: var(--bad);
  animation: pulse 0.6s infinite alternate;
}

@keyframes pulse {
  to {
    opacity: 0.55;
  }
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
  transition: width 0.1s linear;
}

.tools {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.right {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel {
  padding: 18px 18px 20px;
}

.panel h3 {
  margin: 0 0 14px;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.guesses {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guess {
  position: relative;
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 10px;
  background: var(--panel-2);
  overflow: hidden;
  transition: 0.2s;
}

.guess .bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background: var(--accent);
  transition: width 0.15s ease;
}

.guess.hit {
  background: rgba(47, 212, 122, 0.14);
  box-shadow: inset 0 0 0 1px rgba(47, 212, 122, 0.35);
}

.guess.hit .bar {
  background: var(--good);
}

.rank {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pct {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--muted);
}

.empty {
  font-size: 14px;
  margin: 0;
}

.progress-to-win {
  margin-top: 18px;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.ptw-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}

.ptw-bar {
  position: relative;
  height: 8px;
  border-radius: 6px;
  background: var(--panel-2);
  overflow: hidden;
}

.ptw-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--good));
  transition: width 0.15s;
}

.tiny {
  font-size: 12px;
  margin-top: 6px;
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

.g-move,
.g-enter-active,
.g-leave-active {
  transition: all 0.22s ease;
}

.g-enter-from,
.g-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.g-leave-active {
  position: absolute;
  width: calc(100% - 36px);
}

.pop-enter-active {
  animation: pop 0.28s ease;
}
</style>
