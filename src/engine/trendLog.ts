import type { EventCtx } from './events.ts'
import { markSeen } from './events.ts'
import type { LifeState } from './types.ts'
import { hasGrandkids } from './events/spec.ts'

// 世間の小ネタ (PROJECT_PLAN §11.18): short, light lines about trends, food, technology, net culture and everyday
// oddities of Japan, Korea, Taiwan and elsewhere, mixed into the life log. Log only: no choice, no effect, no check;
// they are shown on screen only (never in headless runs), drawn on their own random stream (so a life is the same
// with or without them), and each is told at most once in a life.
//
// All texts are original, written from general trends and customs rather than from any one piece of news. They do
// not name real people, companies, schools or teams, and they leave out disasters, accidents, crime, war, politics
// and discrimination. They are not real news: the first one of a life is preceded by a note saying so.

export type TrendRegion = 'jp' | 'kr' | 'tw' | 'world' | 'net'
export type TrendTheme = 'food' | 'tech' | 'ai' | 'net' | 'life' | 'sport' | 'word' | 'culture' | 'baseball'

export interface Trend {
  id: string
  region: TrendRegion
  theme: TrendTheme
  text: string
  /** ages at which the line fits (default 12–120) */
  ages: [number, number]
  /** game years in which it fits (technology of the 2020s) */
  years?: [number, number]
  when?: (s: LifeState) => boolean
}

const player = (s: LifeState) => !!s.bb
const fan = (s: LifeState) => !!s.bb || s.career.highestRank > 0

interface Opts {
  ages?: [number, number]
  years?: [number, number]
  when?: (s: LifeState) => boolean
}
const KID: [number, number] = [5, 11]
const TEEN: [number, number] = [11, 19]
const ADULT: [number, number] = [20, 120]
const WORK: [number, number] = [24, 64]
const SENIOR: [number, number] = [60, 120]
const NOW: [number, number] = [2026, 2075]

const RAW: [TrendRegion, TrendTheme, string, Opts?][] = [
  // ------------------------------------------------------------ Japan
  ['jp', 'food', 'コンビニの新作おにぎりの具が毎月増え、どれにするか迷った末に、いつもの鮭に手が伸びるのがお約束です。'],
  ['jp', 'life', 'サウナのあとの「整った」をどう言葉にするかで、昼休みの会話が三十分も続くことがあるそうです。', { ages: WORK }],
  ['jp', 'life', '駅のホームで、全員が同じ角度でスマホをのぞき込む光景に、ふと笑ってしまうのは、自分もその一人だからでしょう。', { ages: TEEN }],
  ['jp', 'life', '梅雨の間に折りたたみ傘の新色が次々と出て、傘立てが妙にカラフルになりました。'],
  ['jp', 'food', '自動販売機に「あたたかいのとつめたいの、ちょうど真ん中」の飲み物が並び、一部で「ぬるい」と評判になっているらしい。', { ages: TEEN }],
  ['jp', 'word', '今年の流行語の候補に、誰も使ったことのない言葉が混じっているのは、毎年のお楽しみです。', { ages: TEEN }],
  ['jp', 'life', '推しのグッズに使うお金を、家計簿の別の欄に分けて管理する人が、まわりで増えているようです。', { ages: TEEN }],
  ['jp', 'food', '回転寿司のタブレットで、孫がだまって十皿ぶん注文していて、そっと財布を押さえました。', { ages: SENIOR, when: hasGrandkids }],
  ['jp', 'life', '宅配ボックスに自分宛てでない荷物が入っていて、管理人さんと二人で、しばらく首をかしげました。', { ages: WORK }],
  ['jp', 'tech', '家電量販店の掃除ロボットが、店内の宣伝より先に迷子になっているのは、きっと見学コースのつもりなのでしょう。', { ages: TEEN }],
  ['jp', 'life', '商店街のスタンプカードが、いつのまにかアプリのポイントに変わっていました。', { ages: [30, 120] }],
  ['jp', 'culture', '焼き芋の屋台のあの歌が、年々リミックスされている気がします。'],
  ['jp', 'culture', 'お花見では、場所取りの青いシートが、夜のうちに整然と並んでいました。', { ages: TEEN }],
  ['jp', 'life', 'ゆるキャラの着ぐるみが、猛暑のために交代制になったと聞き、中の人をねぎらいたくなります。', { ages: TEEN }],
  ['jp', 'life', '年賀状じまいの文面に、毎年ちがう工夫をこらす人がいると知り、感心するばかりです。', { ages: [30, 120] }],
  ['jp', 'life', 'レジ袋が有料になって何年もたつのに、エコバッグを家に忘れる日がまだ続いています。', { ages: ADULT }],
  ['jp', 'life', '電車の中吊り広告が、ひとつ残らず「整う系」の商品でした。', { ages: WORK }],
  ['jp', 'life', '近所の公園に犬用の水飲み場ができて、散歩仲間のあいさつがひとつ増える、ささやかな幸せです。', { ages: ADULT }],
  ['jp', 'culture', '学校の自由研究で、毎年一定数「なぜ猫は箱に入るのか」が出てくるそうです。', { ages: [7, 14] }],
  ['jp', 'food', '地元の祭りの屋台に「唐揚げ入りたこ焼き」が登場し、賛否は真っ二つで、半分ずつ頼む人が多いようです。', { ages: TEEN }],
  ['jp', 'food', '給食の冷凍みかんが、なぜ最後まで凍っているのか、教室で全員が議論するのが、毎年の恒例です。', { ages: [7, 14] }],
  ['jp', 'culture', '友だちの間で、消しゴムのカスで作る小さな粘土遊びが流行りました。', { ages: KID }],
  ['jp', 'culture', '休み時間の「だるまさんがころんだ」に、いつのまにか新ルールが加わっていました。', { ages: [5, 11] }],
  ['jp', 'culture', '雨の日の帰り道、水たまりの深さを競う遊びが流行り、靴下が全部ぬれました。', { ages: [6, 12] }],
  ['jp', 'life', '近所の銭湯の脱衣所に、番台の代わりに「ご自由にどうぞ」の牛乳コーナーができていました。', { ages: ADULT }],
  ['jp', 'life', '夏の猛暑で日傘を差す男性が増え、父も試して「意外と涼しい」と言いました。', { ages: TEEN }],
  ['jp', 'life', '冬のこたつの前で、誰もが動けなくなる現象は、毎年の恒例行事です。'],
  ['jp', 'food', '商店街のコロッケ屋が、揚げたてのときだけ見せる行列の長さに、毎回感心します。', { ages: TEEN }],
  ['jp', 'word', '若者の言葉が月ごとに変わり、意味を聞くタイミングを逃し続けています。', { ages: [30, 120] }],
  ['jp', 'word', '孫の使う言葉を辞書で引いたのに載っておらず、孫に聞くと「辞書が古いんだよ」と言われる始末です。', { ages: SENIOR, when: hasGrandkids }],
  // ------------------------------------------------------------ Korea
  ['kr', 'food', '韓国風のチキンが夜食の定番になり、甘辛いタレの種類を語る人が増えているらしい。', { ages: TEEN }],
  ['kr', 'food', 'ホットクの屋台に、チーズ入りの新作が並び、長い行列ができているのが日常です。', { ages: TEEN }],
  ['kr', 'food', '友人がキンパを巻く練習を始め、最初の一本は、具がぜんぶはみ出していました。', { ages: TEEN }],
  ['kr', 'culture', '韓国ドラマを一気見して、気づけば朝になっていた、という話が周りで増えているようです。', { ages: TEEN }],
  ['kr', 'culture', 'K-POPの振り付けを覚えるのが、運動会の準備より盛り上がるのが不思議です。', { ages: [8, 15] }],
  ['kr', 'food', '韓国の屋台のトッポッキの辛さに、涙目で完食した友人がいて、全員で拍手を送りたくなります。', { ages: TEEN }],
  ['kr', 'culture', '韓国の若者の間でフィルムカメラ風の写真が人気だと聞き、押入れから古いカメラを出してみました。', { ages: TEEN }],
  ['kr', 'life', '韓国式のパックを夜に貼ったまま眠り、朝に枕に張りついていました。', { ages: TEEN }],
  ['kr', 'food', '韓国のかき氷は、写真映えが良すぎて、食べる前に溶けかけているのが定番だそうです。', { ages: TEEN }],
  ['kr', 'food', '韓国のカフェの季節限定ラテを再現しようとして、台所が泡だらけになるのがオチです。', { ages: TEEN }],
  ['kr', 'word', 'ハングルの形がかわいくて、ノートにまねして書いたら、自分にも読めない暗号になるのがお決まりです。', { ages: [10, 120] }],
  ['kr', 'food', '韓国の友人に教わった二日酔いに効くスープを試すと、確かに翌朝が軽くなりました。', { ages: WORK }],
  ['kr', 'life', '韓国のチムジルバンで、汗をかきながら食べるゆで卵が、なぜあんなにおいしいのか、真剣に考えてしまうのは私だけでしょうか。', { ages: ADULT }],
  ['kr', 'food', '近所のスーパーの韓国海苔のコーナーが、気づけば一段ぶん増えていました。', { ages: ADULT }],
  ['kr', 'baseball', '韓国の野球場では、スタンド全体が踊るように応援すると聞き、一度見てみたいものです。', { when: fan }],
  ['kr', 'culture', '韓国の漫画アプリで、縦にスクロールして読む形式が、日本でも当たり前になっていました。', { ages: TEEN, years: NOW }],
  ['kr', 'life', '韓国の友人が言う「ご飯食べた？」が、あいさつだと知り、毎回つい本気で答えてしまいます。', { ages: ADULT }],
  // ------------------------------------------------------------ Taiwan
  ['tw', 'food', '台湾の夜市の屋台の写真を見て、無性に小籠包が食べたくなるのは、仕方のないことです。'],
  ['tw', 'food', 'タピオカの流行がひと巡りして、今度は「タピオカ入りのかき氷」が静かに復活していました。', { ages: TEEN }],
  ['tw', 'food', '台湾の朝ごはんの定番「蛋餅」を見よう見まねで作り、巻きすぎて春巻きになるのは、どうやらお約束のようです。', { ages: TEEN }],
  ['tw', 'food', '台湾のコンビニのおにぎりを紹介する動画で、具の組み合わせの自由さに感心するばかりです。', { ages: TEEN, years: NOW }],
  ['tw', 'culture', '台湾では、ごみ収集車が音楽を流しながら走ると聞き、ごみ出しがダンスの時間のように思えてきます。', { ages: TEEN }],
  ['tw', 'culture', '台湾の友人が旧正月の赤い封筒の話をしてくれて、お年玉の額を比べて盛り上がるのが、お正月の楽しみです。', { ages: TEEN }],
  ['tw', 'culture', '台湾茶の教室で、お湯の温度をめぐる議論に巻き込まれました。', { ages: ADULT }],
  ['tw', 'food', '台湾スイーツの豆花を食べると、やさしい甘さで、その日一日がおだやかになる気がします。', { ages: TEEN }],
  ['tw', 'baseball', '台湾の野球場では、トランペットと太鼓で、試合中ずっと応援が続くと聞き、体力に驚くばかりです。', { when: fan }],
  ['tw', 'food', '台湾のパイナップルケーキを手土産にもらい、全員が「もう一個」と言いながら食べました。', { ages: TEEN }],
  ['tw', 'life', '台湾には猫と一緒に店番をする店が多いと聞き、猫の勤務時間が気になって仕方がありません。', { ages: TEEN }],
  ['tw', 'life', '台湾旅行で屋台のお姉さんに「日本人？」と聞かれてうなずくと、おまけをもらいました。', { ages: ADULT }],
  ['tw', 'culture', '台湾の朝の公園で、体操とダンスが入り混じる光景を見て、早起きの価値を教えてくれるのかもしれません。', { ages: ADULT }],
  ['tw', 'food', '台湾発のふわふわ焼き菓子の店が近所にできて、昼休みに行列ができていました。', { ages: WORK }],
  ['tw', 'food', '友人が台湾から持ち帰った牡蠣オムレツのたれが、うちの冷蔵庫の中で主役になっています。', { ages: ADULT }],
  ['tw', 'tech', '台湾の友人が使う小さなロボット掃除機には、なぜか全員に名前がついていました。', { ages: ADULT, years: NOW }],
  // ------------------------------------------------------------ the rest of the world
  ['world', 'food', 'イタリアの食事は、前菜から締めまで何時間もかけることがあると知り、想像だけで満腹になりそうです。', { ages: TEEN }],
  ['world', 'life', '北欧には、午後三時のコーヒー休憩を大切にする習慣があると聞き、毎日の暮らしに取り入れたいものです。', { ages: WORK }],
  ['world', 'culture', 'ブラジルのカーニバルの練習風景を見て、体力の使い方がまったく違うと感じずにはいられません。', { ages: TEEN }],
  ['world', 'food', 'インドのカレーは地域によって別の食べ物のように違うと知り、近所のカレー屋を巡ってみたくなります。', { ages: TEEN }],
  ['world', 'life', 'フランスのパン屋では、バゲットの持ち帰り方に流儀があると聞き、まねして腕に抱えて帰りました。', { ages: TEEN }],
  ['world', 'food', 'メキシコ料理の店で、辛さの調整を店員に任せたら、涙が出る辛さが出てくることがあります。', { ages: ADULT }],
  ['world', 'culture', 'アフリカの市場の色あざやかな布の写真を見て、部屋のカーテンを替えたくなります。', { ages: TEEN }],
  ['world', 'life', 'オーストラリアでは夏にクリスマスを海で過ごす人が多いと聞き、冬の日本ではうらやましい限りです。', { ages: TEEN }],
  ['world', 'food', 'トルコの紅茶は小さなグラスで何杯も飲むと聞き、まねをして、夜に眠れなくなりました。', { ages: ADULT }],
  ['world', 'food', 'ベトナム風のコーヒーに練乳を入れると、朝の甘さが新鮮でした。', { ages: ADULT }],
  ['world', 'culture', 'モロッコの市場に積まれた香辛料の山の写真を眺めて、台所の棚を一段増やしました。', { ages: ADULT }],
  ['world', 'food', 'タイの屋台料理の辛さに、観光客のほうが涙ぐむ動画を見て、自分もそうなりそうだと思わずにいられません。', { ages: TEEN }],
  ['world', 'life', 'ドイツでは日曜日にお店がほとんど閉まると知り、効率のよい休み方だと感心するばかりです。', { ages: ADULT }],
  ['world', 'life', 'スペインの昼寝の習慣をまねしてみたら、午後はずっとぼんやりしてしまいました。', { ages: WORK }],
  ['world', 'sport', 'アメリカの高校では、応援のチアリーダーの練習も、本気の部活だと聞きました。', { ages: TEEN }],
  ['world', 'baseball', 'メキシコの野球ファンは、試合中ずっとラッパと歌で応援すると聞き、耳栓を持っていくことにしました。', { when: fan }],
  ['world', 'baseball', 'ドミニカの子どもたちが手作りのグラブで野球をする写真を見て、道具の大切さをあらためて思います。', { when: fan }],
  ['world', 'life', 'オランダでは自転車のラッシュアワーがあると知り、一度その流れにまぎれてみたくなりました。', { ages: TEEN }],
  ['world', 'culture', 'ギリシャのカフェで猫がのんびり寝ている写真を見て、世界の猫は働き者の顔をしていると思いました。', { ages: TEEN }],
  ['world', 'sport', 'ケニアの長距離走者の朝練の動画を見て、起きる時間の早さに背筋が伸びる思いです。', { ages: TEEN }],
  ['world', 'word', 'カナダの人は天気の話から会話を始めると聞き、毎朝、窓の外を見て話題を仕込むようになりました。', { ages: ADULT }],
  ['world', 'life', 'アイスランドでは温泉に入りながら会議のような雑談をすると聞き、湯船で仕事の話をする自分を想像しました。', { ages: WORK }],
  ['world', 'culture', 'インドの結婚式は何日も続くと聞き、休暇の取り方を勉強しなければと思いました。', { ages: ADULT }],
  ['world', 'food', 'ハワイ風のパンケーキが日本に定着して、行列の長さにも驚かなくなりました。', { ages: TEEN }],
  ['world', 'sport', '南米のサッカーの応援を動画で見て、スタンド全体が一つの生き物のようだと感じました。', { ages: TEEN }],
  ['world', 'life', 'ロンドンの人は小雨なら傘をささないと聞き、傘の存在意義を考えさせられます。', { ages: ADULT }],
  ['world', 'culture', 'ペルーの高地では星空がとても近く見えると聞き、いつか行ってみたいものです。', { ages: TEEN }],
  ['world', 'food', 'ポルトガルの焼き菓子を食べてみたら、シナモンの量が人生観を変えるほどです。', { ages: ADULT }],
  ['world', 'life', '北欧の家具の組み立て説明書は、言葉がなくても伝わると聞き、その自信がどこまで通用するか試したくなるものです。', { ages: ADULT }],
  ['world', 'culture', 'モンゴルの子どもたちが馬に乗って学校に通うと聞き、通学路の長さを想像するばかりです。', { ages: [7, 14] }],
  ['world', 'food', 'エチオピアのコーヒーの儀式は、豆を煎るところから時間をかけると知り、インスタントの罪深さを思いました。', { ages: ADULT }],
  // ------------------------------------------------------------ net, AI and technology
  ['net', 'ai', '対話AIに明日の天気を聞いたら、天気の説明より先に「まず深呼吸をしましょう」と返ってきて、笑いました。', { years: NOW, ages: TEEN }],
  ['net', 'ai', '対話AIに野球のルールを聞くと、なぜか「ダブルスチール」の説明だけ異様に熱がこもっていました。', { years: NOW, ages: TEEN, when: fan }],
  ['net', 'ai', '対話AIに夕食のメニューを相談すると、結論が「とりあえず冷蔵庫を開けましょう」でした。', { years: NOW, ages: ADULT }],
  ['net', 'ai', '画像生成AIが作った「ネコとおにぎりの運動会」の絵が、友人のグループで回ってきました。', { years: NOW, ages: TEEN }],
  ['net', 'ai', 'AIに俳句を作らせたら、季語が全部「おでん」でした。', { years: NOW, ages: ADULT }],
  ['net', 'ai', 'AI翻訳が「お疲れさまです」を何通りにも訳してくれて、どれが正解か分からなくなりました。', { years: NOW, ages: WORK }],
  ['net', 'ai', '音声アシスタントが、返事のたびに少しずつ口調が丁寧になっている気がします。', { years: NOW, ages: ADULT }],
  ['net', 'tech', 'スマートウォッチが「そろそろ立ち上がりましょう」と促すたび、全員が一斉に立つ会議室がありました。', { ages: WORK, years: NOW }],
  ['net', 'tech', '自動運転の実験が街のあちこちで見られ、運転手の昼寝が新しい風景になるのかもしれないと思いました。', { ages: ADULT, years: NOW }],
  ['net', 'net', 'ネットのミームで、まったく意味のない二文字が数日間、全員の会話に混ざりました。', { ages: TEEN }],
  ['net', 'net', 'ありがとうの絵文字を一日に何回送ったか数えてみると、思ったより多くて照れてしまいます。', { ages: TEEN }],
  ['net', 'net', '「猫が飼い主にお説教する動画」を友人と見せ合っているうちに、一時間が過ぎていました。', { ages: WORK }],
  ['net', 'net', '「加工しない自然な一枚」が流行ると聞き、加工アプリを開く手が止まりました。', { ages: TEEN }],
  ['net', 'net', '動画を1.5倍速で見るのが当たり前になり、会話まで早口になっていました。', { ages: TEEN }],
  ['net', 'tech', 'スマホのメモに「あとで読む」を溜めすぎて、永遠に読まない記事が増えていくのが常です。', { ages: TEEN }],
  ['net', 'tech', '電子レンジのボタンを押す前の「ピッ」の回数を数える遊びを、なぜか家族全員で始めました。', { ages: TEEN }],
  ['net', 'net', 'オンライン会議の背景に映った本棚の本が気になり、休憩時間の話題になるのも、オンライン会議ならではです。', { ages: WORK, years: NOW }],
  ['net', 'net', '友人がオンラインゲームで「初心者です」と言いながら、上級者のように動いていて、周りが笑いました。', { ages: TEEN }],
  ['net', 'life', 'ネット通販の箱が中身の何倍も大きく届き、箱に入ろうとする猫との戦いが始まりました。', { ages: TEEN }],
  ['net', 'life', '材料が三つのレシピ動画ほど、なぜか台所が散らかります。', { ages: TEEN }],
  ['net', 'tech', 'スマホの充電が1パーセントになると、人はなぜか全力で走り出す、という説を周りで検証していました。', { ages: TEEN }],
  ['net', 'tech', '写真フォルダに同じ構図の写真が三百枚あって、整理は永遠に終わりそうにありません。', { ages: TEEN }],
  ['net', 'tech', 'パスワードを忘れた回数を友人と競い、勝者は誰も嬉しくありませんでした。', { ages: ADULT }],
  ['net', 'net', 'ネットで見た「一日一回、深呼吸」の習慣が、続いたのは三日間でした。', { ages: TEEN }],
  ['net', 'tech', '新しいスマホの設定には三時間かかり、気づけば窓の外が暗くなる、というのが世の常です。', { ages: ADULT }],
  ['net', 'net', 'ネットの掲示板で「子どものころの変な遊び」が盛り上がり、自分だけの遊びが全国共通だったと知る、あの瞬間はたまりません。', { ages: ADULT }],
  ['net', 'tech', 'ロボット掃除機にあだ名をつけたら、家族全員がその名前で呼ぶようになりました。', { ages: TEEN, years: NOW }],
  ['net', 'tech', 'ドローンが撮った映像で、見慣れた町が別の場所に見えて、散歩に出たくなりました。', { ages: TEEN, years: NOW }],
  ['net', 'tech', '電子書籍の端末の電池残量が、いつも「あと3日」のまま減らない気がします。', { ages: ADULT }],
  ['net', 'net', '友だちとの間で「既読がつくまでの時間」を競う謎のルールが生まれ、すぐに全員が疲れ果てるのがオチです。', { ages: TEEN }],
  ['net', 'net', '子どもたちの間で、変顔のスタンプだけで会話が成立する遊びが流行っていました。', { ages: [8, 15] }],
  ['net', 'ai', 'AIに「お母さんに謝る文章」を頼んだら、いきなり三千字の大作が出てきて、本人に読み上げて笑われました。', { years: NOW, ages: TEEN }],
  ['net', 'ai', '宿題をAIに頼もうとした友人が、答えより先に「自分の言葉で書くコツ」を教えられて、複雑な顔をしていました。', { years: NOW, ages: [11, 18] }],
  ['net', 'ai', 'AIが選んだ「今日のラッキーアイテム」が、三日連続で「ゆで卵」でした。', { years: NOW, ages: TEEN }],
  ['net', 'ai', '近所のおじいさんが対話AIに話しかけて、そのまま三十分も昔話をしていました。', { years: NOW, ages: [14, 70] }],
  // ------------------------------------------------------------ sport and everyday, around baseball and not
  ['jp', 'sport', '市民マラソンで、仮装した人たちの後ろを走ると、不思議と元気が出ました。', { ages: ADULT }],
  ['world', 'sport', '近所の公園で、名前も知らないラケット遊びが始まり、ルールは三人で決めました。', { ages: TEEN }],
  ['jp', 'sport', 'サッカー好きの友人は、試合のない日も、スコア予想だけで一日が終わっていました。', { ages: TEEN }],
  ['jp', 'sport', 'ボルダリングの壁を登る人たちの会話は、ほぼ「その石、どこで見つけたの」でした。', { ages: TEEN }],
  ['jp', 'sport', 'ジムのマシンが、使うたびに「がんばりました」と褒めてくれて、少し照れました。', { ages: ADULT, years: NOW }],
  ['jp', 'sport', '運動会のムカデ競走で、足並みが揃うまでの会話が、競技より盛り上がりました。', { ages: [6, 14] }],
  ['jp', 'sport', '冬のスキー場で、リフトのたびに毎回違う人と相席になり、会話が続きました。', { ages: TEEN }],
  ['jp', 'life', 'ボードゲームのカフェでは、ルール説明に一時間、遊びは三十分でした。', { ages: TEEN }],
  ['jp', 'life', '自転車のヘルメットが年々おしゃれになり、帽子売り場と見分けがつきません。', { ages: TEEN }],
  ['jp', 'baseball', '球場の売店に、期間限定の「応援団ラーメン」が登場し、スタンドで湯気が上がっていました。', { when: fan, ages: [8, 120] }],
  ['jp', 'baseball', '応援歌のアレンジが、いつのまにか観客のスマホの待ち受け音になっていました。', { when: fan, ages: TEEN }],
  ['jp', 'baseball', 'ベンチ裏のホワイトボードに、ミーティングの内容より長い「今日の夕飯予想」が書かれていました。', { when: player, ages: TEEN }],
  ['jp', 'baseball', 'スコアボードの電球が全部LEDになったと、年配の用具係さんがしみじみ話していました。', { when: fan, ages: TEEN }],
  ['jp', 'baseball', 'ボールを磨くのに最適な布をめぐって、先輩二人が三十分も議論していました。', { when: player, ages: TEEN }],
  ['jp', 'baseball', '試合前のゲン担ぎが、増えすぎて、チームの誰にも全体が把握できなくなるのが、野球の伝統のようです。', { when: player, ages: TEEN }],
  ['jp', 'baseball', 'バッティングセンターにAIコーチが入り、フォームの点数が表示されるようになりました。結果は聞かないでください。', { when: fan, ages: TEEN, years: NOW }],
  ['jp', 'baseball', '球場の外野席で、ピクニックのようにシートを広げる家族連れが増えました。', { when: fan, ages: ADULT }],
  ['jp', 'baseball', '球場近くの定食屋に、試合の日だけ「勝ちそば」が登場します。注文数は、結果と無関係だそうです。', { when: fan, ages: ADULT }],
  ['jp', 'baseball', 'ブルペンで投げる音を録音して、眠る前に聞く人がいると聞き、そっと試してみました。', { when: player, ages: TEEN }],
  ['jp', 'baseball', '素振り用のバットの重さを絶対に教えない仲間がいて、チーム内で小さな噂になりました。', { when: player, ages: TEEN }],
  ['jp', 'baseball', '用具店で、バットの形をしたスマホスタンドを見つけ、つい買ってしまうのが人情です。', { when: fan, ages: TEEN }],
  ['jp', 'baseball', '試合前の円陣のあと、全員が同じ順番でグラブをたたいているのに気づきました。', { when: player, ages: TEEN }],
  ['jp', 'baseball', 'ユニフォームの洗濯で、柔軟剤の香りが選手ごとに違うと気づき、においで誰か分かるようになりました。', { when: player, ages: TEEN }],
  ['jp', 'baseball', '野球ゲームの中の自分の選手の能力が、現実よりずっと高くて、複雑な気分になるのは、きっと私だけではありません。', { when: fan, ages: TEEN }],
  ['jp', 'baseball', '新しいスポーツドリンクの味が、ついに「何味か分からない味」に到達しました。', { when: player, ages: TEEN }],
  ['jp', 'baseball', '球場の売り子さんの階段の上り下りが、バレエのようになめらかで、試合より見入ってしまうほどです。', { when: fan, ages: ADULT }],
  ['jp', 'baseball', '雨天中止が決まった瞬間の、スタンドの全員のため息が、不思議と心地よく聞こえるのが不思議です。', { when: fan, ages: TEEN }],
  ['kr', 'baseball', '韓国の応援団長の掛け声を動画で見て、日本の応援との違いを、友人と夜中まで語り合いました。', { when: fan, ages: ADULT }],
  ['world', 'baseball', 'アメリカの球場の名物は、球場ごとに違うと聞き、食べ歩きの旅の計画を立てたくなります。', { when: fan, ages: TEEN }],
  ['tw', 'baseball', '台湾の野球場の応援は、攻撃の場面ごとにリズムが変わると聞き、一度そのリズムに身をまかせてみたくなりました。', { when: fan, ages: ADULT }],
  ['world', 'baseball', '道具が足りなくても、工夫して野球を楽しむ子どもたちの話を聞き、自分のグラブを磨き直しました。', { when: fan, ages: TEEN }],
  // ------------------------------------------------------------ small oddities of every day
  ['jp', 'life', 'エレベーターの「閉」ボタンを、押しても押しても閉まらない気がして、全員が無言で待ちました。', { ages: ADULT }],
  ['net', 'life', '傘を電車に忘れたと思ったら、玄関の傘立ての中に二本ありました。', { ages: TEEN }],
  ['jp', 'life', 'コンビニの店員さんに「温めますか」と聞かれて、冷たいアイスなのに一瞬迷いました。', { ages: TEEN }],
  ['net', 'life', '夜中に急に食べたくなる「あの味」を探して、結局、冷蔵庫の前で一時間立っていました。', { ages: TEEN }],
  ['jp', 'culture', 'ハロウィンの夜、子どもたちが近所を回り、お菓子の数を計算する親が続出しました。', { ages: [5, 14] }],
  ['jp', 'culture', '商店街の福引で、特賞の「温泉旅行」よりも、参加賞のティッシュ箱のほうが、なぜか嬉しかったです。', { ages: TEEN }],
  ['world', 'life', '旅行先で見つけた珍しいお菓子を買いすぎて、荷物の八割がお菓子になりがちです。', { ages: ADULT }],
  ['net', 'life', '観光地の「ここで写真を撮るのが人気」の看板に、なぜか全員が並んでいました。', { ages: TEEN }],
  ['jp', 'life', '田舎の無人販売所で、野菜の値段が「お気持ちで」と書かれていて、財布の中身を試されている気分になりました。', { ages: ADULT }],
  ['net', 'food', '新しいパンの店で、パンの種類より、トングの持ち方で悩みました。', { ages: TEEN }],
  ['world', 'food', 'どこの国のカフェでも、メニューの一番上にあるのは、結局いちばん高いコーヒーでした。', { ages: ADULT }],
  ['net', 'food', '世界中で「焼きたて」の匂いは、人を黙らせる力があると、パン屋の前で確信してしまいます。', { ages: TEEN }],
  ['jp', 'word', '祖母の言っていた「アイス」が、氷菓のことだったのかソフトクリームのことだったのか、今でもときどき考えます。', { ages: [10, 120] }],
  ['net', 'life', '「あと五分だけ」と言って布団の中で過ごした時間を全部足したら、旅行に行けたかもしれません。', { ages: TEEN }],
  ['jp', 'life', '図書館の返却ボックスの前で、同じ本を返しに来た人と目が合い、お互い無言でうなずくのが礼儀のようです。', { ages: ADULT }],
  ['net', 'culture', '世界中のあちこちで、同じ時間に同じ動画を見て笑っている人がいると思うと、不思議な気持ちになります。', { ages: TEEN }],
  ['jp', 'culture', '夏祭りの金魚すくいで、一匹も取れなかった子に、屋台のおじさんが三匹もおまけしてくれることがあります。', { ages: KID }],
  ['jp', 'food', '駄菓子屋の「当たり」が出たときの、あの無言の勝利のポーズは、世代を超えて共通のようです。', { ages: [6, 120] }],
  ['net', 'life', '地図アプリに導かれて着いた場所は、目的の店の裏口で、そこで店員さんと目が合いました。', { ages: ADULT, years: NOW }],
  ['jp', 'life', '町内の掲示板に「落とし物：片方だけの手袋」の貼り紙があり、持ち主が現れるのを皆が静かに見守っているようです。', { ages: ADULT }],
  ['net', 'tech', '古いゲーム機を押入れから出したら、起動の音を聞いて、家族全員が子どもに戻りました。', { ages: TEEN }],
  ['jp', 'word', '「あとで連絡するね」が、たいてい「あとで」のまま終わることを、お互いに分かっている不思議な約束でした。', { ages: ADULT }],
  ['net', 'life', 'ネットで見つけた「簡単な収納術」を試したら、収納する物が増えて、簡単ではなくなりました。', { ages: ADULT }],
  ['world', 'life', '海外のホテルのシャワーの使い方が分からず、十分格闘したあげく、フロントに電話しました。', { ages: ADULT }],
  ['jp', 'food', '運動会の弁当の卵焼きは、家ごとに甘さが違うことを、友だちと交換して知りました。', { ages: [6, 15] }],
  ['net', 'life', '思い出の写真を見返すと、人は意外なほど、背景の看板ばかり覚えているものです。', { ages: ADULT }],
  ['jp', 'culture', '地域の夏休みのラジオ体操で、スタンプ欄が全部埋まった日、ちょっとした達成感がありました。', { ages: [6, 12] }],
  ['jp', 'culture', '子ども会のクリスマス会で、サンタ役の大人が、実は近所の八百屋さんだと全員が気づいていました。', { ages: [6, 12] }],
  ['jp', 'life', '文房具店で、新しい消しゴムの「消えやすさ」を、試し書きで検証する小学生を見かけました。', { ages: ADULT }],
  ['net', 'life', '雨の日の傘のぶつけ合いを避けるための、すれ違いのコツを、周りの友人と共有しました。', { ages: TEEN }],
  ['net', 'word', '「それ、ワンチャンあるよ」の使い方が世代で違って、会話が三往復ほどすれ違いました。', { ages: TEEN }],
  ['jp', 'word', '祖父の「近ごろの若い者は」の続きが、毎回違う内容で、実はちょっと楽しみでした。', { ages: [8, 20] }],
  ['kr', 'word', '韓国ドラマの決めぜりふを、家族みんなで覚えてしまい、食卓がドラマのセットのようになりました。', { ages: TEEN }],
  ['tw', 'word', '台湾の友人が「加油」の意味をていねいに教えてくれて、以来、応援の言葉の幅が広がりました。', { ages: ADULT }],
  ['world', 'word', '海外の友人が日本語の「いただきます」を気に入り、毎回、真剣な顔で手を合わせるようになりました。', { ages: ADULT }],
  ['world', 'culture', '世界のどこでも、子どもが石けりに熱中する様子は、あまり変わらないと気づきました。', { ages: ADULT }],
]

export const TRENDS: Trend[] = RAW.map(([region, theme, text, o], i) => ({ id: `t.${i + 1}`, region, theme, text, ages: o?.ages ?? [12, 120], years: o?.years, when: o?.when }))

/** shown once in a life, before its first line: these lines are made up from general trends, not reports */
export const TREND_NOTE = '（これから時おり出てくる「世間の小ネタ」は、各国の流行や暮らしから着想を得たゲームの創作で、実際のニュースではありません。）'

/** chance a year brings one: not before four, lighter in childhood */
export function trendChance(age: number): number {
  return age < 4 ? 0 : age < 12 ? 0.12 : 0.2
}

/** lines that fit this life now and have not been told */
export function eligibleTrends(s: LifeState): Trend[] {
  return TRENDS.filter((t) => !s.evHist?.[t.id] && s.age >= t.ages[0] && s.age <= t.ages[1] && (!t.years || (s.year >= t.years[0] && s.year <= t.years[1])) && (!t.when || t.when(s)))
}

/** the regions and themes of the lines of the last few years: the same ones are drawn less often (variety) */
function recentTrends(s: LifeState): { regions: Set<TrendRegion>; last?: Trend } {
  const regions = new Set<TrendRegion>()
  let last: Trend | undefined
  let lastAge = -1
  for (const t of TRENDS) {
    const h = s.evHist?.[t.id]
    if (!h || h[0] < s.age - 3) continue
    regions.add(t.region)
    if (h[0] >= lastAge) {
      lastAge = h[0]
      last = t
    }
  }
  return { regions, last }
}

/**
 * This year's world-news line, if any (screen only, own random stream `c.rng`). Log only: it asks nothing, changes no
 * state but its own record of what was told, and uses neither the career stream nor the event streams.
 */
export function trendPass(c: EventCtx): string | undefined {
  const s = c.s
  if (c.headless || !c.rng.chance(trendChance(s.age))) return undefined
  const pool = eligibleTrends(s)
  if (pool.length === 0) return undefined
  const { regions, last } = recentTrends(s)
  const t = c.rng.weighted(pool, pool.map((x) => (regions.has(x.region) ? 0.35 : 1) * (last && x.theme === last.theme ? 0.5 : 1)))
  markSeen(s, t.id)
  // (the year's other lines are placed by the same rule; a time of our own keeps the note just before its line)
  const at = 0.3 + c.rng.next() * 0.5
  if (!s.taken.includes('note.trend')) {
    s.taken.push('note.trend')
    c.add('note', TREND_NOTE, { category: 'trend', at: at - 0.005 })
  }
  c.add('normal', t.text, { category: 'trend', at })
  return t.id
}
