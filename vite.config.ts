import react from '@vitejs/plugin-react'
import { defineConfig, type UserConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // each language's page has its own head (title, description, link previews: crawlers do not run the app); the app is the same (src/i18n)
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        en: fileURLToPath(new URL('./en/index.html', import.meta.url)),
        ko: fileURLToPath(new URL('./ko/index.html', import.meta.url)),
        'zh-tw': fileURLToPath(new URL('./zh-tw/index.html', import.meta.url)),
      },
    },
  },
  // module workers: the school list is a separate chunk (dynamic import), which a classic worker bundle cannot split
  worker: { format: 'es' },
  // (the `test` key is vitest's: its own copy of vite's types is older than this project's vite, so the object is cast instead of typed)
  test: {
    // The tests simulate whole lives and several take 2–4 s alone. With one worker for each of the 20 cores they fought for the CPU and
    // the memory, and four of them passed the 5 s limit (cohort, life, lifeEvents, lifeLove), the same four every run, each passing alone.
    // Measured on the full run (2026-10-19): 20 workers 8.5 min and 4 timeouts; 10 workers 8.2 min and 1 timeout; 6 workers 8.8 min and none.
    // The limit of the tests is NOT raised: fewer workers make the same run as fast and let every test finish inside it.
    maxWorkers: 6,
  },
} as UserConfig)
