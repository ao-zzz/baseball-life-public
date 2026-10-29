import type { Stat } from './types.ts'

// Japanese prefectures. `births` are rough figures used only as random-draw weights; they were not
// checked against a source, so they are labelled unverified and are never shown as facts.
export interface Prefecture {
  name: string
  region: string
  births: number
  /** summer regional tournament teams; only Aichi and Tottori are reported values (§6.4) */
  teams: number
  teamsKind: 'measured' | 'estimate'
}

const AVG_TEAMS = Math.round(((3363 - 174 - 21) / 45) * 10) / 10

const P = (name: string, region: string, births: number, teams?: number): Prefecture => ({
  name,
  region,
  births,
  teams: teams ?? AVG_TEAMS,
  teamsKind: teams === undefined ? 'estimate' : 'measured',
})

export const PREFECTURES: Prefecture[] = [
  P('北海道', '北海道', 26), P('青森県', '東北', 6.5), P('岩手県', '東北', 6.2), P('宮城県', '東北', 13),
  P('秋田県', '東北', 4.3), P('山形県', '東北', 5.8), P('福島県', '東北', 10.5), P('茨城県', '関東', 16.6),
  P('栃木県', '関東', 11.6), P('群馬県', '関東', 11.5), P('埼玉県', '関東', 45), P('千葉県', '関東', 37),
  P('東京都', '関東', 86), P('神奈川県', '関東', 58), P('新潟県', '中部', 12), P('富山県', '中部', 6),
  P('石川県', '中部', 7.3), P('福井県', '中部', 5), P('山梨県', '中部', 5), P('長野県', '中部', 12),
  P('岐阜県', '中部', 11.7), P('静岡県', '中部', 21.6), P('愛知県', '中部', 51, 174), P('三重県', '近畿', 10.5),
  P('滋賀県', '近畿', 10), P('京都府', '近畿', 15), P('大阪府', '近畿', 58), P('兵庫県', '近畿', 34),
  P('奈良県', '近畿', 7.8), P('和歌山県', '近畿', 5.6), P('鳥取県', '中国', 3.7, 21), P('島根県', '中国', 4.3),
  P('岡山県', '中国', 12.5), P('広島県', '中国', 18), P('山口県', '中国', 8), P('徳島県', '四国', 4.4),
  P('香川県', '四国', 6.3), P('愛媛県', '四国', 7.9), P('高知県', '四国', 3.8), P('福岡県', '九州', 36),
  P('佐賀県', '九州', 5.8), P('長崎県', '九州', 8.5), P('熊本県', '九州', 12.5), P('大分県', '九州', 7.3),
  P('宮崎県', '九州', 7.2), P('鹿児島県', '九州', 10.8), P('沖縄県', '九州・沖縄', 13.8),
]

export const PREF_WEIGHT_STAT: Stat = {
  id: 'jpPrefWeights', value: PREFECTURES.length, unit: '都道府県', kind: 'assumption', domain: 'population', sex: 'all',
  population: '日本の出生', definition: '生まれる都道府県を決める重み（年間出生数の概算、千人）', asOf: '2023年ごろ（概算）',
  sourceIds: [], sourceType: 'none', unverified: true, note: '出典を確認するまでは重みとしてだけ使い、画面に事実として出さない。',
}

// Fictional people. Common surnames and given names only; any match with a real person is coincidental.
export const FAMILY_NAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本',
  '井上', '木村', '林', '斎藤', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川',
  '前田', '岡田', '長谷川', '藤田', '後藤', '近藤', '村上', '遠藤', '青木', '坂本', '斉藤', '福田', '太田', '西村', '藤井',
  '金子', '岡本', '藤原', '三浦', '中野', '中川', '原田', '松田', '竹内', '小野', '田村', '中山', '和田', '石田', '森田',
]

export const GIVEN_NAMES = [
  '蓮', '湊', '陽翔', '蒼', '樹', '悠真', '大和', '颯', '律', '陽太', '奏太', '悠人', '朝陽', '大翔', '湊斗',
  '健太', '翔太', '拓海', '大輝', '航', '颯太', '海斗', '優斗', '晴', '陸', '隼', '一輝', '直樹', '圭', '亮',
]

export const PARTNER_NAMES = ['美咲', '葵', '結衣', '陽菜', '紗希', '彩', '真央', '千尋', '詩織', '理沙', '舞', '恵']
