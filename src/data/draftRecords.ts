import raw from './draft-affiliations.json' with { type: 'json' }

// Where the players picked in the NPB draft came from, 2021–2025 (日本野球機構 ドラフト会議の指名結果、支配下・育成、
// 球団ごとのページ。scripts/ingest-draft.ts、出典 npbDraft). Only the affiliation of each pick is kept.

export const DRAFT_META = raw.meta as { source: string; accessed: string; sha256: string; years: number[] }
const counts = new Map<string, number>()
for (const r of raw.rows) counts.set(r.affiliation, (counts.get(r.affiliation) ?? 0) + 1)
/** players picked in those drafts who came from this team (as NPB wrote the affiliation) */
export const draftPicksFrom = (affiliation: string): number => counts.get(affiliation) ?? 0
export const DRAFT_PICKS_TOTAL = raw.rows.length
