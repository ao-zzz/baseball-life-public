import type { Org } from './types.ts'

// Real organisations that may be shown by name (PROJECT_PLAN §2.1-7, §6.5). Only names confirmed on
// the organisation's own page are listed, each with its source and check date. Anything else is shown
// with a generic label. Years after 2026-10 use the October 2026 names as a stated assumption.

export const ORG_NAME_NOTE = '大会・球団・リーグの名前は2026年10月時点のものを仮に使っています。将来の存続・名称・所属は仮定です。試合の結果は、すべてゲーム内のシミュレーションです。'

const TOURNAMENT = (id: string, realName: string): Org => ({
  id,
  type: 'tournament',
  country: 'JP',
  realName,
  generic: '高校野球の大会',
  verified: true,
  sourceIds: ['jhbfTop'],
  accessed: '2026-10-17',
})

const NPB = (id: string, realName: string, league: string): Org => ({
  id,
  type: 'pro',
  country: 'JP',
  realName,
  generic: 'NPB の球団',
  league,
  verified: true,
  sourceIds: ['npbTeams'],
  accessed: '2026-10-17',
})

const IL = (id: string, realName: string, league = '四国アイランドリーグplus', sourceId = 'iblj', accessed = '2026-10-17'): Org => ({
  id,
  type: 'independent',
  country: 'JP',
  realName,
  generic: '独立リーグの球団',
  league,
  verified: true,
  sourceIds: [sourceId],
  accessed,
})

/** BC リーグの球団（公式サイトのチーム情報、2026-10-18） */
const BC = (id: string, realName: string) => IL(id, realName, 'ルートインBCリーグ', 'bcl', '2026-10-18')
/** 日本海リーグの球団（公式サイトのチーム情報、2026-10-18） */
const NL = (id: string, realName: string) => IL(id, realName, '日本海リーグ', 'nlb', '2026-10-18')

export const ORGS: Org[] = [
  TOURNAMENT('hs-summer', '全国高等学校野球選手権大会'),
  TOURNAMENT('hs-spring', '選抜高等学校野球大会'),
  NPB('npb-hanshin', '阪神タイガース', 'セントラル・リーグ'),
  NPB('npb-dena', '横浜DeNAベイスターズ', 'セントラル・リーグ'),
  NPB('npb-giants', '読売ジャイアンツ', 'セントラル・リーグ'),
  NPB('npb-dragons', '中日ドラゴンズ', 'セントラル・リーグ'),
  NPB('npb-carp', '広島東洋カープ', 'セントラル・リーグ'),
  NPB('npb-swallows', '東京ヤクルトスワローズ', 'セントラル・リーグ'),
  NPB('npb-hawks', '福岡ソフトバンクホークス', 'パシフィック・リーグ'),
  NPB('npb-fighters', '北海道日本ハムファイターズ', 'パシフィック・リーグ'),
  NPB('npb-buffaloes', 'オリックス・バファローズ', 'パシフィック・リーグ'),
  NPB('npb-eagles', '東北楽天ゴールデンイーグルス', 'パシフィック・リーグ'),
  NPB('npb-lions', '埼玉西武ライオンズ', 'パシフィック・リーグ'),
  NPB('npb-marines', '千葉ロッテマリーンズ', 'パシフィック・リーグ'),
  IL('il-tokushima', '徳島インディゴソックス'),
  IL('il-kagawa', '香川オリーブガイナーズ'),
  IL('il-ehime', '愛媛マンダリンパイレーツ'),
  IL('il-kochi', '高知ファイティングドッグス'),
  BC('bc-fukushima', '福島レッドホープス'),
  BC('bc-ibaraki', '茨城アストロプラネッツ'),
  BC('bc-chiba', '千葉スカイセイラーズ'),
  BC('bc-tochigi', '栃木ゴールデンブレーブス'),
  BC('bc-saitama', '埼玉武蔵ヒートベアーズ'),
  BC('bc-kanagawa', '神奈川フューチャードリームス'),
  BC('bc-gunma', '群馬ダイヤモンドペガサス'),
  BC('bc-yamanashi', '山梨ファイアーウィンズ'),
  BC('bc-shinano', '信濃グランセローズ'),
  NL('nl-ishikawa', '石川ミリオンスターズ'),
  NL('nl-toyama', '富山GRNサンダーバーズ'),
  NL('nl-shiga', 'SHIGA HIJUMPS'),
]

/** 独立リーグの球団の所在（都道府県。球団名・リーグの公式表記による） */
export const INDEP_PREF: Record<string, string> = {
  'il-tokushima': '徳島県', 'il-kagawa': '香川県', 'il-ehime': '愛媛県', 'il-kochi': '高知県',
  'bc-fukushima': '福島県', 'bc-ibaraki': '茨城県', 'bc-chiba': '千葉県', 'bc-tochigi': '栃木県', 'bc-saitama': '埼玉県',
  'bc-kanagawa': '神奈川県', 'bc-gunma': '群馬県', 'bc-yamanashi': '山梨県', 'bc-shinano': '長野県',
  'nl-ishikawa': '石川県', 'nl-toyama': '富山県', 'nl-shiga': '滋賀県',
}

export function orgById(id: string | undefined): Org | undefined {
  return id ? ORGS.find((o) => o.id === id) : undefined
}

/** the name to show: the real name only when verified, else the league + generic label */
export function orgLabel(o: Org | undefined): string {
  if (!o) return ''
  if (o.verified && o.realName) return o.realName
  if (o.verified && o.league) return `${o.league}の球団`
  return o.generic
}
