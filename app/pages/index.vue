<script setup>
import { CATEGORIES } from '~~/shared/categories.js'

useHead({ title: 'Sketch Duel — дуэль каракулей с нейросетью' })
</script>

<template>
  <div class="wrap">
    <header class="topbar">
      <div class="brand"><span class="dot" /> Sketch Duel</div>
    </header>

    <section class="hero">
      <h1>Дуэль каракулей<br /><span>с нейросетью</span></h1>
      <p class="lead">
        Нейросеть обучена на {{ CATEGORIES.length }} категориях из открытого датасета Google
        QuickDraw и целиком живёт у тебя в браузере: ни одного запроса на сервер, ни одной
        картинки наружу.
      </p>
    </section>

    <div class="modes">
      <NuxtLink to="/draw" class="mode card">
        <div class="mode-ico">✏️</div>
        <h2>Ты рисуешь — ИИ угадывает</h2>
        <p>
          Тебе выпадает слово, у тебя 20 секунд. Сеть смотрит на холст в реальном времени и
          называет три самых вероятных варианта. Успей нарисовать так, чтобы она поняла.
        </p>
        <span class="go">Играть →</span>
      </NuxtLink>

      <NuxtLink to="/guess" class="mode card">
        <div class="mode-ico">🤖</div>
        <h2>ИИ рисует — ты угадываешь</h2>
        <p>
          Рисунок проявляется штрих за штрихом. Чем раньше угадаешь — тем больше очков.
          Четыре варианта ответа, две попытки.
        </p>
        <span class="go">Играть →</span>
      </NuxtLink>
    </div>

    <section class="cats card">
      <h3>Что сеть умеет узнавать</h3>
      <div class="chips">
        <span v-for="c in CATEGORIES" :key="c.key" class="chip">{{ c.emoji }} {{ c.ru }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  padding: 40px 0 30px;
}

h1 {
  font-size: clamp(34px, 6vw, 60px);
  line-height: 1.03;
  margin: 0 0 16px;
  letter-spacing: -0.035em;
  font-weight: 800;
}

h1 span {
  background: linear-gradient(100deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lead {
  max-width: 640px;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.6;
  margin: 0;
}

.modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
  margin-bottom: 26px;
}

.mode {
  padding: 26px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: 0.18s ease;
  position: relative;
  overflow: hidden;
}

.mode::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(400px 160px at 80% 0%, rgba(124, 92, 255, 0.16), transparent 70%);
  opacity: 0;
  transition: 0.18s;
  pointer-events: none;
}

.mode:hover {
  transform: translateY(-3px);
  border-color: #3c4666;
}

.mode:hover::after {
  opacity: 1;
}

.mode-ico {
  font-size: 34px;
}

.mode h2 {
  margin: 0;
  font-size: 21px;
  letter-spacing: -0.02em;
}

.mode p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
  font-size: 14.5px;
  flex: 1;
}

.go {
  margin-top: 8px;
  font-weight: 700;
  color: var(--accent-2);
}

.cats {
  padding: 20px 22px 22px;
}

.cats h3 {
  margin: 0 0 14px;
  font-size: 15px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  font-size: 13px;
}
</style>
