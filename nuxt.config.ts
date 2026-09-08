import { fileURLToPath } from 'node:url'

const scssDir = fileURLToPath(new URL('./app/assets/scss', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/scss/main.scss'],
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // Токены и миксины доступны в каждом <style lang="scss"> без импортов.
          additionalData: '@use "tokens" as *;\n@use "mixins" as *;\n',
          loadPaths: [scssDir]
        }
      }
    }
  },
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
        { name: 'theme-color', content: '#090b11' }
      ]
    }
  },
  nitro: {
    prerender: { crawlLinks: false, routes: ['/', '/draw', '/guess'] }
  }
})
