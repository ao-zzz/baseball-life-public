import type { StatsWords } from './statsEn.ts'

// The statistics and their sources in Traditional Chinese for Taiwan (zh-TW), by the same ids as statsEn.ts. Translated from the
// Japanese data (data/stats.ts, data/sources.ts) with the English as reference. A source's `original` is its own title, unchanged.
// Drafted with AI.

const JHBF = '日本高等學校棒球聯盟'
const JPBPA = '日本職棒選手會'

/** a value confirmed in the source whose source has no breakdown by sex (data/stats.ts `ref`) */
const ref = (target: string, extra = '') =>
  `統計對象：${target}。數值與定義已在出處確認（2026-10-17）。出處未按性別區分，因此不斷定為僅限男性的數值，而是作為男性生涯模型的參考值使用。${extra}`
/** the same, for a value computed from such figures (data/stats.ts `refDerived`) */
const refDerived = (target: string, extra = '') =>
  `統計對象：${target}。原始數值已在出處確認（2026-10-17）。原始統計未按性別區分，因此不斷定為僅限男性的數值，而是作為男性生涯模型的參考值使用。${extra}`
const NO_DATA = '沒有資料依據的模型設定。'
const MANAGERS = '出處也未說明是否包含球隊經理。'
const TEAMS_NO_SEX = '此為隊伍數，未區分性別。'
const CONFIRMED_MEN = '已在出處確認（2026-10-17）。出處的表格將其列為「男」的數值。'

const HS_MEMBERS = `${JHBF}加盟學校的硬式棒球隊隊員`
const DRAFT_2025 = '2025年NPB選秀'
const FILED_2025 = '2025年職棒志願書'
const RELEASED = '2021–2025年遭戰力外通告或引退的NPB球員767人'
const RELEASED_FULL = '2021–2025年遭戰力外通告或引退的NPB球員767人（不含外籍球員，以及在同一球團以育成身分重新簽約者）'
const RELEASED_PATHS = '2021–2025年遭戰力外通告或現役引退的NPB球員767人的出路（NPB的調查）'
const SALARY_713 = 'NPB公示為支配下選手的日本籍球員713人'
const SALARY_TARGET = `12球團公示為支配下選手的日本籍球員713人（${JPBPA}的調查，2026年）`
const OLD_EDITION_AMOUNT = '2022年版的資料。遊戲中作為2025年度的基準使用，2025、2026年度的金額尚未確認'
const OLD_EDITION_RULE = '2022年版的資料。遊戲中作為2025年度的基準使用，2025、2026年度的規定尚未確認'
const PLAYING_KIDS = '打棒球的孩子與球員'
const NOT_MALE_ONLY = '出處未按性別區分，因此不斷定為僅限男性的數值，而是作為男性生涯模型的參考值使用。'
const BOYS_CONFIRMED = '已在出處確認（2026-10-17）。出處的表格將其列為「男子」的數值。'
const RULES_CONFIRMED = '以出處（MLB官方用語集）的摘要確認（2026-10-19）。為規則上的數值。'
const NOT_IN_STATS = '未以官方統計確認。為配合一般已知水準的遊戲中推估。'
const BORROWED = '借用日本差值的推估。未作為統計確認。'

export const STATS_ZH_TW: StatsWords = {
  stat: {
    // ---------------------------------------------------------------- Japan: measured / reported
    jpHsPlayers: {
      population: HS_MEMBERS,
      definition: '全年級隊員人數合計（出處未說明是否包含女生與球隊經理）',
      asOf: '2026年5月底',
      verifyNote: ref(`${JHBF}加盟學校的硬式棒球隊隊員（全年級，2026年5月底）`, MANAGERS),
      note: '標題「12萬分之1」的分母。並非成為職業球員的機率。',
    },
    jpHsFirstYears: {
      population: HS_MEMBERS,
      definition: '1年級隊員人數',
      asOf: '2026年5月底',
      verifyNote: ref(`${JHBF}加盟學校硬式棒球隊隊員中的1年級生（2026年5月底）`, MANAGERS),
    },
    jpHsSeniors2025: {
      population: HS_MEMBERS,
      definition: '3年級隊員人數',
      asOf: '2025年5月底',
      verifyNote: ref(`${JHBF}加盟學校硬式棒球隊隊員中的3年級生（2025年5月底，過去的表格）`, MANAGERS),
    },
    jpHsSchools: {
      population: `${JHBF}（硬式）`,
      definition: '加盟學校數',
      asOf: '2026年5月底',
      verifyNote: ref(`${JHBF}的硬式加盟學校（2026年5月底）`, '此為學校數，未區分性別。'),
    },
    jpHsComplete: {
      population: '高中硬式棒球隊隊員',
      definition: '續留率＝3年級隊員數 ÷ 該屆入學年度的1年級隊員數（含中途加入的隊員）',
      asOf: '2026年5月底',
      verifyNote: ref(`${JHBF}加盟學校的硬式棒球隊隊員（2026年的3年級生與2024年的1年級生）`),
      note: '中途入隊者也計入3年級生，因此並非同一批人連續待滿3年的比例本身。',
    },
    jpTeamsTotal: {
      population: '2026年夏季地方大會',
      definition: '參賽隊伍數（含聯合隊157隊）',
      asOf: '2026年夏季',
      verifyNote: ref('2026年夏季全國高等學校棒球選手權大會地方大會的參賽隊伍（新聞報導）', TEAMS_NO_SEX),
    },
    jpTeamsAichi: {
      population: '2026年夏季地方大會（愛知）',
      definition: '參賽隊伍數（最多）',
      asOf: '2026年夏季',
      verifyNote: ref('2026年夏季愛知大會的參賽隊伍（新聞報導）', TEAMS_NO_SEX),
    },
    jpTeamsTottori: {
      population: '2026年夏季地方大會（鳥取）',
      definition: '參賽隊伍數（最少）',
      asOf: '2026年夏季',
      verifyNote: ref('2026年夏季鳥取大會的參賽隊伍（新聞報導）', TEAMS_NO_SEX),
    },
    jpJhsSoft: {
      population: '中體連（日本中學校體育聯盟）的軟式棒球',
      definition: '球員人數（全年級。日本中學校體育聯盟軟式棒球競技部的調查）',
      asOf: '2025年',
      verifyNote: ref('中體連軟式棒球隊所屬的隊員與球員（2025年。NPB的文章引用中體連的調查）', '此次未查閱中體連的原始資料。'),
    },
    jpDraftTotal: {
      population: DRAFT_2025,
      definition: '被指名人數（支配下73人、育成43人）',
      asOf: '2025年',
      verifyNote: ref('2025年NPB選秀會議中被指名的球員（新聞報導的統計）'),
    },
    jpDraftFromHs: {
      population: DRAFT_2025,
      definition: '高中生被指名人數（支配下19人、育成14人）',
      asOf: '2025年',
      verifyNote: ref('2025年NPB選秀會議中被指名的高中生（新聞報導的統計）'),
    },
    jpDraftFromUniv: {
      population: DRAFT_2025,
      definition: '大學生被指名人數（含海外大學。支配下40人、育成14人）',
      asOf: '2025年',
      verifyNote: ref('2025年NPB選秀會議中被指名的大學生（含海外大學。新聞報導的統計）'),
    },
    jpDraftFromCompany: {
      population: DRAFT_2025,
      definition: '社會人球員被指名人數（支配下12人、育成1人）',
      asOf: '2025年',
      verifyNote: ref('2025年NPB選秀會議中被指名的社會人棒球球員（新聞報導的統計）'),
    },
    jpDraftFromIndep: {
      population: DRAFT_2025,
      definition: '獨立聯盟球員被指名人數（支配下1人、育成12人）',
      asOf: '2025年',
      verifyNote: ref('2025年NPB選秀會議中被指名的獨立聯盟球員（新聞報導的統計）'),
    },
    jpShibouHs: {
      population: FILED_2025,
      definition: '提出志願書的高中生人數',
      asOf: '2025年',
      verifyNote: ref('2025年提出職棒志願書的高中生（文章中的記述）'),
    },
    jpShibouUniv: {
      population: FILED_2025,
      definition: '提出志願書的大學生人數',
      asOf: '2025年',
      verifyNote: ref('2025年提出職棒志願書的大學生（文章中的記述）'),
    },
    jpIkuseiPromoted: {
      population: 'NPB 12球團的育成選手',
      definition: '從育成轉為支配下的人數（2023年，至文章發表時的8月為止）',
      asOf: '2023年',
      verifyNote: ref('2023年（至文章發表時為止）從育成登錄為支配下的NPB 12球團球員'),
    },
    jpReleaseAge: {
      population: RELEASED_FULL,
      definition: '各年平均年齡（26.3–27.8歲）以對象人數加權的平均',
      asOf: '2021–2025年',
      verifyNote: refDerived('2021–2025年遭戰力外通告或現役引退的NPB球員767人（不含外籍球員，以及在同一球團以育成身分重新簽約者。NPB的調查）'),
    },
    jpTenure: {
      population: RELEASED_FULL,
      definition: '各年平均在籍年數（6.3–7.7年）以對象人數加權的平均',
      asOf: '2021–2025年',
      verifyNote: refDerived('2021–2025年遭戰力外通告或現役引退的NPB球員767人（NPB的調查）'),
    },
    jpCareerNpb: {
      population: RELEASED,
      definition: '出路與NPB相關（球員、育成、教練、球團職員等）。由5年合計438人計算',
      asOf: '2021–2025年',
      verifyNote: refDerived(RELEASED_PATHS),
    },
    jpCareerOtherBaseball: {
      population: RELEASED,
      definition: '出路為其他棒球（獨立聯盟、社會人、海外等）。由合計188人計算',
      asOf: '2021–2025年',
      verifyNote: refDerived(RELEASED_PATHS),
    },
    jpCareerNonBaseball: {
      population: RELEASED,
      definition: '出路為棒球以外。由合計82人計算',
      asOf: '2021–2025年',
      verifyNote: refDerived(RELEASED_PATHS),
    },
    jpCareerUndecided: {
      population: RELEASED,
      definition: '出路未定或不明。由合計59人計算',
      asOf: '2021–2025年',
      verifyNote: refDerived(RELEASED_PATHS),
    },
    jpSalaryMedian: {
      population: SALARY_713,
      definition: `年薪中位數（${JPBPA}的調查）`,
      asOf: '2026年',
      verifyNote: ref(SALARY_TARGET),
    },
    npbMinSalary: {
      population: 'NPB支配下選手',
      definition: '支配下選手年薪（參稼報酬）的最低額（稅前）',
      asOf: OLD_EDITION_AMOUNT,
      verifyNote: `統計對象：NPB的支配下選手（${JPBPA}資料〈2022年版〉第5頁的表格）。{yen~:4200000}（稅前）與定義已在出處確認（2026-10-22）。資料為2022年版，2025、2026年度的金額尚未確認（野球協約的條文本身並未公開）。${NOT_MALE_ONLY}`,
    },
    npbFirstTeamMin: {
      population: 'NPB支配下選手',
      definition:
        '一軍最低保障：年薪未滿{yen~:16000000}的球員，每登錄一軍出賽名單1天，即支付（1,600萬日圓－年薪）÷150作為追加參稼報酬（登錄150天時，與年薪合計為{yen~:16000000}）',
      asOf: OLD_EDITION_RULE,
      verifyNote: `統計對象：NPB的支配下選手（${JPBPA}資料〈2022年版〉第5頁的表格）。{yen~:16000000}與150天的計算式及定義已在出處確認（2026-10-22）。資料為2022年版，2025、2026年度的規定尚未確認（野球協約的條文本身並未公開）。${NOT_MALE_ONLY}遊戲中沒有記錄一軍登錄的天數，因此與自由球員（FA）資格的換算相同，以「一軍1個球季的比例」×150天計算（模型上的換算）。`,
    },
    jpSalaryMean: {
      population: SALARY_713,
      definition: `年薪平均值（${JPBPA}的調查）`,
      asOf: '2026年',
      verifyNote: ref(SALARY_TARGET),
    },
    elbowYouth: {
      population: '小學棒球隊球員247人（山形大學等的研究，2007年發表）',
      definition: '以超音波發現肱骨內上髁（手肘內側）撕脫的比例（單一研究）',
      asOf: '2007年',
      verifyNote: '數值已在論文摘要中確認（2026-10-17）。摘要未記載對象的地區、性別與年級，且此值也不用於生涯模型，因此維持未確認。',
      note: '單一研究。並非全國的數值。',
    },

    // ---------------------------------------------------------------- Japan: estimates derived from the above
    jpHsFile: {
      population: '高中3年級硬式棒球隊隊員',
      definition: '2025年的職棒志願書（高中生124人）÷ 2025年5月底的3年級隊員（40,842人）',
      asOf: '2025年',
      verifyNote: refDerived(`分子為2025年提出職棒志願書的高中生，分母為${JHBF}2025年5月底的3年級隊員`, '出處不同的兩個數字之比。'),
    },
    jpHsDraftGivenFile: {
      population: '提出職棒志願書的高中生',
      definition: '高中生被指名人數 ÷ 高中生提出人數',
      asOf: '2025年',
      verifyNote: refDerived('2025年提出職棒志願書的高中生124人，以及其中被指名的33人（兩則新聞報導）'),
    },
    jpUnivDraftGivenFile: {
      population: '提出職棒志願書的大學生',
      definition: '大學生被指名人數 ÷ 大學生提出人數（被指名人數含海外大學）',
      asOf: '2025年',
      verifyNote: refDerived('2025年提出職棒志願書的大學生176人，以及被指名的大學生54人（兩則新聞報導。被指名人數含海外大學）'),
    },
    jpShihaikaHs: {
      population: '2025年NPB選秀被指名的高中生33人',
      definition: '以支配下身分被指名的比例（1年份）',
      asOf: '2025年',
      verifyNote: refDerived('2025年NPB選秀被指名的高中生33人（新聞報導的統計）', '1年份的資料。'),
    },
    jpShihaikaUniv: {
      population: '2025年NPB選秀被指名的大學生54人',
      definition: '以支配下身分被指名的比例（1年份）',
      asOf: '2025年',
      verifyNote: refDerived('2025年NPB選秀被指名的大學生54人（新聞報導的統計）', '1年份的資料。'),
    },
    jpShihaikaCompany: {
      population: '2025年NPB選秀被指名的社會人球員13人',
      definition: '以支配下身分被指名的比例（1年份，人數少）',
      asOf: '2025年',
      verifyNote: refDerived('2025年NPB選秀被指名的社會人棒球球員13人（新聞報導的統計）', '僅1年份、13人的資料。'),
    },
    jpShihaikaIndep: {
      population: '2025年NPB選秀被指名的獨立聯盟球員13人',
      definition: '以支配下身分被指名的比例（1年份，人數少）',
      asOf: '2025年',
      verifyNote: refDerived('2025年NPB選秀被指名的獨立聯盟球員13人（新聞報導的統計）', '僅1年份、13人的資料。'),
    },
    jpKoshien: {
      population: '高中硬式棒球隊隊員（1個年級）',
      definition: '在學期間進入甲子園板凳名單的比例。以春季32校、夏季49校 × 20人的名額（每年1,620個），除以每個年級的隊員數（124,116÷3）',
      asOf: '2026年',
      verifyNote: `統計對象：${JHBF}加盟學校的硬式棒球隊隊員（2026年5月底全年級人數除以3，即每個年級）與甲子園春夏兩季的參賽名額。隊員數已在出處確認（2026-10-17）。參賽學校數（春季32、夏季49）與板凳名單人數（20人）在此次確認中未查閱出處，因此維持未確認。隊員數未區分性別。`,
      note: '包含「1個名額算作1個年級中的1人」的假設。',
    },
    jpNpbExit: {
      population: 'NPB球員',
      definition: '每年離開球團的機率。2021–2025年平均在籍年數的倒數（假設每年機率相同）',
      asOf: '2021–2025年',
      verifyNote: refDerived('2021–2025年遭戰力外通告或現役引退的NPB球員767人的平均在籍年數（NPB的調查）', '「每年機率相同」是模型的假設。'),
    },
    jpSalarySigma: {
      population: 'NPB支配下的日本籍球員',
      definition: '假設年薪呈對數常態分布，由中位數與平均值求得的離散程度',
      asOf: '2026年',
      verifyNote: refDerived(`12球團公示為支配下選手的日本籍球員713人的年薪（${JPBPA}的調查）`, '對數常態分布是模型的假設。'),
    },
    jpPrefTeamsOther: {
      population: '2026年夏季地方大會（愛知、鳥取以外）',
      definition: '愛知、鳥取以外45個都道府縣的平均（含聯合隊。未考慮北海道與東京分為2個地區的制度）',
      asOf: '2026年夏季',
      verifyNote: refDerived('2026年夏季地方大會的參賽隊伍（新聞報導的全國合計與最多、最少）', TEAMS_NO_SEX),
    },

    // ---------------------------------------------------------------- Japan: assumptions (no data yet)
    jpJhsContinue: {
      population: '打過少棒（小學）的孩子',
      definition: '在國中也繼續打棒球的比例',
      asOf: '-',
      verifyNote: NO_DATA,
      note: '由於沒有少棒球員人數的資料，因此採用假設。',
    },
    jpHsJoin: {
      population: '國中時打棒球的孩子',
      definition: '在高中加入硬式棒球隊的比例',
      asOf: '-',
      verifyNote: NO_DATA,
      note: '由於國中硬式俱樂部的球員人數不明，因此採用假設。軟式（中體連）1個年級約4.6萬人，高中1年級生約4.4萬人。',
    },
    jpToUniv: {
      population: '持續打硬式棒球到高中3年級的球員',
      definition: '在大學繼續打棒球的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpToCompany: {
      population: '完成高中或大學學業的球員',
      definition: '加入社會人棒球企業隊的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpToIndep: {
      population: '完成高中或大學學業的球員',
      definition: '加入獨立聯盟的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpUnivComplete: {
      population: '大學棒球隊隊員',
      definition: '持續到4年級的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpUnivFile: {
      population: '大學4年級棒球隊隊員',
      definition: '提出職棒志願書的比例（依提出者176人與大學隊員人數的假設推算）',
      asOf: '-',
      verifyNote: '由於沒有大學隊員人數的資料，比例為假設。',
    },
    jpUnivToCompany: {
      population: '持續打棒球到大學4年級的球員',
      definition: '加入社會人棒球企業隊的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpUnivToIndep: {
      population: '持續打棒球到大學4年級的球員',
      definition: '加入獨立聯盟的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpIkuseiExit: {
      population: 'NPB育成選手',
      definition: '每年離開球團的機率',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpCompanyDraft: {
      population: '社會人棒球球員',
      definition: '每年被NPB指名的機率',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpIndepDraft: {
      population: '獨立聯盟球員',
      definition: '每年被NPB指名的機率',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpIkuseiPromote: {
      population: 'NPB育成選手',
      definition: '每年升為支配下的機率（依每年32人與育成選手人數的假設推算）',
      asOf: '-',
      verifyNote: '由於沒有12球團育成選手總數的資料，比例為假設。',
    },
    jpIchigun: {
      population: 'NPB支配下選手中尚未在一軍出賽的球員',
      definition: '每年在一軍初次出賽的機率',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    jpMlb: {
      population: '有NPB一軍經驗的球員',
      definition: '每年轉往MLB的機率',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    companyTenure: {
      population: '社會人棒球與獨立聯盟球員',
      definition: '每年結束現役生涯的機率',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    abilityRho: {
      population: PLAYING_KIDS,
      definition: '實力（在同年級中的位置）延續到下一年的程度',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    focusEffect: {
      population: PLAYING_KIDS,
      definition: '以「練習」為重點的那一年，實力的提升幅度',
      asOf: '-',
      verifyNote: NO_DATA,
    },

    // ---------------------------------------------------------------- body growth (general population, boys)
    jpBoyHeight: {
      population: '日本男生（5–17歲，抽樣調查）',
      definition: '各年齡的平均身高（表中數值為17歲。5–17歲的數值見body.ts）',
      asOf: '2024年度',
      verifyNote: BOYS_CONFIRMED,
    },
    jpBoyWeight: {
      population: '日本男生（5–17歲，抽樣調查）',
      definition: '各年齡的平均體重（表中數值為17歲。5–17歲的數值見body.ts）',
      asOf: '2024年度',
      verifyNote: BOYS_CONFIRMED,
    },
    jpHsMembersPerSchool: {
      population: `${JHBF}加盟學校`,
      definition: '每校硬式棒球隊隊員數（隊員124,116人 ÷ 加盟學校3,746所。與出處表格中的「平均」33.1一致）',
      asOf: '2026年5月底',
      verifyNote: refDerived(`${JHBF}的硬式棒球隊隊員數與加盟學校數（2026年5月底）`),
    },
    // abilities and team model (no data: model settings, shown as model values)
    abilityModel: {
      population: PLAYING_KIDS,
      definition: '顯示的能力（0–100）是在同年代打棒球的人當中的位置：整體實力（已校準）加上由守備位置與練習決定的擅長、不擅長之處',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    velocityModel: {
      population: '投手',
      definition: '顯示的球速：各年齡的基準（17歲為127km/h）加上實力與擅長、不擅長之處',
      asOf: '-',
      verifyNote: '尚未確認公開的各年齡球速資料，因此為模型上的設定。',
    },
    hsTeamModel: {
      population: '高中硬式棒球隊',
      definition: '板凳名單人數（遊戲中的設定），以及球隊人數與實力的決定方式',
      asOf: '-',
      verifyNote: '各大會的板凳名單人數在此次確認中未查閱出處，因此為遊戲中的設定（20人）。球隊人數以每校平均（33.1人）為中心，並假設強隊人數較多。',
    },
    seasonModel: {
      population: '大學、社會人、獨立聯盟與職業球員',
      definition:
        '高中畢業後各球季的決定方式（遊戲中的設定）：板凳名單人數（25人）、比賽場數（大學聯賽每季10–14場，獨立聯盟50–70場，職業若整季出賽，野手143場、先發25場、救援55場，二軍則為110、18、40場）、聯賽排名、盃賽勝負、在一軍出賽的比例（依決定該年年薪的實力位置）。成績的基準，是在此模型中晉級到各階段之球員的實力分布（10萬人的試行，2026-10-18），以及遊戲中打擊率、全壘打、防禦率的基準',
      asOf: '-',
      verifyNote:
        '板凳名單人數、比賽場數與大會賽制，在此次確認中未查閱出處，因此為遊戲中的設定。大會名稱也未確認，因此以一般名稱顯示。出路的判定（退隊、選秀、一軍初次出賽、戰力外）維持已校準的機率，比賽結果則配合這些判定產生。',
    },
    schoolModel: {
      population: '升上高中或大學的球員',
      definition:
        '升學的決定方式（遊戲中的設定）：將球員分配到實際存在的學校（不含女校，即名稱中含有「女子」「女學院」等字樣者），並一律視為設有棒球隊。一般入學考試的錄取機率，取決於本人學力（由知識換算）與學校難度（未收錄偏差值的學校，使用每段人生暫定的值）之差；學校推薦取決於知識與評價；運動績優推薦則依棒球實力選出前來邀約的球隊（不使用偏差值），能否入學由本人的評價（能力、守備位置適性、成長潛力、實績、傷病史等，evaluationModel）與球隊實力（teamRatingModel）決定。若第一志願落榜，則進入同時報考的學校',
      asOf: '-',
      verifyNote:
        '學校名稱是依據文部科學省學校代碼的實際名稱。是否設有棒球隊及其實力、入學考試難度、錄取與推薦的機率，全部是遊戲中的假設，並非已確認的事實。偏差值僅收錄大學，採用河合塾的公開值（2027年度入學考試的錄取邊界預測）；高中因尚未找到可用的出處，因此未收錄。',
    },
    hsPlayModel: {
      population: '高中棒球球員',
      definition:
        '高中個人成績與球速的模型（遊戲中的設定）。一般球員打擊率約.250、全壘打率1%、防禦率約4.6、每9局三振約6.5次。對手是其他高中生（學校越強，對手越強）。校內投球能力比自己高的球員越多，投手登板的比例就越低（弱校的王牌幾乎每場都投，強校則由多人分攤）。練習賽場數依學校實力而變（強校較多，弱校較少）。3年級投手的球速：中位數127km/h，後10%約117km/h，前1%約143km/h（2026-10-18設定目標值的假設）',
      asOf: '-',
      verifyNote:
        '尚未找到顯示高中生成績分布的公開資料，因此全部為模型上的數值。先前的設定比現實好太多，例如一般球員也有打擊率.315、防禦率2.6、每年投50–240局等。',
    },
    evaluationModel: {
      population: '選擇出路的球員',
      definition:
        '球員的評價（遊戲中的設定，不顯示數值）：整體能力加上守備位置適性（身高只會讓各位置稍微傾斜，技術可以彌補）、成長潛力（年齡，以及身高仍可成長的空間）、實績（甲子園、隊長、固定先發、優勝、代表隊）、傷病史、近期狀態、所屬球隊的實力與球探的關注。受到邀約的機率與實際能入隊的機率分別決定（僅透過入隊測試加入的情況，以及俱樂部球隊，各有不同的基準）',
      asOf: '-',
      verifyNote: '沒有以數值呈現球員評價或球探評價的公開資料，因此全部為模型上的數值。身高與守備位置的關係也不是統計，而是遊戲中的假設。',
    },
    teamRatingModel: {
      population: '高中、大學、社會人、獨立聯盟、NPB與美國大學的球隊',
      definition:
        '球隊的內部實力（遊戲中的設定。不顯示數值，只以「強豪、上位、中堅」等字詞與依據呈現）。大學依所屬聯盟（全日本大學棒球聯盟的官方頁面）、該聯盟在選手權大會的決賽晉級次數（2005–2026）、東都與首都聯盟的分級，以及該大學本身的決賽晉級紀錄。高中依甲子園參賽紀錄（夏季、春季，2004–2026，日本高等學校棒球聯盟的參賽學校一覽）。社會人依日本選手權大會的參賽隊伍一覽（官方）。NPB依最近3年的勝率（NPB的戰績表）。美國大學依NCAA第一級（Division I）的分區聯盟。沒有依據的球隊（無參賽紀錄的高中、獨立聯盟、未加盟任何聯盟的大學）依設立者、聯盟、球隊分別推估。越強的球隊隊員越多、入隊門檻越高、隊內競爭越激烈。在NPB，越強的球團，同樣實力能在一軍出賽的機會越少；選秀時則是弱隊指名較多好球員',
      asOf: '2026年',
      verifyNote:
        '聯盟的加盟大學、選手權大會的決賽晉級、甲子園參賽、日本選手權大會參賽與NPB的勝負，皆已在官方公布中確認（2026-10-18）。東都、首都聯盟的分級與美國大學一覽為二手資料（Wikipedia）。由聯盟、分級、參賽與勝率算出實力數值的公式，以及沒有依據之球隊的實力，均為遊戲中的假設。',
    },
    scoutModel: {
      population: '高中2、3年級、大學、社會人與獨立聯盟的球員',
      definition:
        '球探的關注度（0–100）。依下一次職棒志願書或選秀判定（已校準）中被選中的機率產生，並依當年正式比賽的成績上下浮動數點。「球探前來視察」的階段（60以上）只有在判定決定球探到場時才會出現。並非保證被指名的數值',
      asOf: '-',
      verifyNote: '沒有以數值呈現球探評價的公開資料，因此為模型上的數值。',
    },

    // ---------------------------------------------------------------- work and money (general population, men)
    jpWageMale: {
      population: '男性一般勞工',
      definition: '各年齡層的薪資（表中數值為最高的55–59歲。所有年齡層的數值見after.ts）。「薪資」的定義未在此出處的頁面確認',
      asOf: '2025年',
      verifyNote: CONFIRMED_MEN,
    },
    jpUnemployMale: {
      population: '男性勞動力人口',
      definition: '完全失業率（年平均）',
      asOf: '2025年',
      verifyNote: '已在出處確認（2026-10-17）。出處將其列為「男性」的數值。',
      note: '某一時點正在找工作的人所占的比例，並非1年內失去工作的機率。',
    },
    jpNeverMarried50Male: {
      population: '日本男性（45–54歲）',
      definition: '50歲時的未婚比例（45–49歲與50–54歲未婚比例的平均。依據補足不詳值後的數值）',
      asOf: '2020年',
      verifyNote: '已在出處確認（2026-10-17）。出處的表格將其列為「男」的數值。由國勢調查計算，出處為二次統整。',
      note: '2020年的數值。遊戲主角年滿50歲是在2080年代以後，該時代的比例假設沿用相同數值作為參考。',
    },
    licenseModel: {
      population: '進入醫科・齒科・藥科・護理・教育大學的人（不繼續打棒球的學生）',
      definition:
        '依大學名稱決定所學領域，6年（醫・齒・藥）或4年畢業。國家考試的錄取難易度（每次：醫師90%・牙醫師65%・藥師70%・護理師90%，最多3次）、取得證照後工作的第一年年收入（醫師{yen:10000000}・牙醫師{yen:7000000}・藥師{yen:5500000}・護理師{yen:4800000}），以及開業等帶來的增減。教育大學畢業即取得教師證',
      asOf: '-',
      verifyNote: '錄取難易度與年收入，都是未以公開統計確認的遊戲中的假設。不作為實際國家考試的錄取率或該職業的平均收入看待。',
    },
    careerModel: {
      population: '棒球之後選擇了上班族以外道路的人',
      definition:
        '職業電競選手、直播主、偶像·歌手·演員·藝人、漫畫家·小說家·插畫家、創業、自衛官、議員、球評·教練·球探·球團職員的起始年收入、因事件而增減的幅度，以及成功與失敗發生的難易度',
      asOf: '-',
      verifyNote: '年收入的金額、成功與人氣成長的方式、失敗發生的難易度，全都是未能以公開統計確認的遊戲中的假設。不作為實際職業的平均收入看待。',
    },
    kidBallModel: {
      population: '日本人生中年滿8歲的兒子',
      definition: '兒子是否開始打棒球，以及他如何走過國中、高中、甲子園、選秀、大學、社會人棒球、獨立聯盟與職棒一軍',
      asOf: '-',
      verifyNote:
        '每個階段都套用與主角本人人生相同統計的比例，而不考慮他的處境，屬於推估。父親的經歷讓兒子稍微更容易開始打球、略微提高素質，是遊戲中的假設；父母的成績不會決定他的成功。',
    },
    workModel: {
      population: '有工作的人',
      definition:
        '年收入＝各年齡的月薪 × 14個月（含獎金的假設）× 任職單位、職位與是否為正職的倍率。退職金：正職且任職3年以上時，為年資 × 各任職單位的金額（每年{yen:250000}–{yen:500000}）。升遷、轉職、失業、退休的發生難易度也是模型上的設定',
      asOf: '-',
      verifyNote: '獎金比例、任職單位與職位造成的差異、退職金金額，以及升遷、轉職、失業的機率，均無法以公開統計確認，因此為假設。',
    },
    householdModel: {
      population: '18歲以上',
      definition:
        '以下項目的設定：實領比例（扣除稅金與社會保險費後的剩餘）、生活費（實領的6成＋固定費用；每名子女每年{yen:300000}；存款為負的年份縮減15%）、配偶的實領收入（每年{yen:900000}；最小的孩子未滿3歲期間為{yen:300000}；領到60歲為止）、房租與貸款還款、年金（每年{yen:1800000}，配偶部分{yen:700000}）。他住在父母家，父母雙亡後繼承房子',
      asOf: '-',
      verifyNote: '家計支出、配偶的收入與年金金額，均無法以公開統計確認，因此為假設。',
    },
    usHouseholdModel: {
      population: '住在美國、已離開棒球的人',
      definition:
        '公共年金自67歲起領取（全額參考值約每年{yen:2500000}；依先前收入高低領取全額的40–100%，有配偶則再加計50%）；65歲退休，到67歲為止的2年靠存款生活。醫療費自65歲起每年{yen:300000}，80歲起每年{yen:550000}。工作期間的收入與其他家計（實領比例、生活費、居住費）沿用日本的設定',
      asOf: '-',
      verifyNote:
        '年金的起領年齡、金額與醫療費，是配合本遊戲模型的假設，並未以美國制度的數值或統計確認（67歲是作為較晚出生世代全額起領年齡的參考而設定）。',
    },
    lifeEventModel: {
      population: '離開棒球後的人生',
      definition: '邂逅、結婚、子女、照護、社區活動、疾病等事件的發生難易度',
      asOf: '-',
      verifyNote:
        '事件的發生難易度全部為假設。邂逅與結婚已經調整，使交給自動進行時50歲時的未婚比例接近統計值（jpNeverMarried50Male，28.25%）。初婚年齡、子女人數，以及照護、疾病等的發生難易度，均無法以公開統計確認。',
    },

    // ---------------------------------------------------------------- general population (not baseball)
    jpLifeMale: {
      population: '日本男性',
      definition: '0歲的平均餘命（平均壽命）。令和7年（2025年）簡易生命表',
      asOf: '2025年',
      verifyNote: CONFIRMED_MEN,
    },
    jpLifeMaleAt10: {
      population: '活到10歲的日本男性',
      definition: '平均死亡年齡＝10歲＋10歲的平均餘命71.60年（令和7年〔2025年〕簡易生命表）。用於調整死亡機率',
      asOf: '2025年',
      verifyNote: '原始數值已在出處確認（2026-10-17）。出處的表格將其列為「男」10歲時的平均餘命。',
      note: '本遊戲設定在開始打棒球的8歲之前不會死亡，因此配合的是10歲時的平均餘命，而非出生時。',
    },

    // ---------------------------------------------------------------- United States
    usLifeMale: {
      population: '美國男性',
      definition: '出生時的平均餘命。NCHS的2024年確定值',
      asOf: '2024年',
      verifyNote: '已在出處確認（2026-10-19）。出處的表格將其列為「男性」的數值（2023年為75.8年）。',
    },
    usLifeMaleAt10: {
      population: '活到10歲的美國男性',
      definition: '平均死亡年齡。在出生時的平均餘命76.5年上，加上日本數值中出生時與10歲時的差（81.60−81.35＝0.25年）的假設。用於調整死亡機率',
      asOf: '2024年',
      verifyNote: '未取得美國10歲時的平均餘命。出生時的平均餘命（76.5年）已確認，修正至10歲時則是借用日本數值的假設。',
    },
    usDraftRounds: {
      population: 'MLB規則4選秀（Rule 4 Draft）',
      definition: '2022–26年勞資協議下的選秀輪數',
      asOf: '2026年',
      verifyNote: '以出處（MLB官方用語集）的摘要確認（2026-10-19）。為規則上的數值，並非人數的統計。',
      note: '自2028年起的資格變更案（20歲以上、高中畢業後2年）只是提案，並非現行規定。',
    },
    usArbitrationYears: {
      population: 'MLB球員',
      definition: '取得薪資仲裁資格所需的服務年資（有Super Two的例外）',
      asOf: '2026年',
      verifyNote: RULES_CONFIRMED,
    },
    usFreeAgencyYears: {
      population: 'MLB球員',
      definition: '取得自由球員（FA）資格所需的服務年資（172天算1年）',
      asOf: '2026年',
      verifyNote: RULES_CONFIRMED,
    },
    usMid: {
      population: '打少棒的男孩',
      definition: '到國中年齡（middle school）仍繼續打棒球的比例',
      asOf: '-',
      verifyNote: NO_DATA + '美國少棒的人數與持續率未能確認。',
    },
    usHs: {
      population: '在國中年齡持續打棒球的男孩',
      definition: '加入高中（4年制）棒球隊的比例',
      asOf: '-',
      verifyNote: NO_DATA + '美國高中的棒球人口與入隊比例未能確認。',
    },
    usHsStay: {
      population: '高中棒球隊隊員',
      definition: '在高中球隊持續1年的比例（假設持續4年的比例約6成後所取的4次方根）',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    usHsDraft: {
      population: '持續打到高中最後一個學年的球員',
      definition: '在MLB選秀中被指名的比例',
      asOf: '-',
      verifyNote: NO_DATA + '未能確認將高中生被指名人數與球隊最後一個學年人數相連結的統計。',
    },
    usHsSign: {
      population: '在選秀中被指名的高中生',
      definition: '不升大學而選擇職業合約的比例（交給自動進行時答案的決定方式）',
      asOf: '-',
      verifyNote: NO_DATA + '被指名後簽約的高中生比例未能確認。',
    },
    usHsCollege: {
      population: '持續打到高中最後一個學年但未被指名的球員',
      definition: '在大學或二年制學院的棒球隊繼續打球的比例',
      asOf: '-',
      verifyNote: NO_DATA + 'NCAA有關升學比例的頁面無法開啟（§6.4）。',
    },
    usCollegeStay: {
      population: '大學與二年制學院棒球隊隊員',
      definition: '在球隊持續1年的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    usCollegeDraft: {
      population: '具選秀資格的大學與二年制學院球員',
      definition: '每年在MLB選秀中被指名的比例（4年制大學在讀完3年級後或年滿21歲起，二年制學院則隨時）',
      asOf: '-',
      verifyNote: NO_DATA + '具資格的人數未能確認。依分級（NCAA第一至第三級、二年制學院）而有的差異，作為設定分開處理。',
    },
    usCollegeSign: {
      population: '在選秀中被指名的大學與二年制學院球員',
      definition: '選擇簽約的比例（交給自動進行時答案的決定方式）',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    usJucoTransfer: {
      population: '讀完二年制學院2年且未被指名的球員',
      definition: '轉學至4年制大學繼續打球的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    usMinorUp: {
      population: '小聯盟球員',
      definition: '每年升上一個層級的比例（各層級間的差異為設定）',
      asOf: '-',
      verifyNote: NO_DATA + '小聯盟各層級的升級率未能確認。',
    },
    usMinorExit: {
      population: '小聯盟球員',
      definition: '每年合約到期而離開棒球的比例',
      asOf: '-',
      verifyNote: NO_DATA,
    },
    usMlbDebut: {
      population: '2A與3A的小聯盟球員',
      definition: '每年首次在MLB出賽的比例（依層級設有差異）',
      asOf: '-',
      verifyNote: NO_DATA + '各輪次的MLB到達率（第1輪73%、第2輪51%、第3輪40%，分析文章）為二手資訊，此處作為參考。',
    },
    usMlbExit: {
      population: 'MLB球員',
      definition: '每年離開MLB的比例（依野手平均生涯5.6年〔二手〕推算）',
      asOf: '-',
      verifyNote: NO_DATA + '平均生涯5.6年出自以1902–1993年開始生涯之野手為對象的研究（二手），並非現今的數值。',
    },
    usModel: {
      population: '出生於美國的人生',
      definition:
        '以下項目的設定：大學分級（NCAA第一至第三級、二年制學院）的比例與依實力的差異、選秀順位與簽約金（20輪）的分布、小聯盟層級與年薪、MLB年薪（最低年薪、仲裁、FA）。D2、D3與二年制學院的校名為一般名稱',
      asOf: '-',
      verifyNote:
        '各分級的比例、順位的分布、小聯盟層級與年薪、MLB年薪的形態，均無法以官方統計確認，因此全部為假設。已確認的事實只有選秀輪數與資格、服務年資的規則，以及平均餘命。',
    },

    // ---------------------------------------------------------------- Korea and Cuba: estimates, none checked against a source
    krLifeMale: {
      population: '韓國男性',
      definition: '出生時平均餘命的概略值（遊戲中的推估）',
      asOf: '-',
      verifyNote: NOT_IN_STATS,
    },
    krLifeMaleAt10: {
      population: '活到10歲的韓國男性',
      definition: '平均死亡年齡的推估：在出生時的推估值上，加上日本數值中出生時與10歲時的差（0.25年）。用於調整死亡機率',
      asOf: '-',
      verifyNote: BORROWED,
    },
    cuLifeMale: {
      population: '古巴男性',
      definition: '出生時平均餘命的概略值（遊戲中的推估）',
      asOf: '-',
      verifyNote: NOT_IN_STATS,
    },
    cuLifeMaleAt10: {
      population: '活到10歲的古巴男性',
      definition: '平均死亡年齡的推估：在出生時的推估值上，加上日本數值中出生時與10歲時的差（0.25年）。用於調整死亡機率',
      asOf: '-',
      verifyNote: BORROWED,
    },
    krModel: {
      population: '出生於韓國的人生（測試版）',
      definition: '以下項目的設定：高中與大學的出路、選秀（KBO新人選秀）、二軍與一軍的層級、年薪、兵役的處理，以及取得FA前的年數。也包含家計、年金與醫療費的設定',
      asOf: '-',
      verifyNote:
        'KBO一軍比賽場數（144）、二軍比賽場數（120，由2025年的118場與2026年的121場而來）、最低年薪（3,000萬韓元），以及取得FA所需年數（高中畢業8年、大學畢業7年），已透過公開資料與新聞報導確認（2026-10-23）。年薪的成長方式，是向KBO公布的平均年薪（2026年1億7,536萬韓元）靠攏的遊戲中推估。其他比例、年數與金額（含簽約金與兵役）均為未經官方統計或一手資料確認的遊戲中推估，不視為實際的制度或數值。',
    },
    cuModel: {
      population: '出生於古巴的人生（測試版）',
      definition: '以下項目的設定：體育學校的選拔、晉升國內聯賽（古巴國家聯賽）、收入、海外挑戰（與MLB球團簽約），以及家計、年金與醫療費',
      asOf: '-',
      verifyNote: '比例、收入與金額全部是未經官方統計或一手資料確認的遊戲中推估。政治、經濟與制度的狀況是遊戲內的推估模型，並非斷定為事實。',
    },
  },

  source: (() => {
    const JHBF_PUB = '日本高等學校棒球聯盟'
    const JHBF_FOUNDATION = '公益財團法人 日本高等學校棒球聯盟'
    const MEXT = '文部科學省'
    const MHLW = '厚生勞動省'
    const JABA = '公益財團法人 日本棒球聯盟（JABA）'
    const JUBF = '公益財團法人 全日本大學棒球聯盟'
    const JUKELABO = 'Jukelabo補習班'
    const NPB_ORG = '日本職業棒球組織（NPB）'
    const NOT_OPENED = '無法開啟。未嘗試任何迴避手段。數值未確認。'
    const GIRLS_MANAGERS = '未說明是否包含女生與球隊經理。'
    const WIKI_LEAGUES = 'Wikipedia（二手資料；未與聯盟官方網站比對）'
    return {
      jhbf: {
        title: '加盟學校數與隊員人數統計（硬式）',
        original: '加盟校数・部員数統計（硬式）',
        publisher: JHBF_PUB,
        checkNote: `確認2026年5月底加盟學校3,746所、隊員124,116人（1年級43,836、2年級40,714、3年級39,566）、續留率90.3%。${GIRLS_MANAGERS}`,
      },
      jhbfPref2026: {
        title: '加盟學校數與隊員人數統計（硬式）2026年，依都道府縣',
        original: '加盟校数・部員数統計（硬式）2026年・都道府県別',
        publisher: JHBF_PUB,
        checkNote: `確認截至2026年5月底各都道府縣的加盟學校數（47都道府縣，合計3,746所）與隊員人數。未列出學校名稱一覽。${GIRLS_MANAGERS}`,
      },
      mextSchoolCode: {
        title: '學校代碼（令和8年〔2026年〕5月1日時點，暫定版；更新日2026/5/20）',
        original: '学校コード（令和8年5月1日時点・暫定版。更新日 2026/5/20）',
        publisher: MEXT,
        checkNote:
          '以CSV取得全國學校的名稱、學校種類、都道府縣、設立區分（國立、公立、私立）、本校或分校及所在地（高中5,127所、大學840所、短期大學329所、高等專門學校58所）。不包含性別資訊、學科、是否設有棒球隊與偏差值。頁面未記載使用條件。',
      },
      keinetRanking2027: {
        title: '入學考試難易度預測一覽表 2027年度入學考試（依學部學科排名／依大學）',
        original: '入試難易予想一覧表 2027年度入試（学部学科ランク／大学別）',
        publisher: '河合塾 Kei-Net',
        checkNote:
          '從14份PDF（國公立、私立 × 7個地區）取得各學科的偏差值（依河合塾全統模擬考的偏差值，錄取可能性50%的邊界線；2026年10月時點對2027年度入學考試的預測）。有下限值（「37.4以下為方便起見視為35.0」）與無邊界值（border free，無數值）的學科。東京大學、京都大學等部分大學未列入。使用條件未能確認（© Kawaijuku Educational Information Network）。經使用者許可，作為公開數值使用（2026-10-18）。',
      },
      jukelabo2026: {
        title: '高中偏差值資訊（令和8年度・2026年度，47都道府縣的頁面）',
        original: '高校偏差値情報（令和8年度・2026年度、47都道府県のページ）',
        publisher: JUKELABO,
        checkNote:
          '依都道府縣、公立／私立與國立別，取得全日制高中的偏差值（4,556所，9,447列）。每個課程各有一列，計算依據的模擬考未註明。robots.txt允許擷取頁面，網站上也未發現禁止再利用的使用條款（僅有著作權標示與隱私權政策）。以1.2秒的間隔擷取。各校的代表值為普通科的中位數（若無則為所有課程的中位數）。',
      },
      jukelabo2026univ: {
        title: '大學偏差值一覽（依學部系統分類的14個頁面）',
        original: '大学偏差値一覧（学部系統別14ページ）',
        publisher: JUKELABO,
        checkNote:
          '國公立與私立大學依學部與考試日程的偏差值。計算依據的模擬考與年度未註明。僅用於河合塾Kei-Net中沒有數值的大學，各大學的代表值為各列的中位數。同一所大學不與河合塾的數值混用。',
      },
      jhbfTop: {
        title: '日本高等學校棒球聯盟 官方網站（大會簡介）',
        original: '日本高等学校野球連盟 公式サイト（大会の案内）',
        publisher: JHBF_PUB,
        checkNote:
          '確認大會名稱「選拔高等學校棒球大會」（第99屆）、「全國高等學校棒球選手權大會」（第108屆）、「秋季地區大會」（令和8年度）。屆數不在遊戲中使用（因為他入學是在2041年以後）。',
      },
      daily2026: {
        title: '參賽隊伍減少33隊至3,363隊 夏季高中棒球地方大會（2026年6月28日）',
        original: '参加チーム33減の3363 夏の高校野球地方大会（2026年6月28日）',
        publisher: 'Daily Sports',
        checkNote: '確認3,363隊（含聯合隊157隊），最多為愛知174隊，最少為鳥取21隊。',
      },
      npbJhs: {
        title: '全國國中生問卷調查2025：針對中體連軟式棒球隊所屬球員的全國調查（2026年4月17日）',
        original: '全国中学生アンケート2025 ～中体連軟式野球部所属選手への全国調査～（2026年4月17日）',
        publisher: 'NPB',
        checkNote: '確認2025年中體連軟式棒球的球員人數139,240人（引用日本中學校體育聯盟的調查）。未記載性別與年級別。',
      },
      hbnDraft: {
        title: '今年大學生指名約占整體一半！【25年選秀】（2025年10月23日）',
        original: '今年は大学生指名が全体の約半分！【25年ドラフト】（2025年10月23日）',
        publisher: 'hb-nippon',
        checkNote: '確認指名116人（支配下73、育成43）：高中33（支配下19）、大學54（40）、社會人13（12）、獨立聯盟13（1）、其他3（1）。',
      },
      numberShibou: {
        title: '近畿大學選秀貼身採訪秘辛（2025年10月30日）',
        original: '近畿大ドラフト密着秘話（2025年10月30日、沢井史）',
        publisher: 'Number',
        checkNote: '確認2025年的職棒志願書：高中生124人、大學生176人（文章中的記述）。',
      },
      numberIkusei: {
        title: '職棒「其實把育成選手養著不用」的問題（2023年8月6日）',
        original: 'プロ野球“じつは育成選手を飼い殺している”問題（2023年8月6日、田尻耕太郎）',
        publisher: 'Number',
        checkNote: '確認2023年（至文章發表時為止）12球團中由育成轉為支配下的共有32人。文中未記載12球團育成選手的總數。',
      },
      npbCareer: {
        title: '2024年戰力外／現役引退球員出路調查結果',
        original: '2024年戦力外／現役引退選手の進路調査結果',
        publisher: 'NPB',
        checkNote: '確認2024年的157人（不含外籍球員，以及在同一球團以育成身分重新簽約者）、平均26.3歲、平均在籍6.3年，以及出路的明細。',
      },
      npbCareer2025: {
        title: '2025年戰力外／現役引退球員出路調查結果',
        original: '2025年戦力外／現役引退選手の進路調査結果',
        publisher: 'NPB',
        checkNote: '確認2025年的169人、平均27.2歲（2025年10月31日時點）、在籍6.8年，出路：NPB相關90、其他棒球54、棒球以外17、未定8。',
      },
      npbCareerTrend: {
        title: '戰力外／現役引退球員出路調查結果【參考】歷年變化（2021–2025年）',
        original: '戦力外／現役引退選手の進路調査結果【参考】過去推移（2021～2025年）',
        publisher: 'NPB',
        checkNote: '確認2021–2025年的對象人數（143、145、153、157、169）、平均年齡、平均在籍年數，以及各出路類別的合計人數。',
      },
      npbTeams: {
        title: '12球團（中央聯盟、太平洋聯盟）',
        original: '12球団（セントラル・リーグ、パシフィック・リーグ）',
        publisher: 'NPB',
        checkNote: '確認中央聯盟6球團與太平洋聯盟6球團的名稱（2026年的頁面）。',
      },
      iblj: {
        title: '四國島聯盟plus 官方網站',
        original: '四国アイランドリーグplus 公式サイト',
        publisher: '四國島聯盟plus',
        checkNote: '確認聯盟名稱與4個球團（德島Indigo Socks、香川Olive Guyners、愛媛Mandarin Pirates、高知Fighting Dogs）。有一則2026年10月16日的公告。',
      },
      bcl: {
        title: 'Route Inn BC聯盟 官方網站（球隊資訊）',
        original: 'ルートインBCリーグ 公式サイト（チーム情報）',
        publisher: 'Route Inn BC聯盟',
        checkNote:
          '在「球隊資訊」頁面確認2026年9個球團的正式名稱（福島Red Hopes、茨城Astro Planets、千葉Sky Sailors、栃木Golden Braves、埼玉武藏Heat Bears、神奈川Future Dreams、群馬Diamond Pegasus、山梨Fire Winds、信濃Grandserows）。東京球團為準加盟，因此不使用。',
      },
      nlb: {
        title: '日本海聯盟 官方網站（球隊資訊）',
        original: '日本海リーグ 公式サイト（チーム情報）',
        publisher: '日本海聯盟',
        checkNote:
          '在球隊資訊中確認3個球團：石川Million Stars、富山GRN Thunderbirds、SHIGA HIJUMPS（新聞中提到金澤Dragon Cross與岐阜Technoa Diamond Rivers獲准正式加盟，但球隊資訊中未列出，因此不使用）。',
      },
      jabaRenmeiho2026: {
        title: '日本棒球聯盟 聯盟報2026（2026年6月發行。變更事項，以及2026年度JABA各地區聯盟主辦大會的參賽隊伍一覽）',
        original: '日本野球連盟連盟報2026（2026年6月発行。変更事項と、2026年度JABA各地区連盟主催大会の出場チーム一覧）',
        publisher: JABA,
        checkNote:
          '確認2025年度加盟隊伍的變更事項（新加盟、恢復活動、暫停活動、解散退出、名稱變更；附類別、加盟地方團體與地區聯盟），以及參加2026年度地區聯盟主辦大會的隊伍名稱（依地區）。未列出所有加盟隊伍的名冊（加盟隊伍數依都道府縣刊載）。',
      },
      jabaSenshuken2026: {
        title: '第51屆社會人棒球日本選手權大會 參賽隊伍一覽（截至2026.10.9）',
        original: '第51回社会人野球日本選手権大会 出場チーム一覧（2026.10.9現在）',
        publisher: JABA,
        checkNote: '確認日本選手權大會參賽隊伍的名稱（依代表地區，附參賽次數）。未列出地區聯盟。',
      },
      jubfLeagues: {
        title: '全日本大學棒球聯盟 加盟聯盟（各聯盟頁面的「加盟大學」欄。27個聯盟）',
        original: '全日本大学野球連盟 加盟連盟（各連盟のページの「加盟大学」欄。27連盟）',
        publisher: JUBF,
        checkNote:
          '在各聯盟的官方頁面（league_info.php?leagueid=01–27）確認全部27個聯盟的名稱、官方網站URL、加盟學校數與加盟大學名稱。加盟大學合計370所（含以學部、校區、高等專門學校、短期大學為單位者）。未區分分級（1部、2部）。',
      },
      jubfChampions: {
        title: '全日本大學棒球選手權大會 冠軍與亞軍學校一覽（2005–2026年）',
        original: '全日本大学野球選手権大会 優勝校・準優勝校一覧（2005〜2026年）',
        publisher: JUBF,
        checkNote: '確認2005年至2026年的冠軍與亞軍學校（2020年停辦）。',
      },
      jhbfSummerOuting: {
        title: '全國高等學校棒球選手權大會 參賽學校一覽（第86–106屆）與代表學校頁面（第107、108屆）',
        original: '全国高等学校野球選手権大会 出場校一覧（第86回〜第106回）と代表校のページ（第107・108回）',
        publisher: JHBF_FOUNDATION,
        checkNote: '確認2004–2026年夏季大會的代表學校（依地方大會；校名為通稱）與截至2026年的累計參賽次數。2020年停辦。',
      },
      jhbfSpringOuting: {
        title: '選拔高等學校棒球大會 參賽學校一覽（第76–97屆）與代表學校頁面（第98屆）',
        original: '選抜高等学校野球大会 出場校一覧（第76回〜第97回）と代表校のページ（第98回）',
        publisher: JHBF_FOUNDATION,
        checkNote: '確認2004–2026年春季大會的參賽學校（依都道府縣；通稱）與截至2026年的累計參賽次數。2020年因停辦而排除。',
      },
      npbStandings: {
        title: 'NPB球團戰績表（央聯、洋聯2023–2025年的最終排名）',
        original: 'NPB 球団の勝敗表（セ・パ両リーグ 2023〜2025年の最終順位）',
        publisher: NPB_ORG,
        checkNote: '確認2023、2024、2025年最終戰績表（12球團）的勝、敗、和與勝率。',
      },
      wikiNcaaD1Baseball: {
        title: 'List of NCAA Division I baseball programs（Wikipedia；大學名稱、州、分區聯盟）',
        publisher: 'Wikipedia（二手資料；未與NCAA官方頁面比對）',
        checkNote: '轉錄2026年NCAA第一級（Division I）棒球隊的表格（大學名稱、州、分區聯盟）。未收錄NCAA第二級、第三級、NAIA與二年制學院（NJCAA）。',
      },
      npbDraft: {
        title: '職棒選秀會議指名結果（2021–2025年，依球團；支配下與育成）',
        original: 'プロ野球ドラフト会議の指名結果（2021〜2025年、球団ごと。支配下・育成）',
        publisher: NPB_ORG,
        checkNote: '在12球團的頁面確認2021–2025年被指名的615名球員的出身（學校、企業、獨立聯盟球團）。未記錄球員姓名。',
      },
      wikiHsResults: {
        title:
          '全國高等學校棒球選手權大會（○○縣代表）與全國高等學校棒球選手權○○大會（Wikipedia；夏季甲子園的勝負，以及都道府縣大會的冠軍與亞軍）',
        original: '全国高等学校野球選手権大会 (○○県勢) と 全国高等学校野球選手権○○大会（Wikipedia。夏の甲子園での勝敗と、都道府県大会の優勝・準優勝）',
        publisher: 'Wikipedia（二手資料；未與日本高等學校棒球聯盟的紀錄逐場比對）',
        checkNote:
          '從47都道府縣的縣代表頁面取得2004–2026年夏季甲子園的勝負，並從各地方大會的頁面取得2011–2025年的冠軍與亞軍學校。冠軍學校606筆與日本高等學校棒球聯盟的代表學校一覽100%一致。宮崎、兵庫、山口的地方大會僅能讀取部分。春季與秋季的都道府縣大會未能取得。',
      },
      wikiJubfLeagues: {
        title: '全日本大學棒球聯盟（Wikipedia；加盟聯盟一覽與加盟學校數）',
        original: '全日本大学野球連盟（Wikipedia。加盟連盟の一覧と加盟校数）',
        publisher: WIKI_LEAGUES,
        checkNote: '確認27個加盟聯盟（北海道2、東北3、關東甲信越7、北陸東海3、關西5、中國四國3、九州4）的名稱與加盟學校數。未列出各聯盟的加盟大學名稱。',
      },
      wikiUnivLeagueMembers: {
        title: '東京六大學棒球聯盟、東都大學棒球聯盟、關西學生棒球聯盟、首都大學棒球聯盟、關西六大學棒球聯盟（Wikipedia；加盟大學）',
        original: '東京六大学野球連盟・東都大学野球連盟・関西学生野球連盟・首都大学野球連盟・関西六大学野球連盟（Wikipedia。加盟大学）',
        publisher: 'Wikipedia（二手資料；未與各聯盟官方網站比對）',
        checkNote:
          '確認以下大學名稱：東京六大學6校、東都1–4部22校（2026年春季聯賽開始時）、關西學生6校、首都1、2部16校（2025年秋季聯賽結束時）、關西六大學6校。其他21個聯盟的加盟大學名稱未確認。',
      },
      jpbpaGuide2022: {
        title: '給以成為職棒球員為目標的球員與家人（2022年版）',
        original: 'プロ野球選手を目指す選手・ご家族の皆さんへ（2022年版）',
        publisher: JPBPA,
        checkNote:
          '在第5頁「球員合約的內容」表格中，確認支配下的最低年薪{yen~:4200000}（稅前）、育成{yen~:2300000}（稅前），以及支配下的追加參稼報酬「（1,600萬日圓－年薪）/150×一軍登錄天數」（育成則無）。資料為2022年版，2025、2026年度的金額與規定尚未確認（野球協約的條文本身並未公開，未確認）。遊戲依擁有者的指示，以此表中支配下的最低年薪{yen~:4200000}與追加參稼報酬作為2025年度的基準。遊戲中育成的最低年薪為{yen~:2400000}，與此表的{yen~:2300000}（稅前）不一致。{yen~:2400000}的依據未確認，數值依擁有者的指示維持不變。',
      },
      salary2026: {
        title: '2026年職棒球員平均年薪為5,216萬日圓（2026年5月18日）',
        original: '2026年のプロ野球選手平均年俸は5216万円（2026年5月18日）',
        publisher: `nippon.com（${JPBPA}的調查）`,
        checkNote: '確認公示為支配下選手的日本籍球員713人，平均{yen~:52160000}，中位數{yen~:20000000}。',
      },
      mextHealth2024: {
        title: '令和6年度（2024年度）學校保健統計（學校保健統計調查結果）確定值（2025年2月12日公布）',
        original: '令和6年度学校保健統計（学校保健統計調査の結果）確定値（2025年2月12日公表）',
        publisher: MEXT,
        checkNote:
          '確認男生各年齡（5–17歲，4月1日當時的足歲）身高與體重的平均值（例：17歲 170.8cm、62.2kg）。為抽樣調查（發育狀態為全體幼兒、兒童、學生的5.2%）。',
      },
      mhlwWage2025: {
        title: '令和7（2025）年薪資結構基本統計調查概況「依性別觀察的薪資」第2表',
        original: '令和7(2025)年賃金構造基本統計調査の概況「性別にみた賃金」第2表',
        publisher: MHLW,
        checkNote:
          '確認男性各年齡層的薪資（千日圓）：19歲以下212.5、20–24歲245.7、25–29歲288.0、30–34歲330.4、35–39歲366.2、40–44歲398.2、45–49歲420.7、50–54歲437.5、55–59歲445.6、60–64歲358.5、65–69歲304.3。「薪資」的定義（所定內給與額等）未寫在此頁面，因此未確認。',
      },
      ipssPop2024T0623: {
        title: '人口統計資料集（2024）表6-23 依性別的50歲時未婚比例、有配偶比例、喪偶比例與離婚比例：1920–2020年',
        original: '人口統計資料集（2024）表6-23 性別50歳時の未婚割合，有配偶割合，死別割合および離別割合：1920～2020年',
        publisher: '國立社會保障・人口問題研究所',
        checkNote:
          '確認表中「男・未婚」2020年的數值28.25%（2010年20.14%、2015年24.77%）。表的附註：依總務省統計局《國勢調查報告》計算。為45–49歲與50–54歲比例的平均值。2015年與2020年依據補足不詳值後的數值。',
      },
      statLabor2025: {
        title: '勞動力調查（基本統計）2025年（令和7年）平均結果摘要',
        original: '労働力調査（基本集計）2025年（令和7年）平均結果の要約',
        publisher: '總務省統計局',
        checkNote: '確認2025年平均的完全失業率2.5%，男性2.7%。',
      },
      mhlwLife2025: {
        title: '令和7（2025）年簡易生命表概況「主要年齡的平均餘命」',
        original: '令和7(2025)年簡易生命表の概況「主な年齢の平均余命」',
        publisher: MHLW,
        checkNote: '確認男性平均壽命81.35年（前一年81.09年）、男性10歲時的平均餘命71.60年。',
      },
      ncaa: {
        title: 'Baseball: Probability of competing beyond high school',
        publisher: 'NCAA',
        checkNote: '2026-10-17：此URL被轉址至NCAA首頁，無法開啟頁面。數值未確認。',
      },
      baDraftRounds: {
        title: 'How Many MLB Draftees Make It To The Majors（2019年5月17日，J.J. Cooper）',
        publisher: 'Baseball America',
        checkNote: '確認1981–2010年簽約的被指名球員升上大聯盟的比例：第1輪73%、第2輪51%、第3輪40%。未記載第4輪以後的數值。',
      },
      bpDraftRounds: {
        title: 'The Baseball Draft: A 50-Year Retrospective, Part Two（2014年6月9日，Allan Simpson）',
        publisher: 'Baseball Prospectus',
        checkNote: '確認第1輪69.0%（1965–2009年，1,198人中827人）、第2輪46.5%、第3輪37.8%、第4輪31.3%。第2輪以後的對象年份未記載。',
      },
      witnauer: {
        title: 'Witnauer et al. 2007（MLB野手的平均生涯）',
        publisher: '科羅拉多大學（University of Colorado）',
        checkNote: '確認1902–1993年開始生涯的野手5,989人平均為5.6年，且每5人中有1人只打了1年。',
      },
      mlbRoster2025: {
        title: '2025年開幕日名單中的外國出生球員',
        publisher: 'MLB',
        checkNote: `2026-10-17：伺服器回傳HTTP 406，頁面${NOT_OPENED}`,
      },
      bloombergIntl: {
        title: 'Dominican Republic seeks fair play for young ballplayers eyeing MLB（2022年10月18日）',
        publisher: 'Bloomberg Línea',
        checkNote: '確認2012–16年簽約的多明尼加球員2,294人中，有110人進入MLB球團。2024–25年國際簽約1,011人與「3–5%」的敘述不在此文章中。',
      },
      kbo2026: {
        title: 'KBO 2026年選秀的新聞報導',
        publisher: '國民日報（kukinews）',
        checkNote: `2026-10-17：伺服器回傳HTTP 403，頁面${NOT_OPENED}`,
      },
      cpbl2025: {
        title: '中職／180人搶進六隊窄門！（2025年6月20日）',
        original: '中職／180人搶進六隊窄門！（2025年6月20日）',
        publisher: 'TVBS',
        checkNote: '確認2025年選秀報名180人，其中72人為當年度應屆畢業的高中生。',
      },
      elbowStudy: {
        title: '原田幹生等〈針對少年棒球選手運用超音波的手肘檢查〉《臨床整形外科》第42卷第6期 第555–560頁（2007年6月）',
        original: '原田幹生ほか「少年野球選手に対する超音波を用いた肘検診」臨床整形外科 42巻6号 pp.555-560（2007年6月）',
        publisher: '醫學書院（山形大學醫學部整形外科等）',
        checkNote:
          '在摘要中確認，小學棒球隊球員247名中，有48名經超音波發現肱骨內上髁撕脫。摘要中未記載對象的地區與性別。先前的出處（信州大學網站上的PDF）是筑波大學的另一項研究，其中沒有此數值。',
      },
      fangraphsTJ: {
        title: 'Ten interesting facts about Tommy John surgery（2018年4月18日，Jon Roegele）',
        publisher: 'FanGraphs（The Hardball Times）',
        checkNote: '確認2017年登板的MLB投手中，有26%曾接受此手術。',
      },
      nchsDb548: {
        title: 'Mortality in the United States, 2024（NCHS Data Brief No. 548，2026年1月）',
        publisher: 'CDC・美國國家衛生統計中心（NCHS）',
        checkNote:
          '2026-10-19：在頁面本文中確認，2024年確定值的出生時平均餘命為男性76.5年（2023年為75.8年）、女性81.4年、男女合計79.0年。未取得10歲時的平均餘命。',
      },
      mlbRule4: {
        title: 'Rule 4 Draft（MLB官方用語集）與2026 MLB Draft概要',
        publisher: 'MLB',
        checkNote:
          '2026-10-19：以搜尋結果的摘要確認（未取得頁面本文全文）。依2022–26年勞資協議，選秀為20輪。對象為高中畢業且未進入大學的球員，以及在二年制學院就讀1年以上的球員（二年制學院學生全員皆具資格）。4年制大學則在讀完3年級後或年滿21歲時。須為美國或加拿大居民。自2028年起的資格變更（20歲以上、高中畢業後2年）是MLB的提案，並非現行規定。',
      },
      mlbServiceTime: {
        title: 'Service Time、Free Agency、Salary Arbitration（MLB官方用語集）',
        publisher: 'MLB',
        checkNote:
          '2026-10-19：以搜尋結果的摘要確認（未取得本文全文）。1個球季為187天，在現役名單或傷兵名單上的1天算1天，172天算1年服務年資。6年取得FA，3年取得薪資仲裁（年資2–3年的球員中，前一年達86天以上的前22%為Super Two，可進行仲裁；門檻每年變動）。',
      },
    }
  })(),

  unit: {
    人: '人',
    校: '所',
    割合: '比例',
    チーム: '隊',
    歳: '歲',
    年: '年',
    万円: '萬日圓',
    年あたり: '每年',
    対数の標準偏差: '對數標準差',
    年あたりの自己相関: '每年自我相關',
    標準偏差: '標準差',
    cm: 'cm',
    kg: 'kg',
    '点／標準偏差': '分／標準差',
    'km/h': 'km/h',
    '-': '-',
    点: '分',
    '千円（月額）': '千日圓（月額）',
    か月分: '個月份',
    巡: '輪',
  },

  name: {
    四国アイランドリーグplus: '四國島聯盟plus',
    ルートインBCリーグ: 'Route Inn BC聯盟',
    日本海リーグ: '日本海聯盟',
    北海道: '北海道',
    東北: '東北',
    北信越: '北信越',
    関東: '關東',
    東海: '東海',
    近畿: '近畿',
    中国: '中國地區',
    四国: '四國',
    九州: '九州',
    東京大学: '東京大學',
    京都大学: '京都大學',
    大阪大学: '大阪大學',
    東北大学: '東北大學',
    名古屋大学: '名古屋大學',
    九州大学: '九州大學',
    北海道大学: '北海道大學',
    一橋大学: '一橋大學',
    東京科学大学: '東京科學大學',
    早稲田大学: '早稻田大學',
    慶應義塾大学: '慶應義塾大學',
    上智大学: '上智大學',
    明治大学: '明治大學',
    青山学院大学: '青山學院大學',
    立教大学: '立教大學',
    中央大学: '中央大學',
    法政大学: '法政大學',
    関西大学: '關西大學',
    関西学院大学: '關西學院大學',
    同志社大学: '同志社大學',
    立命館大学: '立命館大學',
  },

  exam: {
    keinetRanking2027: '河合塾全統模擬考的邊界偏差值（錄取可能性50%的分數線；2026年10月時點的預測）',
    jukelabo2026univ: 'Jukelabo補習班公布的大學偏差值（計算依據的模擬考未註明）',
    jukelabo2026: 'Jukelabo補習班公布的高中偏差值（計算依據的模擬考未註明）',
  },
}
