<script setup>
/**
 * Проигрыватель штрихов: воспроизводит рисунок так, как его рисовал человек —
 * штрих за штрихом, с паузами на «отрыв карандаша».
 *
 * На вход — рисунок в формате QuickDraw: [[[x...],[y...]], ...].
 */
import { ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  drawing: { type: Array, default: null },
  paused: { type: Boolean, default: false },
  speed: { type: Number, default: 1 }
})
const emit = defineEmits(['progress', 'done'])

const VIRT = 1000
const PAD = 70
const GAP_LEN = 260 // «длина» паузы между штрихами в виртуальных единицах

const holder = ref(null)
const canvas = ref(null)
const timeline = shallowRef([])
const totalLen = ref(0)
const duration = ref(8000)

let ctx = null
let ro = null
let raf = null
let elapsed = 0
let lastTs = 0
let finished = false
let lastEmit = -1

function resize() {
  const el = canvas.value
  const box = holder.value
  if (!el || !box) return
  const size = Math.max(80, Math.floor(box.clientWidth))
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
  el.style.width = size + 'px'
  el.style.height = size + 'px'
  el.width = Math.round(size * dpr)
  el.height = Math.round(size * dpr)
  ctx = el.getContext('2d')
  render()
}

/** Строит план анимации: отрезки + паузы между штрихами. */
function build() {
  const d = props.drawing
  timeline.value = []
  totalLen.value = 0
  elapsed = 0
  finished = false
  lastEmit = -1
  if (!d || !d.length) return

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [xs, ys] of d) {
    for (const x of xs) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    for (const y of ys) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const k = (VIRT - PAD * 2) / span
  const ox = PAD + ((VIRT - PAD * 2) - (maxX - minX) * k) / 2
  const oy = PAD + ((VIRT - PAD * 2) - (maxY - minY) * k) / 2
  const tx = (x) => ox + (x - minX) * k
  const ty = (y) => oy + (y - minY) * k

  const segs = []
  let total = 0
  d.forEach(([xs, ys], si) => {
    const n = Math.min(xs.length, ys.length)
    if (n === 0) return
    if (si > 0) {
      segs.push({ gap: true, len: GAP_LEN, at: total })
      total += GAP_LEN
    }
    if (n === 1) {
      segs.push({ dot: true, x: tx(xs[0]), y: ty(ys[0]), len: 20, at: total })
      total += 20
      return
    }
    for (let i = 0; i < n - 1; i++) {
      const ax = tx(xs[i])
      const ay = ty(ys[i])
      const bx = tx(xs[i + 1])
      const by = ty(ys[i + 1])
      const len = Math.max(1, Math.hypot(bx - ax, by - ay))
      segs.push({ ax, ay, bx, by, len, at: total })
      total += len
    }
  })
  timeline.value = segs
  totalLen.value = total
  // Даже самый простой рисунок проявляется не быстрее 7 с — иначе играть невозможно.
  duration.value = Math.min(14000, Math.max(7000, (total / 380) * 1000)) / (props.speed || 1)
}

function render() {
  if (!ctx || !canvas.value) return
  const el = canvas.value
  const k = el.width / VIRT
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, el.width, el.height)
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#23262f'
  ctx.lineWidth = 9

  const segs = timeline.value
  if (!segs.length) return
  const shown = progressLen()
  let tip = null

  ctx.beginPath()
  for (const s of segs) {
    if (s.at >= shown) break
    if (s.gap) continue
    if (s.dot) {
      ctx.moveTo(s.x + 0.01, s.y)
      ctx.lineTo(s.x, s.y)
      tip = [s.x, s.y]
      continue
    }
    const t = Math.min(1, (shown - s.at) / s.len)
    const ex = s.ax + (s.bx - s.ax) * t
    const ey = s.ay + (s.by - s.ay) * t
    ctx.moveTo(s.ax, s.ay)
    ctx.lineTo(ex, ey)
    tip = [ex, ey]
  }
  ctx.stroke()

  if (tip && !finished) {
    ctx.beginPath()
    ctx.fillStyle = 'rgba(124, 92, 255, 0.9)'
    ctx.arc(tip[0], tip[1], 9, 0, Math.PI * 2)
    ctx.fill()
  }
}

function progressLen() {
  if (!totalLen.value) return 0
  return (elapsed / duration.value) * totalLen.value
}

function tick(ts) {
  raf = requestAnimationFrame(tick)
  // Пока вкладка была скрыта, rAF не вызывался: без ограничения кадр «перепрыгнул» бы
  // сразу к концу рисунка. Ограничиваем шаг разумной величиной.
  const dt = lastTs ? Math.min(100, ts - lastTs) : 0
  lastTs = ts
  if (props.paused || finished || !timeline.value.length) return
  elapsed = Math.min(duration.value, elapsed + dt)
  render()
  const p = elapsed / duration.value
  if (p - lastEmit > 0.01 || p >= 1) {
    lastEmit = p
    emit('progress', p)
  }
  if (elapsed >= duration.value) {
    finished = true
    render()
    emit('done')
  }
}

function restart() {
  build()
  lastTs = 0
  render()
}

/** Мгновенно дорисовать до конца (когда раунд закончился). */
function finish() {
  if (!timeline.value.length) return
  elapsed = duration.value
  finished = true
  render()
  emit('progress', 1)
}

onMounted(() => {
  build()
  resize()
  ro = new ResizeObserver(resize)
  ro.observe(holder.value)
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})

watch(
  () => props.drawing,
  () => {
    restart()
  }
)

defineExpose({ restart, finish })
</script>

<template>
  <div ref="holder" class="pad">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.pad {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  overflow: hidden;
  background:
    linear-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px) 0 0 / 100% 28px,
    linear-gradient(90deg, rgba(0, 0, 0, 0.035) 1px, transparent 1px) 0 0 / 28px 100%,
    var(--paper);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.12),
    0 14px 40px rgba(0, 0, 0, 0.45);
}

canvas {
  display: block;
}
</style>
