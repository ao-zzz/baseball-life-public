import type { LifeConfig } from '../engine/types.ts'

// Same-condition model runs off the main thread. The engine is imported dynamically: it waits for the
// school list (a separate chunk, top-level await), and a message that arrives before the handler is
// set would be lost.
const engine = Promise.all([import('../engine/cohort.ts'), import('../engine/params.ts')])

self.onmessage = async (e: MessageEvent<{ config: LifeConfig; nRarity?: number; nFull?: number }>) => {
  const { config, nRarity, nFull } = e.data
  const [{ runCohort }, { defaultParams }] = await engine
  const result = runCohort(config, { params: defaultParams(), headless: true }, nRarity, nFull, (f) => {
    self.postMessage({ type: 'progress', f })
  })
  self.postMessage({ type: 'done', result })
}
