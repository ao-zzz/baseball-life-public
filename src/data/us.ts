// The United States as a place of birth and its names (PROJECT_PLAN §11.31). Nothing here is a statistic that was
// checked against a source: the weights below are rough shares of the population of each state (an assumption, used
// only to draw a birth place) and the names are common English given names and family names (an assumption, not a
// roster). The region (Census regions) is the usual grouping. All people in the game are fictional.

export type UsRegion = 'Northeast' | 'Midwest' | 'South' | 'West'

export interface UsState {
  name: string
  region: UsRegion
  /** a rough share of the population, in millions (assumption; not a count of births) */
  births: number
}

export const US_STATES: UsState[] = [
  { name: 'アラバマ州', region: 'South', births: 5.1 },
  { name: 'アラスカ州', region: 'West', births: 0.7 },
  { name: 'アリゾナ州', region: 'West', births: 7.4 },
  { name: 'アーカンソー州', region: 'South', births: 3.0 },
  { name: 'カリフォルニア州', region: 'West', births: 39 },
  { name: 'コロラド州', region: 'West', births: 5.9 },
  { name: 'コネチカット州', region: 'Northeast', births: 3.6 },
  { name: 'デラウェア州', region: 'South', births: 1.0 },
  { name: 'フロリダ州', region: 'South', births: 22.6 },
  { name: 'ジョージア州', region: 'South', births: 11 },
  { name: 'ハワイ州', region: 'West', births: 1.4 },
  { name: 'アイダホ州', region: 'West', births: 1.9 },
  { name: 'イリノイ州', region: 'Midwest', births: 12.5 },
  { name: 'インディアナ州', region: 'Midwest', births: 6.8 },
  { name: 'アイオワ州', region: 'Midwest', births: 3.2 },
  { name: 'カンザス州', region: 'Midwest', births: 2.9 },
  { name: 'ケンタッキー州', region: 'South', births: 4.5 },
  { name: 'ルイジアナ州', region: 'South', births: 4.6 },
  { name: 'メーン州', region: 'Northeast', births: 1.4 },
  { name: 'メリーランド州', region: 'South', births: 6.2 },
  { name: 'マサチューセッツ州', region: 'Northeast', births: 7.0 },
  { name: 'ミシガン州', region: 'Midwest', births: 10 },
  { name: 'ミネソタ州', region: 'Midwest', births: 5.7 },
  { name: 'ミシシッピ州', region: 'South', births: 2.9 },
  { name: 'ミズーリ州', region: 'Midwest', births: 6.2 },
  { name: 'モンタナ州', region: 'West', births: 1.1 },
  { name: 'ネブラスカ州', region: 'Midwest', births: 2.0 },
  { name: 'ネバダ州', region: 'West', births: 3.2 },
  { name: 'ニューハンプシャー州', region: 'Northeast', births: 1.4 },
  { name: 'ニュージャージー州', region: 'Northeast', births: 9.3 },
  { name: 'ニューメキシコ州', region: 'West', births: 2.1 },
  { name: 'ニューヨーク州', region: 'Northeast', births: 19.6 },
  { name: 'ノースカロライナ州', region: 'South', births: 10.8 },
  { name: 'ノースダコタ州', region: 'Midwest', births: 0.8 },
  { name: 'オハイオ州', region: 'Midwest', births: 11.8 },
  { name: 'オクラホマ州', region: 'South', births: 4.0 },
  { name: 'オレゴン州', region: 'West', births: 4.2 },
  { name: 'ペンシルベニア州', region: 'Northeast', births: 13 },
  { name: 'ロードアイランド州', region: 'Northeast', births: 1.1 },
  { name: 'サウスカロライナ州', region: 'South', births: 5.3 },
  { name: 'サウスダコタ州', region: 'Midwest', births: 0.9 },
  { name: 'テネシー州', region: 'South', births: 7.1 },
  { name: 'テキサス州', region: 'South', births: 30 },
  { name: 'ユタ州', region: 'West', births: 3.4 },
  { name: 'バーモント州', region: 'Northeast', births: 0.65 },
  { name: 'バージニア州', region: 'South', births: 8.7 },
  { name: 'ワシントン州', region: 'West', births: 7.8 },
  { name: 'ウェストバージニア州', region: 'South', births: 1.8 },
  { name: 'ウィスコンシン州', region: 'Midwest', births: 5.9 },
  { name: 'ワイオミング州', region: 'West', births: 0.58 },
]

export const US_STATE_WEIGHT_NOTE = '出生地の抽選の重みは、各州のおおよその人口（百万人単位の概数）で、出典で確認した値ではありません（ゲーム上の仮定）。'

/** the flag (age when it began) of a US life's current relationship: year.ts sets and reads it, the retirees' events set it too */
export const US_DATING_FLAG = 'us.dating'

/** first names of a partner or spouse (game inventions) */
export const US_PARTNER_NAMES = ['Emily', 'Sarah', 'Jessica', 'Ashley', 'Megan', 'Hannah', 'Olivia', 'Emma', 'Grace', 'Lauren']

export const US_GIVEN_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Andrew', 'Joshua', 'Kevin', 'Brian', 'Ryan',
  'Tyler', 'Jacob', 'Nathan', 'Caleb', 'Ethan', 'Logan', 'Mason', 'Carter', 'Hunter', 'Cole', 'Jackson', 'Austin', 'Dylan', 'Connor', 'Luke', 'Owen', 'Eli', 'Wyatt', 'Miguel', 'Carlos',
]

export const US_FAMILY_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Parker', 'Collins',
  'Garcia', 'Martinez', 'Rodriguez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres',
]
