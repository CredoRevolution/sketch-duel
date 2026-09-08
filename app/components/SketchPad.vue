<script setup>
/**
 * Холст для рисования карандашом.
 *
 * Штрихи хранятся в виртуальных координатах 0..1000 (холст всегда квадратный),
 * поэтому ресайз окна и разная плотность пикселей ничего не ломают:
 * рисунок просто перерисовывается в новом масштабе.
 */
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  lineWidth: { type: Number, default: 9 }
})
const emit = defineEmits(['change', 'stroke-end'])

const VIRT = 1000
const holder = ref(null)
const canvas = ref(null)
const strokes = shallowRef([]) // Array<number[]> — [x0,y0,x1,y1,...]
const isDrawing = ref(false)

let ctx = null
let ro = null
let cssSize = 0
let current = null
let activePointer = null

function resize() {
  const el = canvas.value
  const box = holder.value
  if (!el || !box) return
  const size = Math.max(80, Math.floor(box.clientWidth))
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
  cssSize = size
  el.style.width = size + 'px'
  el.style.height = size + 'px'
  el.width = Math.round(size * dpr)
  el.height = Math.round(size * dpr)
  ctx = el.getContext('2d')
  redraw()
}

function toVirt(ev) {
  const r = canvas.value.getBoundingClientRect()
  return [
    ((ev.clientX - r.left) / r.width) * VIRT,
    ((ev.clientY - r.top) / r.height) * VIRT
  ]
}

function redraw() {
  if (!ctx) return
  const el = canvas.value
  const k = el.width / VIRT // виртуальные единицы -> пиксели устройства
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, el.width, el.height)
  ctx.setTransform(k, 0, 0, k, 0, 0)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#23262f'
  ctx.lineWidth = props.lineWidth // сразу в виртуальных единицах

  for (const s of strokes.value) drawStroke(s)
}

function drawStroke(s) {
  const n = s.length / 2
  if (n === 0) return
  ctx.beginPath()
  if (n === 1) {
    ctx.arc(s[0], s[1], ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
    return
  }
  ctx.moveTo(s[0], s[1])
  if (n === 2) {
    ctx.lineTo(s[2], s[3])
  } else {
    // Сглаживание: квадратичные кривые через середины отрезков.
    for (let i = 1; i < n - 1; i++) {
      const cx = s[i * 2]
      const cy = s[i * 2 + 1]
      const mx = (cx + s[i * 2 + 2]) / 2
      const my = (cy + s[i * 2 + 3]) / 2
      ctx.quadraticCurveTo(cx, cy, mx, my)
    }
    ctx.lineTo(s[(n - 1) * 2], s[(n - 1) * 2 + 1])
  }
  ctx.stroke()
}

function onDown(ev) {
  if (props.disabled || activePointer !== null) return
  if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === 'mouse') return
  activePointer = ev.pointerId
  // Захват может не сработать (синтетическое событие, гонка при быстром тапе).
  // Без try/catch исключение оставило бы activePointer занятым навсегда — холст умирал бы молча.
  try {
    canvas.value.setPointerCapture(ev.pointerId)
  } catch {
    /* рисуем и без захвата */
  }
  const [x, y] = toVirt(ev)
  current = [x, y]
  strokes.value = [...strokes.value, current]
  isDrawing.value = true
  redraw()
  ev.preventDefault()
}

function onMove(ev) {
  if (activePointer !== ev.pointerId || !current) return
  // На тач-устройствах браузер копит события — берём всю пачку, линия выходит плавнее.
  // Для недоверенных (синтетических) событий список пустой — тогда работаем с самим событием.
  let events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : []
  if (!events.length) events = [ev]
  let added = false
  for (const e of events) {
    const [x, y] = toVirt(e)
    const n = current.length
    const dx = x - current[n - 2]
    const dy = y - current[n - 1]
    if (dx * dx + dy * dy < 4) continue // < 2 вирт. единиц — шум
    current.push(x, y)
    added = true
  }
  if (added) {
    redraw()
    emit('change', strokes.value) // родитель сам троттлит распознавание
  }
  ev.preventDefault()
}

function onUp(ev) {
  if (activePointer !== ev.pointerId) return
  try {
    canvas.value.releasePointerCapture(ev.pointerId)
  } catch {
    /* уже отпущен */
  }
  activePointer = null
  isDrawing.value = false
  if (current && current.length >= 2) {
    strokes.value = [...strokes.value]
    emit('change', strokes.value)
    emit('stroke-end', strokes.value)
  }
  current = null
}

function undo() {
  if (!strokes.value.length) return
  strokes.value = strokes.value.slice(0, -1)
  redraw()
  emit('change', strokes.value)
}

function clear() {
  strokes.value = []
  current = null
  redraw()
  emit('change', strokes.value)
}

function getStrokes() {
  return strokes.value
}

function isBlank() {
  return strokes.value.length === 0
}

function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    undo()
  }
}

onMounted(() => {
  resize()
  ro = new ResizeObserver(resize)
  ro.observe(holder.value)
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKey)
})

watch(() => props.lineWidth, redraw)

defineExpose({ undo, clear, getStrokes, isBlank })
</script>

<template>
  <div ref="holder" class="pad" :class="{ disabled }">
    <canvas
      ref="canvas"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @contextmenu.prevent
    />
    <div v-if="!strokes.length && !disabled" class="hint">рисуй прямо здесь ✏️</div>
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
  touch-action: none;
  user-select: none;
}

.pad.disabled {
  filter: saturate(0.6) brightness(0.85);
}

canvas {
  display: block;
  cursor: crosshair;
  touch-action: none;
}

.pad.disabled canvas {
  cursor: default;
}

.hint {
  position: absolute;
  inset: auto 0 14px;
  text-align: center;
  color: #b3ab97;
  font-size: 14px;
  pointer-events: none;
  font-weight: 600;
}
</style>
