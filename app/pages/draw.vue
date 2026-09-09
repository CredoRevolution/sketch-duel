<script setup>
/**
 * Режим 1: игроку выпадает слово, он рисует, сеть распознаёт холст.
 *
 * Сеть намеренно «заторможена»: она смотрит на холст не после каждого штриха,
 * а раз в difficulty.think миллисекунд, и должна узнать слово несколько
 * проверок подряд (difficulty.holdFrames). Без этого она угадывает мгновенно
 * и играть неинтересно.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

useHead({ title: 'Ты рисуешь — ИИ угадывает · Sketch Duel' })

const clf = useClassifier()
const { difficultyId, difficulty, drawPool, setDifficulty } = useGameSettings()
const pad = ref(null)

const state = ref('loading') // loading | playing | won | lost | error
const target = ref(null)
const guesses = ref([])
const targetP = ref(0)
const timeLeft = ref(0)
const thinking = ref(false)
const holdCount = ref(0)
const score = ref(0)
const streak = ref(0)
const bestStreak = ref(0)
const rounds = ref(0)
const wins = ref(0)
const lastPoints = ref(0)
const loadError = ref(null)
const recent = []

let timer = null
let brain = null
let thinkFlash = null
let roundStartedAt = 0
let hiddenAt = 0

const RING = 2 * Math.PI * 26

const secondsLeft = computed(() => Math.max(0, timeLeft.value / 1000))
const timeFrac = computed(() =>
  difficulty.value.roundMs ? Math.max(0, Math.min(1, timeLeft.value / difficulty.value.roundMs)) : 0
)
const winP = computed(() => difficulty.value.winP)
const holdNeeded = computed(() => difficulty.value.holdFrames)
const playing = computed(() => state.value === 'playing')
const hurry = computed(() => playing.value && secondsLeft.value <= 5)

function pickTarget() {
  const list = drawPool.value
  const free = list.filter((c) => !recent.includes(c.key))
  const from = free.length ? free : list
  const c = from[Math.floor(Math.random() * from.length)]
  recent.push(c.key)
  if (recent.length > Math.min(12, Math.floor(list.length / 2))) recent.shift()
  return c
}

function stopTimers() {
  if (timer) clearInterval(timer)
  if (brain) clearInterval(brain)
  if (thinkFlash) clearTimeout(thinkFlash)
  timer = brain = thinkFlash = null
}

function startRound() {
  stopTimers()
  target.value = pickTarget()
  guesses.value = []
  targetP.value = 0
  holdCount.value = 0
  thinking.value = false
  timeLeft.value = difficulty.value.roundMs
  state.value = 'playing'
  pad.value?.clear()

  roundStartedAt = Date.now()
  hiddenAt = 0
  timer = setInterval(() => {
    if (document.hidden) return
    timeLeft.value = difficulty.value.roundMs - (Date.now() - roundStartedAt)
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      finishRound(false)
    }
  }, 100)

  brain = setInterval(look, difficulty.value.think)
}

function finishRound(won) {
  stopTimers()
  thinking.value = false
  rounds.value++
  if (won) {
    wins.value++
    lastPoints.value = Math.round(20 + 80 * timeFrac.value)
    score.value += lastPoints.value
    streak.value++
    bestStreak.value = Math.max(bestStreak.value, streak.value)
    state.value = 'won'
  } else {
    lastPoints.value = 0
    streak.value = 0
    state.value = 'lost'
  }
}

/** Один «взгляд» сети на холст. */
function look() {
  if (!playing.value || document.hidden) return
  const strokes = pad.value?.getStrokes() ?? []
  if (!strokes.length) {
    guesses.value = []
    targetP.value = 0
    holdCount.value = 0
    return
  }
  thinking.value = true
  const { top, probOf } = clf.analyze(strokes, 3)
  guesses.value = top
  targetP.value = probOf(target.value.key)

  const sure = top[0] && top[0].key === target.value.key && top[0].p >= winP.value
  holdCount.value = sure ? holdCount.value + 1 : 0
  if (holdCount.value >= holdNeeded.value) {
    finishRound(true)
    return
  }
  if (thinkFlash) clearTimeout(thinkFlash)
  thinkFlash = setTimeout(() => (thinking.value = false), 200)
}

function clearCanvas() {
  pad.value?.clear()
  guesses.value = []
  targetP.value = 0
  holdCount.value = 0
}

function onVisibility() {
  if (document.hidden) {
    hiddenAt = Date.now()
  } else if (hiddenAt) {
    roundStartedAt += Date.now() - hiddenAt
    hiddenAt = 0
  }
}

function onKey(e) {
  if (e.target instanceof HTMLElement && ['INPUT', 'BUTTON', 'A'].includes(e.target.tagName)) return
  if ((e.key === 'Enter' || e.code === 'Space') && (state.value === 'won' || state.value === 'lost')) {
    e.preventDefault()
    startRound()
  }
}

function changeDifficulty(id) {
  setDifficulty(id)
  if (state.value !== 'loading' && state.value !== 'error') startRound()
}

onMounted(async () => {
  try {
    await clf.ensureLoaded()
    startRound()
  } catch (e) {
    loadError.value = e.message || String(e)
    state.value = 'error'
  }
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopTimers()
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="wrap">
    <AppHeader mode="draw">
      <span class="pill">🏆 <b>{{ score }}</b></span>
      <span class="pill">🔥 <b>{{ streak }}</b></span>
      <span class="pill">✅ <b>{{ wins }}/{{ rounds }}</b></span>
    </AppHeader>

    <div v-if="state === 'error'" class="card notice">
      <h3>Модель не загрузилась</h3>
      <p class="muted">{{ loadError }}</p>
      <p class="dim">Собери артефакты командой <code>npm run data:all</code> и обнови страницу.</p>
    </div>

    <div v-else-if="state === 'loading'" class="card notice">
      <h3>Загружаю нейросеть…</h3>
      <p class="muted">Около 300 КБ весов. Дальше всё считается прямо в браузере, офлайн.</p>
    </div>

    <div v-else class="game">
      <div class="game__main">
        <div class="task card">
          <div class="task__word">
            <div class="task__label">нарисуй</div>
            <div class="task__value">
              <span aria-hidden="true">{{ target?.emoji }}</span> {{ target?.ru }}
            </div>
          </div>

          <div class="timer">
            <svg class="ring" viewBox="0 0 60 60" aria-hidden="true">
              <circle class="ring__bg" cx="30" cy="30" r="26" />
              <circle
                class="ring__fg"
                :class="{ 'is-hurry': hurry }"
                cx="30"
                cy="30"
                r="26"
                :stroke-dasharray="RING"
                :stroke-dashoffset="RING * (1 - timeFrac)"
              />
            </svg>
            <div class="timer__num" :class="{ 'is-hurry': hurry }">
              {{ secondsLeft.toFixed(1) }}
            </div>
          </div>
        </div>

        <SketchPad ref="pad" :disabled="!playing" />

        <div class="tools">
          <button class="btn" :disabled="!playing" @click="pad?.undo()">↩ Отменить</button>
          <button class="btn" :disabled="!playing" @click="clearCanvas">🗑 Очистить</button>
          <div class="spacer" />
          <button v-if="playing" class="btn btn--ghost" @click="finishRound(false)">Сдаюсь</button>
          <button v-else class="btn btn--primary btn--lg" @click="startRound">
            Следующий раунд →
          </button>
        </div>
      </div>

      <aside class="game__side">
        <div class="card panel">
          <div class="panel__head">
            <h3>ИИ видит</h3>
            <span class="think" :class="{ 'is-on': thinking }" aria-hidden="true">
              <i /><i /><i />
            </span>
          </div>

          <TransitionGroup name="g" tag="div" class="guesses">
            <div
              v-for="(g, i) in guesses"
              :key="g.key"
              class="guess"
              :class="{ 'is-hit': g.key === target?.key }"
            >
              <span class="guess__rank">{{ i + 1 }}</span>
              <span class="guess__name">
                <span aria-hidden="true">{{ g.emoji }}</span> {{ g.ru }}
              </span>
              <span class="guess__pct">{{ Math.round(g.p * 100) }}%</span>
              <i class="guess__bar" :style="{ width: Math.max(2, g.p * 100) + '%' }" />
            </div>
          </TransitionGroup>

          <p v-if="!guesses.length" class="panel__empty dim">
            {{ playing ? 'Холст пустой — сеть ждёт первый штрих.' : 'Раунд окончен.' }}
          </p>

          <div class="meter">
            <div class="meter__head">
              <span class="dim">уверенность в «{{ target?.ru }}»</span>
              <b>{{ Math.round(targetP * 100) }}%</b>
            </div>
            <div class="meter__bar">
              <i :style="{ width: Math.min(100, (targetP / winP) * 100) + '%' }" />
            </div>
            <div class="meter__foot dim">
              нужно {{ Math.round(winP * 100) }}%, и подряд
              <span class="holds" aria-hidden="true">
                <i v-for="n in holdNeeded" :key="n" :class="{ 'is-on': holdCount >= n }" />
              </span>
            </div>
          </div>
        </div>

        <Transition name="pop">
          <div v-if="state === 'won'" class="card verdict verdict--win">
            <div class="verdict__ico" aria-hidden="true">🎉</div>
            <h3>Угадала!</h3>
            <p class="muted">
              Это точно {{ target?.emoji }} {{ target?.ru }}. <b>+{{ lastPoints }}</b> очков, серия
              {{ streak }}.
            </p>
            <button class="btn btn--primary" @click="startRound">Ещё раз</button>
          </div>
          <div v-else-if="state === 'lost'" class="card verdict verdict--lose">
            <div class="verdict__ico" aria-hidden="true">🫤</div>
            <h3>Не узнала</h3>
            <p class="muted">
              Загадано было «{{ target?.ru }}»<span v-if="guesses[0]">, а сеть решила, что это
                {{ guesses[0].emoji }} {{ guesses[0].ru }}</span
              >.
            </p>
            <button class="btn btn--primary" @click="startRound">Дальше</button>
          </div>
        </Transition>

        <div class="card panel">
          <h3 class="panel__title">Сложность</h3>
          <DifficultyPicker
            :model-value="difficultyId"
            compact
            @update:model-value="changeDifficulty"
          />
          <div class="rows">
            <div class="row"><span class="dim">слов в игре</span><b>{{ drawPool.length }}</b></div>
            <div class="row">
              <span class="dim">точность модели</span>
              <b>{{ clf.metrics() ? Math.round(clf.metrics().top1 * 100) + '%' : '—' }}</b>
            </div>
            <div class="row"><span class="dim">лучшая серия</span><b>{{ bestStreak }}</b></div>
            <div class="row"><span class="dim">клавиши</span><b>Ctrl+Z · Пробел</b></div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.game {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.75fr);
  gap: 20px;
  align-items: start;

  @include upto($bp-md) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.game__main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.game__side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.task {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;

  &__word {
    flex: 1;
    min-width: 0;
  }

  &__label {
    @include eyebrow;
    margin: 0 0 3px;
  }

  &__value {
    font-size: clamp(23px, 4vw, 31px);
    font-weight: 800;
    letter-spacing: -0.03em;
    @include ellipsis;
  }
}

.timer {
  position: relative;
  width: 60px;
  height: 60px;
  flex: none;

  &__num {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 15px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;

    &.is-hurry {
      color: $red;
    }
  }
}

.ring {
  width: 60px;
  height: 60px;
  transform: rotate(-90deg);

  circle {
    fill: none;
    stroke-width: 4;
    stroke-linecap: round;
  }

  &__bg {
    stroke: rgba(255, 255, 255, 0.08);
  }

  &__fg {
    stroke: $violet-2;
    transition:
      stroke-dashoffset 0.12s linear,
      stroke $med;

    &.is-hurry {
      stroke: $red;
    }
  }
}

.tools {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.panel {
  padding: 20px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;

    h3 {
      @include eyebrow;
      margin: 0;
    }
  }

  &__title {
    @include eyebrow;
  }

  &__empty {
    margin: 0;
    font-size: 13.5px;
  }
}

.think {
  display: inline-flex;
  gap: 4px;
  opacity: 0;
  transition: opacity $fast;

  &.is-on {
    opacity: 1;
  }

  i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: $violet-2;
    animation: breathe 0.5s infinite alternate;

    &:nth-child(2) {
      animation-delay: 0.12s;
    }

    &:nth-child(3) {
      animation-delay: 0.24s;
    }
  }
}

.guesses {
  position: relative; // держим уходящий элемент внутри панели
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guess {
  position: relative;
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  border-radius: $r-sm;
  background: $surface-2;
  overflow: hidden;
  transition: background $med;

  &__rank {
    font-size: 11px;
    font-weight: 700;
    color: $text-3;
  }

  &__name {
    font-weight: 600;
    @include ellipsis;
  }

  &__pct {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: $text-2;
  }

  &__bar {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: $violet;
    transition: width $med $ease;
  }

  &.is-hit {
    background: rgba(52, 211, 153, 0.14);
    box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.35);

    .guess__bar {
      background: $green;
    }
  }
}

.meter {
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid $line;

  &__head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    margin-bottom: 8px;
  }

  &__bar {
    height: 8px;
    border-radius: $r-full;
    background: $surface-2;
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      border-radius: $r-full;
      background: linear-gradient(90deg, $violet, $green);
      transition: width $med $ease;
    }
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 9px;
    font-size: 12px;
  }
}

.holds {
  display: inline-flex;
  gap: 4px;

  i {
    width: 14px;
    height: 4px;
    border-radius: $r-full;
    background: $surface-3;
    transition: background $fast;

    &.is-on {
      background: $green;
    }
  }
}

.verdict {
  padding: 22px;
  text-align: center;

  &__ico {
    font-size: 40px;
    line-height: 1;
  }

  h3 {
    margin: 8px 0 5px;
    font-size: 20px;
  }

  p {
    margin: 0 0 15px;
    font-size: 14px;
  }

  &--win {
    box-shadow: $sh-md, inset 0 0 0 1px rgba(52, 211, 153, 0.4);
  }

  &--lose {
    box-shadow: $sh-md, inset 0 0 0 1px rgba(251, 113, 133, 0.35);
  }
}

.rows {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid $line;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
}

.notice {
  padding: 28px;

  h3 {
    margin-bottom: 8px;
  }

  code {
    padding: 2px 6px;
    border-radius: 6px;
    background: $surface-3;
    font-size: 12.5px;
  }
}

.g-move,
.g-enter-active,
.g-leave-active {
  transition: all $med $ease;
}

.g-enter-from,
.g-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.g-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}

.pop-enter-active {
  animation: pop $med $ease;
}
</style>
