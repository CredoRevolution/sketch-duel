export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Sketch Duel — дуэль каракулей с нейросетью',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content: 'Два режима: нейросеть угадывает твой рисунок или ты угадываешь её.'
        },
        { name: 'theme-color', content: '#0d0f14' }
      ]
    }
  },
  nitro: {
    prerender: { crawlLinks: false, routes: ['/', '/draw', '/guess'] }
  }
})
