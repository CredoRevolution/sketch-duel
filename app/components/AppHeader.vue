<script setup>
/** Шапка: логотип, слот под статистику раунда и переключатель режимов. */
defineProps({
  mode: { type: String, default: null } // 'draw' | 'guess' | null
})
</script>

<template>
  <header class="hdr">
    <NuxtLink to="/" class="brand">
      <span class="brand__mark" aria-hidden="true" />
      <span class="brand__name">Sketch&nbsp;Duel</span>
    </NuxtLink>

    <div class="hdr__stats"><slot /></div>

    <nav v-if="mode" class="switcher" aria-label="Режимы">
      <NuxtLink to="/draw" class="switcher__item" :class="{ 'is-active': mode === 'draw' }">
        <span aria-hidden="true">✏️</span><span class="switcher__label">Я рисую</span>
      </NuxtLink>
      <NuxtLink to="/guess" class="switcher__item" :class="{ 'is-active': mode === 'guess' }">
        <span aria-hidden="true">🤖</span><span class="switcher__label">ИИ рисует</span>
      </NuxtLink>
    </nav>
  </header>
</template>

<style lang="scss" scoped>
.hdr {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -0.02em;
  @include focus-ring;

  &__mark {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: $grad-accent;
    box-shadow: 0 0 16px rgba(124, 92, 255, 0.9);
  }

  &:hover &__name {
    color: $violet-2;
  }

  &__name {
    transition: color $fast;
  }
}

.hdr__stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.switcher {
  display: inline-flex;
  padding: 4px;
  gap: 4px;
  border-radius: $r-full;
  border: 1px solid $line;
  background: rgba(0, 0, 0, 0.25);

  &__item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: $r-full;
    font-size: 13.5px;
    font-weight: 600;
    color: $text-2;
    transition: all $fast $ease;
    @include focus-ring;

    &:hover {
      color: $text;
      background: rgba(255, 255, 255, 0.05);
    }

    &.is-active {
      color: #fff;
      background: $grad-violet;
      box-shadow: $sh-glow;
    }
  }

  &__label {
    @include upto($bp-sm) {
      display: none;
    }
  }
}
</style>
