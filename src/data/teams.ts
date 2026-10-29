import raw from './teams-jaba.json' with { type: 'json' }

// Real 社会人野球 teams (PROJECT_PLAN §11.13): the company and club teams that appear in the official 2026
// lists of 日本野球連盟 (scripts/ingest-jaba.ts). Only teams with a region (地区連盟) can be placed; a team
// the 連盟報 lists as 活動休止 or 解散・脱退 is not in the table. The type (会社／クラブ) and the prefecture are
// known only for the teams in the 連盟報's list of changes; for the others they are left empty.

export interface AmateurTeam {
  name: string
  /** 地区連盟 */
  region: JabaRegion
  /** '' = not stated in the sources used */
  kind: 'company' | 'club' | ''
  pref: string
  /** in the list of teams of the 第51回日本選手権 (2026.10.9): the one fact on strength the sources give */
  nationals: boolean
}

export type JabaRegion = '北海道' | '東北' | '北信越' | '関東' | '東海' | '近畿' | '中国' | '四国' | '九州'

export const AMATEUR_META = raw.meta as { sources: string[]; accessed: string; sha256: string; rule: string; teams: number; withRegion: number; byRegion: Record<string, number>; inactiveExcluded: string[] }

export const AMATEUR_TEAMS: AmateurTeam[] = (raw.rows as [string, string, string, string, number][])
  .filter(([, region]) => region)
  .map(([name, region, kind, pref, bits]) => ({ name, region: region as JabaRegion, kind: kind as AmateurTeam['kind'], pref, nationals: (bits & 2) !== 0 }))

/** 地区連盟 of a prefecture (the 連盟報's list of member groups: 山梨 is in 関東, 静岡 in 東海, 福井 in 北信越) */
export const JABA_REGION_OF_PREF: Record<string, JabaRegion> = {
  北海道: '北海道',
  青森県: '東北', 岩手県: '東北', 宮城県: '東北', 秋田県: '東北', 山形県: '東北', 福島県: '東北',
  新潟県: '北信越', 富山県: '北信越', 石川県: '北信越', 福井県: '北信越', 長野県: '北信越',
  茨城県: '関東', 栃木県: '関東', 群馬県: '関東', 埼玉県: '関東', 千葉県: '関東', 東京都: '関東', 神奈川県: '関東', 山梨県: '関東',
  静岡県: '東海', 愛知県: '東海', 岐阜県: '東海', 三重県: '東海',
  滋賀県: '近畿', 京都府: '近畿', 大阪府: '近畿', 兵庫県: '近畿', 奈良県: '近畿', 和歌山県: '近畿',
  鳥取県: '中国', 島根県: '中国', 岡山県: '中国', 広島県: '中国', 山口県: '中国',
  徳島県: '四国', 香川県: '四国', 愛媛県: '四国', 高知県: '四国',
  福岡県: '九州', 佐賀県: '九州', 長崎県: '九州', 熊本県: '九州', 大分県: '九州', 宮崎県: '九州', 鹿児島県: '九州', 沖縄県: '九州',
}

/**
 * 2025年度の加盟チーム数（連盟報2026 p.364–365「2025年度加盟チーム数及び登録者数」の地区連盟ごとの計。会社／クラブ）。
 * 総合計 339（会社98・クラブ241）、ほかに活動休止25。名簿ではなく数だけで、収録率を測る基準にする。
 */
export const AMATEUR_OFFICIAL_2025: Record<JabaRegion, { company: number; club: number }> = {
  北海道: { company: 3, club: 17 },
  東北: { company: 8, club: 50 },
  北信越: { company: 6, club: 14 },
  関東: { company: 25, club: 74 },
  東海: { company: 11, club: 16 },
  近畿: { company: 18, club: 36 },
  中国: { company: 7, club: 11 },
  四国: { company: 3, club: 4 },
  九州: { company: 17, club: 19 },
}

export const teamsInRegion = (region: JabaRegion): AmateurTeam[] => AMATEUR_TEAMS.filter((t) => t.region === region)
