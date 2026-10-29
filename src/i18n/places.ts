import type { CountryCode } from '../data/types.ts'
import { COUNTRY_INFO } from '../engine/countries/index.ts'
import { STAR_INFO, type StarInfo } from '../data/potentialStars.ts'
import { lang, type Lang } from './index.ts'

// The names the screens show for the data (the multilingual work, batch 2): countries, what their places of birth are called, the places
// themselves and the words of the ★. The game keeps and compares its Japanese names (a prefecture's name is read by its rules), so the
// data are never changed: the screens ask here, and in Japanese they get the data as they are.
// Countries and region words are tables by country code (a missing one fails the type check); places and ★ are by the data's own
// Japanese name or number, checked by src/i18n/i18n.test.tsx (every place of every playable country has its English name).

const COUNTRY_EN: Record<CountryCode, string> = {
  JP: 'Japan',
  US: 'United States',
  KR: 'South Korea',
  TW: 'Taiwan',
  DO: 'Dominican Republic',
  CU: 'Cuba',
  VE: 'Venezuela',
  MX: 'Mexico',
}

const REGION_WORD_EN: Record<CountryCode, string> = { JP: 'prefecture', US: 'state', KR: 'region', TW: 'region', DO: 'region', CU: 'province', VE: 'region', MX: 'region' }

/** the places of birth, by the data's Japanese name (romanised without long vowels for Japan, as the prefectures write themselves) */
export const PLACE_EN: Record<string, string> = {
  // Japan (data/jp.ts PREFECTURES)
  北海道: 'Hokkaido', 青森県: 'Aomori', 岩手県: 'Iwate', 宮城県: 'Miyagi', 秋田県: 'Akita', 山形県: 'Yamagata', 福島県: 'Fukushima',
  茨城県: 'Ibaraki', 栃木県: 'Tochigi', 群馬県: 'Gunma', 埼玉県: 'Saitama', 千葉県: 'Chiba', 東京都: 'Tokyo', 神奈川県: 'Kanagawa',
  新潟県: 'Niigata', 富山県: 'Toyama', 石川県: 'Ishikawa', 福井県: 'Fukui', 山梨県: 'Yamanashi', 長野県: 'Nagano', 岐阜県: 'Gifu',
  静岡県: 'Shizuoka', 愛知県: 'Aichi', 三重県: 'Mie', 滋賀県: 'Shiga', 京都府: 'Kyoto', 大阪府: 'Osaka', 兵庫県: 'Hyogo', 奈良県: 'Nara',
  和歌山県: 'Wakayama', 鳥取県: 'Tottori', 島根県: 'Shimane', 岡山県: 'Okayama', 広島県: 'Hiroshima', 山口県: 'Yamaguchi',
  徳島県: 'Tokushima', 香川県: 'Kagawa', 愛媛県: 'Ehime', 高知県: 'Kochi', 福岡県: 'Fukuoka', 佐賀県: 'Saga', 長崎県: 'Nagasaki',
  熊本県: 'Kumamoto', 大分県: 'Oita', 宮崎県: 'Miyazaki', 鹿児島県: 'Kagoshima', 沖縄県: 'Okinawa',
  // the United States (data/us.ts US_STATES)
  アラバマ州: 'Alabama', アラスカ州: 'Alaska', アリゾナ州: 'Arizona', アーカンソー州: 'Arkansas', カリフォルニア州: 'California',
  コロラド州: 'Colorado', コネチカット州: 'Connecticut', デラウェア州: 'Delaware', フロリダ州: 'Florida', ジョージア州: 'Georgia',
  ハワイ州: 'Hawaii', アイダホ州: 'Idaho', イリノイ州: 'Illinois', インディアナ州: 'Indiana', アイオワ州: 'Iowa', カンザス州: 'Kansas',
  ケンタッキー州: 'Kentucky', ルイジアナ州: 'Louisiana', メーン州: 'Maine', メリーランド州: 'Maryland', マサチューセッツ州: 'Massachusetts',
  ミシガン州: 'Michigan', ミネソタ州: 'Minnesota', ミシシッピ州: 'Mississippi', ミズーリ州: 'Missouri', モンタナ州: 'Montana',
  ネブラスカ州: 'Nebraska', ネバダ州: 'Nevada', ニューハンプシャー州: 'New Hampshire', ニュージャージー州: 'New Jersey',
  ニューメキシコ州: 'New Mexico', ニューヨーク州: 'New York', ノースカロライナ州: 'North Carolina', ノースダコタ州: 'North Dakota',
  オハイオ州: 'Ohio', オクラホマ州: 'Oklahoma', オレゴン州: 'Oregon', ペンシルベニア州: 'Pennsylvania', ロードアイランド州: 'Rhode Island',
  サウスカロライナ州: 'South Carolina', サウスダコタ州: 'South Dakota', テネシー州: 'Tennessee', テキサス州: 'Texas', ユタ州: 'Utah',
  バーモント州: 'Vermont', バージニア州: 'Virginia', ワシントン州: 'Washington', ウェストバージニア州: 'West Virginia',
  ウィスコンシン州: 'Wisconsin', ワイオミング州: 'Wyoming',
  // South Korea (data/league.ts KR_REGIONS)
  ソウル: 'Seoul', 釜山: 'Busan', 大邱: 'Daegu', 仁川: 'Incheon', 光州: 'Gwangju', 大田: 'Daejeon', 蔚山: 'Ulsan', 世宗: 'Sejong',
  京畿道: 'Gyeonggi', 江原道: 'Gangwon', 忠清北道: 'North Chungcheong', 忠清南道: 'South Chungcheong', 全羅北道: 'North Jeolla',
  全羅南道: 'South Jeolla', 慶尚北道: 'North Gyeongsang', 慶尚南道: 'South Gyeongsang', 済州島: 'Jeju',
  // Cuba (data/league.ts CU_REGIONS)
  'ピナル・デル・リオ': 'Pinar del Río', アルテミサ: 'Artemisa', 'ラ・ハバナ': 'Havana', マヤベケ: 'Mayabeque', マタンサス: 'Matanzas',
  シエンフエゴス: 'Cienfuegos', 'ビジャ・クララ': 'Villa Clara', 'サンクティ・スピリトゥス': 'Sancti Spíritus', 'シエゴ・デ・アビラ': 'Ciego de Ávila',
  カマグエイ: 'Camagüey', 'ラス・トゥナス': 'Las Tunas', オルギン: 'Holguín', グランマ: 'Granma', 'サンティアゴ・デ・クーバ': 'Santiago de Cuba',
  グアンタナモ: 'Guantánamo',
}

/** the words of each ★ (data/potentialStars.ts STAR_INFO) */
export const STAR_EN: Record<number, StarInfo> = {
  1: { title: 'An ordinary boy, true to life', text: 'Ordinary gifts (×1). Close to real life: most boys leave baseball somewhere in high school.' },
  2: { title: 'A boy with good reflexes', text: 'Slightly better gifts. He may become one of the core players of his team.' },
  3: { title: 'Talked about in his town', text: 'Gifts that stand out locally. In the right setting, the road to a strong high school or university opens.' },
  4: { title: 'A name in his prefecture', text: 'Gifts whose name comes up in prefectural tournaments. More paths open, but it depends on how he is raised.' },
  5: { title: 'Gifts to aim for the national stage', text: 'Gifts that can aim for Koshien and the national tournaments. The pros come into view, yet injuries or a poor fit may stop him short.' },
  6: { title: 'Gifts of national level', text: 'Gifts that could hold up anywhere in the country. Pro scouts may start to notice him.' },
  7: { title: 'Among the best in the country', text: 'Gifts that make the pros a real prospect. Even so, he may be found late, or not get his chances.' },
  8: { title: 'Gifts the pros could chase', text: 'Gifts pro clubs might follow. He will not necessarily get through every gate.' },
  9: { title: 'Rare gifts, even in baseball', text: 'Rare gifts, even in the baseball world. Success depends on development, playing time, health and his own decisions all coming together.' },
  10: { title: 'A potential world-class talent', text: 'Gifts that could even reach MLB. But nothing is promised: injuries, setting, playing time, coaches and being found late may keep them from blooming, or him from the pros.' },
}

/** the countries whose English name takes "the" in a sentence (a place where he lived: "in the United States") */
const COUNTRY_THE: Partial<Record<CountryCode, string>> = { US: 'the United States', DO: 'the Dominican Republic' }

/** the names of the data in one language other than Japanese (the multilingual work: another language adds its own set here) */
export interface PlaceWords {
  country: Record<CountryCode, string>
  regionWord: Record<CountryCode, string>
  place: Record<string, string>
  star: Record<number, StarInfo>
  /** a country's name inside a sentence, where it differs from `country` */
  countryInSentence: Partial<Record<CountryCode, string>>
  /** the mark of a country in beta, after its name */
  beta: string
}

const WORDS: Partial<Record<Lang, PlaceWords>> = {
  en: { country: COUNTRY_EN, regionWord: REGION_WORD_EN, place: PLACE_EN, star: STAR_EN, countryInSentence: COUNTRY_THE, beta: ' (beta)' },
}

/** a language's names of the data, once fetched (packs.ts: Korean placesKo.ts, Traditional Chinese placesZhTW.ts) */
export function addPlaceWords(l: Lang, w: PlaceWords) {
  WORDS[l] = w
}

/** the names of the data in a language (the language now by default); undefined in Japanese, whose names are the data's own */
export const placeWords = (l: Lang = lang()): PlaceWords | undefined => WORDS[l]

/** a country's name */
export const countryName = (c: CountryCode): string => placeWords()?.country[c] ?? COUNTRY_INFO[c].label

/** a country's name in the choice of the country, with its beta mark (engine/countries/index.ts countryTitle) */
export const countryChoice = (c: CountryCode): string => countryName(c) + (COUNTRY_INFO[c].beta ? (placeWords()?.beta ?? '（ベータ版）') : '')

/** what a country's places of birth are called */
export const regionWord = (c: CountryCode): string => placeWords()?.regionWord[c] ?? COUNTRY_INFO[c].regionLabel

/** a country by its Japanese name (where he lives when it is abroad: engine/place.ts livingPlace gives the country's name) */
const countryOfLabel = (name: string): CountryCode | undefined => (Object.keys(COUNTRY_INFO) as CountryCode[]).find((c) => COUNTRY_INFO[c].label === name)

/** a place by the data's name, or a country's (the name itself when there is no name for it in the language) */
export const placeName = (name: string): string => {
  const w = placeWords()
  if (!w) return name
  const c = w.place[name] === undefined ? countryOfLabel(name) : undefined
  return w.place[name] ?? (c ? (w.countryInSentence[c] ?? w.country[c]) : name)
}

/** a country's place of birth by its index (LifeConfig.prefecture) */
export const regionName = (c: CountryCode, i: number): string => placeName(COUNTRY_INFO[c].regions[i] ?? '')

/** the words of a ★ */
export const starInfo = (n: number): StarInfo => placeWords()?.star[n] ?? STAR_INFO[n]
