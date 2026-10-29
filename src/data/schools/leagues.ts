import raw from './jubf-leagues.json' with { type: 'json' }

// University baseball leagues (PROJECT_PLAN §11.14–11.15). Facts and assumptions are kept apart:
// - read from the federation's own pages (全日本大学野球連盟, scripts/ingest-jubf.ts): the 27 member leagues, their
//   websites and member universities (source jubfLeagues), and the finalists of the national championship,
//   2005–2026 (source jubfChampions);
// - read from a secondary page (Wikipedia): the 部 (division) of the 東都 and 首都 leagues, which the federation's
//   pages do not give (source wikiUnivLeagueMembers);
// - game assumptions: the strength of a league or a division (route/rating.ts), never a statistic.

export interface UnivLeague {
  /** the federation's league id, "01"…"27" */
  id: string
  name: string
  site: string
  /** number of member universities as the federation writes it */
  teams: number
  /** member names as written on the federation's page */
  members: string[]
}

export const UNIV_LEAGUES: UnivLeague[] = raw.leagues.map((l) => ({ id: l.leagueId, name: l.name, site: l.site, teams: l.count, members: l.members }))
export const JUBF_META = raw.meta as { source: string; url: string; accessed: string; sha256: string; note: string }

/** spellings on the federation's pages that differ from the national list */
export const MEMBER_ALIAS: Record<string, string> = { 國學院大学: '國學院大學' }

export const leagueName = (id: string): string => UNIV_LEAGUES.find((l) => l.id === id)?.name ?? id

/** ids of the leagues whose divisions are known */
export const TOKYO6 = '09'
export const TOTO = '10'
export const SHUTO = '11'

export interface DivisionList {
  league: string
  /** 部 (1 = top) */
  division: number
  names: string[]
  /** strength of the division on the scale where an average university team is 0.55 and this is the offset: a game assumption */
  tier: number
}

/** the divisions of two leagues (Wikipedia: 東都 as of the 2026 spring season, 首都 as of the 2025 autumn season) */
export const DIVISIONS: DivisionList[] = [
  { league: TOTO, division: 1, tier: 0.55, names: ['青山学院大学', '國學院大學', '東洋大学', '中央大学', '亜細亜大学', '立正大学'] },
  { league: TOTO, division: 2, tier: 0.35, names: ['駒澤大学', '専修大学', '日本大学', '東京農業大学', '拓殖大学', '帝京平成大学'] },
  { league: TOTO, division: 3, tier: 0.1, names: ['国士舘大学', '大正大学', '成蹊大学', '上智大学', '学習院大学', '一橋大学'] },
  { league: TOTO, division: 4, tier: -0.1, names: ['順天堂大学', '東京科学大学', '芝浦工業大学', '東京都市大学'] },
  { league: SHUTO, division: 1, tier: 0.35, names: ['筑波大学', '帝京大学', '日本体育大学', '武蔵大学', '東海大学', '城西大学'] },
  {
    league: SHUTO,
    division: 2,
    tier: 0.1,
    names: ['明星大学', '大東文化大学', '獨協大学', '日本ウェルネススポーツ大学', '東京経済大学', '明治学院大学', '桜美林大学', '成城大学', '足利大学', '玉川大学'],
  },
]

/** finalists of the 全日本大学野球選手権大会 (2020: cancelled); names as in the national list */
export const CHAMPIONS: { year: number; champion: string; runnerUp: string }[] = [
  { year: 2005, champion: '青山学院大学', runnerUp: '近畿大学' },
  { year: 2006, champion: '大阪体育大学', runnerUp: '青山学院大学' },
  { year: 2007, champion: '早稲田大学', runnerUp: '東海大学' },
  { year: 2008, champion: '東洋大学', runnerUp: '東海大学' },
  { year: 2009, champion: '法政大学', runnerUp: '富士大学' },
  { year: 2010, champion: '東洋大学', runnerUp: '東海大学' },
  { year: 2011, champion: '東洋大学', runnerUp: '慶應義塾大学' },
  { year: 2012, champion: '早稲田大学', runnerUp: '亜細亜大学' },
  { year: 2013, champion: '上武大学', runnerUp: '亜細亜大学' },
  { year: 2014, champion: '東海大学', runnerUp: '神奈川大学' },
  { year: 2015, champion: '早稲田大学', runnerUp: '流通経済大学' },
  { year: 2016, champion: '中京学院大学', runnerUp: '中央学院大学' },
  { year: 2017, champion: '立教大学', runnerUp: '国際武道大学' },
  { year: 2018, champion: '東北福祉大学', runnerUp: '国際武道大学' },
  { year: 2019, champion: '明治大学', runnerUp: '佛教大学' },
  { year: 2021, champion: '慶應義塾大学', runnerUp: '福井工業大学' },
  { year: 2022, champion: '亜細亜大学', runnerUp: '上武大学' },
  { year: 2023, champion: '青山学院大学', runnerUp: '明治大学' },
  { year: 2024, champion: '青山学院大学', runnerUp: '早稲田大学' },
  { year: 2025, champion: '東北福祉大学', runnerUp: '福井工業大学' },
  { year: 2026, champion: '関西大学', runnerUp: '慶應義塾大学' },
]

export const LEAGUE_SOURCES = { leagues: 'jubfLeagues', champions: 'jubfChampions', divisions: 'wikiUnivLeagueMembers', accessed: '2026-10-18' } as const
