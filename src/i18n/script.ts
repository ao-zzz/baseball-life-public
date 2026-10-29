// What counts as "still Japanese" in a translated text, by language (the multilingual work). English and Korean use no kanji, so any
// kana or kanji left is Japanese. Traditional Chinese for Taiwan shares the kanji: there a text is still Japanese when it has kana, or
// a character Japanese writes in its own new form (県 for 縣, 歳 for 歲…); and a simplified character (们, 这…) has no place in it
// either. The lists are of the characters this game's texts can meet, not every one: they catch a text left in Japanese or written
// in the wrong script, and the tests run them on every translated text.

const KANA = /[ぁ-んァ-ヶー々〆]/
const KANJI = /[一-龠〇]/

/** the forms Japanese writes in its own way (shinjitai and kokuji) where Taiwan writes another character */
const JAPANESE_FORMS =
  '亜悪圧囲医壱隠営栄駅円塩縁応欧殴桜奥横温穏仮価画会絵拡覚学楽渇巻陥勧寛歓観関顔帰気戯犠旧拠挙峡狭暁区駆勲径恵掲渓経蛍軽継鶏撃倹剣圏検権献県険顕験厳効広恒鉱号国黒済砕斎剤雑参惨蚕賛残糸歯児辞湿実写釈寿収従渋獣縦粛処叙奨将焼称証乗剰壌嬢条状畳譲醸触嘱寝尽図粋酔随髄数枢瀬声斉静窃摂専浅践銭潜繊禅双壮争荘捜挿巣装騒増臓蔵続堕対体帯滞滝択沢担単胆団断弾遅昼鋳庁徴聴転伝灯当盗稲闘徳独読届縄弐悩脳覇廃拝売麦発髪抜晩蛮仏払塀辺変舗歩宝豊毎万満黙訳薬与誉揺様謡来頼乱覧竜両猟緑涙塁励礼霊齢暦歴恋炉労楼録湾歳戦点込枠畑峠匂働'

/** simplified characters (mainland China), never written in Taiwan */
const SIMPLIFIED =
  '们这个说话为东车门发时对过还进见长现义觉开问间听让书头买卖给济电网马鸟鱼龙爱办边产场处带导动风关观欢华机记纪价节举乐类论难农亲钱请认势岁条图团无戏线乡选样页艺议应拥员远运杂职种众专转资总组么获赛队绩击签约级联业军训练败胜负输赢亿读该没将么热闹谁样'

const NOT_TAIWAN = new RegExp(`[${JAPANESE_FORMS}${SIMPLIFIED}]`)

/** the characters of a text that should not be in a translation into the language (empty when the text is fine) */
export function untranslated(text: string, l: string): string[] {
  if (l === 'ja') return []
  const out = new Set<string>()
  for (const ch of text) {
    if (KANA.test(ch)) out.add(ch)
    else if (l === 'zh-TW' ? NOT_TAIWAN.test(ch) : KANJI.test(ch)) out.add(ch)
  }
  return [...out]
}

/** how many characters of a text should not be in a translation into the language (to choose the best of two partial ones) */
export function untranslatedCount(text: string, l: string): number {
  if (l === 'ja') return 0
  let n = 0
  for (const ch of text) if (KANA.test(ch) || (l === 'zh-TW' ? NOT_TAIWAN.test(ch) : KANJI.test(ch))) n++
  return n
}

/** a translated text with nothing of Japanese (or of the wrong script) left in it */
export const isTranslated = (text: string, l: string): boolean => untranslated(text, l).length === 0
