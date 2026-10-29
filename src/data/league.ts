// Places of birth and names for the countries added after Japan and the US (Korea, Cuba: PROJECT_PLAN §11.46). Everything here is
// a game assumption: the weights are rough populations (in 万人, round figures, not checked against a source), and the names are
// common-sounding ones chosen by hand, not drawn from a register.

export interface LeagueRegion {
  name: string
  /** the weight of the draw of the place of birth (rough population in 万人; an assumption) */
  births: number
}

export const KR_REGIONS: LeagueRegion[] = [
  { name: 'ソウル', births: 940 },
  { name: '釜山', births: 330 },
  { name: '大邱', births: 235 },
  { name: '仁川', births: 295 },
  { name: '光州', births: 140 },
  { name: '大田', births: 145 },
  { name: '蔚山', births: 110 },
  { name: '世宗', births: 38 },
  { name: '京畿道', births: 1360 },
  { name: '江原道', births: 155 },
  { name: '忠清北道', births: 160 },
  { name: '忠清南道', births: 213 },
  { name: '全羅北道', births: 175 },
  { name: '全羅南道', births: 180 },
  { name: '慶尚北道', births: 260 },
  { name: '慶尚南道', births: 330 },
  { name: '済州島', births: 67 },
]

export const CU_REGIONS: LeagueRegion[] = [
  { name: 'ピナル・デル・リオ', births: 58 },
  { name: 'アルテミサ', births: 51 },
  { name: 'ラ・ハバナ', births: 212 },
  { name: 'マヤベケ', births: 38 },
  { name: 'マタンサス', births: 71 },
  { name: 'シエンフエゴス', births: 41 },
  { name: 'ビジャ・クララ', births: 78 },
  { name: 'サンクティ・スピリトゥス', births: 46 },
  { name: 'シエゴ・デ・アビラ', births: 43 },
  { name: 'カマグエイ', births: 77 },
  { name: 'ラス・トゥナス', births: 53 },
  { name: 'オルギン', births: 102 },
  { name: 'グランマ', births: 81 },
  { name: 'サンティアゴ・デ・クーバ', births: 105 },
  { name: 'グアンタナモ', births: 50 },
]

export const KR_FAMILY_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍']
export const KR_GIVEN_NAMES = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준우', '현우', '건우', '우진', '선우', '민재', '지훈', '승현', '태양', '재윤', '동현']
export const KR_PARTNER_NAMES = ['서연', '지우', '하윤', '서윤', '지민', '수아', '채원', '예은', '유진', '다은']

export const CU_FAMILY_NAMES = ['Rodríguez', 'Hernández', 'González', 'Pérez', 'Díaz', 'García', 'Martínez', 'Sánchez', 'López', 'Fernández', 'Gómez', 'Torres', 'Ramírez', 'Castillo', 'Morales', 'Suárez', 'Cruz', 'Ortega', 'Silva', 'Domínguez']
export const CU_GIVEN_NAMES = ['Yoel', 'Alexei', 'Yunier', 'Reinier', 'Lázaro', 'Yasiel', 'Raúl', 'Osvaldo', 'Carlos', 'Dayron', 'Yosvani', 'Roberto', 'Eduardo', 'Frank', 'Amaury', 'Jorge', 'Ernesto', 'Yordan', 'Luis', 'Pedro']
export const CU_PARTNER_NAMES = ['Yanet', 'Daniela', 'Lisandra', 'Marlen', 'Yaimara', 'Claudia', 'Beatriz', 'Dayana', 'Mailín', 'Yadira']

/** a flag of this country's love thread (the dating year; the same meaning as the US's `us.dating`, which its shared code reads) */
export const LEAGUE_NOTE = '出生地の抽選の重みは、おおよその人口（万人単位の概数）で、出典で確認した値ではありません（ゲーム上の仮定）。名前は、よくある響きの名前を手で選んだものです。'
