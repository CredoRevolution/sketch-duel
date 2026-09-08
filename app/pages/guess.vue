<script setup>
/**
 * Режим 2: холст проигрывает настоящий человеческий рисунок из QuickDraw
 * штрих за штрихом, игрок угадывает по вариантам ответа.
 * Чем раньше ответ — тем больше очков.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

useHead({ title: 'ИИ рисует — ты угадываешь · Sketch Duel' })

const MAX_POINTS = 100
const MIN_POINTS = 30
const WRONG_PENALTY = 25
const MAX_WRONG = 2
const GRACE_MS = 10000

const replay = useReplay()
const { difficultyId, difficulty, pool, setDifficulty } = useGameSettings()
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

const playing = computed(() => state.value === 'playing')
const points = computed(() => {
  const base = MAX_POINTS - (MAX_POINTS - MIN_POINTS) * Math.min(1, progress.value)
  return Math.max(0, Math.round(base - wrongKeys.value.length * WRONG_PENALTY))
})
const barWidth = computed(() =>
  finishedDrawing.value && playing.value
    ? (graceLeft.value / GRACE_MS) * 100
    : Math.min(100, progress.value * 100)
)

function shuffle(a) {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

function pickCategory() {
  const list = pool.value
  const free = list.filter((c) => !recentCats.includes(c.key))
  const from = free.length ? free : list
  const c = from[Math.floor(Math.random() * from.length)]
  recentCats.push(c.key)
  if (recentCats.length > Math.min(12, Math.floor(list.length / 2))) recentCats.shift()
  return c
}

function stopGrace() {
  if (graceTimer) clearInterval(graceTimer)
  graceTimer = null
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
    const others = shuffle(pool.value.filter((c) => c.key !== cat.key)).slice(
      0,
      difficulty.value.options - 1
    )
    const { drawing: d, id } = await replay.randomDrawing(cat.key, seen)
    seen.add(id)
    answer.value = cat
    options.value = shuffle([cat, ...others])
    drawing.value = d
    state.value = 'playing'
    replay.prefetch(shuffle(pool.value).slice(0, 3).map((c) => c.key))
  } catch (e) {
    loadError.value = e.message || String(e)
    state.value = 'error'
  }
}

function onProgress(p) {
  progress.value = p
}

function onDone() {
  if (!playing.value) return
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
  if (!playing.value || wrongKeys.value.includes(cat.key)) return
  if (cat.key === answer.value.key) {
    stopGrace()
    lastPoints.value = points.value
    score.value += lastPoints.value
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

function onVisibility() {
  if (document.hidden) {
    hiddenAt = Date.now()
  } else if (hiddenAt) {
    graceStartedAt += Date.now() - hiddenAt
    hiddenAt = 0
  }
}

function onKey(e) {
  if (e.target instanceof HTMLElement && ['INPUT', 'BUTTON', 'A'].includes(e.target.tagName)) return
  if (playing.value) {
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

function changeDifficulty(id) {
  setDifficulty(id)
  startRound()
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
    <AppHeader mode="guess">
      <span class="pill">🏆 <b>{{ score }}</b></span>
      <span class="pill">🔥 <b>{{ streak }}</b></span>
      <span class="pill">✅ <b>{{ wins }}/{{ rounds }}</b></span>
    </AppHeader>

    <div v-if="state === 'error'" class="card notice">
      <h3>Не удалось загрузить рисунки</h3>
      <p class="muted">{{ loadError }}</p>
      <p class="dim">Собери данные командой <code>npm run data:all</code> и обнови страницу.</p>
    </div>

    <div v-else class="game">
      <div class="game__main">
        <div class="task card">
          <div class="task__word">
            <div class="task__label">что это будет?</div>
            <div class="task__value">
              <template v-if="state === 'won' || state === 'lost'">
                <span aria-hidden="true">{{ answer?.emoji }}</span> {{ answer?.ru }}
              </template>
              <template v-else>рисую…</template>
            </div>
          </div>
          <div class="pts" :class="{ 'is-low': points <= 40 }">
            +{{ playing ? points : lastPoints }}<small>очк</small>
          </div>
        </div>

        <div class="bar" :class="{ 'is-grace': finishedDrawing && playing }">
          <i :style="{ width: barWidth + '%' }" />
        </div>

        <ReplayCanvas
          ref="canvas"
          :drawing="drawing"
          :paused="!playing"
          :speed="difficulty.replaySpeed"
          @progress="onProgress"
          @done="onDone"
        />

        <div class="tools">
          <span v-if="playing && finishedDrawing" class="pill pill--warn">
            ⏳ осталось {{ (graceLeft / 1000).toFixed(1) }} с
          </span>
          <span v-else-if="playing" class="pill dim">очки тают, пока рисунок проявляется</span>
          <div class="spacer" />
          <button v-if="playing" class="btn btn--ghost" @click="lose">Сдаюсь</button>
          <button
            v-else-if="state !== 'loading'"
            class="btn btn--primary btn--lg"
            @click="startRound"
          >
            Следующий раунд →
          </button>
        </div>
      </div>

      <aside class="game__side">
        <div class="card panel">
          <h3 class="panel__title">Варианты</h3>
          <div class="opts">
            <button
              v-for="(o, i) in options"
              :key="o.key"
              class="opt"
              :class="{
                'is-wrong': wrongKeys.includes(o.key),
                'is-right': !playing && o.key === answer?.key,
                'is-dim': !playing && o.key !== answer?.key
              }"
              :disabled="!playing || wrongKeys.includes(o.key)"
              @click="choose(o)"
            >
              <span class="opt__kbd">{{ i + 1 }}</span>
              <span class="opt__emoji" aria-hidden="true">{{ o.emoji }}</span>
              <span class="opt__label">{{ o.ru }}</span>
            </button>
          </div>
          <p class="opts__hint dim">
            Ошибок осталось: <b>{{ Math.max(0, MAX_WRONG - wrongKeys.length) }}</b> · каждая минус
            {{ WRONG_PENALTY }} очков · клавиши 1–{{ options.length }}
          </p>
        </div>

        <Transition name="pop">
          <div v-if="state === 'won'" class="card verdict verdict--win">
            <div class="verdict__ico" aria-hidden="true">🎯</div>
            <h3>В точку!</h3>
            <p class="muted"><b>+{{ lastPoints }}</b> очков. Серия: {{ streak }}.</p>
            <button class="btn btn--primary" @click="startRound">Ещё раз</button>
          </div>
          <div v-else-if="state === 'lost'" class="card verdict verdict--lose">
            <div class="verdict__ico" aria-hidden="true">🙈</div>
            <h3>Мимо</h3>
            <p class="muted">Это был {{ answer?.emoji }} {{ answer?.ru }}.</p>
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
            <div class="row"><span class="dim">слов в игре</span><b>{{ pool.length }}</b></div>
            <div class="row">
              <span class="dim">вариантов ответа</span><b>{{ difficulty.options }}</b>
            </div>
            <div class="row"><span class="dim">откуда рисунки</span><b>QuickDraw</b></div>
            <div class="row"><span class="dim">клавиши</span><b>1–{{ difficulty.options }} · Пробел</b></div>
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

.pts {
  flex: none;
  font-size: 28px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: $green;

  &.is-low {
    color: $amber;
  }

  small {
    margin-left: 3px;
    font-size: 12px;
    color: $text-3;
  }
}

.bar {
  height: 6px;
  border-radius: $r-full;
  background: $surface-2;
  overflow: hidden;

  i {
    display: block;
    height: 100%;
    border-radius: $r-full;
    background: $grad-accent;
  }

  // Когда рисунок дорисован, та же полоска показывает остаток времени на ответ.
  &.is-grace i {
    background: $red;
    transition: width 0.1s linear;
  }
}

.tools {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  min-height: 40px;
}

.panel {
  padding: 20px;

  &__title {
    @include eyebrow;
  }
}

.opts {
  display: flex;
  flex-direction: column;
  gap: 9px;

  &__hint {
    margin: 14px 0 0;
    font-size: 12px;
    line-height: 1.55;
  }
}

.opt {
  display: grid;
  grid-template-columns: 22px 24px 1fr;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  border-radius: $r-md;
  border: 1px solid $line;
  background: $surface-2;
  text-align: left;
  font-weight: 600;
  font-size: 15px;
  transition: all $fast $ease;
  @include focus-ring;

  &:hover:not(:disabled) {
    background: $surface-3;
    border-color: $line-2;
    transform: translateX(3px);
  }

  &:disabled {
    cursor: default;
  }

  &__kbd {
    padding: 1px 0;
    border: 1px solid $line;
    border-radius: 5px;
    font-size: 11px;
    text-align: center;
    color: $text-3;
  }

  &__emoji {
    font-size: 18px;
  }

  &__label {
    @include ellipsis;
  }

  &.is-wrong {
    background: rgba(251, 113, 133, 0.12);
    border-color: rgba(251, 113, 133, 0.4);
    text-decoration: line-through;
    opacity: 0.6;
    animation: shake 0.3s;
  }

  &.is-right {
    background: rgba(52, 211, 153, 0.16);
    border-color: rgba(52, 211, 153, 0.5);
    opacity: 1;
  }

  &.is-dim:disabled {
    opacity: 0.32;
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

.pop-enter-active {
  animation: pop $med $ease;
}
</style>
