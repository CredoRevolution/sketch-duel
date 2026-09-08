<script setup>
/** Сегментированный переключатель сложности. */
import { DIFFICULTIES } from '~~/shared/categories.js'

defineProps({
  modelValue: { type: String, required: true },
  compact: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="diff" :class="{ 'diff--compact': compact }">
    <div class="diff__seg" role="radiogroup" aria-label="Сложность">
      <button
        v-for="d in DIFFICULTIES"
        :key="d.id"
        type="button"
        role="radio"
        :aria-checked="modelValue === d.id"
        :disabled="disabled"
        class="diff__opt"
        :class="[`is-${d.id}`, { 'is-active': modelValue === d.id }]"
        @click="emit('update:modelValue', d.id)"
      >
        <span aria-hidden="true">{{ d.emoji }}</span>
        <span>{{ d.ru }}</span>
      </button>
    </div>
    <p v-if="!compact" class="diff__hint">
      {{ DIFFICULTIES.find((d) => d.id === modelValue)?.hint }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.diff {
  &__seg {
    display: inline-flex;
    padding: 4px;
    gap: 4px;
    border-radius: $r-full;
    border: 1px solid $line;
    background: rgba(0, 0, 0, 0.28);
  }

  &__opt {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 15px;
    border-radius: $r-full;
    font-size: 13.5px;
    font-weight: 600;
    color: $text-2;
    transition: all $fast $ease;
    @include focus-ring;

    &:hover:not(:disabled):not(.is-active) {
      color: $text;
      background: rgba(255, 255, 255, 0.05);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &.is-active {
      color: #fff;
    }

    &.is-active.is-easy {
      background: linear-gradient(135deg, #22a06b, #34d399);
      box-shadow: 0 6px 18px rgba(52, 211, 153, 0.3);
    }

    &.is-active.is-normal {
      background: $grad-violet;
      box-shadow: $sh-glow;
    }

    &.is-active.is-hard {
      background: linear-gradient(135deg, #e0435c, #fb7185);
      box-shadow: 0 6px 18px rgba(251, 113, 133, 0.32);
    }
  }

  &__hint {
    margin: 10px 0 0;
    font-size: 13px;
    color: $text-3;
  }

  &--compact &__opt {
    padding: 6px 11px;
    font-size: 12.5px;
  }
}
</style>
