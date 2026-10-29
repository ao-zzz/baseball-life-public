import type { CountryCode } from '../data/types.ts'

// The career ladder: "highest stage reached" is the highest rank on this list.
// Rarity is reported as the share of same-condition model runs that reached at least this rank.

export interface Rung {
  rank: number
  label: string
  short: string
}

const JP: Rung[] = [
  { rank: 0, label: '野球を始める前', short: '始める前' },
  { rank: 1, label: '学童野球で野球を始めた', short: '学童野球' },
  { rank: 2, label: '中学でも野球を続けた', short: '中学野球' },
  { rank: 3, label: '高校で硬式野球部に入った', short: '高校野球' },
  { rank: 4, label: '高校3年の夏まで続けた', short: '高校3年夏まで' },
  { rank: 5, label: '高校の後も野球を続けた（大学・社会人・独立リーグ）', short: '高校の後も' },
  { rank: 6, label: 'NPB の育成選手になった', short: 'NPB 育成' },
  { rank: 7, label: 'NPB の支配下選手になった', short: 'NPB 支配下' },
  { rank: 8, label: 'NPB の1軍で試合に出た', short: 'NPB 1軍' },
  { rank: 9, label: 'NPB で長く活躍した（1軍で8年以上）', short: '1軍で8年以上' },
  { rank: 10, label: 'MLB でプレーした', short: 'MLB' },
]

const US: Rung[] = [
  { rank: 0, label: '野球を始める前', short: '始める前' },
  { rank: 1, label: 'リトルリーグで野球を始めた', short: 'リトルリーグ' },
  { rank: 2, label: '中学年代でも続けた', short: '中学年代' },
  { rank: 3, label: '高校の野球部に入った', short: '高校野球' },
  { rank: 4, label: '高校の最終学年まで続けた', short: '高校最終学年' },
  { rank: 5, label: '大学（NCAA・ジュニアカレッジ）で続けた', short: '大学野球' },
  { rank: 6, label: 'MLB 球団と契約した（マイナー）', short: 'マイナー' },
  { rank: 7, label: '2A・3A まで上がった', short: '2A・3A' },
  { rank: 8, label: 'MLB で試合に出た', short: 'MLB' },
  { rank: 9, label: 'MLB で長く活躍した（6年以上）', short: 'MLB 6年以上' },
  { rank: 10, label: 'MLB の看板選手になった', short: '看板選手' },
]

const LATAM: Rung[] = [
  { rank: 0, label: '野球を始める前', short: '始める前' },
  { rank: 1, label: '地域のチームで野球を始めた', short: '地域の野球' },
  { rank: 2, label: '10代前半も続けた', short: '10代前半' },
  { rank: 3, label: '育成組織（アカデミー）に入った', short: 'アカデミー' },
  { rank: 4, label: '契約を目指して16歳まで続けた', short: '16歳まで' },
  { rank: 5, label: '国内リーグでプレーした', short: '国内リーグ' },
  { rank: 6, label: 'MLB 球団と契約した（マイナー）', short: 'マイナー' },
  { rank: 7, label: '米国のマイナー上位まで上がった', short: '2A・3A' },
  { rank: 8, label: 'MLB で試合に出た', short: 'MLB' },
  { rank: 9, label: 'MLB で長く活躍した（6年以上）', short: 'MLB 6年以上' },
  { rank: 10, label: 'MLB の看板選手になった', short: '看板選手' },
]

const KR: Rung[] = [
  { rank: 0, label: '野球を始める前', short: '始める前' },
  { rank: 1, label: '少年野球で始めた', short: '少年野球' },
  { rank: 2, label: '中学でも続けた', short: '中学野球' },
  { rank: 3, label: '高校の野球部に入った', short: '高校野球' },
  { rank: 4, label: '高校3年まで続けた', short: '高校3年まで' },
  { rank: 5, label: '大学・実業団などで続けた', short: '高校の後も' },
  { rank: 6, label: 'KBO の育成・2軍', short: 'KBO 2軍' },
  { rank: 7, label: 'KBO の球団に指名された', short: 'KBO 指名' },
  { rank: 8, label: 'KBO の1軍で試合に出た', short: 'KBO 1軍' },
  { rank: 9, label: 'KBO で長く活躍した', short: 'KBO で長く' },
  { rank: 10, label: 'MLB・NPB でプレーした', short: '海外' },
]

const TW: Rung[] = KR.map((r) => ({
  ...r,
  label: r.label.replace('KBO', 'CPBL').replace('少年野球で始めた', '少棒で始めた').replace('中学でも続けた', '青少棒でも続けた').replace('高校の野球部に入った', '青棒に入った'),
  short: r.short.replace('KBO', 'CPBL').replace('少年野球', '少棒').replace('中学野球', '青少棒').replace('高校野球', '青棒'),
}))

export function ladderOf(country: CountryCode): Rung[] {
  switch (country) {
    case 'JP':
      return JP
    case 'US':
      return US
    case 'KR':
      return KR
    case 'TW':
      return TW
    default:
      return LATAM
  }
}

export function rungLabel(country: CountryCode, rank: number): string {
  const l = ladderOf(country)
  return (l[rank] ?? l[0]).label
}
