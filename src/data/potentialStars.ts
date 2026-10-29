// The ★ of the potential mode (PROJECT_PLAN §11.21–11.22): the words shown at the choice, and what trials of the model give for each.
// What a ★ changes: the distribution of the hidden talent, how fast and how well he is developed, a lead over his age group in the
// early years, and how much of the talent the scouts and recruiters see. It does not change a country's base rate or a stage check.
// Nothing here is a statistic about real players.

export const starMarks = (n: number) => '★'.repeat(n) + '☆'.repeat(10 - n)

export interface StarInfo {
  title: string
  text: string
}

export const STAR_INFO: Record<number, StarInfo> = {
  1: { title: '一般人・リアリティ重視', text: '素質はふつう（倍率1倍）。現実に近い基準で、ほとんどの人は高校のどこかで野球を離れます。' },
  2: { title: '少し運動神経のよい子', text: '素質がわずかに高め。チームでは、中心の一人になることがあります。' },
  3: { title: '地元で評判の子', text: '地元では目立つ素質。伸びる環境に恵まれれば、強い高校や大学に進む道が開けます。' },
  4: { title: '県内で名前の出る素質', text: '県内の大会で名前が出る素質。進路の選択肢は広がりますが、育ち方しだいです。' },
  5: { title: '全国の舞台を狙える素質', text: '甲子園や全国大会を狙える素質。プロの道も視野に入りますが、怪我や相性で、伸びきらないこともあります。' },
  6: { title: '全国レベルの素質', text: '全国でも通用しうる素質。プロのスカウトの目にとまる可能性が出てきます。' },
  7: { title: '全国でも指折りの素質', text: 'プロ入りが現実味を帯びる素質。それでも、見つけられるのが遅れたり、出番に恵まれなかったりします。' },
  8: { title: 'プロが追いかけうる素質', text: 'プロの球団が注目しうる素質。多くの関門を、すべて通れるとは限りません。' },
  9: { title: '球界でも珍しい素質', text: '球界でも珍しい素質。成功するかどうかは、育成・出場機会・健康・決断がそろうかにかかっています。' },
  10: { title: '世界的な逸材候補', text: 'MLBに届く道も起こりえる素質。ただし、保証はありません。怪我・環境・出場機会・指導者との相性・発見の遅れで、開花しないことも、プロに届かないこともあります。' },
}

export interface StarTrial {
  /** share of lives (0..1) that reached each stage in the trials */
  r5: number
  r6: number
  r8: number
  r10: number
}

/**
 * Trials of the model: potential mode, Japan, decisions left to おまかせ, N lives per ★ (2026-10-20, after the posting rule of
 * PROJECT_PLAN §11.61 and the height of the ★ of §11.63; seeds from 7,000,000; scripts/startrials.ts). Not statistics
 * about real players. The measures, fixed: r5 went on with baseball after high school (university, company team, independent
 * league, or the pros), r6 reached NPB as a 育成 player or higher, r8 played in the NPB first team, r10 played in MLB; the
 * denominator is every life of that ★.
 */
export const STAR_TRIALS_N = 10000
export const STAR_TRIALS: Record<number, StarTrial> = {
  1: { r5: 0.104, r6: 0.004, r8: 0.003, r10: 0 },
  2: { r5: 0.173, r6: 0.015, r8: 0.011, r10: 0 },
  3: { r5: 0.271, r6: 0.047, r8: 0.036, r10: 0.002 },
  4: { r5: 0.396, r6: 0.114, r8: 0.087, r10: 0.006 },
  5: { r5: 0.53, r6: 0.224, r8: 0.177, r10: 0.014 },
  6: { r5: 0.659, r6: 0.367, r8: 0.307, r10: 0.035 },
  7: { r5: 0.76, r6: 0.528, r8: 0.456, r10: 0.069 },
  8: { r5: 0.843, r6: 0.675, r8: 0.609, r10: 0.126 },
  9: { r5: 0.905, r6: 0.796, r8: 0.737, r10: 0.205 },
  10: { r5: 0.945, r6: 0.882, r8: 0.837, r10: 0.307 },
}
