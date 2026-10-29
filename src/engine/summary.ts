import type { LifeState, LogEntry, Phase } from './types.ts'
import { rungLabel } from './ladder.ts'

// Title, epitaph and key moments for the result screen. Wording is original to this game.

function wasIn(s: LifeState, phase: Phase): boolean {
  return s.timeline.some((t) => t.phase === phase)
}

/** an office won after baseball (events/publicLife.ts): the highest one names the life, above the baseball titles except the top ones */
function officeTitle(s: LifeState): string | undefined {
  const a = s.career.achievements
  if (a.includes('内閣総理大臣')) return '野球で育ち、内閣総理大臣になった人'
  if (a.includes('大臣')) return '野球人から大臣になった人'
  if (a.includes('連邦下院議員')) return '野球人から連邦議会議員になった人'
  if (a.includes('衆議院議員')) return '野球人から国会議員になった人'
  return undefined
}

/** the title of a US life (Japan's wording is about 1軍, 甲子園 and 高校野球: PROJECT_PLAN §11.31) */
function usTitle(s: LifeState): string {
  const office = officeTitle(s)
  if (office) return office
  const r = s.career.highestRank
  if (r >= 10) return 'メジャーの看板選手になった人'
  if (r >= 9) return '長くメジャーで戦い抜いた人'
  if (r >= 8) return 'メジャーのグラウンドに立った人'
  if (r >= 7) return 'マイナーの上位まで駆け上がった人'
  if (r >= 6) return 'ドラフトで指名され、プロの道に進んだ人'
  if (r >= 5) return '高校の先も大学・短大で野球を続けた人'
  if (s.career.achievements.includes('少年野球の指導')) return '少年野球で子どもたちを教えた人'
  if (r >= 4) return 'ハイスクール野球を最後までやり切った人'
  if (r >= 3) return 'ハイスクールで白球を追った人'
  if (r >= 2) return '中学年代まで野球を続けた人'
  return '少年時代に野球をした人'
}

/** the title of a life of Korea or Cuba (PROJECT_PLAN §11.46); the ranks are those of the country's ladder (ladder.ts) */
function leagueTitle(s: LifeState): string {
  const r = s.career.highestRank
  const kr = s.person.country === 'KR'
  if (!kr && s.flags?.['cu.mlb'] !== undefined) return r >= 8 ? 'メジャーのグラウンドに立った人' : r >= 6 ? '海を渡り、マイナーで戦った人' : '海を渡った野球人'
  if (r >= 9) return kr ? '長く1軍で戦い抜いた人' : '国内リーグで長く戦い抜いた人'
  if (r >= 8) return kr ? '1軍のグラウンドに立った人' : '国内リーグで名を知られた人'
  if (r >= 7) return 'ドラフトで指名され、プロの道に進んだ人'
  if (r >= 6) return 'プロの2軍で夢を追った人'
  if (r >= 5) return kr ? '高校の先も大学で野球を続けた人' : '国内リーグの選手になった人'
  if (s.career.achievements.includes('少年野球の指導')) return '少年野球で子どもたちを教えた人'
  if (r >= 4) return '高校年代の野球をやり切った人'
  if (r >= 3) return '高校年代で白球を追った人'
  if (r >= 2) return '中学年代まで野球を続けた人'
  return '少年時代に野球をした人'
}

export function lifeTitle(s: LifeState): string {
  if (s.person.country === 'US') return usTitle(s)
  if (s.person.country === 'KR' || s.person.country === 'CU') return leagueTitle(s)
  const office = officeTitle(s)
  if (office) return office
  const r = s.career.highestRank
  const a = s.career.achievements
  if (r >= 10) return '海を渡った野球人'
  if (r >= 9) return '長く1軍で戦い抜いた人'
  if (r >= 8) return '1軍のグラウンドに立った人'
  if (r >= 7) return 'プロのユニフォームに袖を通した人'
  if (r >= 6) return '3桁の背番号からプロを目指した人'
  if (r >= 5) {
    if (wasIn(s, 'company')) return '働きながら白球を追い続けた人'
    if (wasIn(s, 'indep')) return '独立リーグで夢を追った人'
    return '高校の先も野球を続けた人'
  }
  if (a.includes('甲子園')) return '甲子園の土を踏んだ人'
  if (a.includes('少年野球の指導')) return '少年野球で子どもたちを教えた人'
  if (r >= 4) return '高校野球を最後までやり切った人'
  if (r >= 3) return '高校で硬式の白球を追った人'
  if (r >= 2) return '中学まで野球を続けた人'
  return '少年時代に野球をした人'
}

export function epitaph(s: LifeState): string {
  if ((s.person.country === 'US' || s.person.country === 'KR' || s.person.country === 'CU') && s.career.highestRank >= 8) return 'ブルペンの扉が開いた日のことを、最後まで覚えていた。'
  if (s.family.children > 0 && s.career.achievements.includes('孫')) return 'キャッチボールの相手は、子から孫へと代わっていった。'
  if (s.career.highestRank >= 7) return '名前を呼ばれた日の歓声を、最後まで覚えていた。'
  if (s.career.achievements.includes('甲子園')) return 'あの夏の土の色は、いつまでも思い出せた。'
  if (s.career.highestRank >= 4) return '最後の夏が終わった日から、別の長い試合が始まった。'
  if (s.family.everMarried) return '野球で覚えた「声を出す」ことを、家族の前でも忘れなかった。'
  return '押し入れのグローブは、ときどき取り出して手入れされていた。'
}

/** Up to five key moments, excluding birth and death, spread over the life. */
export function keyMoments(s: LifeState, max = 5): LogEntry[] {
  const keys = s.log.filter((e) => e.key && e.kind !== 'death' && e.age > 0)
  if (keys.length <= max) return keys
  const picked: LogEntry[] = []
  const step = keys.length / max
  for (let i = 0; i < max; i++) picked.push(keys[Math.floor(i * step + step / 2)])
  return picked
}

export function highestLabel(s: LifeState): string {
  return rungLabel(s.person.country, s.career.highestRank)
}

/** Total years with a baseball team. */
export function yearsPlayed(s: LifeState): number {
  return s.career.yearsPlaying
}
