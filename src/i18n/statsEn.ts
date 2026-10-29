import type { Source, Stat } from '../data/types.ts'
import { lang, type Lang } from './index.ts'
import { moneyTokens } from './currency.ts'

// The statistics and their sources as the screens show them (the multilingual work, batch 6). The data (data/stats.ts, data/sources.ts)
// are never changed: the screens ask here, and in Japanese they get the data as they are. In English they get the texts of these maps,
// by stat id and source id (every id has its entry: checked by src/i18n/i18n.test.tsx). The English keeps who is counted, what is
// counted, the time, and every caveat (unconfirmed, reference value, assumption) of the Japanese. Drafted with AI.
// A source in Japanese (or Chinese) keeps its original title after the English one, in parentheses (`original`), so that a reader can
// find it: that is the only Japanese the English shows here.

export interface StatEn {
  population: string
  definition: string
  asOf: string
  verifyNote?: string
  note?: string
}

export interface SourceEn {
  title: string
  /** the source's own title in its language (Japanese or Chinese), shown after the English one */
  original?: string
  publisher: string
  checkNote?: string
}

const JHBF = 'the Japan High School Baseball Federation'
const JPBPA = 'the Japan Professional Baseball Players Association'

/** a value confirmed in the source whose source has no breakdown by sex (data/stats.ts `ref`) */
const ref = (target: string, extra = '') =>
  `Counted: ${target}. Figures and definition confirmed in the source (2026-10-17). The source gives no breakdown by sex, so it is not asserted to be a value for males only; it is used as a reference value for the male career model.${extra ? ' ' + extra : ''}`
/** the same, for a value computed from such figures (data/stats.ts `refDerived`) */
const refDerived = (target: string, extra = '') =>
  `Counted: ${target}. The underlying figures were confirmed in the source (2026-10-17). The original statistics give no breakdown by sex, so it is not asserted to be a value for males only; it is used as a reference value for the male career model.${extra ? ' ' + extra : ''}`
const NO_DATA = 'A model setting with no data behind it.'
const MANAGERS = 'The source also does not say whether team managers are included.'
const TEAMS_NO_SEX = 'A number of teams; no breakdown by sex is shown.'
const CONFIRMED_MEN = 'Confirmed in the source (2026-10-17). The source’s table shows it as the value for “men”.'

const HS_MEMBERS = `Hardball baseball club members at member schools of ${JHBF}`
const DRAFT_2025 = 'The 2025 NPB draft'
const FILED_2025 = 'Declarations for the pro draft, 2025'
const RELEASED = 'The 767 NPB players released or retired in 2021–2025'
const RELEASED_PATHS = 'the paths of the 767 NPB players released or retired from active play in 2021–2025 (NPB survey)'
const SALARY_713 = `The 713 Japanese players officially announced on NPB main rosters`
const OLD_EDITION_AMOUNT = 'Material of the 2022 edition. The game uses it as the standard for 2025; the amounts for 2025 and 2026 have not been confirmed'
const OLD_EDITION_RULE = 'Material of the 2022 edition. The game uses it as the standard for 2025; the rules for 2025 and 2026 have not been confirmed'
const PLAYING_KIDS = 'Children and players who play baseball'

export const STAT_EN: Record<string, StatEn> = {
  // ---------------------------------------------------------------- Japan: measured / reported
  jpHsPlayers: {
    population: HS_MEMBERS,
    definition: 'Total club members of all grades (the source does not say whether girls and team managers are included)',
    asOf: 'end of May 2026',
    verifyNote: ref(`hardball baseball club members at member schools of ${JHBF} (all grades, end of May 2026)`, MANAGERS),
    note: 'The denominator of the title “1 in 120,000”. Not the chance of turning pro.',
  },
  jpHsFirstYears: {
    population: HS_MEMBERS,
    definition: 'Number of first-year members',
    asOf: 'end of May 2026',
    verifyNote: ref(`first-year members among the hardball baseball club members at member schools of ${JHBF} (end of May 2026)`, MANAGERS),
  },
  jpHsSeniors2025: {
    population: HS_MEMBERS,
    definition: 'Number of third-year members',
    asOf: 'end of May 2025',
    verifyNote: ref(`third-year members among the hardball baseball club members at member schools of ${JHBF} (end of May 2025, a past table)`, MANAGERS),
  },
  jpHsSchools: {
    population: 'The Japan High School Baseball Federation (hardball)',
    definition: 'Number of member schools',
    asOf: 'end of May 2026',
    verifyNote: ref(`hardball member schools of ${JHBF} (end of May 2026)`, 'A number of schools; no breakdown by sex is shown.'),
  },
  jpHsComplete: {
    population: 'High school hardball baseball club members',
    definition: 'Retention rate = third-year members ÷ first-year members of their year of entry (including members who joined midway)',
    asOf: 'end of May 2026',
    verifyNote: ref(`hardball baseball club members at member schools of ${JHBF} (the third-years of 2026 and the first-years of 2024)`),
    note: 'Since those who joined midway are also counted among the third-years, this is not exactly the share of the same people who stayed for 3 years.',
  },
  jpTeamsTotal: {
    population: 'The regional tournaments of summer 2026',
    definition: 'Number of participating teams (including 157 combined teams)',
    asOf: 'summer 2026',
    verifyNote: ref('teams that entered the regional tournaments of the 2026 summer National High School Baseball Championship (press report)', TEAMS_NO_SEX),
  },
  jpTeamsAichi: {
    population: 'The regional tournaments of summer 2026 (Aichi)',
    definition: 'Number of participating teams (the most)',
    asOf: 'summer 2026',
    verifyNote: ref('teams that entered the Aichi tournament of summer 2026 (press report)', TEAMS_NO_SEX),
  },
  jpTeamsTottori: {
    population: 'The regional tournaments of summer 2026 (Tottori)',
    definition: 'Number of participating teams (the fewest)',
    asOf: 'summer 2026',
    verifyNote: ref('teams that entered the Tottori tournament of summer 2026 (press report)', TEAMS_NO_SEX),
  },
  jpJhsSoft: {
    population: 'Rubber-ball baseball in the junior high school sports federation (Chutairen)',
    definition: 'Number of players (all grades; survey by the rubber-ball baseball section of the Japan junior high school sports federation)',
    asOf: '2025',
    verifyNote: ref(
      'members and players of rubber-ball baseball clubs in the junior high school sports federation (2025; an NPB article quoting the federation’s survey)',
      'The federation’s original material was not opened this time.',
    ),
  },
  jpDraftTotal: {
    population: DRAFT_2025,
    definition: 'Number of players drafted (73 main roster, 43 development)',
    asOf: '2025',
    verifyNote: ref('players drafted at the 2025 NPB draft meeting (tally by a press report)'),
  },
  jpDraftFromHs: {
    population: DRAFT_2025,
    definition: 'High school players drafted (19 main roster, 14 development)',
    asOf: '2025',
    verifyNote: ref('high school players drafted at the 2025 NPB draft meeting (tally by a press report)'),
  },
  jpDraftFromUniv: {
    population: DRAFT_2025,
    definition: 'University players drafted (including universities abroad; 40 main roster, 14 development)',
    asOf: '2025',
    verifyNote: ref('university players drafted at the 2025 NPB draft meeting (including universities abroad; tally by a press report)'),
  },
  jpDraftFromCompany: {
    population: DRAFT_2025,
    definition: 'Company-team players drafted (12 main roster, 1 development)',
    asOf: '2025',
    verifyNote: ref('company baseball players drafted at the 2025 NPB draft meeting (tally by a press report)'),
  },
  jpDraftFromIndep: {
    population: DRAFT_2025,
    definition: 'Players drafted from independent leagues (1 main roster, 12 development)',
    asOf: '2025',
    verifyNote: ref('independent league players drafted at the 2025 NPB draft meeting (tally by a press report)'),
  },
  jpShibouHs: {
    population: FILED_2025,
    definition: 'Number of high school players who filed',
    asOf: '2025',
    verifyNote: ref('high school players who filed a declaration for the pro draft in 2025 (as stated in an article)'),
  },
  jpShibouUniv: {
    population: FILED_2025,
    definition: 'Number of university players who filed',
    asOf: '2025',
    verifyNote: ref('university players who filed a declaration for the pro draft in 2025 (as stated in an article)'),
  },
  jpIkuseiPromoted: {
    population: 'Development players of the 12 NPB clubs',
    definition: 'Number who moved from development to the main roster (2023, up to August, the time of the article)',
    asOf: '2023',
    verifyNote: ref('players of the 12 NPB clubs registered to the main roster from development in 2023 (up to the time of the article)'),
  },
  jpReleaseAge: {
    population: 'The 767 NPB players released or retired in 2021–2025 (excluding foreign players and development players re-signed by the same club)',
    definition: 'Average of each year’s average age (26.3–27.8) weighted by the number of players',
    asOf: '2021–2025',
    verifyNote: refDerived('the 767 NPB players released or retired from active play in 2021–2025 (excluding foreign players and development players re-signed by the same club; NPB survey)'),
  },
  jpTenure: {
    population: 'The 767 NPB players released or retired in 2021–2025 (excluding foreign players and development players re-signed by the same club)',
    definition: 'Average of each year’s average tenure (6.3–7.7 years) weighted by the number of players',
    asOf: '2021–2025',
    verifyNote: refDerived('the 767 NPB players released or retired from active play in 2021–2025 (NPB survey)'),
  },
  jpCareerNpb: {
    population: RELEASED,
    definition: 'Next path related to NPB (player, development player, coach, club staff and so on). Calculated from the 5-year total of 438 players',
    asOf: '2021–2025',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpCareerOtherBaseball: {
    population: RELEASED,
    definition: 'Next path in other baseball (independent, company, abroad and so on). Calculated from a total of 188 players',
    asOf: '2021–2025',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpCareerNonBaseball: {
    population: RELEASED,
    definition: 'Next path outside baseball. Calculated from a total of 82 players',
    asOf: '2021–2025',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpCareerUndecided: {
    population: RELEASED,
    definition: 'Next path undecided or unknown. Calculated from a total of 59 players',
    asOf: '2021–2025',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpSalaryMedian: {
    population: SALARY_713,
    definition: `Median salary (survey by ${JPBPA})`,
    asOf: '2026',
    verifyNote: ref(`the 713 Japanese players officially announced on the main rosters of the 12 clubs (survey by ${JPBPA}, 2026)`),
  },
  npbMinSalary: {
    population: 'NPB main-roster players',
    definition: 'Minimum salary (participation remuneration) of main-roster players (before tax)',
    asOf: OLD_EDITION_AMOUNT,
    verifyNote: `Counted: NPB main-roster players (table on p.5 of the material of ${JPBPA} (2022 edition)). {yen~:4200000} (before tax) and the definition were confirmed in the source (2026-10-22). The material is the 2022 edition, and the amounts for 2025 and 2026 have not been confirmed (the text of the Baseball Agreement itself is not public). The source gives no breakdown by sex, so it is not asserted to be a value for males only; it is used as a reference value for the male career model.`,
  },
  npbFirstTeamMin: {
    population: 'NPB main-roster players',
    definition:
      'First-team minimum guarantee: a player paid under {yen~:16000000} is paid, as additional participation remuneration, (¥16 million − salary) ÷ 150 for each day registered as an active player on the first team (with 150 days, {yen~:16000000} together with the salary)',
    asOf: OLD_EDITION_RULE,
    verifyNote: `Counted: NPB main-roster players (table on p.5 of the material of ${JPBPA} (2022 edition)). The {yen~:16000000} and 150-day formula and the definition were confirmed in the source (2026-10-22). The material is the 2022 edition, and the rules for 2025 and 2026 have not been confirmed (the text of the Baseball Agreement itself is not public). The source gives no breakdown by sex, so it is not asserted to be a value for males only; it is used as a reference value for the male career model. The game does not record days registered on the first team, so it counts them as “the share of one first-team season” × 150 days, the same as its conversion for FA rights (a model conversion).`,
  },
  jpSalaryMean: {
    population: SALARY_713,
    definition: `Mean salary (survey by ${JPBPA})`,
    asOf: '2026',
    verifyNote: ref(`the 713 Japanese players officially announced on the main rosters of the 12 clubs (survey by ${JPBPA}, 2026)`),
  },
  elbowYouth: {
    population: '247 players on elementary school baseball teams (a study by Yamagata University and others, published in 2007)',
    definition: 'Share in whom an avulsion of the medial epicondyle of the humerus (the inner side of the elbow) was found by ultrasound (a single study)',
    asOf: '2007',
    verifyNote:
      'The figure was confirmed in the paper’s abstract (2026-10-17). The abstract does not state the subjects’ region, sex or grade, and the value is not used in the career model either, so it is left unconfirmed.',
    note: 'A single study. Not a national figure.',
  },

  // ---------------------------------------------------------------- Japan: estimates derived from the above
  jpHsFile: {
    population: 'Third-year high school hardball baseball club members',
    definition: 'Declarations for the pro draft in 2025 (124 high school players) ÷ third-year members at the end of May 2025 (40,842)',
    asOf: '2025',
    verifyNote: refDerived(
      `the numerator is the high school players who filed a declaration for the pro draft in 2025, the denominator ${JHBF}’s third-year members at the end of May 2025`,
      'A ratio of two numbers from different sources.',
    ),
  },
  jpHsDraftGivenFile: {
    population: 'High school players who filed a declaration for the pro draft',
    definition: 'High school players drafted ÷ high school players who filed',
    asOf: '2025',
    verifyNote: refDerived('the 124 high school players who filed a declaration for the pro draft in 2025, and the 33 of them who were drafted (two press reports)'),
  },
  jpUnivDraftGivenFile: {
    population: 'University players who filed a declaration for the pro draft',
    definition: 'University players drafted ÷ university players who filed (the number drafted includes universities abroad)',
    asOf: '2025',
    verifyNote: refDerived(
      'the 176 university players who filed a declaration for the pro draft in 2025, and the 54 university players drafted (two press reports; the number drafted includes universities abroad)',
    ),
  },
  jpShihaikaHs: {
    population: 'The 33 high school players drafted in the 2025 NPB draft',
    definition: 'Share drafted to the main roster (one year of data)',
    asOf: '2025',
    verifyNote: refDerived('the 33 high school players drafted in the 2025 NPB draft (tally by a press report)', 'One year of data.'),
  },
  jpShihaikaUniv: {
    population: 'The 54 university players drafted in the 2025 NPB draft',
    definition: 'Share drafted to the main roster (one year of data)',
    asOf: '2025',
    verifyNote: refDerived('the 54 university players drafted in the 2025 NPB draft (tally by a press report)', 'One year of data.'),
  },
  jpShihaikaCompany: {
    population: 'The 13 company-team players drafted in the 2025 NPB draft',
    definition: 'Share drafted to the main roster (one year of data, few players)',
    asOf: '2025',
    verifyNote: refDerived('the 13 company baseball players drafted in the 2025 NPB draft (tally by a press report)', 'Data of one year and only 13 players.'),
  },
  jpShihaikaIndep: {
    population: 'The 13 independent league players drafted in the 2025 NPB draft',
    definition: 'Share drafted to the main roster (one year of data, few players)',
    asOf: '2025',
    verifyNote: refDerived('the 13 independent league players drafted in the 2025 NPB draft (tally by a press report)', 'Data of one year and only 13 players.'),
  },
  jpKoshien: {
    population: 'High school hardball baseball club members (one grade)',
    definition:
      'Share who make the bench at Koshien while at school. The slots of 32 schools in spring and 49 in summer × 20 players (1,620 a year), divided by the number of members per grade (124,116 ÷ 3)',
    asOf: '2026',
    verifyNote: `Counted: hardball baseball club members at member schools of ${JHBF} (all grades at the end of May 2026 divided by 3, per grade) and the spring and summer slots at Koshien. The number of members was confirmed in the source (2026-10-17). The number of participating schools (32 in spring, 49 in summer) and the bench size (20 players) were not opened in a source in this check, so they are left unconfirmed. The number of members has no breakdown by sex.`,
    note: 'Includes the assumption that one slot counts as one person of one grade.',
  },
  jpNpbExit: {
    population: 'NPB players',
    definition: 'Chance of leaving the club per year. The inverse of the average tenure in 2021–2025 (assuming the same chance every year)',
    asOf: '2021–2025',
    verifyNote: refDerived('the average tenure of the 767 NPB players released or retired from active play in 2021–2025 (NPB survey)', '“The same chance every year” is a model assumption.'),
  },
  jpSalarySigma: {
    population: 'Japanese NPB main-roster players',
    definition: 'Spread derived from the median and the mean, assuming salaries follow a log-normal distribution',
    asOf: '2026',
    verifyNote: refDerived(`salaries of the 713 Japanese players officially announced on the main rosters of the 12 clubs (survey by ${JPBPA})`, 'The log-normal distribution is a model assumption.'),
  },
  jpPrefTeamsOther: {
    population: 'The regional tournaments of summer 2026 (other than Aichi and Tottori)',
    definition: 'Average of the 45 prefectures other than Aichi and Tottori (including combined teams; the two-district system of Hokkaido and Tokyo is not taken into account)',
    asOf: 'summer 2026',
    verifyNote: refDerived('teams entered in the regional tournaments of summer 2026 (the national total, the most and the fewest, from a press report)', TEAMS_NO_SEX),
  },

  // ---------------------------------------------------------------- Japan: assumptions (no data yet)
  jpJhsContinue: {
    population: 'Children who played youth (elementary school) baseball',
    definition: 'Share who keep playing baseball in junior high',
    asOf: '-',
    verifyNote: NO_DATA,
    note: 'Assumed because there is no data on the number of youth players.',
  },
  jpHsJoin: {
    population: 'Children who played baseball in junior high',
    definition: 'Share who join a high school hardball baseball club',
    asOf: '-',
    verifyNote: NO_DATA,
    note: 'Assumed because the number of players in junior high hardball clubs is unknown. One grade of rubber-ball baseball (Chutairen) is about 46,000; first-year high school members are about 44,000.',
  },
  jpToUniv: {
    population: 'Players who kept playing hardball baseball through the third year of high school',
    definition: 'Share who keep playing baseball at university',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpToCompany: {
    population: 'Players who finished high school or university',
    definition: 'Share who join a corporate team in company baseball',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpToIndep: {
    population: 'Players who finished high school or university',
    definition: 'Share who join an independent league',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpUnivComplete: {
    population: 'University baseball club members',
    definition: 'Share who stay until the fourth year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpUnivFile: {
    population: 'Fourth-year university baseball club members',
    definition: 'Share who file a declaration for the pro draft (from the 176 who filed and an assumed number of university club members)',
    asOf: '-',
    verifyNote: 'There is no data on the number of university club members, so the share is an assumption.',
  },
  jpUnivToCompany: {
    population: 'Players who kept playing baseball through the fourth year of university',
    definition: 'Share who join a corporate team in company baseball',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpUnivToIndep: {
    population: 'Players who kept playing baseball through the fourth year of university',
    definition: 'Share who join an independent league',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpIkuseiExit: {
    population: 'NPB development players',
    definition: 'Chance of leaving the club per year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpCompanyDraft: {
    population: 'Company baseball players',
    definition: 'Chance of being drafted by NPB per year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpIndepDraft: {
    population: 'Independent league players',
    definition: 'Chance of being drafted by NPB per year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpIkuseiPromote: {
    population: 'NPB development players',
    definition: 'Chance of moving up to the main roster per year (from 32 a year and an assumed number of development players)',
    asOf: '-',
    verifyNote: 'There is no data on the total number of development players of the 12 clubs, so the share is an assumption.',
  },
  jpIchigun: {
    population: 'NPB main-roster players who have not yet played on the first team',
    definition: 'Chance of a first-team debut per year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpMlb: {
    population: 'NPB players with first-team experience',
    definition: 'Chance of moving to MLB per year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  companyTenure: {
    population: 'Company baseball and independent league players',
    definition: 'Chance of ending his playing days per year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  abilityRho: {
    population: PLAYING_KIDS,
    definition: 'How much ability (the standing within the same grade) carries over to the next year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  focusEffect: {
    population: PLAYING_KIDS,
    definition: 'How much ability rises in a year with “practice” as the focus',
    asOf: '-',
    verifyNote: NO_DATA,
  },

  // ---------------------------------------------------------------- body growth (general population, boys)
  jpBoyHeight: {
    population: 'Japanese boys (ages 5–17, sample survey)',
    definition: 'Average height by age (the table value is for age 17; the values for ages 5–17 are in body.ts)',
    asOf: 'fiscal 2024',
    verifyNote: 'Confirmed in the source (2026-10-17). The source’s table shows it as the value for “boys”.',
  },
  jpBoyWeight: {
    population: 'Japanese boys (ages 5–17, sample survey)',
    definition: 'Average weight by age (the table value is for age 17; the values for ages 5–17 are in body.ts)',
    asOf: 'fiscal 2024',
    verifyNote: 'Confirmed in the source (2026-10-17). The source’s table shows it as the value for “boys”.',
  },
  jpHsMembersPerSchool: {
    population: `Member schools of ${JHBF}`,
    definition: 'Hardball baseball club members per school (124,116 members ÷ 3,746 member schools; matches the “average” of 33.1 in the source’s table)',
    asOf: 'end of May 2026',
    verifyNote: refDerived(`hardball baseball club members and number of member schools of ${JHBF} (end of May 2026)`),
  },
  // abilities and team model (no data: model settings, shown as model values)
  abilityModel: {
    population: PLAYING_KIDS,
    definition:
      'The abilities shown (0–100) are the standing among people of the same age who play baseball: the overall ability (calibrated) plus strengths and weaknesses set by position and practice',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  velocityModel: {
    population: 'Pitchers',
    definition: 'The velocity shown: a standard for each age (127 km/h at 17) plus ability and strengths and weaknesses',
    asOf: '-',
    verifyNote: 'Published data on velocity by age could not be confirmed, so this is a model setting.',
  },
  hsTeamModel: {
    population: 'High school hardball baseball clubs',
    definition: 'Bench size (a game setting) and how team size and strength are set',
    asOf: '-',
    verifyNote:
      'The bench size of each tournament was not opened in a source in this check, so it is a game setting (20 players). Team size is centred on the average per school (33.1 players), and strong teams are assumed to have more.',
  },
  seasonModel: {
    population: 'University, company team, independent league and pro players',
    definition:
      'How the seasons after high school are made (a game setting): bench size (25 players), number of games (a university league season 10–14 games, independent leagues 50–70 games, the pros, for a full season, 143 games for a position player, 25 starts and 55 relief appearances, and on the second team 110, 18 and 40), league standings, wins and losses at tournaments, and the share of first-team play (from the standing of the ability that set that year’s salary). The standards for statistics are the distribution of the ability of the players who reached each stage in this model (100,000 trials, 2026-10-18) and the game’s standards for batting average, home runs and ERA',
    asOf: '-',
    verifyNote:
      'Bench size, number of games and tournament formats were not opened in a source in this check, so they are game settings. The names of tournaments were not checked either, so generic names are shown. Career checks (quitting the club, the draft, first-team debut, release) stay at their calibrated chances, and game results are made to fit them.',
  },
  schoolModel: {
    population: 'Players going on to high school or university',
    definition:
      'How schools are decided (a game setting): players are assigned to real schools, excluding girls’ schools (those whose names contain words such as “girls’” or “women’s academy”), as schools that have a baseball club. The chance of passing a general entrance exam comes from the gap between his academic ability (converted from knowledge) and the school’s difficulty (for schools with no deviation score included, a value provisionally set for each life); school recommendations from knowledge and evaluation; for sports recommendations, the teams that approach him are chosen by baseball strength (deviation scores are not used), and whether he gets in is decided from his evaluation (ability, fit for a defensive position, growth prospects, record, injury history and so on; evaluationModel) and the team’s strength (teamRatingModel). If he fails his first choice, he goes to a school he also applied to',
    asOf: '-',
    verifyNote:
      'School names are real names from the school codes of the Ministry of Education, Culture, Sports, Science and Technology. Whether there is a baseball club and how strong it is, how hard the entrance exams are, and the chances of passing or of recommendation are all game assumptions, not confirmed facts. Deviation scores are included only for universities, from Kawaijuku’s published values (predicted borders for the 2027 entrance exams); for high schools no usable source has been found, so they are not included.',
  },
  hsPlayModel: {
    population: 'High school baseball players',
    definition:
      'Model of high school individual statistics and velocity (a game setting). An average player bats about .250, has a home run rate of 1%, an ERA of about 4.6 and about 6.5 strikeouts per 9 innings. Opponents are other high school students (the stronger the school, the stronger the opponents). A pitcher pitches a smaller share the more players in his school have better pitching than he does (the ace of a weak school pitches nearly every game; at strong schools they share). The number of practice games changes with the school’s strength (more at stronger schools, fewer at weak ones). Velocity of third-year pitchers: median 127 km/h, bottom 10% about 117 km/h, top 1% about 143 km/h (an assumption with targets set on 2026-10-18)',
    asOf: '-',
    verifyNote:
      'No public data showing the distribution of high school players’ statistics has been found, so all are model values. The earlier settings were far better than reality, such as an average player batting .315 with an ERA of 2.6 and pitching 50–240 innings a year.',
  },
  evaluationModel: {
    population: 'Players choosing their path',
    definition:
      'Evaluation of a player (a game setting; no number is shown): overall ability plus fit for a defensive position (height only tilts each position slightly, and skill makes up for it), growth prospects (age, and room for height to grow), record (Koshien, captain, regular, championships, national team), injury history, recent form, the strength of his team and scouts’ attention. The chance of being approached and the chance of actually getting in are decided separately (joining through a tryout only, and club teams, each have their own standard)',
    asOf: '-',
    verifyNote:
      'There is no public data giving players’ evaluations or scouts’ evaluations as numbers, so all are model values. The relation between height and defensive position is also a game assumption, not a statistic.',
  },
  teamRatingModel: {
    population: 'Teams of high schools, universities, company baseball, independent leagues, NPB and US colleges',
    definition:
      'The internal strength of a team (a game setting; no number is shown, only words such as “powerhouse, upper tier, mid-tier” and the evidence). Universities: from the league they belong to (official pages of the Japan University Baseball Federation), that league’s number of finals reached in the championship (2005–2026), the divisions of the Tohto and Metropolitan leagues, and the university’s own finals reached. High schools: from Koshien appearances (summer and spring, 2004–2026, the Japan High School Baseball Federation’s lists of participating schools). Company teams: from the official list of teams in the Japan Championship. NPB: from the winning percentage of the last 3 years (NPB standings). US colleges: from the NCAA Division I conference. Teams with no evidence (high schools with no appearances, independent leagues, universities in no league) are estimated by operator, league and team. Stronger teams have more members, a higher bar for joining and harder competition within the team. In NPB, the stronger the club, the less first-team play for the same ability, and in the draft the weaker clubs pick more good players',
    asOf: '2026',
    verifyNote:
      'League members, championship finals reached, Koshien appearances, Japan Championship appearances and NPB results were each confirmed in official announcements (2026-10-18). The divisions of the Tohto and Metropolitan leagues and the list of US colleges are from a secondary source (Wikipedia). The formulas that make strength values from leagues, divisions, appearances and winning percentages, and the strength of teams with no evidence, are game assumptions.',
  },
  scoutModel: {
    population: 'Second- and third-year high school players, university players, and company team and independent league players',
    definition:
      'Scouts’ interest (0–100). Made from the chance of being chosen at the next check of the pro draft declaration or the draft (calibrated), moving a few points up or down with that year’s official game statistics. The stage “scouts are coming to watch” (60 or more) comes only when the check decides that scouts came. Not a value that promises a pick',
    asOf: '-',
    verifyNote: 'There is no public data giving scouts’ evaluations as numbers, so this is a model value.',
  },

  // ---------------------------------------------------------------- work and money (general population, men)
  jpWageMale: {
    population: 'Male general workers',
    definition:
      'Wages by age group (the table value is the highest, ages 55–59; the values for all age groups are in after.ts). The definition of “wages” was not checked on this source’s page',
    asOf: '2025',
    verifyNote: CONFIRMED_MEN,
  },
  jpUnemployMale: {
    population: 'The male labour force',
    definition: 'Unemployment rate (annual average)',
    asOf: '2025',
    verifyNote: 'Confirmed in the source (2026-10-17). The source shows it as the value for “men”.',
    note: 'The share of people looking for work at a given time, not the chance of losing a job within a year.',
  },
  jpNeverMarried50Male: {
    population: 'Japanese men (ages 45–54)',
    definition: 'Share never married at age 50 (average of the never-married shares at 45–49 and 50–54; based on values with unknowns imputed)',
    asOf: '2020',
    verifyNote: 'Confirmed in the source (2026-10-17). The source’s table shows it as the value for “men”. Calculated from the census; the source is a secondary compilation.',
    note: 'The 2020 value. The game’s heroes turn 50 in the 2080s or later, and for the share of that era the same value is used as a guide, as an assumption.',
  },
  licenseModel: {
    population: 'People who entered a medical, dental, pharmacy, nursing or education university (students who do not play)',
    definition:
      'The field of study is taken from the university’s name; the course lasts six years (medicine, dentistry, pharmacy) or four. How likely the national exam is to be passed (per try: doctors 90%, dentists 65%, pharmacists 70%, nurses 90%; up to three tries), the first year’s pay in the licensed work ({yen:10000000} doctors, {yen:7000000} dentists, {yen:5500000} pharmacists, {yen:4800000} nurses), and how opening a practice and other events change it. An education university gives a teaching licence at graduation',
    asOf: '-',
    verifyNote:
      'The chances of passing and the pay are game assumptions, not figures confirmed in public statistics. They are not the real pass rates of the national exams or the average incomes of these jobs.',
  },
  careerModel: {
    population: 'People who chose a path other than company work after baseball',
    definition:
      'The starting yearly pay, how events raise or lower it, and how likely success and failure are, for pro gamers, streamers, idols, singers, actors and TV personalities, manga artists, novelists and illustrators, founders, members of the Self-Defense Forces, elected officials, and commentators, coaches, scouts and front-office staff',
    asOf: '-',
    verifyNote:
      'The amounts of pay, how success and popularity grow, and how likely failure is are all game assumptions not confirmed in public statistics. They are not the average incomes of real occupations.',
  },
  kidBallModel: {
    population: 'Sons of a Japanese life who have turned 8',
    definition:
      'Whether a son starts baseball, and how he goes on through junior high, high school, Koshien, the draft, university, company teams, independent leagues and the first team of the pros',
    asOf: '-',
    verifyNote:
      'Each step uses the shares of the same statistics as the player’s own life, applied without his circumstances: an estimate. That his father’s career makes a start a little likelier and lifts his talent slightly is a game assumption; a parent’s record never decides his success.',
  },
  workModel: {
    population: 'People who work',
    definition:
      'Annual income = monthly wage by age × 14 months (an assumption including bonuses) × multipliers for employer, position and whether regular. Severance pay, for a regular employee who worked 3 years or more: years of service × an amount per employer ({yen:250000}–{yen:500000} a year). How likely promotion, changing jobs, unemployment and retirement are is also a model setting',
    asOf: '-',
    verifyNote:
      'The share of bonuses, differences by employer and position, the amount of severance pay, and the chances of promotion, changing jobs and unemployment could not be confirmed in public statistics, so they are assumptions.',
  },
  householdModel: {
    population: 'Ages 18 and over',
    definition:
      'Settings for the share of take-home pay (what remains after taxes and social insurance), living costs (60% of take-home pay plus fixed costs; {yen:300000} a year per child; cut by 15% in years when savings are negative), the spouse’s take-home pay ({yen:900000} a year; {yen:300000} while the youngest child is under 3; until 60), rent and loan repayments, and pensions ({yen:1800000} a year, {yen:700000} for the spouse). He lives in his parents’ home and inherits the house when both parents have died',
    asOf: '-',
    verifyNote: 'Household costs, the spouse’s income and pension amounts could not be confirmed in public statistics, so they are assumptions.',
  },
  usHouseholdModel: {
    population: 'People living in the United States after leaving baseball',
    definition:
      'Public pension from 67 (full amount about {yen:2500000} a year as a guide; 40–100% of the full amount depending on how high his earnings were, plus 50% if he has a spouse); retirement at 65, living on savings for the 2 years until 67. Medical costs {yen:300000} a year from 65, {yen:550000} a year from 80. Income while working and the rest of the household (share of take-home pay, living costs, housing costs) keep the settings for Japan',
    asOf: '-',
    verifyNote:
      'The pension starting age and amounts and the medical costs are assumptions fitted to this game’s model, not checked as figures or statistics of the US system (67 was set as a guide to the full-benefit starting age for later birth years).',
  },
  lifeEventModel: {
    population: 'Life after leaving baseball',
    definition: 'How likely events are, such as meeting someone, marriage, children, caregiving, community activities and illness',
    asOf: '-',
    verifyNote:
      'How likely events are is all assumed. Meeting someone and marriage were adjusted so that the share never married at 50, when played with decisions left to the game, comes close to the statistic (jpNeverMarried50Male, 28.25%). Age at first marriage, number of children, and how likely caregiving, illness and the like are could not be confirmed in public statistics.',
  },

  // ---------------------------------------------------------------- general population (not baseball)
  jpLifeMale: {
    population: 'Japanese men',
    definition: 'Life expectancy at age 0 (average life span). Abridged Life Table for 2025 (Reiwa 7)',
    asOf: '2025',
    verifyNote: CONFIRMED_MEN,
  },
  jpLifeMaleAt10: {
    population: 'Japanese men who lived to 10',
    definition: 'Average age at death = 10 + the life expectancy at 10 of 71.60 years (Abridged Life Table for 2025 (Reiwa 7)). Used to adjust the chances of death',
    asOf: '2025',
    verifyNote: 'The underlying figures were confirmed in the source (2026-10-17). The source’s table shows it as the life expectancy of “men” at age 10.',
    note: 'In this game nobody dies before 8, the age he starts baseball, so it is fitted to the life expectancy at age 10 rather than at birth.',
  },

  // ---------------------------------------------------------------- United States
  usLifeMale: {
    population: 'US men',
    definition: 'Life expectancy at birth. NCHS final figure for 2024',
    asOf: '2024',
    verifyNote: 'Confirmed in the source (2026-10-19). The source’s table shows it as the value for “males” (75.8 years in 2023).',
  },
  usLifeMaleAt10: {
    population: 'US men who lived to 10',
    definition:
      'Average age at death. An assumption adding to the life expectancy at birth of 76.5 years the difference between birth and age 10 in Japan’s values (81.60 − 81.35 = 0.25 years). Used to adjust the chances of death',
    asOf: '2024',
    verifyNote: 'US life expectancy at age 10 was not obtained. The life expectancy at birth (76.5 years) is confirmed, and the correction to age 10 is an assumption borrowing Japan’s values.',
  },
  usDraftRounds: {
    population: 'The MLB Rule 4 draft',
    definition: 'Number of draft rounds under the 2022–26 collective bargaining agreement',
    asOf: '2026',
    verifyNote: 'Confirmed from a summary of the source (MLB’s official glossary) (2026-10-19). A value of the rules, not a statistic of numbers of people.',
    note: 'The change of eligibility proposed from 2028 (age 20 or older, two years after high school graduation) is a proposal, not current.',
  },
  usArbitrationYears: {
    population: 'MLB players',
    definition: 'Service time to become eligible for salary arbitration (with the Super Two exception)',
    asOf: '2026',
    verifyNote: 'Confirmed from a summary of the source (MLB’s official glossary) (2026-10-19). A value of the rules.',
  },
  usFreeAgencyYears: {
    population: 'MLB players',
    definition: 'Service time to become eligible for free agency (172 days make 1 year)',
    asOf: '2026',
    verifyNote: 'Confirmed from a summary of the source (MLB’s official glossary) (2026-10-19). A value of the rules.',
  },
  usMid: {
    population: 'Boys who play youth baseball',
    definition: 'Share who keep playing baseball at middle school age',
    asOf: '-',
    verifyNote: NO_DATA + ' The number of youth baseball players in the US and their retention could not be confirmed.',
  },
  usHs: {
    population: 'Boys who kept playing baseball at middle school age',
    definition: 'Share who join a high school (4-year) baseball team',
    asOf: '-',
    verifyNote: NO_DATA + ' The baseball population of US high schools and the share who join could not be confirmed.',
  },
  usHsStay: {
    population: 'High school baseball team members',
    definition: 'Share who stay one year on the high school team (the fourth root of an assumed share of about 60% staying all 4 years)',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usHsDraft: {
    population: 'Players who kept playing to the final year of high school',
    definition: 'Share drafted in the MLB draft',
    asOf: '-',
    verifyNote: NO_DATA + ' No statistic linking the number of high school players drafted to the number of players in their final year on a team could be confirmed.',
  },
  usHsSign: {
    population: 'High school players drafted',
    definition: 'Share who choose a pro contract rather than going to college (how the answer is decided when decisions are left to the game)',
    asOf: '-',
    verifyNote: NO_DATA + ' The share of drafted high school players who signed could not be confirmed.',
  },
  usHsCollege: {
    population: 'Players who kept playing to the final year of high school and were not drafted',
    definition: 'Share who keep playing on a college or junior college team',
    asOf: '-',
    verifyNote: NO_DATA + ' NCAA’s page on the shares going on could not be opened (§6.4).',
  },
  usCollegeStay: {
    population: 'College and junior college baseball team members',
    definition: 'Share who stay one year on the team',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usCollegeDraft: {
    population: 'College and junior college players eligible for the draft',
    definition: 'Share drafted in the MLB draft per year (at 4-year colleges after finishing the third year or from age 21, at junior colleges at any time)',
    asOf: '-',
    verifyNote: NO_DATA + ' The number of eligible players could not be confirmed. Differences by division (NCAA Divisions I–III, junior colleges) are separated as settings.',
  },
  usCollegeSign: {
    population: 'College and junior college players drafted',
    definition: 'Share who choose to sign (how the answer is decided when decisions are left to the game)',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usJucoTransfer: {
    population: 'Players who finished 2 years at a junior college and were not drafted',
    definition: 'Share who transfer to a 4-year college and keep playing',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usMinorUp: {
    population: 'Minor league players',
    definition: 'Share who move up one level per year (the differences between levels are settings)',
    asOf: '-',
    verifyNote: NO_DATA + ' Promotion rates by minor league level could not be confirmed.',
  },
  usMinorExit: {
    population: 'Minor league players',
    definition: 'Share whose contract ends and who leave baseball, per year',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usMlbDebut: {
    population: 'Minor league players at Double-A and Triple-A',
    definition: 'Share who play in MLB for the first time, per year (differing by level)',
    asOf: '-',
    verifyNote: NO_DATA + ' The rates of reaching MLB by round (1st round 73%, 2nd 51%, 3rd 40%, an analysis article) are secondary information, used here as a guide.',
  },
  usMlbExit: {
    population: 'MLB players',
    definition: 'Share who leave MLB per year (from position players’ average career of 5.6 years [secondary])',
    asOf: '-',
    verifyNote: NO_DATA + ' The average career of 5.6 years is from a study of position players who began in 1902–1993 (secondary), not a current value.',
  },
  usModel: {
    population: 'Lives born in the United States',
    definition:
      'Settings for the shares of college divisions (NCAA Divisions I–III, junior colleges) and the differences by ability, the distribution of draft position and signing bonus (20 rounds), minor league levels and salaries, and MLB salaries (minimum salary, arbitration, FA). School names in D2, D3 and junior colleges are generic',
    asOf: '-',
    verifyNote:
      'The shares by division, the distribution of draft position, minor league levels and salaries, and the shape of MLB salaries could not be confirmed in official statistics, so they are all assumptions. The only confirmed facts are the number of draft rounds and eligibility, the service time rules and the life expectancy.',
  },

  // ---------------------------------------------------------------- Korea and Cuba: estimates, none checked against a source
  krLifeMale: {
    population: 'South Korean men',
    definition: 'Approximate life expectancy at birth (a game estimate)',
    asOf: '-',
    verifyNote: 'Not checked in official statistics. A game estimate fitted to the generally known level.',
  },
  krLifeMaleAt10: {
    population: 'South Korean men who lived to 10',
    definition: 'Estimate of the average age at death: the difference between birth and age 10 in Japan’s values (0.25 years) added to the estimate at birth. Used to adjust the chances of death',
    asOf: '-',
    verifyNote: 'An estimate with Japan’s difference borrowed. Not checked as a statistic.',
  },
  cuLifeMale: {
    population: 'Cuban men',
    definition: 'Approximate life expectancy at birth (a game estimate)',
    asOf: '-',
    verifyNote: 'Not checked in official statistics. A game estimate fitted to the generally known level.',
  },
  cuLifeMaleAt10: {
    population: 'Cuban men who lived to 10',
    definition: 'Estimate of the average age at death: the difference between birth and age 10 in Japan’s values (0.25 years) added to the estimate at birth. Used to adjust the chances of death',
    asOf: '-',
    verifyNote: 'An estimate with Japan’s difference borrowed. Not checked as a statistic.',
  },
  krModel: {
    population: 'Lives born in South Korea (beta)',
    definition:
      'Settings for high school and university paths, the draft (the KBO rookie draft), the second-team and first-team levels, salaries, how military service is handled, and the years until FA. Includes the household, pension and medical cost settings',
    asOf: '-',
    verifyNote:
      'The KBO’s first-team games (144), second-team games (120, from 118 in 2025 and 121 in 2026), minimum salary (₩30 million) and years until free agency (8 from high school, 7 from university) were confirmed in published sources and reports (2026-10-23). How salaries grow is a game estimate set near the KBO’s published average salary (₩175.36 million in 2026). The other shares, years and amounts (including signing bonuses and military service) are game estimates not checked in official statistics or primary sources, and are not treated as the real system or real figures.',
  },
  cuModel: {
    population: 'Lives born in Cuba (beta)',
    definition:
      'Settings for selection to sports schools, promotion to the national league (Serie Nacional), income, trying abroad (a contract with an MLB club), and household, pension and medical costs',
    asOf: '-',
    verifyNote:
      'Shares, income and amounts are all game estimates not checked in official statistics or primary sources. The political, economic and institutional situation is an estimated model within the game, and is not asserted as fact.',
  },
}

const JHBF_PUB = 'Japan High School Baseball Federation'
const JHBF_FOUNDATION = 'Japan High School Baseball Federation (public interest incorporated foundation)'
const MEXT = 'Ministry of Education, Culture, Sports, Science and Technology (MEXT)'
const MHLW = 'Ministry of Health, Labour and Welfare'
const JABA = 'Japan Amateur Baseball Association (public interest incorporated foundation)'
const JUBF = 'Japan University Baseball Federation (public interest incorporated foundation)'
const JUKELABO = 'Jukelabo Yobiko (a prep school)'
const NPB_ORG = 'Nippon Professional Baseball (NPB)'
const NOT_OPENED = 'could not be opened. No workaround was attempted. The value is unconfirmed.'
const GIRLS_MANAGERS = 'It does not say whether girls or team managers are included.'

export const SOURCE_EN: Record<string, SourceEn> = {
  jhbf: {
    title: 'Statistics on member schools and club members (hardball)',
    original: '加盟校数・部員数統計（硬式）',
    publisher: JHBF_PUB,
    checkNote: `Confirmed for the end of May 2026: 3,746 member schools, 124,116 members (1st year 43,836, 2nd year 40,714, 3rd year 39,566), retention rate 90.3%. ${GIRLS_MANAGERS}`,
  },
  jhbfPref2026: {
    title: 'Statistics on member schools and club members (hardball), 2026, by prefecture',
    original: '加盟校数・部員数統計（硬式）2026年・都道府県別',
    publisher: JHBF_PUB,
    checkNote: `Confirmed the number of member schools by prefecture as of the end of May 2026 (47 prefectures; 3,746 schools in total) and the number of members. No list of school names is given. ${GIRLS_MANAGERS}`,
  },
  mextSchoolCode: {
    title: 'School codes (as of May 1, 2026 (Reiwa 8), provisional version; updated 2026/5/20)',
    original: '学校コード（令和8年5月1日時点・暫定版。更新日 2026/5/20）',
    publisher: MEXT,
    checkNote:
      'Obtained as CSV the name, type of school, prefecture, type of establishment (national, public, private), main or branch school and address of the schools nationwide (high schools 5,127, universities 840, junior colleges 329, colleges of technology 58). Information by sex, departments, whether there is a baseball club and deviation scores are not included. The page states no terms of use.',
  },
  keinetRanking2027: {
    title: 'Table of predicted entrance exam difficulty, 2027 entrance exams (rank by faculty and department / by university)',
    original: '入試難易予想一覧表 2027年度入試（学部学科ランク／大学別）',
    publisher: 'Kawaijuku Kei-Net',
    checkNote:
      'From 14 PDFs (national/public and private × 7 regions), the deviation score of each department was obtained (by the deviation scores of Kawaijuku’s Zento mock exams, the border line at a 50% chance of passing; a prediction for the 2027 entrance exams as of October 2026). There are floor values (“37.4 or below is treated as 35.0 for convenience”) and border-free departments (no value). Some universities, such as the University of Tokyo and Kyoto University, are not listed. Terms of use could not be confirmed (© Kawaijuku Educational Information Network). Used as published values with the user’s permission (2026-10-18).',
  },
  jukelabo2026: {
    title: 'High school deviation score information (school year 2026 (Reiwa 8), pages for the 47 prefectures)',
    original: '高校偏差値情報（令和8年度・2026年度、47都道府県のページ）',
    publisher: JUKELABO,
    checkNote:
      'Obtained the deviation scores of full-time high schools by prefecture and by public / private and national (4,556 schools, 9,447 rows). There are rows for each course, and the mock exam they come from is not stated. robots.txt allows fetching the pages, and no terms of use forbidding reuse were found on the site (only a copyright notice and a privacy policy). Fetched at 1.2-second intervals. The representative value of each school is the median of the general course (if none, the median of all courses).',
  },
  jukelabo2026univ: {
    title: 'List of university deviation scores (14 pages by field of study)',
    original: '大学偏差値一覧（学部系統別14ページ）',
    publisher: JUKELABO,
    checkNote:
      'Deviation scores by faculty and exam schedule of national/public and private universities. The mock exam and year they come from are not stated. Used only for universities with no value at Kawaijuku Kei-Net; the representative value of each university is the median of its rows. Not mixed with Kawaijuku’s values for the same university.',
  },
  jhbfTop: {
    title: 'Japan High School Baseball Federation official site (tournament information)',
    original: '日本高等学校野球連盟 公式サイト（大会の案内）',
    publisher: JHBF_PUB,
    checkNote:
      'Confirmed the tournament names “National High School Baseball Invitational Tournament” (99th), “National High School Baseball Championship” (108th) and “Autumn regional tournaments” (Reiwa 8). The edition numbers are not used in the game (since he enters high school in 2041 or later).',
  },
  daily2026: {
    title: 'Participating teams down 33 to 3,363: the regional tournaments of summer high school baseball (June 28, 2026)',
    original: '参加チーム33減の3363 夏の高校野球地方大会（2026年6月28日）',
    publisher: 'Daily Sports',
    checkNote: 'Confirmed 3,363 teams (including 157 combined teams), the most in Aichi with 174 and the fewest in Tottori with 21.',
  },
  npbJhs: {
    title: 'National junior high school student questionnaire 2025: a nationwide survey of players in Chutairen rubber-ball baseball clubs (April 17, 2026)',
    original: '全国中学生アンケート2025 ～中体連軟式野球部所属選手への全国調査～（2026年4月17日）',
    publisher: 'NPB',
    checkNote:
      'Confirmed the number of Chutairen rubber-ball baseball players in 2025, 139,240 (quoting the survey of the Japan junior high school sports federation). No breakdown by sex or grade is given.',
  },
  hbnDraft: {
    title: 'This year university players are about half of all picks! [2025 draft] (October 23, 2025)',
    original: '今年は大学生指名が全体の約半分！【25年ドラフト】（2025年10月23日）',
    publisher: 'hb-nippon',
    checkNote:
      'Confirmed 116 picks (73 main roster, 43 development): high school 33 (main roster 19), university 54 (40), company teams 13 (12), independent 13 (1), other 3 (1).',
  },
  numberShibou: {
    title: 'An inside story of Kindai University’s draft (October 30, 2025)',
    original: '近畿大ドラフト密着秘話（2025年10月30日、沢井史）',
    publisher: 'Number',
    checkNote: 'Confirmed the declarations for the pro draft in 2025: 124 high school players and 176 university players (as stated in the article).',
  },
  numberIkusei: {
    title: 'Pro baseball’s problem of “actually keeping development players idle” (August 6, 2023)',
    original: 'プロ野球“じつは育成選手を飼い殺している”問題（2023年8月6日、田尻耕太郎）',
    publisher: 'Number',
    checkNote:
      'Confirmed that in 2023 (up to the time of the article) 32 players of the 12 clubs moved from development to the main roster. The total number of development players of the 12 clubs is not given.',
  },
  npbCareer: {
    title: 'Results of the survey of the paths of players released or retired in 2024',
    original: '2024年戦力外／現役引退選手の進路調査結果',
    publisher: 'NPB',
    checkNote:
      'Confirmed for 2024: 157 players (excluding foreign players and development players re-signed by the same club), average age 26.3, average tenure 6.3 years, and the breakdown of paths.',
  },
  npbCareer2025: {
    title: 'Results of the survey of the paths of players released or retired in 2025',
    original: '2025年戦力外／現役引退選手の進路調査結果',
    publisher: 'NPB',
    checkNote:
      'Confirmed for 2025: 169 players, average age 27.2 (as of October 31, 2025), tenure 6.8 years, paths: NPB-related 90, other baseball 54, outside baseball 17, undecided 8.',
  },
  npbCareerTrend: {
    title: 'Results of the survey of the paths of released / retired players [reference] past trend (2021–2025)',
    original: '戦力外／現役引退選手の進路調査結果【参考】過去推移（2021～2025年）',
    publisher: 'NPB',
    checkNote: 'Confirmed for 2021–2025 the number of players (143, 145, 153, 157, 169), average age, average tenure, and the total numbers by type of path.',
  },
  npbTeams: {
    title: 'The 12 clubs (Central League, Pacific League)',
    original: '12球団（セントラル・リーグ、パシフィック・リーグ）',
    publisher: 'NPB',
    checkNote: 'Confirmed the names of the 6 Central League clubs and the 6 Pacific League clubs (the 2026 page).',
  },
  iblj: {
    title: 'Shikoku Island League Plus official site',
    original: '四国アイランドリーグplus 公式サイト',
    publisher: 'Shikoku Island League Plus',
    checkNote:
      'Confirmed the league name and its 4 clubs (Tokushima Indigo Socks, Kagawa Olive Guyners, Ehime Mandarin Pirates, Kochi Fighting Dogs). There is a notice dated October 16, 2026.',
  },
  bcl: {
    title: 'Route Inn BC League official site (team information)',
    original: 'ルートインBCリーグ 公式サイト（チーム情報）',
    publisher: 'Route Inn BC League',
    checkNote:
      'On the “team information” page, confirmed the official names of the 9 clubs of 2026 (Fukushima Red Hopes, Ibaraki Astro Planets, Chiba Sky Sailors, Tochigi Golden Braves, Saitama Musashi Heat Bears, Kanagawa Future Dreams, Gunma Diamond Pegasus, Yamanashi Fire Winds, Shinano Grandserows). The Tokyo club is an associate member, so it is not used.',
  },
  nlb: {
    title: 'Japan Sea League official site (team information)',
    original: '日本海リーグ 公式サイト（チーム情報）',
    publisher: 'Japan Sea League',
    checkNote:
      'Confirmed 3 clubs in the team information: Ishikawa Million Stars, Toyama GRN Thunderbirds and SHIGA HIJUMPS (the news mentions the approval of full membership for Kanazawa Dragon Cross and Gifu Technoa Diamond Rivers, but they are not in the team information, so they are not used).',
  },
  jabaRenmeiho2026: {
    title:
      'Japan Amateur Baseball Association bulletin 2026 (issued June 2026; the changes, and the list of teams entered in the 2026 tournaments hosted by each JABA regional federation)',
    original: '日本野球連盟連盟報2026（2026年6月発行。変更事項と、2026年度JABA各地区連盟主催大会の出場チーム一覧）',
    publisher: JABA,
    checkNote:
      'Confirmed the changes of member teams in 2025 (new members, resumed activity, suspended activity, dissolution and withdrawal, name changes; with type, local member body and regional federation) and the names of the teams (by region) entering the 2026 tournaments hosted by the regional federations. No roster of all member teams is given (the number of member teams is given by prefecture).',
  },
  jabaSenshuken2026: {
    title: 'The 51st Japan Championship of company baseball: list of participating teams (as of 2026.10.9)',
    original: '第51回社会人野球日本選手権大会 出場チーム一覧（2026.10.9現在）',
    publisher: JABA,
    checkNote: 'Confirmed the names of the teams in the Japan Championship (by qualifying region, with their number of appearances). Regional federations are not listed.',
  },
  jubfLeagues: {
    title: 'Member leagues of the Japan University Baseball Federation (the “member universities” field of each league’s page; 27 leagues)',
    original: '全日本大学野球連盟 加盟連盟（各連盟のページの「加盟大学」欄。27連盟）',
    publisher: JUBF,
    checkNote:
      'Confirmed for all 27 leagues the name, the URL of the official site, the number of member schools and the names of member universities, on the leagues’ official pages (league_info.php?leagueid=01–27). 370 member universities in total (including units at the level of faculties, campuses, colleges of technology and junior colleges). Divisions (1st, 2nd) are not distinguished.',
  },
  jubfChampions: {
    title: 'All Japan University Baseball Championship: list of champions and runners-up (2005–2026)',
    original: '全日本大学野球選手権大会 優勝校・準優勝校一覧（2005〜2026年）',
    publisher: JUBF,
    checkNote: 'Confirmed the champions and runners-up from 2005 to 2026 (2020 was cancelled).',
  },
  jhbfSummerOuting: {
    title: 'National High School Baseball Championship: lists of participating schools (86th–106th) and pages of the representative schools (107th, 108th)',
    original: '全国高等学校野球選手権大会 出場校一覧（第86回〜第106回）と代表校のページ（第107・108回）',
    publisher: JHBF_FOUNDATION,
    checkNote:
      'Confirmed the representative schools of the summer tournament 2004–2026 (by regional tournament; school names in their common short form) and the total number of appearances as of 2026. 2020 was cancelled.',
  },
  jhbfSpringOuting: {
    title: 'National High School Baseball Invitational Tournament: lists of participating schools (76th–97th) and pages of the representative schools (98th)',
    original: '選抜高等学校野球大会 出場校一覧（第76回〜第97回）と代表校のページ（第98回）',
    publisher: JHBF_FOUNDATION,
    checkNote:
      'Confirmed the participating schools of the spring tournament 2004–2026 (by prefecture; common short names) and the total number of appearances as of 2026. 2020 is left out as it was cancelled.',
  },
  npbStandings: {
    title: 'NPB club standings (final standings of the Central and Pacific Leagues, 2023–2025)',
    original: 'NPB 球団の勝敗表（セ・パ両リーグ 2023〜2025年の最終順位）',
    publisher: NPB_ORG,
    checkNote: 'Confirmed the wins, losses, ties and winning percentages in the final standings (12 clubs) of 2023, 2024 and 2025.',
  },
  wikiNcaaD1Baseball: {
    title: 'List of NCAA Division I baseball programs (Wikipedia; college names, states, conferences)',
    publisher: 'Wikipedia (secondary source; not checked against NCAA’s official pages)',
    checkNote:
      'Transcribed the table of NCAA Division I baseball teams of 2026 (college name, state, conference). NCAA Divisions II and III, NAIA and junior colleges (NJCAA) are not included.',
  },
  npbDraft: {
    title: 'Results of the professional baseball draft meetings (2021–2025, by club; main roster and development)',
    original: 'プロ野球ドラフト会議の指名結果（2021〜2025年、球団ごと。支配下・育成）',
    publisher: NPB_ORG,
    checkNote:
      'Confirmed on the 12 clubs’ pages where the 615 players drafted in 2021–2025 came from (school, company, independent league club). Players’ names were not recorded.',
  },
  wikiHsResults: {
    title:
      'National High School Baseball Championship (teams of ○○ prefecture) and National High School Baseball Championship ○○ tournament (Wikipedia; wins and losses at summer Koshien, and champions and runners-up of the prefectural tournaments)',
    original: '全国高等学校野球選手権大会 (○○県勢) と 全国高等学校野球選手権○○大会（Wikipedia。夏の甲子園での勝敗と、都道府県大会の優勝・準優勝）',
    publisher: 'Wikipedia (secondary source; not checked game by game against the Japan High School Baseball Federation’s records)',
    checkNote:
      'From the prefecture pages of the 47 prefectures, obtained the wins and losses at summer Koshien 2004–2026, and from the page of each regional tournament, the champions and runners-up 2011–2025. The 606 champions matched the Japan High School Baseball Federation’s list of representative schools 100%. The regional tournaments of Miyazaki, Hyogo and Yamaguchi could be read only in part. The spring and autumn prefectural tournaments could not be obtained.',
  },
  wikiJubfLeagues: {
    title: 'Japan University Baseball Federation (Wikipedia; list of member leagues and their number of member schools)',
    original: '全日本大学野球連盟（Wikipedia。加盟連盟の一覧と加盟校数）',
    publisher: 'Wikipedia (secondary source; not checked against the federation’s official site)',
    checkNote:
      'Confirmed the names and numbers of member schools of the 27 member leagues (Hokkaido 2, Tohoku 3, Kanto-Koshinetsu 7, Hokuriku-Tokai 3, Kansai 5, Chugoku-Shikoku 3, Kyushu 4). The names of each league’s member universities are not given.',
  },
  wikiUnivLeagueMembers: {
    title:
      'Tokyo Big6 Baseball League, Tohto University Baseball League, Kansai Student Baseball League, Shuto Base Ball League, Kansai Big Six Baseball League (Wikipedia; member universities)',
    original: '東京六大学野球連盟・東都大学野球連盟・関西学生野球連盟・首都大学野球連盟・関西六大学野球連盟（Wikipedia。加盟大学）',
    publisher: 'Wikipedia (secondary source; not checked against the leagues’ official sites)',
    checkNote:
      'Confirmed the university names: Tokyo Big6 6 schools, Tohto divisions 1–4 22 schools (as of the start of the 2026 spring league), Kansai Student 6 schools, Shuto divisions 1 and 2 16 schools (as of the end of the 2025 autumn league), Kansai Big Six 6 schools. The member university names of the other 21 leagues were not confirmed.',
  },
  jpbpaGuide2022: {
    title: 'To players aiming to become professional baseball players, and their families (2022 edition)',
    original: 'プロ野球選手を目指す選手・ご家族の皆さんへ（2022年版）',
    publisher: 'Japan Professional Baseball Players Association',
    checkNote:
      'In the table “Contents of the player contract” on p.5, confirmed the minimum salary of {yen~:4200000} (before tax) for main-roster players and {yen~:2300000} (before tax) for development players, and the additional participation remuneration of main-roster players, “(¥16 million − salary) / 150 × days registered on the first team” (none for development players). The material is the 2022 edition, and the amounts and rules for 2025 and 2026 have not been confirmed (the text of the Baseball Agreement itself is not public and is unconfirmed). On the owner’s instruction, the game uses this table’s main-roster minimum salary of {yen~:4200000} and the additional participation remuneration as the standard for 2025. The development minimum salary in the game is {yen~:2400000}, which does not match this table’s {yen~:2300000} (before tax). The basis for {yen~:2400000} is unconfirmed, and the value is kept on the owner’s instruction.',
  },
  salary2026: {
    title: 'The average salary of pro baseball players in 2026 is ¥52.16 million (May 18, 2026)',
    original: '2026年のプロ野球選手平均年俸は5216万円（2026年5月18日）',
    publisher: 'nippon.com (survey by the Japan Professional Baseball Players Association)',
    checkNote: 'Confirmed 713 Japanese players officially announced on main rosters, average {yen~:52160000}, median {yen~:20000000}.',
  },
  mextHealth2024: {
    title: 'School Health Statistics for fiscal 2024 (Reiwa 6) (results of the School Health Statistics Survey), final figures (published February 12, 2025)',
    original: '令和6年度学校保健統計（学校保健統計調査の結果）確定値（2025年2月12日公表）',
    publisher: MEXT,
    checkNote:
      'Confirmed the average height and weight of boys by age (5–17, age in full years as of April 1) (e.g. at 17: 170.8 cm, 62.2 kg). A sample survey (for growth status, 5.2% of all infants, children and students).',
  },
  mhlwWage2025: {
    title: 'Overview of the 2025 (Reiwa 7) Basic Survey on Wage Structure, “Wages by sex”, Table 2',
    original: '令和7(2025)年賃金構造基本統計調査の概況「性別にみた賃金」第2表',
    publisher: MHLW,
    checkNote:
      'Confirmed men’s wages by age group (thousand yen): up to 19 212.5, 20–24 245.7, 25–29 288.0, 30–34 330.4, 35–39 366.2, 40–44 398.2, 45–49 420.7, 50–54 437.5, 55–59 445.6, 60–64 358.5, 65–69 304.3. The definition of “wages” (scheduled cash earnings or the like) is not written on this page, so it is unconfirmed.',
  },
  ipssPop2024T0623: {
    title: 'Population Statistics (2024), Table 6-23: Proportions never married, married, widowed and divorced at age 50, by sex: 1920–2020',
    original: '人口統計資料集（2024）表6-23 性別50歳時の未婚割合，有配偶割合，死別割合および離別割合：1920～2020年',
    publisher: 'National Institute of Population and Social Security Research',
    checkNote:
      'Confirmed the table’s 2020 value for “men, never married”, 28.25% (20.14% in 2010, 24.77% in 2015). Note to the table: calculated from the Statistics Bureau, Ministry of Internal Affairs and Communications, “Population Census Report”. The average of the proportions at 45–49 and 50–54. 2015 and 2020 are based on values with unknowns imputed.',
  },
  statLabor2025: {
    title: 'Labour Force Survey (Basic Tabulation), 2025 (Reiwa 7) average results: summary',
    original: '労働力調査（基本集計）2025年（令和7年）平均結果の要約',
    publisher: 'Statistics Bureau, Ministry of Internal Affairs and Communications',
    checkNote: 'Confirmed the 2025 average unemployment rate of 2.5%, 2.7% for men.',
  },
  mhlwLife2025: {
    title: 'Overview of the Abridged Life Table for 2025 (Reiwa 7), “Life expectancy at main ages”',
    original: '令和7(2025)年簡易生命表の概況「主な年齢の平均余命」',
    publisher: MHLW,
    checkNote: 'Confirmed men’s life expectancy at birth of 81.35 years (81.09 the year before) and men’s life expectancy at age 10 of 71.60 years.',
  },
  ncaa: {
    title: 'Baseball: Probability of competing beyond high school',
    publisher: 'NCAA',
    checkNote: '2026-10-17: this URL redirected to NCAA’s home page, and the page could not be opened. The value is unconfirmed.',
  },
  baDraftRounds: {
    title: 'How Many MLB Draftees Make It To The Majors (May 17, 2019, J.J. Cooper)',
    publisher: 'Baseball America',
    checkNote: 'Confirmed the rates of reaching the majors of drafted players who signed in 1981–2010: 1st round 73%, 2nd 51%, 3rd 40%. No values are given for the 4th round and later.',
  },
  bpDraftRounds: {
    title: 'The Baseball Draft: A 50-Year Retrospective, Part Two (June 9, 2014, Allan Simpson)',
    publisher: 'Baseball Prospectus',
    checkNote: 'Confirmed 1st round 69.0% (1965–2009, 827 of 1,198 players), 2nd 46.5%, 3rd 37.8%, 4th 31.3%. The years covered for the 2nd round and later are not stated.',
  },
  witnauer: {
    title: 'Witnauer et al. 2007 (the average career of MLB position players)',
    publisher: 'University of Colorado',
    checkNote: 'Confirmed an average of 5.6 years for 5,989 position players who began their careers in 1902–1993, and that 1 in 5 played only 1 year.',
  },
  mlbRoster2025: {
    title: 'Internationally born players on 2025 Opening Day rosters',
    publisher: 'MLB',
    checkNote: `2026-10-17: the server returned HTTP 406, and the page ${NOT_OPENED}`,
  },
  bloombergIntl: {
    title: 'Dominican Republic seeks fair play for young ballplayers eyeing MLB (October 18, 2022)',
    publisher: 'Bloomberg Línea',
    checkNote:
      'Confirmed that of 2,294 Dominican players signed in 2012–16, 110 joined an MLB club. The 1,011 international signings of 2024–25 and the statement “3–5%” are not in this article.',
  },
  kbo2026: {
    title: 'Press report on the KBO 2026 draft',
    publisher: 'Kookmin Ilbo (kukinews)',
    checkNote: `2026-10-17: the server returned HTTP 403, and the page ${NOT_OPENED}`,
  },
  cpbl2025: {
    title: 'CPBL: 180 players rush for the narrow gate of six teams! (June 20, 2025)',
    original: '中職／180人搶進六隊窄門！（2025年6月20日）',
    publisher: 'TVBS',
    checkNote: 'Confirmed 180 entrants to the 2025 draft, of whom 72 were high school students graduating that year.',
  },
  elbowStudy: {
    title:
      'Mikio Harada et al., “Elbow screening using ultrasound for youth baseball players”, Clinical Orthopaedic Surgery (Rinsho Seikei Geka) vol. 42 no. 6, pp. 555–560 (June 2007)',
    original: '原田幹生ほか「少年野球選手に対する超音波を用いた肘検診」臨床整形外科 42巻6号 pp.555-560（2007年6月）',
    publisher: 'Igaku-Shoin (Department of Orthopaedic Surgery, Yamagata University Faculty of Medicine, and others)',
    checkNote:
      'Confirmed in the abstract that among 247 players of elementary school baseball teams, an avulsion of the medial epicondyle of the humerus was found by ultrasound in 48. The abstract does not state the subjects’ region or sex. The earlier source (a PDF on Shinshu University’s site) was a different study from the University of Tsukuba, and this value was not in it.',
  },
  fangraphsTJ: {
    title: 'Ten interesting facts about Tommy John surgery (April 18, 2018, Jon Roegele)',
    publisher: 'FanGraphs (The Hardball Times)',
    checkNote: 'Confirmed that 26% of the MLB pitchers who pitched in 2017 had had the surgery.',
  },
  nchsDb548: {
    title: 'Mortality in the United States, 2024 (NCHS Data Brief No. 548, January 2026)',
    publisher: 'CDC / National Center for Health Statistics (NCHS)',
    checkNote:
      '2026-10-19: confirmed in the text of the page, as final figures for 2024, the life expectancy at birth of 76.5 years for males (75.8 years in 2023), 81.4 years for females and 79.0 years for both sexes. The life expectancy at age 10 was not obtained.',
  },
  mlbRule4: {
    title: 'Rule 4 Draft (MLB’s official glossary) and an overview of the 2026 MLB Draft',
    publisher: 'MLB',
    checkNote:
      '2026-10-19: confirmed from a summary in search results (the full text of the page was not obtained). Under the 2022–26 collective bargaining agreement the draft has 20 rounds. Eligible are players who graduated from high school and have not gone to college, and players who have been at a junior college for one year or more (all junior college students are eligible). At 4-year colleges, after finishing the third year or on turning 21. Residents of the United States or Canada. The change of eligibility from 2028 (age 20 or older, two years after high school graduation) is an MLB proposal, not current.',
  },
  mlbServiceTime: {
    title: 'Service Time, Free Agency, Salary Arbitration (MLB’s official glossary)',
    publisher: 'MLB',
    checkNote:
      '2026-10-19: confirmed from a summary in search results (the full text was not obtained). A season is 187 days; a day on the active roster or the injured list counts as one day; 172 days make one year of service time. Free agency at 6 years, salary arbitration at 3 years (among players with 2–3 years, the top 22% with 86 days or more in the previous year are Super Twos and eligible for arbitration; the threshold changes every year).',
  },
}

/** the units of the statistics (data/stats.ts `unit`), as the parameters table writes them after the value */
export const UNIT_EN: Record<string, string> = {
  人: 'people',
  校: 'schools',
  割合: 'share',
  チーム: 'teams',
  歳: 'years of age',
  年: 'years',
  万円: '× ¥10,000',
  年あたり: 'per year',
  対数の標準偏差: 'standard deviation of the log',
  年あたりの自己相関: 'autocorrelation per year',
  標準偏差: 'standard deviations',
  cm: 'cm',
  kg: 'kg',
  '点／標準偏差': 'points per standard deviation',
  'km/h': 'km/h',
  '-': '-',
  点: 'points',
  '千円（月額）': '× ¥1,000 (monthly)',
  か月分: 'months’ worth',
  巡: 'rounds',
}

/** the names of the independent leagues (data/orgs.ts), the regional federations of company baseball (data/teams.ts JabaRegion) and the
 * major universities the statistics page lists, as the statistics page writes them */
export const NAME_EN: Record<string, string> = {
  四国アイランドリーグplus: 'Shikoku Island League Plus',
  ルートインBCリーグ: 'Route Inn BC League',
  日本海リーグ: 'Japan Sea League',
  北海道: 'Hokkaido',
  東北: 'Tohoku',
  北信越: 'Hokushinetsu',
  関東: 'Kanto',
  東海: 'Tokai',
  近畿: 'Kinki',
  中国: 'Chugoku',
  四国: 'Shikoku',
  九州: 'Kyushu',
  東京大学: 'The University of Tokyo',
  京都大学: 'Kyoto University',
  大阪大学: 'Osaka University',
  東北大学: 'Tohoku University',
  名古屋大学: 'Nagoya University',
  九州大学: 'Kyushu University',
  北海道大学: 'Hokkaido University',
  一橋大学: 'Hitotsubashi University',
  東京科学大学: 'Institute of Science Tokyo',
  早稲田大学: 'Waseda University',
  慶應義塾大学: 'Keio University',
  上智大学: 'Sophia University',
  明治大学: 'Meiji University',
  青山学院大学: 'Aoyama Gakuin University',
  立教大学: 'Rikkyo University',
  中央大学: 'Chuo University',
  法政大学: 'Hosei University',
  関西大学: 'Kansai University',
  関西学院大学: 'Kwansei Gakuin University',
  同志社大学: 'Doshisha University',
  立命館大学: 'Ritsumeikan University',
}

/** what a source's deviation scores are (data/schools/deviation*.json `exam`), by source id */
export const EXAM_EN: Record<string, string> = {
  keinetRanking2027: 'border deviation score of Kawaijuku’s Zento mock exams (the line at a 50% chance of passing; a prediction as of October 2026)',
  jukelabo2026univ: 'university deviation scores published by Jukelabo Yobiko (the mock exam they come from is not stated)',
  jukelabo2026: 'high school deviation scores published by Jukelabo Yobiko (the mock exam they come from is not stated)',
}

/** the words of the statistics and their sources in one language other than Japanese (another language adds its own set here) */
export interface StatsWords {
  stat: Record<string, StatEn>
  source: Record<string, SourceEn>
  unit: Record<string, string>
  name: Record<string, string>
  exam: Record<string, string>
}

const WORDS: Partial<Record<Lang, StatsWords>> = {
  en: { stat: STAT_EN, source: SOURCE_EN, unit: UNIT_EN, name: NAME_EN, exam: EXAM_EN },
}

/** a language's words of the statistics, once fetched (packs.ts: Korean statsKo.ts, Traditional Chinese statsZhTW.ts) */
export function addStatsWords(l: Lang, w: StatsWords) {
  WORDS[l] = w
}

/** the words of the statistics in a language (the language now by default); undefined in Japanese, whose words are the data's own */
export const statsWords = (l: Lang = lang()): StatsWords | undefined => WORDS[l]

export interface StatText {
  population: string
  definition: string
  asOf: string
  verifyNote?: string
  note?: string
  unit: string
}

/** a statistic's words in the language now (in Japanese: the data as they are) */
export function statText(s: Stat): StatText {
  const w = statsWords()
  const e = w?.stat[s.id]
  if (!w || !e) return { population: s.population, definition: s.definition, asOf: s.asOf, verifyNote: s.verifyNote, note: s.note, unit: s.unit }
  // (amounts written {yen:N} / {yen~:N}: in the language's currency, currency.ts)
  const m = <T extends string | undefined>(x: T): T => (x === undefined ? x : (moneyTokens(x, lang()) as T))
  return { population: m(e.population), definition: m(e.definition), asOf: e.asOf, verifyNote: m(e.verifyNote), note: m(e.note), unit: w.unit[s.unit] ?? s.unit }
}

/** the time of a statistic, short (the panel 「この人生に出てきた統計」: its first 7 characters in Japanese; the year or years in English) */
export function statAsOfShort(s: Stat): string {
  const e = statsWords()?.stat[s.id]
  if (!e) return s.asOf.slice(0, 7)
  const asOf = e.asOf
  return /\d{4}(?:–\d{4})?/.exec(asOf)?.[0] ?? asOf.slice(0, 7)
}

export interface SourceText {
  title: string
  publisher: string
  checkNote?: string
}

/** a source's words in the language now (in Japanese: the data as they are; in English its original title follows in parentheses) */
export function sourceText(src: Source): SourceText {
  const e = statsWords()?.source[src.id]
  if (!e) return { title: src.title, publisher: src.publisher, checkNote: src.checkNote }
  // (the original title beside the translated one, unless they are the same: a Taiwanese source in Chinese)
  return { title: e.original && e.original !== e.title ? `${e.title} (${e.original})` : e.title, publisher: e.publisher, checkNote: e.checkNote === undefined ? undefined : moneyTokens(e.checkNote, lang()) }
}

/** a name the statistics page shows (a league, a regional federation, a university) in the language now */
export const nameText = (name: string): string => statsWords()?.name[name] ?? name

/** what a source's deviation scores are, in the language now (in Japanese: the data's `exam`) */
export const examText = (sourceId: string, ja: string): string => statsWords()?.exam[sourceId] ?? ja
