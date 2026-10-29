import type { LifeState } from '../types.ts'

// What a declarative event may do to the career, which only life.ts can do (it owns the phases and the teams):
// changing team, and ending the playing career. Set by life.ts at load.
export const careerHooks: {
  /** a transfer to another real team of the same kind (company team, independent team, NPB team) */
  moveTeam: (s: LifeState) => void
  /** the player ends his playing career now */
  retire: (s: LifeState) => void
  /** he leaves the job he holds after baseball (the same leaving as a lay-off: the allowance, no job, the search later) */
  quitJob: (s: LifeState) => void
  /** he moves to another company for the same kind of work (a new employer, the years counted again; the allowance of the old one) */
  changeJob: (s: LifeState) => void
} = {
  moveTeam: () => {},
  retire: () => {},
  quitJob: () => {},
  changeJob: () => {},
}
