// Words of baseball and of school that a first-time player may not know (PROJECT_PLAN §11.61). A short meaning each; shown under a
// question that uses the word and on the lines of the record that use it. The meanings are the common ones; the game's own
// assumptions are said so where they matter. A word is matched by a pattern, so that 育成 in 「後輩の育成」 is not taken for the contract.

export interface Term {
  word: string
  re: RegExp
  meaning: string
}

export const GLOSSARY: Term[] = [
  { word: 'コンバート', re: /コンバート/, meaning: '守る位置（ポジション）を、別の位置に変えること。' },
  { word: '支配下', re: /支配下/, meaning: '球団の正式な選手枠（1球団70人まで）に入っていること。1軍の試合に出られる。' },
  { word: '育成選手', re: /育成(選手|契約|指名|枠|\d+位|で|から|の選手)/, meaning: '支配下の枠の外で結ぶ契約の選手。1軍の試合には出られず、支配下になれば出られる。' },
  { word: 'ポスティング', re: /ポスティング/, meaning: '海外FA権のない選手が、所属球団の承認を得て、メジャーの球団と交渉する制度。認めるかどうかは球団が決める。' },
  { word: 'FA', re: /FA|フリーエージェント/, meaning: 'フリーエージェント。決められた年数を1軍で過ごした選手が、どの球団とも契約の交渉ができる権利。海外の球団とも交渉できるのが海外FA権。' },
  { word: '戦力外', re: /戦力外/, meaning: '球団から、来季は契約しないと告げられること。' },
  { word: 'トライアウト', re: /トライアウト/, meaning: '契約を目指す選手が、球団の前でプレーを見せる場。戦力外になった選手が受ける合同トライアウトなどがある。' },
  { word: 'プロ志望届', re: /プロ志望届/, meaning: '高校生・大学生がプロのドラフトで指名を受けるために出す届け。出さないと指名されない。' },
  { word: 'ドラフト指名', re: /指名/, meaning: 'ドラフト会議で、球団が獲りたい選手を選ぶこと。指名されると、その球団と契約の交渉をする。' },
  { word: '2軍', re: /2軍|ファーム/, meaning: '1軍の下のチーム。若手を育て、調子を整える場。' },
  { word: '契約更改', re: /契約更改|更改/, meaning: '球団と、翌年の年俸などを話し合って、契約を結び直すこと。' },
  { word: '社会人野球', re: /社会人野球/, meaning: '会社などのチームでする野球。多くは社員として働きながら選手を続ける。' },
  { word: '独立リーグ', re: /独立リーグ/, meaning: 'NPB（日本のプロ野球）とは別のプロのリーグ。NPBを目指す選手も多い。' },
  { word: 'スポーツ推薦', re: /スポーツ推薦/, meaning: '競技の実績で入学を認める推薦入試。学力の試験より、野球の評価で決まる。' },
  { word: '学校推薦', re: /学校推薦/, meaning: '学校の成績（評定）と校長の推薦で受ける入試。' },
  { word: '一般入試', re: /一般入試/, meaning: '学力の試験で合否を決める入試。' },
  { word: '評定', re: /評定/, meaning: '高校の成績の平均（5段階）。推薦入試で使われる。' },
  { word: '浪人', re: /浪人/, meaning: '大学に入らず、次の年の受験に向けて1年勉強すること。' },
  { word: '留年', re: /留年/, meaning: '単位などが足りず、同じ学年をもう一度やり直すこと。' },
  { word: 'ベンチ外', re: /ベンチ外/, meaning: '試合に出る登録メンバー（ベンチ入り）に入れないこと。' },
  { word: '守備固め', re: /守備固め/, meaning: '試合の終盤に、守りを強くするために途中から守備につく役割。' },
  { word: '代走', re: /代走/, meaning: '塁に出た選手に代わって、走者になる役割。' },
  { word: '代打', re: /代打/, meaning: '打順の選手に代わって、打席に立つ役割。' },
]

/** the words of the glossary used in these texts, in the glossary's order, each once */
export function termsIn(...texts: (string | undefined)[]): Term[] {
  const all = texts.filter(Boolean).join('\n')
  return GLOSSARY.filter((t) => t.re.test(all))
}
