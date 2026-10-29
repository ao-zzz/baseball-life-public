import { lang } from './index.ts'
import { moneyTokens } from './currency.ts'

// The update history (src/data/changelog.ts, written in Japanese) in other languages, by its Japanese line: a line changed or added
// in Japanese has no translation until one is written here (the tests list it), and is shown in Japanese until then.

const EN: Record<string, string> = {
  '歯科・医科・薬科・看護・教育の大学に進むと、歯科医師・医師・薬剤師・看護師・教員の道が開けるようにしました。医・歯・薬は6年で卒業し、国家試験（3回まで）に合格するとその仕事に就けます。開業や夜勤、母校のチームドクターなどの出来事もあります。合格率と年収はゲーム上の仮定です。':
    'Entering a dental, medical, pharmacy, nursing or education university now opens the way to work as a dentist, doctor, pharmacist, nurse or teacher. Medicine, dentistry and pharmacy take six years; passing the national exam (up to three tries) opens the job. There are events such as opening his own practice, night shifts and becoming his old team’s doctor. The pass rates and the pay are game assumptions.',
  '若くして戦力外になり、合同トライアウトでも声がかからなかったとき、独立リーグや大学への入り直しを選べるようにしました。':
    'A young player released by his club who gets no offer at the joint tryout can now choose an independent league or going back to university.',
  'プロ志望届を出すかどうかの質問に、指名の見込みを表示するようにしました（ゲーム上の推定）。中学・高校の代表の選考会は、U-15・U-18日本代表と表示します。':
    'The question of submitting the pro draft declaration now shows his chances of being drafted (a game estimate). The national-team trials in junior high and high school are now shown as Japan’s U-15 and U-18 teams.',
  '社会人野球を引退して社業に専念したとき、勤め先を表示するようにしました。':
    'When a company-team player retires to work for the company, the screen now shows where he works.',
  '背番号の表示が記録とずれることがある不具合、自営の人に職場の送別会が出る不具合、独り身なのに家族を集める選択肢、一度試した趣味の誘いがまた来る不具合を直しました。転居や転勤の質問に、引っ越さない答えを加えました。':
    'Fixed: the shirt number on screen sometimes not matching the record, a workplace farewell party for a self-employed man, a choice that gathered the family of a man who has none, and an invitation to a hobby he had already tried coming back. The questions about moving house or a transfer now include not moving.',
  '野球のあとの仕事に、プロゲーマー、動画配信者、アイドル・歌手・俳優・タレント、漫画家・小説家・イラストレーター、起業、自衛官、政治家、野球解説者・コーチ・スカウト・球団フロントの道を加えました。それぞれに始まり・成功・失敗・転身があり、珍しい道ほど条件が厳しく、まれにしか開けません。':
    'New careers after baseball: pro gamer, streamer, idol, singer, actor, TV personality, manga artist, novelist, illustrator, founder, Self-Defense Forces, politician, baseball commentator, coach, scout and front office. Each has its start, success, failure and change of course; the rarer the path, the stricter its conditions and the more seldom it opens.',
  'ゲームの中だけの「話題になる出来事」（思いがけない注目、投稿の炎上と謝罪・休止・復帰、昔の仲間との和解、地域への貢献など）を加えました。実際のSNSへの投稿はしません。':
    'New in-game “talk of the town” events (unexpected attention, a post that gets flamed and the apology, break and comeback, making up with old teammates, helping the community). Nothing is posted to real social media.',
  '息子が野球を始めると、少年野球から中学・高校・甲子園、大学・社会人・独立リーグ、ドラフト・プロまでの歩みが記録に残るようにしました。統計にもとづく確率で、プロ入りは保証されません。結果画面の家族の欄に、息子の野球の到達点を表示します。':
    'When his son takes up baseball, the record now follows the son from youth baseball through junior high, high school and Koshien, university, company or independent-league ball, to the draft and the pros. The chances come from the statistics, and turning pro is never guaranteed. The family section of the result screen shows how far the son went.',
  'メジャーに挑戦した日本の選手が1年で戻ることが多すぎたのを、契約の年数と成績で残留を決めるように直しました。':
    'Japanese players who went to the majors came back after one season far too often; whether they stay now depends on the length of the contract and how they play.',
  '自営業や店主に「課長」などの役職が付く表示、失業や退職のあとに前の勤め先の出来事が起きる不具合、定年の質問が2回出る不具合を直しました。':
    'Fixed: a shop owner or self-employed man shown with a company post such as section manager, events of a former employer after losing or leaving the job, and the retirement-age question coming twice.',
  '独立リーグの入団テストが、能力が高くても通りにくかったのを、能力とチームの水準で合否が決まるように直しました。大学野球で、能力の高い選手が控えに回りやすかった偏りを小さくしました。':
    'Independent-league tryouts were hard to pass even for strong players; the result now depends on his ability and the team’s level. In university baseball, strong players are less often left on the bench.',
  '韓国語版（/ko/）と台湾向けの繁体字中国語版（/zh-tw/）を公開しました。画面の文章、人生の記録や質問、統計と出典、各ページを読めます。':
    'Korean (/ko/) and Traditional Chinese for Taiwan (/zh-tw/) versions are out. The screens, the life record and the questions, the statistics and sources, and every page can be read in them.',
  '韓国語版の金額は韓国ウォン、繁体字中国語版は台湾ドルで表示します（固定の目安で、実際の為替レートではありません）。実在の資料から引いた金額は円のまま、目安を添えています。':
    'The Korean version shows amounts in Korean won and the Traditional Chinese version in New Taiwan dollars (fixed guides, not real exchange rates). Amounts quoted from real sources stay in yen, with a guide beside them.',
  'タイトル画面の言語の切り替えに、韓国語と繁体字中国語を加えました。': 'The language switch on the title page now includes Korean and Traditional Chinese.',
  '英語版では、金額を米ドルで表示するようにしました（1ドル＝150円の固定の目安で、実際の為替レートではありません）。実在の資料から引いた金額は円のまま、ドルの目安を添えています。':
    'The English version now shows amounts in US dollars (at a fixed guide of ¥150 to the dollar, not a real exchange rate). Amounts quoted from real sources stay in yen, with a rough dollar figure beside them.',
  '韓国の人生で、KBOの試合数（1軍144・2軍120）、最低年俸、FAまでの年数（高卒8年・大卒7年）を公表資料に合わせ、年俸と契約金の水準を公表された平均年俸や報道に近づけました。':
    'In Korean lives, the KBO’s games (144 on the first team, 120 on the second), minimum salary and years until free agency (8 from high school, 7 from university) now follow published sources, and the levels of salaries and signing bonuses are closer to the published average salary and to reports.',
  'キューバの国内リーグの試合数（75）と、アメリカの人生のメジャー（162）とマイナー（レベル別）の試合数を、実際の日程に合わせました。':
    'The games of Cuba’s national league (75), and of the majors (162) and the minors (by level) in American lives, now follow the real schedules.',
  '韓国の人生の注記と統計ページで、確認できた数値とゲーム上の推定を分けて示すようにしました。':
    'The notes in Korean lives and the statistics page now show which figures are confirmed and which are game estimates.',
  '英語版を公開しました（/en/）。画面の文章、人生の記録や質問、統計と出典、各ページを英語で読めます。':
    'The English version is out (/en/). The screens, the life record and the questions, the statistics and sources, and every page can be read in English.',
  'タイトル画面に、日本語と英語を切り替えるリンクを加えました。': 'Added a link on the title page to switch between Japanese and English.',
  '英語版のページに、英語のページタイトルと、共有したときに表示されるタイトルと説明を用意しました。':
    'The English pages have an English page title, and an English title and description shown when the page is shared.',
  'プライバシーポリシーを、人数カウンターの通信、Cloudflare での配信、共有の方法など、実際の動作に合わせて書き直しました。':
    'Rewrote the privacy policy to match what the app actually does, including the life counter’s communication, delivery through Cloudflare and the ways of sharing.',
  '日本からメジャーリーグに渡った年にも、試合数・打率・本塁打・防御率などの年度別成績が残るようにしました。成績はゲーム上の仮定で作ったもので、実在のMLBの記録ではありません。':
    'Years spent in the major leagues after leaving Japan now keep their own season records too: games, batting average, home runs, ERA and more. These records are made from in-game assumptions and are not real MLB records.',
  'MLBの成績は、プロの年度別成績の表と記録の欄で、NPBの通算と分けて表示します。':
    'MLB records are shown in the table of pro seasons and in the records panel, apart from the NPB career totals.',
  'キューバの選手がメジャーやマイナーでプレーした年が、表で「1軍」「2軍」と出ていた表示を直しました。':
    'Fixed the table showing “first team” and “second team” for the years a Cuban player spent in the majors or the minors.',
  '進学や退団など進路を決める質問が、その年の出来事のあとに、その時期に合ったものだけ出るようにしました。選べる答えが1つしかない質問は出なくなりました。':
    'Questions about the next step, such as going on to school or leaving a team, now come after the events of the year and only when they fit the time. Questions with only one possible answer no longer appear.',
  '学歴の表示を整えました。学力の高い高校生には大学の候補を多く示し、就職を考えている高校生も大学を受験する道を選べるようにしました。大学の野球部の入部テストに落ちたときは、翌年の再挑戦や準硬式野球部も選べます。':
    'Tidied how education is shown. Academically strong high school students are offered more universities, and those thinking of getting a job can also choose to sit university entrance exams. A player who fails a university baseball club’s tryout can try again the next year or join the semi-hardball club.',
  '選んだ答えと結果の文章が合わないことがある点を直しました（子どもの野球、指導者の誘いなど）。野球をやめた理由とけがの有無が食い違わないようにし、共有する文章の年齢も画面の表示に合わせました。':
    'Fixed cases where the text of a result did not match the answer chosen (children’s baseball, coaching offers and others). The reason for quitting baseball now agrees with whether he was injured, and the age in the shared text matches the one on screen.',
  'プロ野球選手の背番号が、移籍したときや1軍で活躍したときに変わるようにしました。日本のプロ野球では、年俸1,600万円未満の支配下選手が1軍に登録された日数に応じて追加報酬（1軍の最低保障）を受け取るようにし、支配下選手の最低年俸を資料に合わせて420万円にしました。':
    'A pro player’s uniform number now changes when he moves to another club or does well on the first team. In Japanese pro baseball, a registered player earning less than {yen~:16000000} now receives extra pay for his days on the first-team roster (the first-team minimum guarantee), and the minimum salary of a registered player is now {yen~:4200000}, as in the sources.',
  '出身地とは別に、今住んでいる場所を表示するようにしました。転勤や引っ越しの出来事では行き先が分かるようにしました（プロ球団に在籍している間など、分からないときは表示しません）。':
    'Where he lives now is shown apart from where he was born. Transfers and moves now say where he went (when it is not known, for example while he is with a pro club, nothing is shown).',
  '高校野球の試合の見どころを記録に残すようにしました。趣味、仕事（会社名は架空）、家族（待ってもらったプロポーズをもう一度申し込むなど）、政界の出来事を見直し、一部を増やしました。':
    'Highlights of high school games are now kept in the record. Reviewed the events about hobbies, work (company names are fictional), family (such as proposing again after being asked to wait) and politics, and added some.',
  '別のバージョンで保存した人生に、このバージョンにない統計が含まれていても、「この人生に出てきた統計」の表示で画面が止まらないようにしました。':
    'A life saved in another version no longer stops the screen at “statistics in this life” when it contains a statistic this version does not have.',
  'プロ野球の最低年俸と1軍の最低保障の根拠として日本プロ野球選手会の資料（2022年版）を示し、2025・2026年度の額は確認できていないことを明記しました。育成選手の最低年俸（240万円）の根拠を確認できていないことも、統計と出典のページに記しました。':
    'The Japan Professional Baseball Players Association’s material (2022 edition) is now shown as the source of the pro minimum salary and the first-team minimum guarantee, with a note that the amounts for 2025 and 2026 have not been confirmed. The statistics and sources page also notes that the source of the development players’ minimum salary ({yen~:2400000}) has not been confirmed.',
  '家族・子ども・孫・仕事の状況と食い違う文章を直しました（家族のいない人に「家族を集めて」、子どものいない人に「子どもの家」、仕事を離れた人に職場や同僚の話が出る、など）。仕事を失った年に、その仕事についての質問が出ることもなくなりました。':
    'Fixed texts that did not match his family, children, grandchildren or work (“gathering the family” for someone with no family, “his child’s home” for someone with no children, talk of the workplace and colleagues after leaving work, and so on). Questions about a job no longer come in the year he lost it.',
  '20歳未満の人物に、飲酒を示す文章が出ないようにしました。': 'Texts about drinking no longer appear for anyone under 20.',
  '介護のために仕事を辞めると、実際に退職した扱いになるようにしました。介護している間は、仕事を探しません。':
    'Leaving work to care for a family member now really counts as leaving the job. While caring, he does not look for work.',
  '高校野球の大会と甲子園の判定を、出身地ではなく、高校の所在県で行うようにしました。':
    'High school tournaments and Koshien are now decided by the prefecture of his high school, not of his birthplace.',
  'アメリカの人生に「初孫」の出来事を加え、孫が出てくる出来事と人生の記録がそろうようにしました。':
    'Added a “first grandchild” event to American lives, so that events with grandchildren match the life record.',
}

/** each language's lines, by the Japanese one (Japanese is the data itself) */
export const CHANGES: Record<string, Record<string, string>> = { en: EN }

/** a language's lines of the history, once fetched (packs.ts: Korean changelogKo.ts, Traditional Chinese changelogZhTW.ts) */
export function addChanges(l: string, lines: Record<string, string>) {
  CHANGES[l] = lines
}

/** a line of the update history in the language now (the Japanese line when it has no translation yet) */
export function changeText(ja: string): string {
  const l = lang()
  return moneyTokens(CHANGES[l]?.[ja] ?? ja, l)
}
