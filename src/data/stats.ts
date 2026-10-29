import type { Stat } from './types.ts'

// Every number the model uses or shows lives here with its provenance (PROJECT_PLAN §6.1, §6.4).
// J6 (2026-10-17): every source in §6.4 was opened again; values, definitions and dates were read
// from the source (see sources.ts `checkNote`). Sex coverage follows the 2026-10-17 decision (§6.1):
// 'male' only when the source says so; 'unstated' when the population is stated but the source has no
// sex breakdown (shown as 参考値, used for the male career model); 'unknown' stays 未確認.
// `unverified` stays true when the value, its source, or who is counted is not confirmed.
// "assumption" values have no data behind them; they are model settings and are labelled as such.

const S = (s: Stat): Stat => s

/**
 * A value whose figures and definition were confirmed in the source, but whose source gives no sex
 * breakdown (sex: 'unstated'). `target` is who is counted, as the source states it.
 */
const ref = (target: string, extra = '') =>
  `集計対象: ${target}。数値と定義は出典で確認済み（2026-10-17）。出典に男女の区分の記載がないため、男子だけの値とは断定せず、男子の進路モデルの参考値として使う。${extra}`
/** the same, for a value computed from such figures */
const refDerived = (target: string, extra = '') =>
  `集計対象: ${target}。元の数値は出典で確認済み（2026-10-17）。元の統計に男女の区分の記載がないため、男子だけの値とは断定せず、男子の進路モデルの参考値として使う。${extra}`
const NO_DATA = 'データがないモデル上の設定。'

// figures read from the sources (J6)
const HS_SENIORS_2025 = 40842 // 日本高野連 2025年5月末の3年生部員
const HS_PLAYERS_2026 = 124116
const CAREER_TOTAL_2021_25 = 143 + 145 + 153 + 157 + 169 // 767
const TENURE_2021_25 = (7.3 * 143 + 7.7 * 145 + 6.8 * 153 + 6.3 * 157 + 6.8 * 169) / CAREER_TOTAL_2021_25
const AGE_2021_25 = (27.8 * 143 + 27.8 * 145 + 27.1 * 153 + 26.3 * 157 + 27.2 * 169) / CAREER_TOTAL_2021_25

export const STATS: Record<string, Stat> = {
  // ---------------------------------------------------------------- Japan: measured / reported
  jpHsPlayers: S({
    id: 'jpHsPlayers', value: HS_PLAYERS_2026, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '日本高野連 加盟校の硬式野球部員', definition: '全学年の部員数の合計（男女・マネージャーを含むかは出典に記載なし）',
    asOf: '2026年5月末', sourceIds: ['jhbf'], sourceType: 'primary', unverified: false,
    verifyNote: ref('日本高野連の加盟校の硬式野球部員（全学年、2026年5月末）', 'マネージャーを含むかも出典に記載がない。'),
    note: 'タイトル「12万分の1」の分母。プロになる確率ではない。',
  }),
  jpHsFirstYears: S({
    id: 'jpHsFirstYears', value: 43836, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '日本高野連 加盟校の硬式野球部員', definition: '1年生の部員数', asOf: '2026年5月末',
    sourceIds: ['jhbf'], sourceType: 'primary', unverified: false,
    verifyNote: ref('日本高野連の加盟校の硬式野球部員のうち1年生（2026年5月末）', 'マネージャーを含むかも出典に記載がない。'),
  }),
  jpHsSeniors2025: S({
    id: 'jpHsSeniors2025', value: HS_SENIORS_2025, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '日本高野連 加盟校の硬式野球部員', definition: '3年生の部員数', asOf: '2025年5月末',
    sourceIds: ['jhbf'], sourceType: 'primary', unverified: false,
    verifyNote: ref('日本高野連の加盟校の硬式野球部員のうち3年生（2025年5月末、過去の表）', 'マネージャーを含むかも出典に記載がない。'),
  }),
  jpHsSchools: S({
    id: 'jpHsSchools', value: 3746, unit: '校', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '日本高野連（硬式）', definition: '加盟校数', asOf: '2026年5月末',
    sourceIds: ['jhbf'], sourceType: 'primary', unverified: false,
    verifyNote: ref('日本高野連の硬式の加盟校（2026年5月末）', '学校の数で、男女の区分は示されていない。'),
  }),
  jpHsComplete: S({
    id: 'jpHsComplete', value: 0.903, unit: '割合', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '高校の硬式野球部員', definition: '継続率＝3年生部員数 ÷ 入学年度の1年生部員数（中途加入部員を含む）', asOf: '2026年5月末',
    sourceIds: ['jhbf'], sourceType: 'primary', unverified: false,
    verifyNote: ref('日本高野連の加盟校の硬式野球部員（2026年の3年生と、2024年の1年生）'),
    note: '途中から入部した人も3年生に数えるため、同じ人が3年続けた割合そのものではない。',
  }),
  jpTeamsTotal: S({
    id: 'jpTeamsTotal', value: 3363, unit: 'チーム', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2026年夏の地方大会', definition: '参加チーム数（連合チーム157を含む）', asOf: '2026年夏',
    sourceIds: ['daily2026'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2026年夏の全国高校野球選手権の地方大会に参加したチーム（報道）', 'チームの数で、男女の区分は示されていない。'),
  }),
  jpTeamsAichi: S({
    id: 'jpTeamsAichi', value: 174, unit: 'チーム', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2026年夏の地方大会（愛知）', definition: '参加チーム数（最多）', asOf: '2026年夏',
    sourceIds: ['daily2026'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2026年夏の愛知大会に参加したチーム（報道）', 'チームの数で、男女の区分は示されていない。'),
  }),
  jpTeamsTottori: S({
    id: 'jpTeamsTottori', value: 21, unit: 'チーム', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2026年夏の地方大会（鳥取）', definition: '参加チーム数（最少）', asOf: '2026年夏',
    sourceIds: ['daily2026'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2026年夏の鳥取大会に参加したチーム（報道）', 'チームの数で、男女の区分は示されていない。'),
  }),
  jpJhsSoft: S({
    id: 'jpJhsSoft', value: 139240, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '中体連の軟式野球', definition: '選手数（全学年。日本中学校体育連盟 軟式野球競技部の調査）', asOf: '2025年',
    sourceIds: ['npbJhs'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('中体連の軟式野球部に所属する部員・選手（2025年。NPB の記事が中体連の調査を引用）', '中体連の元の資料は今回開いていない。'),
  }),
  jpDraftTotal: S({
    id: 'jpDraftTotal', value: 116, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフト', definition: '指名された人数（支配下73・育成43）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2025年の NPB ドラフト会議で指名された選手（報道の集計）'),
  }),
  jpDraftFromHs: S({
    id: 'jpDraftFromHs', value: 33, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフト', definition: '高校生の指名数（支配下19・育成14）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2025年の NPB ドラフト会議で指名された高校生（報道の集計）'),
  }),
  jpDraftFromUniv: S({
    id: 'jpDraftFromUniv', value: 54, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフト', definition: '大学生の指名数（海外の大学を含む。支配下40・育成14）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2025年の NPB ドラフト会議で指名された大学生（海外の大学を含む。報道の集計）'),
  }),
  jpDraftFromCompany: S({
    id: 'jpDraftFromCompany', value: 13, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフト', definition: '社会人の指名数（支配下12・育成1）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2025年の NPB ドラフト会議で指名された社会人野球の選手（報道の集計）'),
  }),
  jpDraftFromIndep: S({
    id: 'jpDraftFromIndep', value: 13, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフト', definition: '独立リーグからの指名数（支配下1・育成12）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2025年の NPB ドラフト会議で指名された独立リーグの選手（報道の集計）'),
  }),
  jpShibouHs: S({
    id: 'jpShibouHs', value: 124, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2025年 プロ志望届', definition: '高校生の提出者数', asOf: '2025年',
    sourceIds: ['numberShibou'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2025年にプロ志望届を出した高校生（記事中の記述）'),
  }),
  jpShibouUniv: S({
    id: 'jpShibouUniv', value: 176, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: '2025年 プロ志望届', definition: '大学生の提出者数', asOf: '2025年',
    sourceIds: ['numberShibou'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2025年にプロ志望届を出した大学生（記事中の記述）'),
  }),
  jpIkuseiPromoted: S({
    id: 'jpIkuseiPromoted', value: 32, unit: '人', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: 'NPB 12球団の育成選手', definition: '育成から支配下へ移った人数（2023年、記事時点の8月まで）', asOf: '2023年',
    sourceIds: ['numberIkusei'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('2023年（記事の時点まで）に育成から支配下登録された NPB 12球団の選手'),
  }),
  jpReleaseAge: S({
    id: 'jpReleaseAge', value: AGE_2021_25, unit: '歳', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2021〜2025年に戦力外・引退した NPB 選手 767人（外国人と同一球団での育成再契約を除く）',
    definition: '各年の平均年齢（26.3〜27.8歳）を対象人数で重みづけした平均', asOf: '2021〜2025年',
    sourceIds: ['npbCareerTrend'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('2021〜2025年に戦力外・現役引退となった NPB の選手767人（外国人と、同一球団での育成再契約を除く。NPB の調査）'),
  }),
  jpTenure: S({
    id: 'jpTenure', value: TENURE_2021_25, unit: '年', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2021〜2025年に戦力外・引退した NPB 選手 767人（外国人と同一球団での育成再契約を除く）',
    definition: '各年の平均在籍期間（6.3〜7.7年）を対象人数で重みづけした平均', asOf: '2021〜2025年',
    sourceIds: ['npbCareerTrend'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('2021〜2025年に戦力外・現役引退となった NPB の選手767人（NPB の調査）'),
  }),
  jpCareerNpb: S({
    id: 'jpCareerNpb', value: 438 / CAREER_TOTAL_2021_25, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2021〜2025年に戦力外・引退した NPB 選手 767人', definition: '進路が NPB 関係（選手・育成・コーチ・球団職員など）。5年分の人数の合計438人から計算', asOf: '2021〜2025年',
    sourceIds: ['npbCareerTrend'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('2021〜2025年に戦力外・現役引退となった NPB の選手767人の進路（NPB の調査）'),
  }),
  jpCareerOtherBaseball: S({
    id: 'jpCareerOtherBaseball', value: 188 / CAREER_TOTAL_2021_25, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2021〜2025年に戦力外・引退した NPB 選手 767人', definition: '進路がその他の野球（独立・社会人・海外など）。合計188人から計算', asOf: '2021〜2025年',
    sourceIds: ['npbCareerTrend'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('2021〜2025年に戦力外・現役引退となった NPB の選手767人の進路（NPB の調査）'),
  }),
  jpCareerNonBaseball: S({
    id: 'jpCareerNonBaseball', value: 82 / CAREER_TOTAL_2021_25, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2021〜2025年に戦力外・引退した NPB 選手 767人', definition: '進路が野球以外。合計82人から計算', asOf: '2021〜2025年',
    sourceIds: ['npbCareerTrend'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('2021〜2025年に戦力外・現役引退となった NPB の選手767人の進路（NPB の調査）'),
  }),
  jpCareerUndecided: S({
    id: 'jpCareerUndecided', value: 59 / CAREER_TOTAL_2021_25, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2021〜2025年に戦力外・引退した NPB 選手 767人', definition: '進路が未定・不明。合計59人から計算', asOf: '2021〜2025年',
    sourceIds: ['npbCareerTrend'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('2021〜2025年に戦力外・現役引退となった NPB の選手767人の進路（NPB の調査）'),
  }),
  jpSalaryMedian: S({
    id: 'jpSalaryMedian', value: 2000, unit: '万円', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: 'NPB 支配下公示の日本人選手 713人', definition: '年俸の中央値（日本プロ野球選手会の調査）', asOf: '2026年',
    sourceIds: ['salary2026'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('12球団の支配下公示の日本人選手713人（日本プロ野球選手会の調査、2026年）'),
  }),
  npbMinSalary: S({
    id: 'npbMinSalary', value: 420, unit: '万円', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: 'NPB 支配下選手', definition: '支配下選手の年俸（参稼報酬）の最低額（税別）',
    asOf: '2022年版の資料。ゲームでは2025年度の基準として使い、2025・2026年度の額は確認できていない',
    sourceIds: ['jpbpaGuide2022'], sourceType: 'secondary', unverified: false,
    verifyNote: '集計対象: NPBの支配下選手（日本プロ野球選手会の資料〈2022年版〉p.5の表）。420万円（税別）と定義は出典で確認済み（2026-10-22）。資料は2022年版で、2025・2026年度の額は確認できていない（野球協約の条文そのものは公開されていない）。出典に男女の区分の記載がないため、男子だけの値とは断定せず、男子の進路モデルの参考値として使う。',
  }),
  npbFirstTeamMin: S({
    id: 'npbFirstTeamMin', value: 1600, unit: '万円', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: 'NPB 支配下選手', definition: '一軍の最低保障：年俸1,600万円未満の選手に、一軍の出場選手登録1日につき（1,600万円－年俸）÷150を追加参稼報酬として支払う（150日で年俸と合わせて1,600万円）',
    asOf: '2022年版の資料。ゲームでは2025年度の基準として使い、2025・2026年度の規定は確認できていない',
    sourceIds: ['jpbpaGuide2022'], sourceType: 'secondary', unverified: false,
    verifyNote: '集計対象: NPBの支配下選手（日本プロ野球選手会の資料〈2022年版〉p.5の表）。1,600万円・150日の式と定義は出典で確認済み（2026-10-22）。資料は2022年版で、2025・2026年度の規定は確認できていない（野球協約の条文そのものは公開されていない）。出典に男女の区分の記載がないため、男子だけの値とは断定せず、男子の進路モデルの参考値として使う。ゲームでは一軍登録の日数を記録していないため、FA権の換算と同じ「一軍の1シーズン分の割合」×150日で数える（モデル上の換算）。',
  }),
  jpSalaryMean: S({
    id: 'jpSalaryMean', value: 5216, unit: '万円', kind: 'measured', domain: 'baseball', sex: 'unstated',
    population: 'NPB 支配下公示の日本人選手 713人', definition: '年俸の平均（日本プロ野球選手会の調査）', asOf: '2026年',
    sourceIds: ['salary2026'], sourceType: 'secondary', unverified: false,
    verifyNote: ref('12球団の支配下公示の日本人選手713人（日本プロ野球選手会の調査、2026年）'),
  }),
  elbowYouth: S({
    id: 'elbowYouth', value: 48 / 247, unit: '割合', kind: 'measured', domain: 'baseball', sex: 'unknown',
    population: '小学校野球チームの選手 247人（山形大学などの研究、2007年発表）', definition: '超音波で上腕骨内上顆（肘の内側）の裂離が見つかった割合（個別の研究）', asOf: '2007年',
    sourceIds: ['elbowStudy'], sourceType: 'primary', unverified: true,
    verifyNote: '数値は論文の抄録で確認済み（2026-10-17）。抄録には対象の地域・男女・学年の記載がなく、進路モデルにも使わないため、未確認のままにする。',
    note: '1つの研究。全国の値ではない。',
  }),

  // ---------------------------------------------------------------- Japan: estimates derived from the above
  jpHsFile: S({
    id: 'jpHsFile', value: 124 / HS_SENIORS_2025, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '高校3年の硬式野球部員', definition: '2025年のプロ志望届（高校生124人）÷ 2025年5月末の3年生部員（40,842人）', asOf: '2025年',
    sourceIds: ['numberShibou', 'jhbf'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('分子は2025年にプロ志望届を出した高校生、分母は日本高野連の2025年5月末の3年生部員', '出典の違う2つの数の比。'),
  }),
  jpHsDraftGivenFile: S({
    id: 'jpHsDraftGivenFile', value: 33 / 124, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: 'プロ志望届を出した高校生', definition: '高校生の指名数 ÷ 高校生の提出者数', asOf: '2025年',
    sourceIds: ['hbnDraft', 'numberShibou'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('2025年にプロ志望届を出した高校生124人と、そのうち指名された33人（2つの報道）'),
  }),
  jpUnivDraftGivenFile: S({
    id: 'jpUnivDraftGivenFile', value: 54 / 176, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: 'プロ志望届を出した大学生', definition: '大学生の指名数 ÷ 大学生の提出者数（指名数は海外の大学を含む）', asOf: '2025年',
    sourceIds: ['hbnDraft', 'numberShibou'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('2025年にプロ志望届を出した大学生176人と、指名された大学生54人（2つの報道。指名数は海外の大学を含む）'),
  }),
  jpShihaikaHs: S({
    id: 'jpShihaikaHs', value: 19 / 33, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフトで指名された高校生 33人', definition: '支配下での指名の割合（1年分）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('2025年の NPB ドラフトで指名された高校生33人（報道の集計）', '1年分のデータ。'),
  }),
  jpShihaikaUniv: S({
    id: 'jpShihaikaUniv', value: 40 / 54, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフトで指名された大学生 54人', definition: '支配下での指名の割合（1年分）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('2025年の NPB ドラフトで指名された大学生54人（報道の集計）', '1年分のデータ。'),
  }),
  jpShihaikaCompany: S({
    id: 'jpShihaikaCompany', value: 12 / 13, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフトで指名された社会人 13人', definition: '支配下での指名の割合（1年分、少人数）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('2025年の NPB ドラフトで指名された社会人野球の選手13人（報道の集計）', '1年分・13人だけのデータ。'),
  }),
  jpShihaikaIndep: S({
    id: 'jpShihaikaIndep', value: 1 / 13, unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2025年 NPB ドラフトで指名された独立リーグの選手 13人', definition: '支配下での指名の割合（1年分、少人数）', asOf: '2025年',
    sourceIds: ['hbnDraft'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('2025年の NPB ドラフトで指名された独立リーグの選手13人（報道の集計）', '1年分・13人だけのデータ。'),
  }),
  jpKoshien: S({
    id: 'jpKoshien', value: 1620 / (HS_PLAYERS_2026 / 3), unit: '割合', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '高校の硬式野球部員（1学年）', definition: '在学中に甲子園でベンチ入りする割合。春32校・夏49校 × 20人の枠（年1,620）を、1学年あたりの部員数（124,116÷3）で割った',
    asOf: '2026年', sourceIds: ['jhbf'], sourceType: 'primary', unverified: true,
    verifyNote: '集計対象: 日本高野連の加盟校の硬式野球部員（2026年5月末の全学年を3で割った1学年あたり）と、甲子園の春夏の出場枠。部員数は出典で確認済み（2026-10-17）。出場校数（春32・夏49）とベンチ入り人数（20人）は今回の確認で出典を開いていないため、未確認のままにする。部員数に男女の区分の記載はない。',
    note: '1つの枠を1学年の1人と数える仮定を含む。',
  }),
  jpNpbExit: S({
    id: 'jpNpbExit', value: 1 / TENURE_2021_25, unit: '年あたり', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: 'NPB の選手', definition: '1年あたりに球団を離れる確率。2021〜2025年の平均在籍期間の逆数（毎年同じ確率という仮定）', asOf: '2021〜2025年',
    sourceIds: ['npbCareerTrend'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('2021〜2025年に戦力外・現役引退となった NPB の選手767人の平均在籍期間（NPB の調査）', '「毎年同じ確率」はモデルの仮定。'),
  }),
  jpSalarySigma: S({
    id: 'jpSalarySigma', value: Math.sqrt(2 * Math.log(5216 / 2000)), unit: '対数の標準偏差', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: 'NPB 支配下の日本人選手', definition: '年俸を対数正規分布と仮定し、中央値と平均から求めた散らばり', asOf: '2026年',
    sourceIds: ['salary2026'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('12球団の支配下公示の日本人選手713人の年俸（日本プロ野球選手会の調査）', '対数正規分布はモデルの仮定。'),
  }),
  jpPrefTeamsOther: S({
    id: 'jpPrefTeamsOther', value: (3363 - 174 - 21) / 45, unit: 'チーム', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '2026年夏の地方大会（愛知・鳥取以外）', definition: '愛知・鳥取以外の45都道府県の平均（連合チームを含む。北海道・東京の2地区制は考えていない）', asOf: '2026年夏',
    sourceIds: ['daily2026'], sourceType: 'secondary', unverified: false,
    verifyNote: refDerived('2026年夏の地方大会の参加チーム（報道の全国合計と最多・最少）', 'チームの数で、男女の区分は示されていない。'),
  }),

  // ---------------------------------------------------------------- Japan: assumptions (no data yet)
  jpJhsContinue: S({
    id: 'jpJhsContinue', value: 0.75, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '学童野球をしていた子', definition: '中学でも野球を続ける割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA, note: '学童の選手数のデータがないため仮定。',
  }),
  jpHsJoin: S({
    id: 'jpHsJoin', value: 0.70, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '中学で野球をしていた子', definition: '高校で硬式野球部に入る割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
    note: '中学硬式クラブの選手数が分からないため仮定。軟式（中体連）の1学年は約4.6万人、高校1年生は約4.4万人。',
  }),
  jpToUniv: S({
    id: 'jpToUniv', value: 0.20, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '高校3年まで硬式野球を続けた選手', definition: '大学で野球を続ける割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpToCompany: S({
    id: 'jpToCompany', value: 0.012, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '高校・大学を終えた選手', definition: '社会人野球の企業チームに入る割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpToIndep: S({
    id: 'jpToIndep', value: 0.006, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '高校・大学を終えた選手', definition: '独立リーグに入る割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpUnivComplete: S({
    id: 'jpUnivComplete', value: 0.85, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '大学の野球部員', definition: '4年まで続ける割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpUnivFile: S({
    id: 'jpUnivFile', value: 0.03, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '大学4年の野球部員', definition: 'プロ志望届を出す割合（提出者176人と、大学の部員数の仮定から）', asOf: '-',
    sourceIds: ['numberShibou'], sourceType: 'secondary', unverified: true, verifyNote: '大学の部員数のデータがないため、割合は仮定。',
  }),
  jpUnivToCompany: S({
    id: 'jpUnivToCompany', value: 0.06, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '大学4年まで野球を続けた選手', definition: '社会人野球の企業チームに入る割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpUnivToIndep: S({
    id: 'jpUnivToIndep', value: 0.02, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '大学4年まで野球を続けた選手', definition: '独立リーグに入る割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpIkuseiExit: S({
    id: 'jpIkuseiExit', value: 0.25, unit: '年あたり', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'NPB の育成選手', definition: '1年あたりに球団を離れる確率', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpCompanyDraft: S({
    id: 'jpCompanyDraft', value: 0.015, unit: '年あたり', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '社会人野球の選手', definition: '1年あたりに NPB から指名される確率', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpIndepDraft: S({
    id: 'jpIndepDraft', value: 0.025, unit: '年あたり', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '独立リーグの選手', definition: '1年あたりに NPB から指名される確率', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpIkuseiPromote: S({
    id: 'jpIkuseiPromote', value: 0.09, unit: '年あたり', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'NPB の育成選手', definition: '1年あたりに支配下へ上がる確率（年32人と、育成選手の人数の仮定から）', asOf: '-',
    sourceIds: ['numberIkusei'], sourceType: 'secondary', unverified: true, verifyNote: '12球団の育成選手の総数のデータがないため、割合は仮定。',
  }),
  jpIchigun: S({
    id: 'jpIchigun', value: 0.35, unit: '年あたり', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'NPB 支配下で、まだ1軍に出ていない選手', definition: '1年あたりに1軍で初出場する確率', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  jpMlb: S({
    id: 'jpMlb', value: 0.004, unit: '年あたり', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'NPB の1軍経験がある選手', definition: '1年あたりに MLB へ移る確率', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  companyTenure: S({
    id: 'companyTenure', value: 0.18, unit: '年あたり', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '社会人野球・独立リーグの選手', definition: '1年あたりに現役を終える確率', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  abilityRho: S({
    id: 'abilityRho', value: 0.92, unit: '年あたりの自己相関', kind: 'assumption', domain: 'model', sex: 'male',
    population: '野球をしている子・選手', definition: '実力（同学年の中での位置）が翌年まで持ち越される度合い', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  focusEffect: S({
    id: 'focusEffect', value: 0.12, unit: '標準偏差', kind: 'assumption', domain: 'model', sex: 'male',
    population: '野球をしている子・選手', definition: '「練習」を重点にした年の実力の上がり幅', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),

  // ---------------------------------------------------------------- body growth (general population, boys)
  jpBoyHeight: S({
    id: 'jpBoyHeight', value: 170.8, unit: 'cm', kind: 'measured', domain: 'population', sex: 'male',
    population: '日本の男子（5〜17歳、抽出調査）', definition: '年齢別の身長の平均値（表の値は17歳。5〜17歳の値は body.ts）', asOf: '2024年度',
    sourceIds: ['mextHealth2024'], sourceType: 'primary', unverified: false,
    verifyNote: '出典で確認済み（2026-10-17）。出典の表が「男子」の値として示している。',
  }),
  jpBoyWeight: S({
    id: 'jpBoyWeight', value: 62.2, unit: 'kg', kind: 'measured', domain: 'population', sex: 'male',
    population: '日本の男子（5〜17歳、抽出調査）', definition: '年齢別の体重の平均値（表の値は17歳。5〜17歳の値は body.ts）', asOf: '2024年度',
    sourceIds: ['mextHealth2024'], sourceType: 'primary', unverified: false,
    verifyNote: '出典で確認済み（2026-10-17）。出典の表が「男子」の値として示している。',
  }),
  jpHsMembersPerSchool: S({
    id: 'jpHsMembersPerSchool', value: HS_PLAYERS_2026 / 3746, unit: '人', kind: 'estimate', domain: 'baseball', sex: 'unstated',
    population: '日本高野連 加盟校', definition: '1校あたりの硬式野球部員数（部員数124,116 ÷ 加盟校3,746。出典の表の「平均」33.1と一致）', asOf: '2026年5月末',
    sourceIds: ['jhbf'], sourceType: 'primary', unverified: false,
    verifyNote: refDerived('日本高野連の加盟校の硬式野球部員と加盟校数（2026年5月末）'),
  }),
  // abilities and team model (no data: model settings, shown as モデル上の値)
  abilityModel: S({
    id: 'abilityModel', value: 15, unit: '点／標準偏差', kind: 'assumption', domain: 'model', sex: 'male',
    population: '野球をしている子・選手', definition: '能力の表示（0〜100）は、同じ年代で野球をしている人の中での位置。総合の実力（較正済み）に、ポジションや練習で決まる得意・不得意を足したもの', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  velocityModel: S({
    id: 'velocityModel', value: 127, unit: 'km/h', kind: 'assumption', domain: 'model', sex: 'male',
    population: '投手', definition: '球速の表示。年齢ごとの基準（17歳で127km/h）に、実力と得意・不得意を足したもの', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '公表された年齢別の球速のデータを確認できていないため、モデル上の設定。',
  }),
  hsTeamModel: S({
    id: 'hsTeamModel', value: 20, unit: '人', kind: 'assumption', domain: 'model', sex: 'male',
    population: '高校の硬式野球部', definition: 'ベンチ入りの人数（ゲーム上の設定）と、チームの人数・強さの決め方', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '大会ごとのベンチ入り人数は今回の確認で出典を開いていないため、ゲーム上の設定（20人）。チームの人数は1校あたりの平均（33.1人）を中心に、強豪はより多いと仮定。',
  }),
  seasonModel: S({
    id: 'seasonModel', value: 25, unit: '人', kind: 'assumption', domain: 'model', sex: 'male',
    population: '大学・社会人・独立リーグ・プロの選手', definition: '高校卒業後のシーズンの決め方（ゲーム上の設定）: ベンチ入りの人数（25人）、試合数（大学のリーグ戦は1シーズン10〜14試合、独立リーグは50〜70試合、プロは1シーズンを通して出た場合に野手143試合・先発25試合・救援55試合、2軍は110・18・40試合）、リーグ戦の順位、大会の勝敗、1軍に出る割合（その年の年俸を決めた実力の位置から）。成績の基準は、このモデルで各段階に進んだ選手の実力の分布（10万人の試行、2026-10-18）と、ゲーム上の打率・本塁打・防御率の基準', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: 'ベンチ入りの人数、試合数、大会の形式は、今回の確認で出典を開いていないため、ゲーム上の設定。大会の名前も確認していないため、一般名で表示する。進路の判定（退部・ドラフト・1軍の初出場・戦力外）は較正済みの確率のままで、試合の結果はそれに合わせて作る。',
  }),
  schoolModel: S({
    id: 'schoolModel', value: 1, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '高校・大学に進む選手', definition: '進学の決め方（ゲーム上の設定）: 女子校（名称に女子・女学院などがあるもの）を除く実在の学校に、野球部があるものとして割り当てる。一般入試の合格の確率は、本人の学力（知識から換算）と学校の難易度（偏差値が未収録の学校は、人生ごとに仮に決めた値）の差から、学校推薦は知識と評価から、スポーツ推薦は、声をかけたチームを野球の強さで選び（偏差値は使わない）、入れるかどうかは本人の評価（能力・守備位置への適性・成長の見込み・実績・故障歴など、evaluationModel）とチームの強さ（teamRatingModel）から決める。第一志望に落ちた場合は併願校に進む', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '学校名は文部科学省の学校コードによる実在の名称。野球部の有無・強さ、入試の難しさ、合格・推薦の確率はすべてゲーム上の仮定で、確認した事実ではない。偏差値は大学のみ河合塾の公開値（2027年度入試のボーダー予想）で、高校は利用できる出典が見つかっていないため未収録。',
  }),
  hsPlayModel: S({
    id: 'hsPlayModel', value: 1, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '高校野球の選手', definition: '高校の個人記録と球速のモデル（ゲーム上の設定）。平均的な選手は打率 約.250・本塁打率 1%・防御率 約4.6・9回あたり奪三振 約6.5。相手は他の高校生（強い学校ほど強い相手と対戦）。投手は、学校の中で自分より投手力が高い選手が多いほど登板の割合が減る（弱い学校のエースはほぼ毎試合、強い学校では分け合う）。練習試合の数は学校の強さで変わる（強い学校ほど多く、弱い学校は少ない）。球速は3年生の投手で中央値127km/h、下位10%が約117km/h、上位1%が約143km/h（2026-10-18に目標値を設定した仮定）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '高校生の記録の分布を示す公的なデータは見つかっていないため、すべてモデル上の値。以前の設定は、平均的な選手でも打率.315・防御率2.6・年に50〜240回を投げるなど、現実より良すぎた。',
  }),
  evaluationModel: S({
    id: 'evaluationModel', value: 1, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '進路を選ぶ選手', definition: '選手の評価（ゲーム上の設定。数値は表示しない）: 総合的な能力に、守備位置への適性（身長は位置ごとにわずかに傾けるだけで、技能が補う）、成長の見込み（年齢と、身長がまだ伸びる余地）、実績（甲子園・主将・レギュラー・優勝・代表）、故障歴、直近の調子、所属チームの強さ、スカウトの注目を足したもの。声がかかる確率と、実際に入れる確率は別々に決める（入部テストだけで入る場合や、クラブチームはそれぞれ別の基準）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '選手の評価やスカウトの評価を数値で示す公的なデータはなく、すべてモデル上の値。身長と守備位置の関係も統計ではなくゲーム上の仮定。',
  }),
  teamRatingModel: S({
    id: 'teamRatingModel', value: 1, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '高校・大学・社会人・独立リーグ・NPB・米国の大学のチーム', definition: 'チームの内部的な強さ（ゲーム上の設定。数値は表示せず、「強豪・上位・中堅」などの言葉と根拠だけで示す）。大学は、加盟する連盟（全日本大学野球連盟の公式ページ）と、その連盟の選手権決勝進出数（2005〜2026）、東都・首都の部、その大学自身の決勝進出から。高校は、甲子園の出場（夏・春、2004〜2026、日本高野連の出場校一覧）から。社会人は日本選手権の出場チーム一覧（公式）から。NPB は直近3年の勝率（NPB の勝敗表）から。米国の大学は NCAA 1部のカンファレンスから。根拠のないチーム（出場記録のない高校、独立リーグ、加盟連盟のない大学）は、設置者・リーグ・チームごとの推定。強いチームほど部員が多く、入る基準が高く、チーム内の競争が厳しい。NPB では、強い球団ほど同じ力でも1軍の出場が少なく、ドラフトは弱い球団が良い選手を多く指名する', asOf: '2026年',
    sourceIds: ['jubfLeagues', 'jubfChampions', 'jhbfSummerOuting', 'jhbfSpringOuting', 'jabaSenshuken2026', 'npbStandings', 'wikiNcaaD1Baseball', 'wikiUnivLeagueMembers'], sourceType: 'primary', unverified: true,
    verifyNote: '連盟の加盟大学・選手権の決勝進出・甲子園の出場・日本選手権の出場・NPB の勝敗は、それぞれ公式の発表で確認（2026-10-18）。東都・首都の部と、米国の大学の一覧は二次資料（Wikipedia）。リーグ・部・出場・勝率から強さの数値を作る式と、根拠のないチームの強さは、ゲーム上の仮定。',
  }),
  scoutModel: S({
    id: 'scoutModel', value: 60, unit: '点', kind: 'assumption', domain: 'model', sex: 'male',
    population: '高校2・3年、大学、社会人・独立リーグの選手', definition: 'スカウトの注目度（0〜100）。次のプロ志望届またはドラフトの判定（較正済み）で選ばれる確率から作り、その年の公式戦の成績で数点上下する。「スカウトが視察に来ている」段階（60以上）は、判定でスカウトが来たと決まったときだけ。指名を約束する値ではない', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: 'スカウトの評価を数値で示す公的なデータはないため、モデル上の値。',
  }),

  // ---------------------------------------------------------------- work and money (general population, men)
  jpWageMale: S({
    id: 'jpWageMale', value: 445.6, unit: '千円（月額）', kind: 'measured', domain: 'population', sex: 'male',
    population: '男性の一般労働者', definition: '年齢階級別の賃金（表の値は最も高い55〜59歳。全年齢階級の値は after.ts）。「賃金」の定義はこの出典のページでは確認していない', asOf: '2025年',
    sourceIds: ['mhlwWage2025'], sourceType: 'primary', unverified: false,
    verifyNote: '出典で確認済み（2026-10-17）。出典の表が「男」の値として示している。',
  }),
  jpUnemployMale: S({
    id: 'jpUnemployMale', value: 0.027, unit: '割合', kind: 'measured', domain: 'population', sex: 'male',
    population: '男性の労働力人口', definition: '完全失業率（年平均）', asOf: '2025年',
    sourceIds: ['statLabor2025'], sourceType: 'primary', unverified: false,
    verifyNote: '出典で確認済み（2026-10-17）。出典が「男性」の値として示している。',
    note: 'ある時点で仕事を探している人の割合で、1年のうちに職を失う確率ではない。',
  }),
  jpNeverMarried50Male: S({
    id: 'jpNeverMarried50Male', value: 0.2825, unit: '割合', kind: 'measured', domain: 'population', sex: 'male',
    population: '日本の男性（45〜54歳）', definition: '50歳時の未婚割合（45〜49歳と50〜54歳の未婚割合の平均。不詳補完値にもとづく）', asOf: '2020年',
    sourceIds: ['ipssPop2024T0623'], sourceType: 'secondary', unverified: false,
    verifyNote: '出典で確認済み（2026-10-17）。出典の表が「男」の値として示している。国勢調査からの算出で、出典は二次集計。',
    note: '2020年の値。ゲームの主人公が50歳になるのは2080年代以降で、その時代の割合は仮定として同じ値を目安にしている。',
  }),
  workModel: S({
    id: 'workModel', value: 14, unit: 'か月分', kind: 'assumption', domain: 'model', sex: 'male',
    population: '働いている人', definition: '年収＝年齢別の月の賃金 × 14か月（賞与を含む仮定）× 勤め先・役職・正規かどうかの倍率。退職金は正規で3年以上勤めた場合に、勤続年数 × 勤め先ごとの額（年25万〜50万円）。昇進・転職・失業・定年の起こりやすさもモデル上の設定', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '賞与の割合、勤め先や役職による差、退職金の額、昇進・転職・失業の確率は、公的統計で確認できていないため仮定。',
  }),
  careerModel: S({
    id: 'careerModel', value: 0, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '野球のあとに、会社勤め以外の道を選んだ人', definition: 'プロゲーマー、配信者、アイドル・歌手・俳優・タレント、漫画家・小説家・イラストレーター、起業、自衛官、議員、解説者・指導者・スカウト・球団フロントの、始まりの年収と、出来事による増減、成功・失敗の起こりやすさ', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '年収の額、成功や人気の伸び方、失敗の起こりやすさは、どれも公的統計で確認できていないゲーム上の仮定。実在の職業の平均収入として扱わない。',
  }),
  licenseModel: S({
    id: 'licenseModel', value: 0, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '医科・歯科・薬科・看護・教育の大学に進んだ人（野球を続けない学生）', definition: '大学の名前から学ぶ分野を決め、6年（医・歯・薬）または4年で卒業。国家試験の合格のしやすさ（1回あたり 医師9割・歯科医師6.5割・薬剤師7割・看護師9割、3回まで）、資格の仕事の初年の年収（医師1,000万円・歯科医師700万円・薬剤師550万円・看護師480万円）、開業などの増減。教育の大学は卒業で教員免許', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '合格のしやすさと年収は、公的統計で確認したものではないゲーム上の仮定。実際の国家試験の合格率や、職業の平均収入として扱わない。',
  }),
  kidBallModel: S({
    id: 'kidBallModel', value: 0, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '日本の人生の、8歳になった息子', definition: '息子が野球を始めるかどうか、中学・高校・甲子園・ドラフト・大学・社会人・独立リーグ・プロの1軍への進み方', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '各段階の進み方は、本人の人生と同じ統計にもとづく割合を、状況を考えずに当てはめた推定。父の経歴が始めやすさと素質をわずかに上げるのはゲーム上の仮定で、親の実績で成功が決まることはない。',
  }),
  householdModel: S({
    id: 'householdModel', value: 0.78, unit: '割合', kind: 'assumption', domain: 'model', sex: 'male',
    population: '18歳以上', definition: '手取りの割合（税と社会保険料を除いた残り）、生活費（手取りの6割＋固定費。子ども1人あたり年30万円。貯金がマイナスの年は15%切り詰める）、配偶者の手取り（年90万円。末の子が3歳未満の間は30万円。60歳まで）、家賃・ローンの返済、年金（年180万円、配偶者の分70万円）の設定。実家に住み、両親とも亡くなったら家を受け継ぐ', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '家計の費用、配偶者の収入、年金の額は、公的統計で確認できていないため仮定。',
  }),
  usHouseholdModel: S({
    id: 'usHouseholdModel', value: 67, unit: '歳', kind: 'assumption', domain: 'model', sex: 'male',
    population: '米国に住む、野球を離れた人', definition: '公的年金は67歳から（満額の目安年250万円。それまでの収入の多さで満額の4〜10割、配偶者がいれば5割を上乗せ）、リタイアは65歳で、67歳までの2年は貯金で暮らす。65歳からの医療費は年30万円、80歳から年55万円。働いている間の収入と、そのほかの家計（手取りの割合・生活費・住居費）は日本向けの設定のまま', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '年金の開始年齢・額・医療費は、このゲームのモデルに合わせた仮定で、米国の制度の数値や統計として確認していない（67歳は、後の生年の満額の開始年齢の目安として置いた）。',
  }),
  lifeEventModel: S({
    id: 'lifeEventModel', value: 0, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '野球を離れた後の人生', definition: '出会い・結婚・子ども・介護・地域活動・病気などの出来事の起こりやすさ', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '出来事の起こりやすさはすべて仮定。出会いと結婚は、おまかせで進めたときの50歳時の未婚割合が統計（jpNeverMarried50Male、28.25%）に近づくよう調整した。初婚年齢、子どもの数、介護・病気などの起こりやすさは、公的統計で確認できていない。',
  }),

  // ---------------------------------------------------------------- general population (not baseball)
  jpLifeMale: S({
    id: 'jpLifeMale', value: 81.35, unit: '年', kind: 'measured', domain: 'population', sex: 'male',
    population: '日本の男性', definition: '0歳の平均余命（平均寿命）。令和7年簡易生命表', asOf: '2025年',
    sourceIds: ['mhlwLife2025'], sourceType: 'primary', unverified: false,
    verifyNote: '出典で確認済み（2026-10-17）。出典の表が「男」の値として示している。',
  }),
  jpLifeMaleAt10: S({
    id: 'jpLifeMaleAt10', value: 10 + 71.6, unit: '歳', kind: 'estimate', domain: 'population', sex: 'male',
    population: '10歳まで生きた日本の男性', definition: '平均で亡くなる年齢＝10歳＋10歳の平均余命71.60年（令和7年簡易生命表）。死亡の確率の調整に使う', asOf: '2025年',
    sourceIds: ['mhlwLife2025'], sourceType: 'primary', unverified: false,
    verifyNote: '元の数値は出典で確認済み（2026-10-17）。出典の表が「男」の10歳の平均余命として示している。',
    note: 'このゲームでは、野球を始める8歳までは亡くならない設定にしているため、出生時ではなく10歳時点の平均余命に合わせる。',
  }),

  // ---------------------------------------------------------------- United States (PROJECT_PLAN §11.31)
  usLifeMale: S({
    id: 'usLifeMale', value: 76.5, unit: '年', kind: 'measured', domain: 'population', sex: 'male',
    population: '米国の男性', definition: '出生時の平均余命。NCHS の2024年の確定値', asOf: '2024年',
    sourceIds: ['nchsDb548'], sourceType: 'primary', unverified: false,
    verifyNote: '出典で確認済み（2026-10-19）。出典の表が「男性」の値として示している（2023年は75.8年）。',
  }),
  usLifeMaleAt10: S({
    id: 'usLifeMaleAt10', value: 76.5 + 0.25, unit: '歳', kind: 'assumption', domain: 'population', sex: 'male',
    population: '10歳まで生きた米国の男性', definition: '平均で亡くなる年齢。出生時の平均余命76.5年に、日本の値で出生時と10歳時点の差（81.60−81.35＝0.25年）を足した仮定。死亡の確率の調整に使う', asOf: '2024年',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '米国の10歳時点の平均余命は取得していない。出生時の平均余命（76.5年）は確認済みで、10歳時点への補正は日本の値を借りた仮定。',
  }),
  usDraftRounds: S({
    id: 'usDraftRounds', value: 20, unit: '巡', kind: 'measured', domain: 'baseball', sex: 'all',
    population: 'MLB ルール4ドラフト', definition: '2022〜26年の労使協定でのドラフトの巡数', asOf: '2026年',
    sourceIds: ['mlbRule4'], sourceType: 'primary', unverified: false,
    verifyNote: '出典（MLB 公式の用語集）の要約で確認（2026-10-19）。ルールの値で、人数の統計ではない。',
    note: '2028年からの資格の変更案（20歳以上・高校卒業から2年）は提案で、現行ではない。',
  }),
  usArbitrationYears: S({
    id: 'usArbitrationYears', value: 3, unit: '年', kind: 'measured', domain: 'baseball', sex: 'all',
    population: 'MLB の選手', definition: '年俸調停の資格を得るサービスタイム（スーパー・ツーの例外あり）', asOf: '2026年',
    sourceIds: ['mlbServiceTime'], sourceType: 'primary', unverified: false,
    verifyNote: '出典（MLB 公式の用語集）の要約で確認（2026-10-19）。ルールの値。',
  }),
  usFreeAgencyYears: S({
    id: 'usFreeAgencyYears', value: 6, unit: '年', kind: 'measured', domain: 'baseball', sex: 'all',
    population: 'MLB の選手', definition: 'FAの資格を得るサービスタイム（172日で1年）', asOf: '2026年',
    sourceIds: ['mlbServiceTime'], sourceType: 'primary', unverified: false,
    verifyNote: '出典（MLB 公式の用語集）の要約で確認（2026-10-19）。ルールの値。',
  }),
  usMid: S({
    id: 'usMid', value: 0.5, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '少年野球をしている男の子', definition: '中学年代（ミドルスクール）でも野球を続ける割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + '米国の少年野球の人数と継続率は確認できていない。',
  }),
  usHs: S({
    id: 'usHs', value: 0.65, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '中学年代で野球を続けた男の子', definition: '高校（4年）の野球部に入る割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + '米国の高校の野球人口と入部の割合は確認できていない。',
  }),
  usHsStay: S({
    id: 'usHsStay', value: 0.88, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '高校の野球部員', definition: '高校の部活を1年続ける割合（4年間を続ける割合を約6割と仮定した4乗根）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  usHsDraft: S({
    id: 'usHsDraft', value: 0.004, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '高校の最終学年まで続けた選手', definition: 'MLBドラフトで指名される割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + '高校生の指名人数と、野球部の最終学年の人数を結びつける統計は確認できていない。',
  }),
  usHsSign: S({
    id: 'usHsSign', value: 0.45, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'ドラフトで指名された高校生', definition: '大学へは進まず、プロの契約を選ぶ割合（おまかせの答えの決め方）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + '指名後に契約した高校生の割合は確認できていない。',
  }),
  usHsCollege: S({
    id: 'usHsCollege', value: 0.12, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '高校の最終学年まで続けた選手のうち指名されなかった選手', definition: '大学・短大の野球部で続ける割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + 'NCAA の進路の割合のページは開けなかった（§6.4）。',
  }),
  usCollegeStay: S({
    id: 'usCollegeStay', value: 0.88, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '大学・短大の野球部員', definition: '部活を1年続ける割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  usCollegeDraft: S({
    id: 'usCollegeDraft', value: 0.05, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'ドラフトの資格がある大学・短大の選手', definition: '1年あたり、MLBドラフトで指名される割合（4年制は3年を終えたあと・21歳から、短大はいつでも）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + '資格のある人数が確認できていない。部の区分（NCAA 1〜3部・短大）による差は設定として分けている。',
  }),
  usCollegeSign: S({
    id: 'usCollegeSign', value: 0.85, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'ドラフトで指名された大学・短大の選手', definition: '契約を選ぶ割合（おまかせの答えの決め方）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  usJucoTransfer: S({
    id: 'usJucoTransfer', value: 0.45, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '短大の2年を終えて指名されなかった選手', definition: '4年制の大学に編入して続ける割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  usMinorUp: S({
    id: 'usMinorUp', value: 0.45, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'マイナーの選手', definition: '1年あたり、ひとつ上の階層に上がる割合（階層ごとの差は設定）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + 'マイナーの階層ごとの昇格率は確認できていない。',
  }),
  usMinorExit: S({
    id: 'usMinorExit', value: 0.25, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'マイナーの選手', definition: '1年あたり、契約が切れて野球を離れる割合', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA,
  }),
  usMlbDebut: S({
    id: 'usMlbDebut', value: 0.18, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: '2A・3A のマイナーの選手', definition: '1年あたり、MLBで初めて出場する割合（階層で差をつける）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + '巡目ごとのMLB到達率（1巡73%、2巡51%、3巡40%、分析記事）は二次情報で、ここでは目安にした。',
  }),
  usMlbExit: S({
    id: 'usMlbExit', value: 0.14, unit: '割合', kind: 'assumption', domain: 'baseball', sex: 'male',
    population: 'MLBの選手', definition: '1年あたり、MLBを離れる割合（野手の平均キャリア5.6年〔二次〕から）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: NO_DATA + '平均キャリア5.6年は1902〜1993年に始めた野手の研究（二次）で、現在の値ではない。',
  }),
  usModel: S({
    id: 'usModel', value: 0, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '米国出身の人生', definition: '大学の区分（NCAA 1〜3部・短大）の割合と実力による差、ドラフトの順位と契約金（20巡）の分布、マイナーの階層と年俸、MLBの年俸（最低年俸・調停・FA）の設定。D2・D3・短大の学校名は一般名', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '区分ごとの割合、順位の分布、マイナーの階層・年俸、MLBの年俸の形は、公式の統計で確認できていないためすべて仮定。確認済みの事実はドラフトの巡数・資格、サービスタイムのルールと平均余命のみ。',
  }),

  // ---------------------------------------------------------------- Korea and Cuba (PROJECT_PLAN §11.46): estimates, none checked against a source
  krLifeMale: S({
    id: 'krLifeMale', value: 80.5, unit: '年', kind: 'assumption', domain: 'population', sex: 'male',
    population: '韓国の男性', definition: '出生時の平均余命のおおよその値（ゲーム上の推定）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '公式統計では確認していない。一般に知られる水準に合わせたゲーム上の推定。',
  }),
  krLifeMaleAt10: S({
    id: 'krLifeMaleAt10', value: 80.5 + 0.25, unit: '歳', kind: 'assumption', domain: 'population', sex: 'male',
    population: '10歳まで生きた韓国の男性', definition: '平均で亡くなる年齢の推定。出生時の推定値に、日本の値での出生時と10歳時点の差（0.25年）を足した。死亡の確率の調整に使う', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '推定値に日本の差を借りたもの。統計として確認していない。',
  }),
  cuLifeMale: S({
    id: 'cuLifeMale', value: 76, unit: '年', kind: 'assumption', domain: 'population', sex: 'male',
    population: 'キューバの男性', definition: '出生時の平均余命のおおよその値（ゲーム上の推定）', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '公式統計では確認していない。一般に知られる水準に合わせたゲーム上の推定。',
  }),
  cuLifeMaleAt10: S({
    id: 'cuLifeMaleAt10', value: 76 + 0.25, unit: '歳', kind: 'assumption', domain: 'population', sex: 'male',
    population: '10歳まで生きたキューバの男性', definition: '平均で亡くなる年齢の推定。出生時の推定値に、日本の値での出生時と10歳時点の差（0.25年）を足した。死亡の確率の調整に使う', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true, verifyNote: '推定値に日本の差を借りたもの。統計として確認していない。',
  }),
  krModel: S({
    id: 'krModel', value: 0, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: '韓国出身の人生（ベータ版）', definition: '高校・大学の進路、ドラフト（KBOの新人ドラフト）、2軍と1軍の階層、年俸、兵役の扱い、FAまでの年数の設定。家計と年金・医療費の設定も含む', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote:
      'KBOの1軍の試合数（144）と2軍の試合数（120、2025年118・2026年121から）、最低年俸（3,000万ウォン）、FAまでの年数（高卒8年・大卒7年）は、公表資料と報道で確認した（2026-10-23）。年俸の伸び方は、KBO公表の平均年俸（2026年1億7,536万ウォン）に近づけたゲーム上の推定。そのほかの割合・年数・金額（契約金・兵役を含む）は、公式統計や一次資料で確認していないゲーム上の推定で、実在の制度や数値として扱わない。',
  }),
  cuModel: S({
    id: 'cuModel', value: 0, unit: '-', kind: 'assumption', domain: 'model', sex: 'male',
    population: 'キューバ出身の人生（ベータ版）', definition: 'スポーツ学校への選抜、国内リーグ（セリエ・ナシオナル）への昇格、収入、海外挑戦（MLB球団との契約）、家計と年金・医療費の設定', asOf: '-',
    sourceIds: [], sourceType: 'none', unverified: true,
    verifyNote: '割合・収入・金額はすべて、公式統計や一次資料で確認していないゲーム上の推定。政治・経済・制度の状況は、ゲーム内の推定モデルであり、事実として断定しない。',
  }),
}

export function stat(id: string): Stat {
  const s = STATS[id]
  if (!s) throw new Error(`unknown stat ${id}`)
  return s
}

export function statValue(id: string): number {
  return stat(id).value
}
