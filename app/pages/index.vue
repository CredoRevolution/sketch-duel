<script setup>
import { ref, computed } from 'vue'
import { CATEGORIES, DIFFICULTIES } from '~~/shared/categories.js'

useHead({ title: 'Sketch Duel — дуэль каракулей с нейросетью' })

const { difficultyId, difficulty, setDifficulty } = useGameSettings()
const openTier = ref(1)

const tiers = computed(() => [
  { n: 1, ru: 'Простые', items: CATEGORIES.filter((c) => c.tier === 1) },
  { n: 2, ru: 'Обычные', items: CATEGORIES.filter((c) => c.tier === 2) },
  { n: 3, ru: 'Сложные', items: CATEGORIES.filter((c) => c.tier === 3) }
])

const inPlay = computed(() => CATEGORIES.filter((c) => c.tier <= difficulty.value.maxTier).length)
</script>

<template>
  <div class="wrap">
    <AppHeader />

    <section class="hero">
      <div class="hero__badge">
        <span class="dot" /> {{ CATEGORIES.length }} категорий · модель живёт в браузере
      </div>
      <h1>
        Дуэль каракулей<br />
        <span class="grad">с нейросетью</span>
      </h1>
      <p class="hero__lead">
        Нейросеть обучена на открытом датасете Google QuickDraw и целиком помещается в 300 КБ.
        Она работает прямо у тебя в браузере: ни одного запроса на сервер, ни одной картинки
        наружу.
      </p>

      <div class="hero__diff">
        <div class="hero__diff-label">Сложность</div>
        <DifficultyPicker :model-value="difficultyId" @update:model-value="setDifficulty" />
        <div class="hero__diff-meta">
          В игре <b>{{ inPlay }}</b> слов · сеть засчитает рисунок от
          <b>{{ Math.round(difficulty.winP * 100) }}%</b> уверенности ·
          <b>{{ Math.round(difficulty.roundMs / 1000) }} с</b> на раунд
        </div>
      </div>
    </section>

    <div class="modes">
      <NuxtLink to="/draw" class="mode card">
        <div class="mode__ico" aria-hidden="true">✏️</div>
        <h2>Ты рисуешь — ИИ угадывает</h2>
        <p>
          Выпадает слово, включается таймер. Сеть посматривает на холст, пока ты рисуешь, и
          называет три самых вероятных варианта. Успей нарисовать так, чтобы она поняла.
        </p>
        <span class="mode__go">Играть <span aria-hidden="true">→</span></span>
      </NuxtLink>

      <NuxtLink to="/guess" class="mode card">
        <div class="mode__ico" aria-hidden="true">🤖</div>
        <h2>ИИ рисует — ты угадываешь</h2>
        <p>
          Рисунок проявляется штрих за штрихом, ровно так, как его рисовал живой человек. Чем
          раньше угадаешь — тем больше очков.
        </p>
        <span class="mode__go">Играть <span aria-hidden="true">→</span></span>
      </NuxtLink>
    </div>

    <section class="cats card">
      <div class="cats__head">
        <h3>Что сеть умеет узнавать</h3>
        <div class="cats__tabs">
          <button
            v-for="t in tiers"
            :key="t.n"
            class="cats__tab"
            :class="{ 'is-active': openTier === t.n }"
            @click="openTier = t.n"
          >
            {{ t.ru }} <span class="cats__count">{{ t.items.length }}</span>
          </button>
        </div>
      </div>
      <div class="chips">
        <span v-for="c in tiers[openTier - 1].items" :key="c.key" class="chip">
          <span aria-hidden="true">{{ c.emoji }}</span> {{ c.ru }}
        </span>
      </div>
    </section>

    <section class="how">
      <div v-for="(s, i) in [
        { t: 'Штрихи → картинка 28×28', d: 'Твои линии перерисовываются в крошечную чёрно-белую картинку — ровно в таком виде сеть видела примеры на обучении.' },
        { t: '784 числа → 100 вероятностей', d: 'Картинка разворачивается в список яркостей пикселей и проходит через три слоя умножений. На выходе — уверенность по каждому слову.' },
        { t: 'Всё на твоём устройстве', d: 'Веса сети — файл на 300 КБ. Он скачивается один раз, дальше распознавание занимает доли миллисекунды и работает офлайн.' }
      ]" :key="i" class="how__item card">
        <div class="how__num">{{ i + 1 }}</div>
        <h4>{{ s.t }}</h4>
        <p>{{ s.d }}</p>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.hero {
  padding: 32px 0 34px;

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 7px 14px;
    margin-bottom: 20px;
    border-radius: $r-full;
    border: 1px solid $line;
    background: rgba(255, 255, 255, 0.03);
    font-size: 13px;
    color: $text-2;

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: $green;
      box-shadow: 0 0 10px $green;
    }
  }

  h1 {
    font-size: clamp(36px, 7vw, 66px);
    font-weight: 800;
    letter-spacing: -0.04em;
    margin-bottom: 18px;
  }

  &__lead {
    max-width: 620px;
    margin: 0 0 28px;
    color: $text-2;
    font-size: 16px;
    line-height: 1.65;
  }

  &__diff {
    display: inline-flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px;
    border-radius: $r-lg;
    border: 1px solid $line;
    background: rgba(0, 0, 0, 0.22);
  }

  &__diff-label {
    @include eyebrow;
    margin: 0;
  }

  &__diff-meta {
    font-size: 13px;
    color: $text-3;

    b {
      color: $text-2;
    }
  }
}

.grad {
  background: $grad-accent;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
  margin-bottom: 20px;
}

.mode {
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 28px 26px 24px;
  overflow: hidden;
  transition: transform $med $ease, border-color $med;
  @include focus-ring;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(420px 180px at 78% 0%, rgba(124, 92, 255, 0.2), transparent 70%);
    opacity: 0;
    transition: opacity $med;
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-4px);
    border-color: $line-2;

    &::after {
      opacity: 1;
    }
  }

  &__ico {
    font-size: 34px;
    line-height: 1;
  }

  h2 {
    font-size: 21px;
  }

  p {
    flex: 1;
    margin: 0;
    color: $text-2;
    font-size: 14.5px;
    line-height: 1.62;
  }

  &__go {
    margin-top: 6px;
    font-weight: 700;
    color: $amber;
  }
}

.cats {
  padding: 22px 24px 24px;
  margin-bottom: 20px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  h3 {
    @include eyebrow;
    margin: 0;
  }

  &__tabs {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    border-radius: $r-full;
    border: 1px solid $line;
    background: rgba(0, 0, 0, 0.28);
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 13px;
    border-radius: $r-full;
    font-size: 13px;
    font-weight: 600;
    color: $text-2;
    transition: all $fast;
    @include focus-ring;

    &:hover:not(.is-active) {
      background: rgba(255, 255, 255, 0.05);
      color: $text;
    }

    &.is-active {
      background: $surface-3;
      color: $text;
    }
  }

  &__count {
    font-size: 11px;
    color: $text-3;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: $r-full;
  border: 1px solid $line;
  background: rgba(255, 255, 255, 0.03);
  font-size: 13px;
}

.how {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;

  &__item {
    padding: 22px;
  }

  &__num {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    margin-bottom: 12px;
    border-radius: 9px;
    background: $surface-3;
    color: $violet-2;
    font-weight: 800;
    font-size: 13px;
  }

  h4 {
    font-size: 15.5px;
    margin-bottom: 7px;
  }

  p {
    margin: 0;
    color: $text-3;
    font-size: 13.5px;
    line-height: 1.6;
  }
}
</style>
