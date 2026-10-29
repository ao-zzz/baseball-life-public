import type { StatsWords } from './statsEn.ts'

// The statistics and their sources in Korean (the multilingual work). Mirrors statsEn.ts id for id; translated from the Japanese data
// (data/stats.ts, data/sources.ts) with the English as reference. A source's `original` is its own title, copied unchanged. Drafted with AI.

const JHBF = '일본고등학교야구연맹'
const JPBPA = '일본프로야구선수회'

/** a value confirmed in the source whose source has no breakdown by sex (data/stats.ts `ref`) */
const ref = (target: string, extra = '') =>
  `집계 대상: ${target}. 수치와 정의는 출처에서 확인했습니다(2026-10-17). 출처에 남녀 구분이 기재되어 있지 않으므로 남자만의 값이라고 단정하지 않고, 남자 진로 모델의 참고값으로 사용합니다.${extra ? ' ' + extra : ''}`
/** the same, for a value computed from such figures (data/stats.ts `refDerived`) */
const refDerived = (target: string, extra = '') =>
  `집계 대상: ${target}. 원래 수치는 출처에서 확인했습니다(2026-10-17). 원래 통계에 남녀 구분이 기재되어 있지 않으므로 남자만의 값이라고 단정하지 않고, 남자 진로 모델의 참고값으로 사용합니다.${extra ? ' ' + extra : ''}`
const NO_DATA = '데이터가 없는 모델상의 설정입니다.'
const MANAGERS = '매니저 포함 여부도 출처에 기재되어 있지 않습니다.'
const TEAMS_NO_SEX = '팀의 수이며, 남녀 구분은 제시되어 있지 않습니다.'
const CONFIRMED_MEN = '출처에서 확인했습니다(2026-10-17). 출처의 표가 ‘남자’의 값으로 제시하고 있습니다.'

const HS_MEMBERS = `${JHBF} 가맹교의 경식 야구부원`
const DRAFT_2025 = '2025년 NPB 드래프트'
const FILED_2025 = '2025년 프로 지망서'
const RELEASED = '2021~2025년에 방출·은퇴한 NPB 선수 767명'
const RELEASED_EXCL = '2021~2025년에 방출·은퇴한 NPB 선수 767명(외국인 선수와 같은 구단에서의 육성 재계약은 제외)'
const RELEASED_PATHS = '2021~2025년에 방출·현역 은퇴한 NPB 선수 767명의 진로(NPB 조사)'
const SALARY_713 = 'NPB 정식 등록 선수로 공시된 일본인 선수 713명'
const SALARY_713_SURVEY = `12개 구단의 정식 등록 선수로 공시된 일본인 선수 713명(${JPBPA} 조사, 2026년)`
const OLD_EDITION_AMOUNT = '2022년판 자료. 게임에서는 2025년도 기준으로 사용하며, 2025·2026년도 금액은 확인하지 못했습니다'
const OLD_EDITION_RULE = '2022년판 자료. 게임에서는 2025년도 기준으로 사용하며, 2025·2026년도 규정은 확인하지 못했습니다'
const PLAYING_KIDS = '야구를 하는 아이·선수'
const ONE_YEAR = '1년분 데이터입니다.'
const ONE_YEAR_13 = '1년분·13명뿐인 데이터입니다.'

const STAT_KO: StatsWords['stat'] = {
  // ---------------------------------------------------------------- Japan: measured / reported
  jpHsPlayers: {
    population: HS_MEMBERS,
    definition: '전 학년 부원 수의 합계(남녀·매니저 포함 여부는 출처에 기재 없음)',
    asOf: '2026년 5월 말',
    verifyNote: ref(`${JHBF} 가맹교의 경식 야구부원(전 학년, 2026년 5월 말)`, MANAGERS),
    note: '제목 ‘12만분의 1’의 분모입니다. 프로가 될 확률이 아닙니다.',
  },
  jpHsFirstYears: {
    population: HS_MEMBERS,
    definition: '1학년 부원 수',
    asOf: '2026년 5월 말',
    verifyNote: ref(`${JHBF} 가맹교의 경식 야구부원 중 1학년(2026년 5월 말)`, MANAGERS),
  },
  jpHsSeniors2025: {
    population: HS_MEMBERS,
    definition: '3학년 부원 수',
    asOf: '2025년 5월 말',
    verifyNote: ref(`${JHBF} 가맹교의 경식 야구부원 중 3학년(2025년 5월 말, 과거의 표)`, MANAGERS),
  },
  jpHsSchools: {
    population: '일본고등학교야구연맹(경식)',
    definition: '가맹교 수',
    asOf: '2026년 5월 말',
    verifyNote: ref(`${JHBF}의 경식 가맹교(2026년 5월 말)`, '학교의 수이며, 남녀 구분은 제시되어 있지 않습니다.'),
  },
  jpHsComplete: {
    population: '고등학교 경식 야구부원',
    definition: '계속률 = 3학년 부원 수 ÷ 그 학년이 입학한 연도의 1학년 부원 수(중도 가입 부원 포함)',
    asOf: '2026년 5월 말',
    verifyNote: ref(`${JHBF} 가맹교의 경식 야구부원(2026년의 3학년과 2024년의 1학년)`),
    note: '도중에 입부한 사람도 3학년으로 세기 때문에, 같은 사람이 3년 동안 계속한 비율 그 자체는 아닙니다.',
  },
  jpTeamsTotal: {
    population: '2026년 여름 지방 대회',
    definition: '참가 팀 수(연합팀 157개 포함)',
    asOf: '2026년 여름',
    verifyNote: ref('2026년 여름 전국고등학교야구선수권대회 지방 대회에 참가한 팀(보도)', TEAMS_NO_SEX),
  },
  jpTeamsAichi: {
    population: '2026년 여름 지방 대회(아이치)',
    definition: '참가 팀 수(최다)',
    asOf: '2026년 여름',
    verifyNote: ref('2026년 여름 아이치 대회에 참가한 팀(보도)', TEAMS_NO_SEX),
  },
  jpTeamsTottori: {
    population: '2026년 여름 지방 대회(돗토리)',
    definition: '참가 팀 수(최소)',
    asOf: '2026년 여름',
    verifyNote: ref('2026년 여름 돗토리 대회에 참가한 팀(보도)', TEAMS_NO_SEX),
  },
  jpJhsSoft: {
    population: '중체련(일본중학교체육연맹)의 연식 야구',
    definition: '선수 수(전 학년. 일본중학교체육연맹 연식야구경기부의 조사)',
    asOf: '2025년',
    verifyNote: ref(
      '중체련 연식 야구부에 소속된 부원·선수(2025년. NPB 기사가 중체련의 조사를 인용)',
      '중체련의 원자료는 이번에 열람하지 않았습니다.',
    ),
  },
  jpDraftTotal: {
    population: DRAFT_2025,
    definition: '지명된 인원(정식 등록 73·육성 43)',
    asOf: '2025년',
    verifyNote: ref('2025년 NPB 드래프트 회의에서 지명된 선수(보도의 집계)'),
  },
  jpDraftFromHs: {
    population: DRAFT_2025,
    definition: '고교생 지명 수(정식 등록 19·육성 14)',
    asOf: '2025년',
    verifyNote: ref('2025년 NPB 드래프트 회의에서 지명된 고교생(보도의 집계)'),
  },
  jpDraftFromUniv: {
    population: DRAFT_2025,
    definition: '대학생 지명 수(해외 대학 포함. 정식 등록 40·육성 14)',
    asOf: '2025년',
    verifyNote: ref('2025년 NPB 드래프트 회의에서 지명된 대학생(해외 대학 포함. 보도의 집계)'),
  },
  jpDraftFromCompany: {
    population: DRAFT_2025,
    definition: '사회인 야구 선수 지명 수(정식 등록 12·육성 1)',
    asOf: '2025년',
    verifyNote: ref('2025년 NPB 드래프트 회의에서 지명된 사회인 야구 선수(보도의 집계)'),
  },
  jpDraftFromIndep: {
    population: DRAFT_2025,
    definition: '독립 리그에서의 지명 수(정식 등록 1·육성 12)',
    asOf: '2025년',
    verifyNote: ref('2025년 NPB 드래프트 회의에서 지명된 독립 리그 선수(보도의 집계)'),
  },
  jpShibouHs: {
    population: FILED_2025,
    definition: '고교생 제출자 수',
    asOf: '2025년',
    verifyNote: ref('2025년에 프로 지망서를 낸 고교생(기사 속 기술)'),
  },
  jpShibouUniv: {
    population: FILED_2025,
    definition: '대학생 제출자 수',
    asOf: '2025년',
    verifyNote: ref('2025년에 프로 지망서를 낸 대학생(기사 속 기술)'),
  },
  jpIkuseiPromoted: {
    population: 'NPB 12개 구단의 육성 선수',
    definition: '육성에서 정식 등록으로 옮긴 인원(2023년, 기사 시점인 8월까지)',
    asOf: '2023년',
    verifyNote: ref('2023년(기사 시점까지)에 육성에서 정식 등록된 NPB 12개 구단의 선수'),
  },
  jpReleaseAge: {
    population: RELEASED_EXCL,
    definition: '각 연도의 평균 연령(26.3~27.8세)을 대상 인원으로 가중한 평균',
    asOf: '2021–2025년',
    verifyNote: refDerived('2021~2025년에 방출·현역 은퇴한 NPB 선수 767명(외국인 선수와 같은 구단에서의 육성 재계약은 제외. NPB 조사)'),
  },
  jpTenure: {
    population: RELEASED_EXCL,
    definition: '각 연도의 평균 재적 기간(6.3~7.7년)을 대상 인원으로 가중한 평균',
    asOf: '2021–2025년',
    verifyNote: refDerived('2021~2025년에 방출·현역 은퇴한 NPB 선수 767명(NPB 조사)'),
  },
  jpCareerNpb: {
    population: RELEASED,
    definition: '진로가 NPB 관계(선수·육성·코치·구단 직원 등). 5년간 인원의 합계 438명으로 계산',
    asOf: '2021–2025년',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpCareerOtherBaseball: {
    population: RELEASED,
    definition: '진로가 그 밖의 야구(독립·사회인·해외 등). 합계 188명으로 계산',
    asOf: '2021–2025년',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpCareerNonBaseball: {
    population: RELEASED,
    definition: '진로가 야구 이외. 합계 82명으로 계산',
    asOf: '2021–2025년',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpCareerUndecided: {
    population: RELEASED,
    definition: '진로가 미정·불명. 합계 59명으로 계산',
    asOf: '2021–2025년',
    verifyNote: refDerived(RELEASED_PATHS),
  },
  jpSalaryMedian: {
    population: SALARY_713,
    definition: `연봉의 중앙값(${JPBPA} 조사)`,
    asOf: '2026년',
    verifyNote: ref(SALARY_713_SURVEY),
  },
  npbMinSalary: {
    population: 'NPB 정식 등록 선수',
    definition: '정식 등록 선수 연봉(참가보수)의 최저액(세금 별도)',
    asOf: OLD_EDITION_AMOUNT,
    verifyNote: `집계 대상: NPB 정식 등록 선수(${JPBPA} 자료(2022년판) p.5의 표). {yen~:4200000}(세금 별도) 및 정의는 출처에서 확인했습니다(2026-10-22). 자료는 2022년판이며, 2025·2026년도 금액은 확인하지 못했습니다(야구협약의 조문 자체는 공개되어 있지 않습니다). 출처에 남녀 구분이 기재되어 있지 않으므로 남자만의 값이라고 단정하지 않고, 남자 진로 모델의 참고값으로 사용합니다.`,
  },
  npbFirstTeamMin: {
    population: 'NPB 정식 등록 선수',
    definition:
      '1군 최저 보장: 연봉이 {yen~:16000000} 미만인 선수에게, 1군 출전 선수 등록 1일당 (1,600만 엔 − 연봉) ÷ 150을 추가 참가보수로 지급합니다(150일이면 연봉과 합쳐 {yen~:16000000})',
    asOf: OLD_EDITION_RULE,
    verifyNote: `집계 대상: NPB 정식 등록 선수(${JPBPA} 자료(2022년판) p.5의 표). {yen~:16000000}·150일의 식 및 정의는 출처에서 확인했습니다(2026-10-22). 자료는 2022년판이며, 2025·2026년도 규정은 확인하지 못했습니다(야구협약의 조문 자체는 공개되어 있지 않습니다). 출처에 남녀 구분이 기재되어 있지 않으므로 남자만의 값이라고 단정하지 않고, 남자 진로 모델의 참고값으로 사용합니다. 게임에서는 1군 등록 일수를 기록하지 않으므로, FA 자격의 환산과 같은 ‘1군 1시즌분의 비율’ × 150일로 셉니다(모델상의 환산).`,
  },
  jpSalaryMean: {
    population: SALARY_713,
    definition: `연봉의 평균(${JPBPA} 조사)`,
    asOf: '2026년',
    verifyNote: ref(SALARY_713_SURVEY),
  },
  elbowYouth: {
    population: '초등학교 야구팀 선수 247명(야마가타대학 등의 연구, 2007년 발표)',
    definition: '초음파로 상완골 내측상과(팔꿈치 안쪽)의 견열이 발견된 비율(개별 연구)',
    asOf: '2007년',
    verifyNote:
      '수치는 논문 초록에서 확인했습니다(2026-10-17). 초록에는 대상의 지역·남녀·학년이 기재되어 있지 않고, 진로 모델에도 사용하지 않으므로 미확인 상태로 둡니다.',
    note: '하나의 연구입니다. 전국의 값이 아닙니다.',
  },

  // ---------------------------------------------------------------- Japan: estimates derived from the above
  jpHsFile: {
    population: '고교 3학년 경식 야구부원',
    definition: '2025년 프로 지망서(고교생 124명) ÷ 2025년 5월 말 3학년 부원(40,842명)',
    asOf: '2025년',
    verifyNote: refDerived(
      `분자는 2025년에 프로 지망서를 낸 고교생, 분모는 ${JHBF}의 2025년 5월 말 3학년 부원`,
      '출처가 다른 두 수의 비입니다.',
    ),
  },
  jpHsDraftGivenFile: {
    population: '프로 지망서를 낸 고교생',
    definition: '고교생 지명 수 ÷ 고교생 제출자 수',
    asOf: '2025년',
    verifyNote: refDerived('2025년에 프로 지망서를 낸 고교생 124명과, 그중 지명된 33명(두 건의 보도)'),
  },
  jpUnivDraftGivenFile: {
    population: '프로 지망서를 낸 대학생',
    definition: '대학생 지명 수 ÷ 대학생 제출자 수(지명 수는 해외 대학 포함)',
    asOf: '2025년',
    verifyNote: refDerived('2025년에 프로 지망서를 낸 대학생 176명과, 지명된 대학생 54명(두 건의 보도. 지명 수는 해외 대학 포함)'),
  },
  jpShihaikaHs: {
    population: '2025년 NPB 드래프트에서 지명된 고교생 33명',
    definition: '정식 등록 선수로 지명된 비율(1년분)',
    asOf: '2025년',
    verifyNote: refDerived('2025년 NPB 드래프트에서 지명된 고교생 33명(보도의 집계)', ONE_YEAR),
  },
  jpShihaikaUniv: {
    population: '2025년 NPB 드래프트에서 지명된 대학생 54명',
    definition: '정식 등록 선수로 지명된 비율(1년분)',
    asOf: '2025년',
    verifyNote: refDerived('2025년 NPB 드래프트에서 지명된 대학생 54명(보도의 집계)', ONE_YEAR),
  },
  jpShihaikaCompany: {
    population: '2025년 NPB 드래프트에서 지명된 사회인 야구 선수 13명',
    definition: '정식 등록 선수로 지명된 비율(1년분, 적은 인원)',
    asOf: '2025년',
    verifyNote: refDerived('2025년 NPB 드래프트에서 지명된 사회인 야구 선수 13명(보도의 집계)', ONE_YEAR_13),
  },
  jpShihaikaIndep: {
    population: '2025년 NPB 드래프트에서 지명된 독립 리그 선수 13명',
    definition: '정식 등록 선수로 지명된 비율(1년분, 적은 인원)',
    asOf: '2025년',
    verifyNote: refDerived('2025년 NPB 드래프트에서 지명된 독립 리그 선수 13명(보도의 집계)', ONE_YEAR_13),
  },
  jpKoshien: {
    population: '고등학교 경식 야구부원(1개 학년)',
    definition:
      '재학 중 고시엔에서 벤치에 드는 비율. 봄 32개교·여름 49개교 × 20명의 자리(연 1,620)를 1개 학년당 부원 수(124,116÷3)로 나눈 값',
    asOf: '2026년',
    verifyNote: `집계 대상: ${JHBF} 가맹교의 경식 야구부원(2026년 5월 말 전 학년을 3으로 나눈 1개 학년당 인원)과 고시엔 봄·여름의 출전 자리. 부원 수는 출처에서 확인했습니다(2026-10-17). 출전 학교 수(봄 32·여름 49)와 벤치 입성 인원(20명)은 이번 확인에서 출처를 열람하지 않았으므로 미확인 상태로 둡니다. 부원 수에는 남녀 구분이 기재되어 있지 않습니다.`,
    note: '한 자리를 1개 학년의 1명으로 세는 가정을 포함합니다.',
  },
  jpNpbExit: {
    population: 'NPB 선수',
    definition: '1년당 구단을 떠날 확률. 2021~2025년 평균 재적 기간의 역수(매년 같은 확률이라는 가정)',
    asOf: '2021–2025년',
    verifyNote: refDerived('2021~2025년에 방출·현역 은퇴한 NPB 선수 767명의 평균 재적 기간(NPB 조사)', '‘매년 같은 확률’은 모델의 가정입니다.'),
  },
  jpSalarySigma: {
    population: 'NPB 정식 등록 일본인 선수',
    definition: '연봉이 로그정규분포를 따른다고 가정하고, 중앙값과 평균으로부터 구한 흩어진 정도',
    asOf: '2026년',
    verifyNote: refDerived(`12개 구단의 정식 등록 선수로 공시된 일본인 선수 713명의 연봉(${JPBPA} 조사)`, '로그정규분포는 모델의 가정입니다.'),
  },
  jpPrefTeamsOther: {
    population: '2026년 여름 지방 대회(아이치·돗토리 이외)',
    definition: '아이치·돗토리를 제외한 45개 도도부현의 평균(연합팀 포함. 홋카이도·도쿄의 2지구제는 고려하지 않음)',
    asOf: '2026년 여름',
    verifyNote: refDerived('2026년 여름 지방 대회의 참가 팀(보도의 전국 합계와 최다·최소)', TEAMS_NO_SEX),
  },

  // ---------------------------------------------------------------- Japan: assumptions (no data yet)
  jpJhsContinue: {
    population: '학동 야구(초등학생 야구)를 하던 아이',
    definition: '중학교에서도 야구를 계속하는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
    note: '학동 야구의 선수 수 데이터가 없어 가정한 값입니다.',
  },
  jpHsJoin: {
    population: '중학교에서 야구를 하던 아이',
    definition: '고등학교에서 경식 야구부에 들어가는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
    note: '중학교 경식 클럽의 선수 수를 알 수 없어 가정한 값입니다. 연식(중체련)의 1개 학년은 약 4.6만 명, 고교 1학년은 약 4.4만 명입니다.',
  },
  jpToUniv: {
    population: '고교 3학년까지 경식 야구를 계속한 선수',
    definition: '대학에서 야구를 계속하는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpToCompany: {
    population: '고등학교·대학을 마친 선수',
    definition: '사회인 야구의 기업팀에 들어가는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpToIndep: {
    population: '고등학교·대학을 마친 선수',
    definition: '독립 리그에 들어가는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpUnivComplete: {
    population: '대학 야구부원',
    definition: '4학년까지 계속하는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpUnivFile: {
    population: '대학 4학년 야구부원',
    definition: '프로 지망서를 내는 비율(제출자 176명과 대학 부원 수의 가정으로부터)',
    asOf: '-',
    verifyNote: '대학 부원 수의 데이터가 없으므로 비율은 가정입니다.',
  },
  jpUnivToCompany: {
    population: '대학 4학년까지 야구를 계속한 선수',
    definition: '사회인 야구의 기업팀에 들어가는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpUnivToIndep: {
    population: '대학 4학년까지 야구를 계속한 선수',
    definition: '독립 리그에 들어가는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpIkuseiExit: {
    population: 'NPB 육성 선수',
    definition: '1년당 구단을 떠날 확률',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpCompanyDraft: {
    population: '사회인 야구 선수',
    definition: '1년당 NPB에서 지명될 확률',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpIndepDraft: {
    population: '독립 리그 선수',
    definition: '1년당 NPB에서 지명될 확률',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpIkuseiPromote: {
    population: 'NPB 육성 선수',
    definition: '1년당 정식 등록으로 올라갈 확률(연 32명과 육성 선수 인원의 가정으로부터)',
    asOf: '-',
    verifyNote: '12개 구단 육성 선수의 총수 데이터가 없으므로 비율은 가정입니다.',
  },
  jpIchigun: {
    population: 'NPB 정식 등록 선수 중 아직 1군에 출전하지 않은 선수',
    definition: '1년당 1군에서 첫 출전할 확률',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  jpMlb: {
    population: 'NPB 1군 경험이 있는 선수',
    definition: '1년당 MLB로 옮길 확률',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  companyTenure: {
    population: '사회인 야구·독립 리그 선수',
    definition: '1년당 현역을 마칠 확률',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  abilityRho: {
    population: PLAYING_KIDS,
    definition: '실력(같은 학년 안에서의 위치)이 다음 해까지 이어지는 정도',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  focusEffect: {
    population: PLAYING_KIDS,
    definition: '‘연습’을 중점으로 한 해의 실력 상승 폭',
    asOf: '-',
    verifyNote: NO_DATA,
  },

  // ---------------------------------------------------------------- body growth (general population, boys)
  jpBoyHeight: {
    population: '일본의 남자(5~17세, 표본 조사)',
    definition: '연령별 키의 평균값(표의 값은 17세. 5~17세의 값은 body.ts)',
    asOf: '2024년도',
    verifyNote: CONFIRMED_MEN,
  },
  jpBoyWeight: {
    population: '일본의 남자(5~17세, 표본 조사)',
    definition: '연령별 몸무게의 평균값(표의 값은 17세. 5~17세의 값은 body.ts)',
    asOf: '2024년도',
    verifyNote: CONFIRMED_MEN,
  },
  jpHsMembersPerSchool: {
    population: `${JHBF} 가맹교`,
    definition: '1개교당 경식 야구부원 수(부원 수 124,116 ÷ 가맹교 3,746. 출처 표의 ‘평균’ 33.1과 일치)',
    asOf: '2026년 5월 말',
    verifyNote: refDerived(`${JHBF} 가맹교의 경식 야구부원과 가맹교 수(2026년 5월 말)`),
  },
  // abilities and team model (no data: model settings, shown as model values)
  abilityModel: {
    population: PLAYING_KIDS,
    definition:
      '능력 표시(0~100)는 같은 연령대에서 야구를 하는 사람 중에서의 위치. 종합 실력(캘리브레이션 완료)에 포지션과 연습으로 정해지는 강점·약점을 더한 것',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  velocityModel: {
    population: '투수',
    definition: '구속 표시. 연령별 기준(17세에 127km/h)에 실력과 강점·약점을 더한 것',
    asOf: '-',
    verifyNote: '공표된 연령별 구속 데이터를 확인하지 못했으므로 모델상의 설정입니다.',
  },
  hsTeamModel: {
    population: '고등학교 경식 야구부',
    definition: '벤치 입성 인원(게임상의 설정)과 팀 인원·강도를 정하는 방법',
    asOf: '-',
    verifyNote:
      '대회별 벤치 입성 인원은 이번 확인에서 출처를 열람하지 않았으므로 게임상의 설정(20명)입니다. 팀 인원은 1개교당 평균(33.1명)을 중심으로 하며, 강호일수록 많다고 가정합니다.',
  },
  seasonModel: {
    population: '대학·사회인 야구·독립 리그·프로 선수',
    definition:
      '고교 졸업 후 시즌을 정하는 방법(게임상의 설정): 벤치 입성 인원(25명), 경기 수(대학 리그전은 1시즌 10~14경기, 독립 리그는 50~70경기, 프로는 1시즌 내내 출전한 경우 야수 143경기·선발 25경기·구원 55경기, 2군은 110·18·40경기), 리그전 순위, 대회 승패, 1군에 출전하는 비율(그해 연봉을 정한 실력의 위치로부터). 성적의 기준은 이 모델에서 각 단계에 진출한 선수의 실력 분포(10만 명 시행, 2026-10-18)와 게임상의 타율·홈런·평균자책점 기준',
    asOf: '-',
    verifyNote:
      '벤치 입성 인원, 경기 수, 대회 형식은 이번 확인에서 출처를 열람하지 않았으므로 게임상의 설정입니다. 대회 이름도 확인하지 않았으므로 일반 명칭으로 표시합니다. 진로 판정(퇴부·드래프트·1군 첫 출전·방출)은 캘리브레이션된 확률 그대로이며, 경기 결과는 그에 맞춰 만듭니다.',
  },
  schoolModel: {
    population: '고등학교·대학에 진학하는 선수',
    definition:
      '진학을 정하는 방법(게임상의 설정): 여학교(이름에 ‘여자’, ‘여학원’ 등이 들어간 학교)를 제외한 실재 학교에, 야구부가 있는 것으로 간주해 배정합니다. 일반 입시의 합격 확률은 본인의 학력(지식에서 환산)과 학교 난이도(편차치가 수록되지 않은 학교는 인생마다 임시로 정한 값)의 차이로부터, 학교 추천은 지식과 평가로부터 정합니다. 체육 특기자 추천은 영입 제안을 한 팀을 야구 실력으로 고르고(편차치는 사용하지 않음), 입학 여부는 본인의 평가(능력·수비 위치 적성·성장 가능성·실적·부상 이력 등, evaluationModel)와 팀의 강도(teamRatingModel)로 정합니다. 제1지망에 떨어진 경우에는 함께 지원한 학교로 진학합니다',
    asOf: '-',
    verifyNote:
      '학교명은 문부과학성 학교 코드에 따른 실재 명칭입니다. 야구부 유무·강도, 입시 난이도, 합격·추천 확률은 모두 게임상의 가정이며 확인된 사실이 아닙니다. 편차치는 대학만 가와이주쿠의 공개값(2027년도 입시의 보더 예상)을 수록했으며, 고등학교는 이용할 수 있는 출처를 찾지 못해 수록하지 않았습니다.',
  },
  hsPlayModel: {
    population: '고교야구 선수',
    definition:
      '고교 개인 기록과 구속의 모델(게임상의 설정). 평균적인 선수는 타율 약 .250·홈런율 1%·평균자책점 약 4.6·9이닝당 탈삼진 약 6.5. 상대는 다른 고교생(강한 학교일수록 강한 상대와 대전). 투수는 학교 안에 자신보다 투수력이 높은 선수가 많을수록 등판 비율이 줄어듭니다(약한 학교의 에이스는 거의 매 경기, 강한 학교에서는 나누어 던짐). 연습 경기 수는 학교의 강도에 따라 달라집니다(강한 학교일수록 많고, 약한 학교는 적음). 구속은 3학년 투수의 중앙값 127km/h, 하위 10%가 약 117km/h, 상위 1%가 약 143km/h(2026-10-18에 목표값을 설정한 가정)',
    asOf: '-',
    verifyNote:
      '고교생 기록의 분포를 보여 주는 공적 데이터를 찾지 못했으므로 모두 모델상의 값입니다. 이전 설정은 평균적인 선수도 타율 .315·평균자책점 2.6·연간 50~240이닝 투구 등 현실보다 지나치게 좋았습니다.',
  },
  evaluationModel: {
    population: '진로를 선택하는 선수',
    definition:
      '선수의 평가(게임상의 설정. 수치는 표시하지 않음): 종합적인 능력에 수비 위치 적성(키는 위치별로 약간 기울게 할 뿐이며 기술이 보완), 성장 가능성(나이와 키가 더 클 여지), 실적(고시엔·주장·주전·우승·대표), 부상 이력, 최근 컨디션, 소속 팀의 강도, 스카우트의 주목을 더한 것. 영입 제안을 받을 확률과 실제로 들어갈 수 있는 확률은 따로 정합니다(입부 테스트만으로 들어가는 경우와 클럽팀은 각각 별도의 기준)',
    asOf: '-',
    verifyNote:
      '선수의 평가나 스카우트의 평가를 수치로 보여 주는 공적 데이터는 없으며, 모두 모델상의 값입니다. 키와 수비 위치의 관계도 통계가 아니라 게임상의 가정입니다.',
  },
  teamRatingModel: {
    population: '고등학교·대학·사회인 야구·독립 리그·NPB·미국 대학의 팀',
    definition:
      '팀의 내부적인 강도(게임상의 설정. 수치는 표시하지 않고, ‘강호·상위·중위권’ 등의 말과 근거로만 보여 줌). 대학은 가맹 연맹(전일본대학야구연맹 공식 페이지)과 그 연맹의 선수권 결승 진출 횟수(2005~2026), 도토·슈토 리그의 부, 그 대학 자체의 결승 진출로부터. 고등학교는 고시엔 출전(여름·봄, 2004~2026, 일본고등학교야구연맹의 출전교 목록)으로부터. 사회인 야구는 일본선수권 출전 팀 목록(공식)으로부터. NPB는 최근 3년 승률(NPB 순위표)로부터. 미국 대학은 NCAA 1부(디비전 I)의 콘퍼런스로부터. 근거가 없는 팀(출전 기록이 없는 고등학교, 독립 리그, 가맹 연맹이 없는 대학)은 설립 주체·리그·팀별 추정. 강한 팀일수록 부원이 많고, 들어가는 기준이 높으며, 팀 내 경쟁이 치열합니다. NPB에서는 강한 구단일수록 같은 실력이라도 1군 출전이 적고, 드래프트에서는 약한 구단이 좋은 선수를 많이 지명합니다',
    asOf: '2026년',
    verifyNote:
      '연맹의 가맹 대학·선수권 결승 진출·고시엔 출전·일본선수권 출전·NPB 승패는 각각 공식 발표로 확인했습니다(2026-10-18). 도토·슈토 리그의 부와 미국 대학 목록은 2차 자료(Wikipedia)입니다. 리그·부·출전·승률로 강도 수치를 만드는 식과, 근거가 없는 팀의 강도는 게임상의 가정입니다.',
  },
  scoutModel: {
    population: '고교 2·3학년, 대학, 사회인 야구·독립 리그 선수',
    definition:
      '스카우트 주목도(0~100). 다음 프로 지망서 또는 드래프트 판정(캘리브레이션 완료)에서 선택될 확률로 만들며, 그해 공식전 성적에 따라 몇 점 오르내립니다. ‘스카우트가 시찰하러 오고 있다’ 단계(60 이상)는 판정에서 스카우트가 왔다고 정해졌을 때만입니다. 지명을 약속하는 값이 아닙니다',
    asOf: '-',
    verifyNote: '스카우트의 평가를 수치로 보여 주는 공적 데이터가 없으므로 모델상의 값입니다.',
  },

  // ---------------------------------------------------------------- work and money (general population, men)
  jpWageMale: {
    population: '남성 일반 노동자',
    definition:
      '연령 계급별 임금(표의 값은 가장 높은 55~59세. 모든 연령 계급의 값은 after.ts). ‘임금’의 정의는 이 출처의 페이지에서 확인하지 않았습니다',
    asOf: '2025년',
    verifyNote: CONFIRMED_MEN,
  },
  jpUnemployMale: {
    population: '남성 노동력 인구',
    definition: '완전실업률(연평균)',
    asOf: '2025년',
    verifyNote: '출처에서 확인했습니다(2026-10-17). 출처가 ‘남성’의 값으로 제시하고 있습니다.',
    note: '어느 시점에 일을 찾고 있는 사람의 비율이며, 1년 안에 직장을 잃을 확률이 아닙니다.',
  },
  jpNeverMarried50Male: {
    population: '일본의 남성(45~54세)',
    definition: '50세 시점 미혼 비율(45~49세와 50~54세 미혼 비율의 평균. 불상 보완값에 근거)',
    asOf: '2020년',
    verifyNote: '출처에서 확인했습니다(2026-10-17). 출처의 표가 ‘남자’의 값으로 제시하고 있습니다. 국세조사에서 산출한 값이며, 출처는 2차 집계입니다.',
    note: '2020년의 값입니다. 게임 주인공이 50세가 되는 것은 2080년대 이후이며, 그 시대의 비율로는 가정으로서 같은 값을 기준으로 삼고 있습니다.',
  },
  licenseModel: {
    population: '의과·치과·약학·간호·교육 대학에 진학한 사람(야구를 계속하지 않는 학생)',
    definition:
      '대학 이름으로 전공 분야를 정하고, 6년(의·치·약) 또는 4년 만에 졸업. 국가시험에 합격하기 쉬운 정도(1회당 의사 90%·치과의사 65%·약사 70%·간호사 90%, 3회까지), 자격직의 첫해 연봉(의사 {yen:10000000}·치과의사 {yen:7000000}·약사 {yen:5500000}·간호사 {yen:4800000}), 개업 등에 따른 증감. 교육 대학은 졸업과 함께 교원 면허',
    asOf: '-',
    verifyNote: '합격하기 쉬운 정도와 연봉은 공적 통계로 확인한 것이 아닌 게임상의 가정입니다. 실제 국가시험 합격률이나 직업의 평균 수입으로 다루지 않습니다.',
  },
  careerModel: {
    population: '야구를 그만둔 뒤 회사원이 아닌 길을 택한 사람',
    definition:
      '프로게이머, 방송인·유튜버, 아이돌·가수·배우·방송 연예인, 만화가·소설가·일러스트레이터, 창업, 자위대원, 의원, 해설자·지도자·스카우트·구단 프런트의 첫해 연봉과 사건에 따른 증감, 성공과 실패가 일어나기 쉬운 정도',
    asOf: '-',
    verifyNote: '연봉 액수, 성공이나 인기가 커지는 방식, 실패가 일어나기 쉬운 정도는 모두 공적 통계로 확인하지 못한 게임상의 가정입니다. 실제 직업의 평균 수입으로 다루지 않습니다.',
  },
  kidBallModel: {
    population: '일본 인생에서 8세가 된 아들',
    definition: '아들이 야구를 시작하는지, 그리고 중학교·고등학교·고시엔·드래프트·대학·사회인 야구·독립 리그·프로 1군으로 나아가는 방식',
    asOf: '-',
    verifyNote:
      '각 단계는 본인의 인생과 같은 통계에 바탕을 둔 비율을 상황을 고려하지 않고 적용한 추정입니다. 아버지의 경력이 야구를 시작하기 쉽게 하고 소질을 조금 높이는 것은 게임상의 가정이며, 부모의 실적으로 성공이 정해지지는 않습니다.',
  },
  workModel: {
    population: '일하는 사람',
    definition:
      '연 수입 = 연령별 월 임금 × 14개월(상여를 포함한 가정) × 근무처·직위·정규직 여부의 배율. 퇴직금은 정규직으로 3년 이상 근무한 경우 근속 연수 × 근무처별 금액(연 {yen:250000}~{yen:500000}). 승진·이직·실업·정년의 발생 가능성도 모델상의 설정',
    asOf: '-',
    verifyNote:
      '상여의 비율, 근무처나 직위에 따른 차이, 퇴직금 액수, 승진·이직·실업 확률은 공적 통계로 확인하지 못했으므로 가정입니다.',
  },
  householdModel: {
    population: '18세 이상',
    definition:
      '실수령액 비율(세금과 사회보험료를 뺀 나머지), 생활비(실수령액의 60% + 고정비. 자녀 1명당 연 {yen:300000}. 저축이 마이너스인 해에는 15% 절약), 배우자의 실수령액(연 {yen:900000}. 막내가 3세 미만인 동안은 {yen:300000}. 60세까지), 집세·대출 상환, 연금(연 {yen:1800000}, 배우자 몫 {yen:700000})의 설정. 본가에 살며, 부모가 모두 세상을 떠나면 집을 물려받습니다',
    asOf: '-',
    verifyNote: '가계 비용, 배우자의 수입, 연금 액수는 공적 통계로 확인하지 못했으므로 가정입니다.',
  },
  usHouseholdModel: {
    population: '미국에 사는, 야구를 떠난 사람',
    definition:
      '공적 연금은 67세부터(전액 기준 연 약 {yen:2500000}. 그때까지의 수입 수준에 따라 전액의 40~100%, 배우자가 있으면 50% 가산), 은퇴는 65세이며 67세까지 2년은 저축으로 생활. 65세부터 의료비 연 {yen:300000}, 80세부터 연 {yen:550000}. 일하는 동안의 수입과 그 밖의 가계(실수령액 비율·생활비·주거비)는 일본용 설정 그대로',
    asOf: '-',
    verifyNote:
      '연금 개시 연령·액수·의료비는 이 게임의 모델에 맞춘 가정이며, 미국 제도의 수치나 통계로 확인하지 않았습니다(67세는 이후 출생 연도의 전액 수령 개시 연령의 기준으로 둔 것입니다).',
  },
  lifeEventModel: {
    population: '야구를 떠난 후의 인생',
    definition: '만남·결혼·자녀·간병·지역 활동·질병 등 사건의 발생 가능성',
    asOf: '-',
    verifyNote:
      '사건의 발생 가능성은 모두 가정입니다. 만남과 결혼은 자동 진행으로 진행했을 때의 50세 시점 미혼 비율이 통계(jpNeverMarried50Male, 28.25%)에 가까워지도록 조정했습니다. 초혼 연령, 자녀 수, 간병·질병 등의 발생 가능성은 공적 통계로 확인하지 못했습니다.',
  },

  // ---------------------------------------------------------------- general population (not baseball)
  jpLifeMale: {
    population: '일본의 남성',
    definition: '0세의 평균 여명(평균 수명). 레이와 7년 간이생명표',
    asOf: '2025년',
    verifyNote: CONFIRMED_MEN,
  },
  jpLifeMaleAt10: {
    population: '10세까지 산 일본의 남성',
    definition: '평균 사망 연령 = 10세 + 10세의 평균 여명 71.60년(레이와 7년 간이생명표). 사망 확률의 조정에 사용',
    asOf: '2025년',
    verifyNote: '원래 수치는 출처에서 확인했습니다(2026-10-17). 출처의 표가 ‘남자’의 10세 평균 여명으로 제시하고 있습니다.',
    note: '이 게임에서는 야구를 시작하는 8세까지는 사망하지 않도록 설정했으므로, 출생 시가 아니라 10세 시점의 평균 여명에 맞춥니다.',
  },

  // ---------------------------------------------------------------- United States
  usLifeMale: {
    population: '미국의 남성',
    definition: '출생 시 평균 여명. NCHS의 2024년 확정값',
    asOf: '2024년',
    verifyNote: '출처에서 확인했습니다(2026-10-19). 출처의 표가 ‘남성’의 값으로 제시하고 있습니다(2023년은 75.8년).',
  },
  usLifeMaleAt10: {
    population: '10세까지 산 미국의 남성',
    definition:
      '평균 사망 연령. 출생 시 평균 여명 76.5년에, 일본의 값에서 출생 시와 10세 시점의 차이(81.60 − 81.35 = 0.25년)를 더한 가정. 사망 확률의 조정에 사용',
    asOf: '2024년',
    verifyNote: '미국의 10세 시점 평균 여명은 확보하지 못했습니다. 출생 시 평균 여명(76.5년)은 확인했으며, 10세 시점으로의 보정은 일본의 값을 빌린 가정입니다.',
  },
  usDraftRounds: {
    population: 'MLB 룰 4 드래프트',
    definition: '2022~26년 노사협정에 따른 드래프트 라운드 수',
    asOf: '2026년',
    verifyNote: '출처(MLB 공식 용어집)의 요약으로 확인했습니다(2026-10-19). 규칙의 값이며, 인원수 통계가 아닙니다.',
    note: '2028년부터의 자격 변경안(20세 이상·고교 졸업 후 2년)은 제안이며, 현행이 아닙니다.',
  },
  usArbitrationYears: {
    population: 'MLB 선수',
    definition: '연봉 조정 자격을 얻는 서비스 타임(슈퍼 투 예외 있음)',
    asOf: '2026년',
    verifyNote: '출처(MLB 공식 용어집)의 요약으로 확인했습니다(2026-10-19). 규칙의 값입니다.',
  },
  usFreeAgencyYears: {
    population: 'MLB 선수',
    definition: 'FA 자격을 얻는 서비스 타임(172일로 1년)',
    asOf: '2026년',
    verifyNote: '출처(MLB 공식 용어집)의 요약으로 확인했습니다(2026-10-19). 규칙의 값입니다.',
  },
  usMid: {
    population: '유소년 야구를 하는 남자아이',
    definition: '중학교 연령대(미들스쿨)에도 야구를 계속하는 비율',
    asOf: '-',
    verifyNote: NO_DATA + ' 미국 유소년 야구의 인원과 계속률은 확인하지 못했습니다.',
  },
  usHs: {
    population: '중학교 연령대에 야구를 계속한 남자아이',
    definition: '고등학교(4년제) 야구부에 들어가는 비율',
    asOf: '-',
    verifyNote: NO_DATA + ' 미국 고등학교의 야구 인구와 입부 비율은 확인하지 못했습니다.',
  },
  usHsStay: {
    population: '고등학교 야구부원',
    definition: '고등학교 야구부 활동을 1년 계속하는 비율(4년간 계속하는 비율을 약 60%로 가정한 값의 네제곱근)',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usHsDraft: {
    population: '고교 최종 학년까지 계속한 선수',
    definition: 'MLB 드래프트에서 지명되는 비율',
    asOf: '-',
    verifyNote: NO_DATA + ' 고교생 지명 인원과 야구부 최종 학년 인원을 연결하는 통계는 확인하지 못했습니다.',
  },
  usHsSign: {
    population: '드래프트에서 지명된 고교생',
    definition: '대학에 진학하지 않고 프로 계약을 선택하는 비율(자동 진행 시 답을 정하는 방법)',
    asOf: '-',
    verifyNote: NO_DATA + ' 지명 후 계약한 고교생의 비율은 확인하지 못했습니다.',
  },
  usHsCollege: {
    population: '고교 최종 학년까지 계속한 선수 중 지명되지 않은 선수',
    definition: '대학·2년제 대학의 야구부에서 계속하는 비율',
    asOf: '-',
    verifyNote: NO_DATA + ' NCAA의 진로 비율 페이지는 열 수 없었습니다(§6.4).',
  },
  usCollegeStay: {
    population: '대학·2년제 대학 야구부원',
    definition: '야구부 활동을 1년 계속하는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usCollegeDraft: {
    population: '드래프트 자격이 있는 대학·2년제 대학 선수',
    definition: '1년당 MLB 드래프트에서 지명되는 비율(4년제는 3학년을 마친 뒤 또는 21세부터, 2년제 대학은 언제든지)',
    asOf: '-',
    verifyNote: NO_DATA + ' 자격이 있는 인원을 확인하지 못했습니다. 구분(NCAA 1~3부·2년제 대학)에 따른 차이는 설정으로 나누어 두었습니다.',
  },
  usCollegeSign: {
    population: '드래프트에서 지명된 대학·2년제 대학 선수',
    definition: '계약을 선택하는 비율(자동 진행 시 답을 정하는 방법)',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usJucoTransfer: {
    population: '2년제 대학에서 2년을 마치고 지명되지 않은 선수',
    definition: '4년제 대학에 편입해 계속하는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usMinorUp: {
    population: '마이너리그 선수',
    definition: '1년당 한 단계 위 레벨로 올라가는 비율(레벨별 차이는 설정)',
    asOf: '-',
    verifyNote: NO_DATA + ' 마이너리그 레벨별 승격률은 확인하지 못했습니다.',
  },
  usMinorExit: {
    population: '마이너리그 선수',
    definition: '1년당 계약이 끝나 야구를 떠나는 비율',
    asOf: '-',
    verifyNote: NO_DATA,
  },
  usMlbDebut: {
    population: '더블A·트리플A 마이너리그 선수',
    definition: '1년당 MLB에 처음 출전하는 비율(레벨에 따라 차등)',
    asOf: '-',
    verifyNote: NO_DATA + ' 라운드별 MLB 도달률(1라운드 73%, 2라운드 51%, 3라운드 40%, 분석 기사)은 2차 정보이며, 여기서는 기준으로 삼았습니다.',
  },
  usMlbExit: {
    population: 'MLB 선수',
    definition: '1년당 MLB를 떠나는 비율(야수의 평균 커리어 5.6년[2차]으로부터)',
    asOf: '-',
    verifyNote: NO_DATA + ' 평균 커리어 5.6년은 1902~1993년에 커리어를 시작한 야수에 대한 연구(2차)이며, 현재의 값이 아닙니다.',
  },
  usModel: {
    population: '미국 출신의 인생',
    definition:
      '대학 구분(NCAA 1~3부·2년제 대학)의 비율과 실력에 따른 차이, 드래프트 순위와 계약금(20라운드)의 분포, 마이너리그 레벨과 연봉, MLB 연봉(최저 연봉·조정·FA)의 설정. D2·D3·2년제 대학의 학교명은 일반 명칭',
    asOf: '-',
    verifyNote:
      '구분별 비율, 순위 분포, 마이너리그 레벨·연봉, MLB 연봉의 형태는 공식 통계로 확인하지 못했으므로 모두 가정입니다. 확인된 사실은 드래프트 라운드 수·자격, 서비스 타임 규칙과 평균 여명뿐입니다.',
  },

  // ---------------------------------------------------------------- Korea and Cuba: estimates, none checked against a source
  krLifeMale: {
    population: '한국의 남성',
    definition: '출생 시 평균 여명의 대략적인 값(게임상의 추정)',
    asOf: '-',
    verifyNote: '공식 통계로 확인하지 않았습니다. 일반적으로 알려진 수준에 맞춘 게임상의 추정입니다.',
  },
  krLifeMaleAt10: {
    population: '10세까지 산 한국의 남성',
    definition: '평균 사망 연령의 추정. 출생 시 추정값에 일본의 값에서 출생 시와 10세 시점의 차이(0.25년)를 더함. 사망 확률의 조정에 사용',
    asOf: '-',
    verifyNote: '추정값에 일본의 차이를 빌린 것입니다. 통계로 확인하지 않았습니다.',
  },
  cuLifeMale: {
    population: '쿠바의 남성',
    definition: '출생 시 평균 여명의 대략적인 값(게임상의 추정)',
    asOf: '-',
    verifyNote: '공식 통계로 확인하지 않았습니다. 일반적으로 알려진 수준에 맞춘 게임상의 추정입니다.',
  },
  cuLifeMaleAt10: {
    population: '10세까지 산 쿠바의 남성',
    definition: '평균 사망 연령의 추정. 출생 시 추정값에 일본의 값에서 출생 시와 10세 시점의 차이(0.25년)를 더함. 사망 확률의 조정에 사용',
    asOf: '-',
    verifyNote: '추정값에 일본의 차이를 빌린 것입니다. 통계로 확인하지 않았습니다.',
  },
  krModel: {
    population: '한국 출신의 인생(베타 버전)',
    definition:
      '고등학교·대학 진로, 드래프트(KBO 신인 드래프트), 2군과 1군의 단계, 연봉, 병역 처리, FA까지의 연수 설정. 가계와 연금·의료비 설정도 포함',
    asOf: '-',
    verifyNote:
      'KBO의 1군 경기 수(144)와 2군 경기 수(120, 2025년 118·2026년 121로부터), 최저 연봉(3,000만 원), FA까지의 연수(고졸 8년·대졸 7년)는 공표 자료와 보도로 확인했습니다(2026-10-23). 연봉이 오르는 방식은 KBO가 공표한 평균 연봉(2026년 1억 7,536만 원)에 가깝게 맞춘 게임상의 추정입니다. 그 밖의 비율·연수·금액(계약금·병역 포함)은 공식 통계나 1차 자료로 확인하지 않은 게임상의 추정이며, 실제 제도나 수치로 취급하지 않습니다.',
  },
  cuModel: {
    population: '쿠바 출신의 인생(베타 버전)',
    definition:
      '스포츠 학교 선발, 국내 리그(세리에 나시오날) 승격, 수입, 해외 도전(MLB 구단과의 계약), 가계와 연금·의료비 설정',
    asOf: '-',
    verifyNote:
      '비율·수입·금액은 모두 공식 통계나 1차 자료로 확인하지 않은 게임상의 추정입니다. 정치·경제·제도의 상황은 게임 내 추정 모델이며, 사실로 단정하지 않습니다.',
  },
}

const JHBF_PUB = '일본고등학교야구연맹'
const JHBF_FOUNDATION = '공익재단법인 일본고등학교야구연맹'
const MEXT = '문부과학성'
const MHLW = '후생노동성'
const JABA = '공익재단법인 일본야구연맹'
const JUBF = '공익재단법인 전일본대학야구연맹'
const JUKELABO = '주케라보 예비교'
const NPB_ORG = '일본야구기구(NPB)'
const NOT_OPENED = '페이지를 열 수 없었습니다. 우회는 시도하지 않았습니다. 값은 미확인입니다.'
const GIRLS_MANAGERS = '남녀·매니저 포함 여부는 기재되어 있지 않습니다.'
const WIKI_LEAGUES = 'Wikipedia(2차 정보. 연맹의 공식 사이트와는 대조하지 않음)'

const SOURCE_KO: StatsWords['source'] = {
  jhbf: {
    title: '가맹교 수·부원 수 통계(경식)',
    original: '加盟校数・部員数統計（硬式）',
    publisher: JHBF_PUB,
    checkNote: `2026년 5월 말 가맹 3,746개교, 부원 124,116명(1학년 43,836·2학년 40,714·3학년 39,566), 계속률 90.3%를 확인했습니다. ${GIRLS_MANAGERS}`,
  },
  jhbfPref2026: {
    title: '가맹교 수·부원 수 통계(경식) 2026년·도도부현별',
    original: '加盟校数・部員数統計（硬式）2026年・都道府県別',
    publisher: JHBF_PUB,
    checkNote: `2026년 5월 말 현재 도도부현별 가맹교 수(47개 도도부현. 합계 3,746개교)와 부원 수를 확인했습니다. 학교명 목록은 실려 있지 않습니다. ${GIRLS_MANAGERS}`,
  },
  mextSchoolCode: {
    title: '학교 코드(레이와 8년 5월 1일 시점·잠정판. 갱신일 2026/5/20)',
    original: '学校コード（令和8年5月1日時点・暫定版。更新日 2026/5/20）',
    publisher: MEXT,
    checkNote:
      '전국 학교의 명칭·학교 종류·도도부현·설치 구분(국립·공립·사립)·본교/분교·소재지를 CSV로 취득했습니다(고등학교 5,127, 대학 840, 단기대학 329, 고등전문학교 58). 남녀별 정보·학과·야구부 유무·편차치는 포함되어 있지 않습니다. 페이지에 이용 조건의 기재는 없습니다.',
  },
  keinetRanking2027: {
    title: '입시 난이도 예상 일람표 2027년도 입시(학부·학과 랭크/대학별)',
    original: '入試難易予想一覧表 2027年度入試（学部学科ランク／大学別）',
    publisher: '가와이주쿠 Kei-Net',
    checkNote:
      '국공립·사립 × 7개 지역의 PDF 14개에서 학과별 편차치를 취득했습니다(가와이주쿠 젠토 모의고사의 편차치에 따른, 합격 가능성 50%의 보더라인. 2026년 10월 현재 2027년도 입시의 예상). ‘37.4 이하는 편의상 35.0’으로 하는 하한값과, 보더 프리(값 없음)가 있습니다. 도쿄대학·교토대학 등 게재되지 않은 대학이 있습니다. 이용 조건의 기재는 확인하지 못했습니다(© Kawaijuku Educational Information Network). 사용자의 허가를 받아 공개값으로 사용합니다(2026-10-18).',
  },
  jukelabo2026: {
    title: '고등학교 편차치 정보(레이와 8년도·2026년도, 47개 도도부현 페이지)',
    original: '高校偏差値情報（令和8年度・2026年度、47都道府県のページ）',
    publisher: JUKELABO,
    checkNote:
      '전일제 고등학교의 편차치를 도도부현별·공립/사립·국립별로 취득했습니다(4,556개교, 9,447행). 코스별 행이 있으며, 산출 근거가 된 모의고사는 명시되어 있지 않습니다. robots.txt는 페이지 취득을 허용하며, 사이트에서 재이용을 금지하는 이용 약관은 찾지 못했습니다(저작권 표기와 개인정보 처리방침뿐). 1.2초 간격으로 취득했습니다. 학교별 대표값은 보통과의 중앙값(없으면 전체 코스의 중앙값)입니다.',
  },
  jukelabo2026univ: {
    title: '대학 편차치 일람(학부 계통별 14페이지)',
    original: '大学偏差値一覧（学部系統別14ページ）',
    publisher: JUKELABO,
    checkNote:
      '국공립·사립 대학의 학부·시험 일정별 편차치입니다. 산출 근거가 된 모의고사·연도는 명시되어 있지 않습니다. 가와이주쿠 Kei-Net에 값이 없는 대학에만 사용하며, 대학별 대표값은 해당 행들의 중앙값입니다. 같은 대학에서 가와이주쿠의 값과 섞지 않습니다.',
  },
  jhbfTop: {
    title: '일본고등학교야구연맹 공식 사이트(대회 안내)',
    original: '日本高等学校野球連盟 公式サイト（大会の案内）',
    publisher: JHBF_PUB,
    checkNote:
      '대회 명칭 ‘선발고등학교야구대회’(제99회), ‘전국고등학교야구선수권대회’(제108회), ‘추계 지구 대회’(레이와 8년도)를 확인했습니다. 대회 회차는 게임에서 사용하지 않습니다(입학이 2041년 이후이므로).',
  },
  daily2026: {
    title: '참가 팀 33개 감소한 3,363팀, 여름 고교야구 지방 대회(2026년 6월 28일)',
    original: '参加チーム33減の3363 夏の高校野球地方大会（2026年6月28日）',
    publisher: '데일리 스포츠',
    checkNote: '3,363팀(연합팀 157개 포함), 최다는 아이치 174팀, 최소는 돗토리 21팀임을 확인했습니다.',
  },
  npbJhs: {
    title: '전국 중학생 설문조사 2025: 중체련 연식 야구부 소속 선수 대상 전국 조사(2026년 4월 17일)',
    original: '全国中学生アンケート2025 ～中体連軟式野球部所属選手への全国調査～（2026年4月17日）',
    publisher: 'NPB',
    checkNote:
      '중체련 연식 야구 선수 수 2025년 139,240명(일본중학교체육연맹 조사의 인용)을 확인했습니다. 남녀별·학년별 기재는 없습니다.',
  },
  hbnDraft: {
    title: '올해는 대학생 지명이 전체의 약 절반! [25년 드래프트](2025년 10월 23일)',
    original: '今年は大学生指名が全体の約半分！【25年ドラフト】（2025年10月23日）',
    publisher: 'hb-nippon',
    checkNote:
      '지명 116명(정식 등록 73·육성 43). 고교 33(정식 등록 19), 대학 54(40), 사회인 야구 13(12), 독립 리그 13(1), 기타 3(1)을 확인했습니다.',
  },
  numberShibou: {
    title: '긴키대학 드래프트 밀착 비화(2025년 10월 30일)',
    original: '近畿大ドラフト密着秘話（2025年10月30日、沢井史）',
    publisher: 'Number',
    checkNote: '2025년 프로 지망서 고교생 124명·대학생 176명을 확인했습니다(기사 속 기술).',
  },
  numberIkusei: {
    title: '프로야구의 “실은 육성 선수를 묵혀 두고 있다” 문제(2023년 8월 6일)',
    original: 'プロ野球“じつは育成選手を飼い殺している”問題（2023年8月6日、田尻耕太郎）',
    publisher: 'Number',
    checkNote:
      '2023년(기사 시점까지)에 육성에서 정식 등록으로 옮긴 선수가 12개 구단에서 32명임을 확인했습니다. 12개 구단 육성 선수의 총수는 기재되어 있지 않습니다.',
  },
  npbCareer: {
    title: '2024년 방출/현역 은퇴 선수의 진로 조사 결과',
    original: '2024年戦力外／現役引退選手の進路調査結果',
    publisher: 'NPB',
    checkNote:
      '2024년의 157명(외국인 선수와 같은 구단에서의 육성 재계약은 제외), 평균 26.3세·재적 6.3년, 진로 내역을 확인했습니다.',
  },
  npbCareer2025: {
    title: '2025년 방출/현역 은퇴 선수의 진로 조사 결과',
    original: '2025年戦力外／現役引退選手の進路調査結果',
    publisher: 'NPB',
    checkNote:
      '2025년의 169명, 평균 27.2세(2025년 10월 31일 시점)·재적 6.8년, 진로 NPB 관계 90·그 밖의 야구 54·야구 이외 17·미정 8을 확인했습니다.',
  },
  npbCareerTrend: {
    title: '방출/현역 은퇴 선수의 진로 조사 결과 [참고] 과거 추이(2021~2025년)',
    original: '戦力外／現役引退選手の進路調査結果【参考】過去推移（2021～2025年）',
    publisher: 'NPB',
    checkNote: '2021~2025년의 대상 인원(143·145·153·157·169), 평균 연령, 평균 재적 기간, 진로 구분별 합계 인원을 확인했습니다.',
  },
  npbTeams: {
    title: '12개 구단(센트럴리그, 퍼시픽리그)',
    original: '12球団（セントラル・リーグ、パシフィック・リーグ）',
    publisher: 'NPB',
    checkNote: '센트럴리그 6개 구단과 퍼시픽리그 6개 구단의 명칭을 확인했습니다(2026년 페이지).',
  },
  iblj: {
    title: '시코쿠 아일랜드리그 plus 공식 사이트',
    original: '四国アイランドリーグplus 公式サイト',
    publisher: '시코쿠 아일랜드리그 plus',
    checkNote:
      '리그명과 4개 구단(도쿠시마 인디고삭스, 가가와 올리브 가이너스, 에히메 만다린 파이리츠, 고치 파이팅 도그스)을 확인했습니다. 2026년 10월 16일 자 공지가 있습니다.',
  },
  bcl: {
    title: '루트인 BC리그 공식 사이트(팀 정보)',
    original: 'ルートインBCリーグ 公式サイト（チーム情報）',
    publisher: '루트인 BC리그',
    checkNote:
      '‘팀 정보’ 페이지에서 2026년 9개 구단의 정식 명칭(후쿠시마 레드호프스, 이바라키 아스트로플래닛츠, 지바 스카이세일러스, 도치기 골든브레이브스, 사이타마 무사시 히트베어스, 가나가와 퓨처드림스, 군마 다이아몬드페가수스, 야마나시 파이어윈즈, 시나노 그랜세로즈)을 확인했습니다. 도쿄 구단은 준가맹이므로 사용하지 않습니다.',
  },
  nlb: {
    title: '니혼카이 리그 공식 사이트(팀 정보)',
    original: '日本海リーグ 公式サイト（チーム情報）',
    publisher: '니혼카이 리그',
    checkNote:
      '팀 정보에서 이시카와 밀리언스타스, 도야마 GRN 선더버즈, SHIGA HIJUMPS의 3개 구단을 확인했습니다(뉴스에 가나자와 드래곤크로스와 기후 테크노아 다이아몬드리버스의 정식 가맹 승인이 기재되어 있으나, 팀 정보에는 실려 있지 않으므로 사용하지 않습니다).',
  },
  jabaRenmeiho2026: {
    title:
      '일본야구연맹 연맹보 2026(2026년 6월 발행. 변경 사항과, 2026년도 JABA 각 지구 연맹 주최 대회의 출전 팀 목록)',
    original: '日本野球連盟連盟報2026（2026年6月発行。変更事項と、2026年度JABA各地区連盟主催大会の出場チーム一覧）',
    publisher: JABA,
    checkNote:
      '2025년도 가맹 팀의 변경 사항(신규 가맹·활동 재개·활동 휴지·해산 탈퇴·명칭 변경. 종별·가맹 지방 단체·지구 연맹 포함)과, 2026년도 지구 연맹 주최 대회에 출전하는 팀명(지구별)을 확인했습니다. 전체 가맹 팀의 명부는 실려 있지 않습니다(가맹 팀 수는 도도부현별로 게재).',
  },
  jabaSenshuken2026: {
    title: '제51회 사회인야구 일본선수권대회 출전 팀 목록(2026.10.9 현재)',
    original: '第51回社会人野球日本選手権大会 出場チーム一覧（2026.10.9現在）',
    publisher: JABA,
    checkNote: '일본선수권 출전 팀(대표 지구별, 출전 횟수 포함)의 명칭을 확인했습니다. 지구 연맹은 실려 있지 않습니다.',
  },
  jubfLeagues: {
    title: '전일본대학야구연맹 가맹 연맹(각 연맹 페이지의 ‘가맹 대학’ 란. 27개 연맹)',
    original: '全日本大学野球連盟 加盟連盟（各連盟のページの「加盟大学」欄。27連盟）',
    publisher: JUBF,
    checkNote:
      '27개 연맹 전체의 명칭·공식 사이트 URL·가맹교 수·가맹 대학명을 연맹의 공식 페이지(league_info.php?leagueid=01~27)에서 확인했습니다. 가맹 대학은 총 370개교(학부·캠퍼스·고등전문학교·단기대학 단위인 것 포함). 부(1부·2부)의 구분은 실려 있지 않습니다.',
  },
  jubfChampions: {
    title: '전일본대학야구선수권대회 우승교·준우승교 목록(2005~2026년)',
    original: '全日本大学野球選手権大会 優勝校・準優勝校一覧（2005〜2026年）',
    publisher: JUBF,
    checkNote: '2005년부터 2026년까지의 우승교와 준우승교(2020년은 중지)를 확인했습니다.',
  },
  jhbfSummerOuting: {
    title: '전국고등학교야구선수권대회 출전교 목록(제86회~제106회)과 대표교 페이지(제107·108회)',
    original: '全国高等学校野球選手権大会 出場校一覧（第86回〜第106回）と代表校のページ（第107・108回）',
    publisher: JHBF_FOUNDATION,
    checkNote:
      '2004~2026년 여름 대회의 대표교(지방 대회별. 학교명은 통칭)와 2026년 기준 통산 출전 횟수를 확인했습니다. 2020년은 중지되었습니다.',
  },
  jhbfSpringOuting: {
    title: '선발고등학교야구대회 출전교 목록(제76회~제97회)과 대표교 페이지(제98회)',
    original: '選抜高等学校野球大会 出場校一覧（第76回〜第97回）と代表校のページ（第98回）',
    publisher: JHBF_FOUNDATION,
    checkNote:
      '2004~2026년 봄 대회의 출전교(도도부현별. 통칭)와 2026년 기준 통산 출전 횟수를 확인했습니다. 2020년은 중지되었으므로 제외합니다.',
  },
  npbStandings: {
    title: 'NPB 구단 승패표(센트럴·퍼시픽 양 리그 2023~2025년 최종 순위)',
    original: 'NPB 球団の勝敗表（セ・パ両リーグ 2023〜2025年の最終順位）',
    publisher: NPB_ORG,
    checkNote: '2023·2024·2025년 최종 승패표(12개 구단)의 승·패·무·승률을 확인했습니다.',
  },
  wikiNcaaD1Baseball: {
    title: 'List of NCAA Division I baseball programs(Wikipedia. 대학명·주·콘퍼런스)',
    publisher: 'Wikipedia(2차 정보. NCAA의 공식 페이지와는 대조하지 않음)',
    checkNote:
      '2026년 NCAA 1부(디비전 I) 야구팀 표(대학명·주·콘퍼런스)를 옮겨 적었습니다. NCAA 2부·3부, NAIA, 2년제 대학(NJCAA)은 수록하지 않았습니다.',
  },
  npbDraft: {
    title: '프로야구 드래프트 회의 지명 결과(2021~2025년, 구단별. 정식 등록·육성)',
    original: 'プロ野球ドラフト会議の指名結果（2021〜2025年、球団ごと。支配下・育成）',
    publisher: NPB_ORG,
    checkNote:
      '2021~2025년 지명 선수 615명의 출신(학교·기업·독립 리그 구단)을 12개 구단 페이지에서 확인했습니다. 선수명은 기록하지 않았습니다.',
  },
  wikiHsResults: {
    title:
      '전국고등학교야구선수권대회(○○현 팀)와 전국고등학교야구선수권 ○○대회(Wikipedia. 여름 고시엔에서의 승패와, 도도부현 대회의 우승·준우승)',
    original: '全国高等学校野球選手権大会 (○○県勢) と 全国高等学校野球選手権○○大会（Wikipedia。夏の甲子園での勝敗と、都道府県大会の優勝・準優勝）',
    publisher: 'Wikipedia(2차 정보. 일본고등학교야구연맹의 기록과 1경기씩 대조하지는 않음)',
    checkNote:
      '47개 도도부현의 지역 팀 페이지에서 2004~2026년 여름 고시엔의 승패를, 각 지방 대회 페이지에서 2011~2025년의 우승·준우승교를 취득했습니다. 우승교 606건은 일본고등학교야구연맹의 대표교 목록과 100% 일치했습니다. 미야자키·효고·야마구치의 지방 대회는 일부만 읽을 수 있었습니다. 봄·가을 도도부현 대회는 취득하지 못했습니다.',
  },
  wikiJubfLeagues: {
    title: '전일본대학야구연맹(Wikipedia. 가맹 연맹 목록과 가맹교 수)',
    original: '全日本大学野球連盟（Wikipedia。加盟連盟の一覧と加盟校数）',
    publisher: WIKI_LEAGUES,
    checkNote:
      '가맹 연맹 27개(홋카이도 2·도호쿠 3·간토고신에쓰 7·호쿠리쿠도카이 3·간사이 5·주고쿠시코쿠 3·규슈 4)의 명칭과 가맹교 수를 확인했습니다. 각 연맹의 가맹 대학명은 실려 있지 않습니다.',
  },
  wikiUnivLeagueMembers: {
    title:
      '도쿄 6대학 야구연맹·도토 대학야구연맹·간사이 학생야구연맹·슈토 대학야구연맹·간사이 6대학 야구연맹(Wikipedia. 가맹 대학)',
    original: '東京六大学野球連盟・東都大学野球連盟・関西学生野球連盟・首都大学野球連盟・関西六大学野球連盟（Wikipedia。加盟大学）',
    publisher: WIKI_LEAGUES,
    checkNote:
      '도쿄 6대학 6개교, 도토 1~4부 22개교(2026년 춘계 리그 개시 시점), 간사이 학생 6개교, 슈토 1·2부 16개교(2025년 추계 리그 종료 시점), 간사이 6대학 6개교의 대학명을 확인했습니다. 그 밖의 21개 연맹의 가맹 대학명은 확인하지 않았습니다.',
  },
  jpbpaGuide2022: {
    title: '프로야구 선수를 목표로 하는 선수·가족 여러분께(2022년판)',
    original: 'プロ野球選手を目指す選手・ご家族の皆さんへ（2022年版）',
    publisher: '일본프로야구선수회',
    checkNote:
      'p.5 ‘선수 계약의 내용’ 표에서 정식 등록 선수의 최저 연봉 {yen~:4200000}(세금 별도)·육성 선수의 최저 연봉 {yen~:2300000}(세금 별도), 정식 등록 선수의 추가 참가보수 ‘(1,600만 엔 − 연봉) / 150 × 1군 등록 일수’(육성은 없음)를 확인했습니다. 자료는 2022년판이며, 2025·2026년도의 금액과 규정은 확인하지 못했습니다(야구협약의 조문 자체는 공개되어 있지 않아 미확인). 게임은 소유자의 지시에 따라 이 표의 정식 등록 최저 연봉 {yen~:4200000} 및 추가 참가보수를 2025년도의 기준으로 사용합니다. 게임에서 쓰는 육성 선수 최저 연봉 값({yen~:2400000})은 이 표의 육성 최저 연봉({yen~:2300000}, 세금 별도)과 일치하지 않습니다. {yen~:2400000}의 근거는 미확인이며, 값은 소유자의 지시로 그대로 두고 있습니다.',
  },
  salary2026: {
    title: '2026년 프로야구 선수 평균 연봉은 5,216만 엔(2026년 5월 18일)',
    original: '2026年のプロ野球選手平均年俸は5216万円（2026年5月18日）',
    publisher: 'nippon.com(일본프로야구선수회 조사)',
    checkNote: '확인 내용: 정식 등록 선수로 공시된 일본인 선수 713명, 평균 {yen~:52160000}, 중앙값 {yen~:20000000}.',
  },
  mextHealth2024: {
    title: '레이와 6년도 학교보건통계(학교보건통계조사 결과) 확정값(2025년 2월 12일 공표)',
    original: '令和6年度学校保健統計（学校保健統計調査の結果）確定値（2025年2月12日公表）',
    publisher: MEXT,
    checkNote:
      '남자의 연령별(5~17세, 4월 1일 현재 만 나이) 키·몸무게 평균값을 확인했습니다(예: 17세 170.8cm·62.2kg). 표본 조사입니다(발육 상태는 전체 유아·아동·학생의 5.2%).',
  },
  mhlwWage2025: {
    title: '레이와 7(2025)년 임금구조기본통계조사 개황 ‘성별로 본 임금’ 제2표',
    original: '令和7(2025)年賃金構造基本統計調査の概況「性別にみた賃金」第2表',
    publisher: MHLW,
    checkNote:
      '남자의 연령 계급별 임금(천 엔)을 확인했습니다: ~19세 212.5, 20~24세 245.7, 25~29세 288.0, 30~34세 330.4, 35~39세 366.2, 40~44세 398.2, 45~49세 420.7, 50~54세 437.5, 55~59세 445.6, 60~64세 358.5, 65~69세 304.3. ‘임금’의 정의(소정 내 급여액 등)는 이 페이지에 쓰여 있지 않으므로 미확인입니다.',
  },
  ipssPop2024T0623: {
    title: '인구통계자료집(2024) 표 6-23 성별 50세 시점 미혼 비율, 유배우 비율, 사별 비율 및 이별 비율: 1920~2020년',
    original: '人口統計資料集（2024）表6-23 性別50歳時の未婚割合，有配偶割合，死別割合および離別割合：1920～2020年',
    publisher: '국립사회보장·인구문제연구소',
    checkNote:
      '표의 ‘남·미혼’ 2020년 값 28.25%를 확인했습니다(2010년 20.14%, 2015년 24.77%). 표의 주: 총무성 통계국 ‘국세조사 보고’로 산출. 45~49세와 50~54세 비율의 평균값. 2015년·2020년은 불상 보완값에 근거.',
  },
  statLabor2025: {
    title: '노동력조사(기본집계) 2025년(레이와 7년) 평균 결과 요약',
    original: '労働力調査（基本集計）2025年（令和7年）平均結果の要約',
    publisher: '총무성 통계국',
    checkNote: '2025년 평균 완전실업률 2.5%, 남성 2.7%를 확인했습니다.',
  },
  mhlwLife2025: {
    title: '레이와 7(2025)년 간이생명표 개황 ‘주요 연령의 평균 여명’',
    original: '令和7(2025)年簡易生命表の概況「主な年齢の平均余命」',
    publisher: MHLW,
    checkNote: '남자의 평균 수명 81.35년(전년 81.09년), 남자의 10세 평균 여명 71.60년을 확인했습니다.',
  },
  ncaa: {
    title: 'Baseball: Probability of competing beyond high school',
    publisher: 'NCAA',
    checkNote: '2026-10-17: 이 URL은 NCAA 홈페이지로 전송되어 페이지를 열 수 없었습니다. 값은 미확인입니다.',
  },
  baDraftRounds: {
    title: 'How Many MLB Draftees Make It To The Majors(2019년 5월 17일, J.J. Cooper)',
    publisher: 'Baseball America',
    checkNote:
      '1981~2010년에 계약한 지명 선수의 메이저리그 도달률 1라운드 73%·2라운드 51%·3라운드 40%를 확인했습니다. 4라운드 이후의 값은 기재되어 있지 않습니다.',
  },
  bpDraftRounds: {
    title: 'The Baseball Draft: A 50-Year Retrospective, Part Two(2014년 6월 9일, Allan Simpson)',
    publisher: 'Baseball Prospectus',
    checkNote:
      '1라운드 69.0%(1965~2009년, 1,198명 중 827명), 2라운드 46.5%, 3라운드 37.8%, 4라운드 31.3%를 확인했습니다. 2라운드 이후의 대상 연도는 기재되어 있지 않습니다.',
  },
  witnauer: {
    title: 'Witnauer et al. 2007(MLB 야수의 평균 커리어)',
    publisher: 'University of Colorado(콜로라도대학교)',
    checkNote: '1902~1993년에 커리어를 시작한 야수 5,989명의 평균이 5.6년이며, 5명 중 1명은 1년만 뛰었다는 것을 확인했습니다.',
  },
  mlbRoster2025: {
    title: '2025년 개막 로스터의 해외 출신 선수',
    publisher: 'MLB',
    checkNote: `2026-10-17: 서버가 HTTP 406을 반환해 ${NOT_OPENED}`,
  },
  bloombergIntl: {
    title: 'Dominican Republic seeks fair play for young ballplayers eyeing MLB(2022년 10월 18일)',
    publisher: 'Bloomberg Línea',
    checkNote:
      '2012~16년에 계약한 도미니카 선수 2,294명 중 110명이 MLB 구단에 입단했다는 것을 확인했습니다. 2024~25년의 국제 계약 1,011명과 ‘3~5%’라는 기술은 이 기사에 없습니다.',
  },
  kbo2026: {
    title: 'KBO 2026년 드래프트 보도',
    publisher: '국민일보(kukinews)',
    checkNote: `2026-10-17: 서버가 HTTP 403을 반환해 ${NOT_OPENED}`,
  },
  cpbl2025: {
    title: '중화직업야구: 180명이 6개 구단의 좁은 문으로 몰렸다!(2025년 6월 20일)',
    original: '中職／180人搶進六隊窄門！（2025年6月20日）',
    publisher: 'TVBS',
    checkNote: '2025년 드래프트 신청자 180명, 그중 그해 졸업 예정 고교생 72명을 확인했습니다.',
  },
  elbowStudy: {
    title:
      '하라다 미키오 외, ‘유소년 야구 선수에 대한 초음파를 이용한 팔꿈치 검진’, 임상정형외과(Rinsho Seikei Geka) 42권 6호 pp.555-560(2007년 6월)',
    original: '原田幹生ほか「少年野球選手に対する超音波を用いた肘検診」臨床整形外科 42巻6号 pp.555-560（2007年6月）',
    publisher: '이가쿠쇼인(야마가타대학 의학부 정형외과 등)',
    checkNote:
      '초록에서, 초등학교 야구팀 선수 247명 중 48명에게서 초음파로 상완골 내측상과의 견열이 발견되었음을 확인했습니다. 대상의 지역·남녀는 초록에 기재되어 있지 않습니다. 이전 출처(신슈대학 사이트의 PDF)는 쓰쿠바대학의 다른 연구였으며, 이 값은 실려 있지 않았습니다.',
  },
  fangraphsTJ: {
    title: 'Ten interesting facts about Tommy John surgery(2018년 4월 18일, Jon Roegele)',
    publisher: 'FanGraphs(The Hardball Times)',
    checkNote: '2017년에 등판한 MLB 투수의 26%가 이 수술을 받은 이력이 있다는 것을 확인했습니다.',
  },
  nchsDb548: {
    title: 'Mortality in the United States, 2024(NCHS Data Brief No. 548, 2026년 1월)',
    publisher: 'CDC·미국 국립보건통계센터(NCHS)',
    checkNote:
      '2026-10-19: 2024년 확정값으로서 출생 시 평균 여명이 남성 76.5년(2023년은 75.8년), 여성 81.4년, 남녀 전체 79.0년임을 페이지 본문에서 확인했습니다. 10세 시점의 평균 여명은 확보하지 못했습니다.',
  },
  mlbRule4: {
    title: 'Rule 4 Draft(MLB 공식 용어집)와 2026 MLB Draft 개요',
    publisher: 'MLB',
    checkNote:
      '2026-10-19: 검색 결과의 요약으로 확인했습니다(페이지 본문 전체는 확보하지 못했습니다). 2022~26년 노사협정에서 드래프트는 20라운드입니다. 고등학교를 졸업하고 대학에 진학하지 않은 선수와, 2년제 대학에 1년 이상 재학한 선수가 대상입니다(2년제 대학 학생은 전원 대상). 4년제 대학은 3학년을 마친 뒤 또는 21세가 되었을 때. 미국 또는 캐나다 거주자. 2028년부터의 자격 변경(20세 이상·고교 졸업 후 2년)은 MLB의 제안이며, 현행이 아닙니다.',
  },
  mlbServiceTime: {
    title: 'Service Time·Free Agency·Salary Arbitration(MLB 공식 용어집)',
    publisher: 'MLB',
    checkNote:
      '2026-10-19: 검색 결과의 요약으로 확인했습니다(본문 전체는 확보하지 못했습니다). 1시즌은 187일이며, 현역 로스터 또는 부상자 명단에 있는 하루가 1일로 계산되고, 172일이 1년의 서비스 타임이 됩니다. 6년이면 FA, 3년이면 연봉 조정(2~3년 차 선수 중 전년도 86일 이상인 상위 22%는 슈퍼 투로서 조정 대상. 기준은 매년 바뀜).',
  },
}

/** the units of the statistics (data/stats.ts `unit`), as the parameters table writes them after the value */
const UNIT_KO: StatsWords['unit'] = {
  人: '명',
  校: '개교',
  割合: '비율',
  チーム: '팀',
  歳: '세',
  年: '년',
  万円: '만 엔',
  年あたり: '1년당',
  対数の標準偏差: '로그의 표준편차',
  年あたりの自己相関: '1년당 자기상관',
  標準偏差: '표준편차',
  cm: 'cm',
  kg: 'kg',
  '点／標準偏差': '점/표준편차',
  'km/h': 'km/h',
  '-': '-',
  点: '점',
  '千円（月額）': '천 엔(월액)',
  か月分: '개월분',
  巡: '라운드',
}

/** the names of the independent leagues, the regional federations of company baseball and the major universities the statistics page lists */
const NAME_KO: StatsWords['name'] = {
  四国アイランドリーグplus: '시코쿠 아일랜드리그 plus',
  ルートインBCリーグ: '루트인 BC리그',
  日本海リーグ: '니혼카이 리그',
  北海道: '홋카이도',
  東北: '도호쿠',
  北信越: '호쿠신에쓰',
  関東: '간토',
  東海: '도카이',
  近畿: '긴키',
  中国: '주고쿠',
  四国: '시코쿠',
  九州: '규슈',
  東京大学: '도쿄대학',
  京都大学: '교토대학',
  大阪大学: '오사카대학',
  東北大学: '도호쿠대학',
  名古屋大学: '나고야대학',
  九州大学: '규슈대학',
  北海道大学: '홋카이도대학',
  一橋大学: '히토쓰바시대학',
  東京科学大学: '도쿄과학대학',
  早稲田大学: '와세다대학',
  慶應義塾大学: '게이오기주쿠대학',
  上智大学: '조치대학',
  明治大学: '메이지대학',
  青山学院大学: '아오야마가쿠인대학',
  立教大学: '릿쿄대학',
  中央大学: '주오대학',
  法政大学: '호세이대학',
  関西大学: '간사이대학',
  関西学院大学: '간세이가쿠인대학',
  同志社大学: '도시샤대학',
  立命館大学: '리쓰메이칸대학',
}

/** what a source's deviation scores are (data/schools/deviation*.json `exam`), by source id */
const EXAM_KO: StatsWords['exam'] = {
  keinetRanking2027: '가와이주쿠 젠토 모의고사의 보더 편차치(합격 가능성 50% 라인. 2026년 10월 현재의 예상)',
  jukelabo2026univ: '주케라보 예비교가 공개한 대학 편차치(산출 근거가 된 모의고사는 명시되어 있지 않음)',
  jukelabo2026: '주케라보 예비교가 공개한 고등학교 편차치(산출 근거가 된 모의고사는 명시되어 있지 않음)',
}

export const STATS_KO: StatsWords = { stat: STAT_KO, source: SOURCE_KO, unit: UNIT_KO, name: NAME_KO, exam: EXAM_KO }
