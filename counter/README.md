# 累計プレイ人数のカウンター（Cloudflare Workers + D1）

ホーム画面の「これまでに N 人の野球人生が始まりました」を支える小さなサーバーです（PROJECT_PLAN §11.51）。**このリポジトリのコードは、Cloudflare にまだデプロイされていません**。下の手順は、あなた（アカウントの持ち主）が実行するためのものです。


## 送られるもの・保存されるもの

- ブラウザは、人生を始めた瞬間に、**その人生のために作ったランダムな ID（UUID v4）だけ**を送ります。名前・乱数の種・国・人生の内容・IP アドレスは、このデータベースに保存しません。
- D1 には、ID と時刻（`lives`）、累計の数（`counter`）だけが入ります。`schema.sql` のトリガーが、新しい ID が入ったときだけ数を 1 増やします。同じ ID の再送（通信の再試行・二重クリック）は数えません。

## API

| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/lives` | `{"id": "<uuid v4>"}` を数える。応答 `{"total": n}`。不正な ID は 400、1 分間の上限（2,000 件）を超えると 429、データベースの障害は 503 |
| GET | `/api/count` | `{"total": n}`（60 秒キャッシュ） |

## 設定の手順（あなたが実行する）

1. Cloudflare のアカウントでログインする: `npx wrangler login`
2. データベースを作る: `npx wrangler d1 create baseball-life-counter`。表示された `database_id` を `counter/wrangler.toml` の `database_id` に書く。
3. 表を作る: `npx wrangler d1 execute baseball-life-counter --remote --file=counter/schema.sql`
4. `counter/wrangler.toml` の `ALLOWED_ORIGINS` に、ゲームを公開する URL（例 `https://your-game.pages.dev`）を書く。
5. デプロイ: `npx wrangler deploy --config counter/wrangler.toml`。表示された Worker の URL（例 `https://baseball-life-counter.<account>.workers.dev`）を控える。
6. ゲームをビルドするときに、その URL を渡す: `VITE_COUNTER_URL=https://baseball-life-counter.<account>.workers.dev npm run build`（`.env.example` 参照）。
7. 不正なカウントの抑制（推奨）: Cloudflare ダッシュボードの「セキュリティ → WAF → レート制限ルール」で、`/api/lives` に対し、同じ IP から 1 分間に 10 回を超える POST をブロックする。このルールは、IP を D1 に保存しません。

`VITE_COUNTER_URL` を設定しないでビルドしたゲームは、何も送らず、人数も表示しません（仮の数字は出しません）。

## 無料枠・費用（確認が必要）

Workers と D1 には無料枠があります。このカウンターは、1 人生につき書き込み 1 回・読み込み数回です。無料枠の上限や料金は変わることがあるので、Cloudflare の公式ページで現在の値を確認してください（このリポジトリでは確認していません）。

## ローカルで試す（Cloudflare なし）

- 単体テスト: `npx vitest run counter`（`schema.sql` から作った SQLite で、重複・同時・上限・障害を検証）
- 代用サーバー: `node counter/dev-server.ts`（ポート 8787、メモリ上）。`VITE_COUNTER_URL=http://localhost:8787 npm run build && npx vite preview` でゲームを繋いで試せる。これは本物の Workers/D1 ではない。

## できないこと

- 認証がないため、スクリプトで数を増やすことは完全には防げません（ID の形式・本文の大きさ・Origin・全体で 1 分あたりの上限・レート制限ルールで抑えるだけです）。
- 本番の Cloudflare 上の動作（D1 の同時書き込み）は、この環境では検証していません。

## 本番での検証の準備（§11.52。未実施。デプロイは持ち主の許可なしに行わない）

### 必要な設定とコマンド（上の手順の確認用）

| 段階 | コマンド・操作 | 確認すること |
|---|---|---|
| 1 | `npx wrangler login` | ブラウザでログインでき、`npx wrangler whoami` にアカウントが出る |
| 2 | `npx wrangler d1 create baseball-life-counter` | `database_id` が表示される → `wrangler.toml` に記入 |
| 3 | `npx wrangler d1 execute baseball-life-counter --remote --file=counter/schema.sql` | `SELECT * FROM counter` が `lives = 0` を返す: `npx wrangler d1 execute baseball-life-counter --remote --command "SELECT * FROM counter"` |
| 4 | `wrangler.toml` の `ALLOWED_ORIGINS` にゲームの URL を記入 | 空のままだと、どの Origin からでも呼べる（開発用） |
| 5 | `npx wrangler deploy --config counter/wrangler.toml` | Worker の URL が表示される |
| 6 | `curl <Worker URL>/api/count` | `{"total":0}` |
| 7 | `curl -X POST <Worker URL>/api/lives -H "content-type: application/json" -d '{"id":"00000000-0000-4000-8000-000000000001"}'` を2回 | 1回目も2回目も `{"total":1}`（同じ ID は1回だけ数える） |
| 9 | `VITE_COUNTER_URL=<Worker URL> npm run build` で作ったゲームで、人生を始める | ホーム画面の人数が1増える（出生届を取り消した、続きから再開した、リロードした場合は増えない） |
| 10 | Cloudflare ダッシュボードの WAF レート制限ルール（`/api/lives` への POST を同一 IP から1分に10回超でブロック） | 11回目以降が 429 になる |
| 11 | 同時書き込みの確認: 異なる ID を並列に送る（例 `for i in $(seq 1 50); do curl -s -X POST ... & done`）と、同じ ID を並列に送る | 数えた数が送った ID の種類数と一致する |

### 無料枠と費用

- 確認できたこと（Cloudflare の公式ページ [D1 の料金](https://developers.cloudflare.com/d1/platform/pricing/)、2026-10-19 に検索で確認）: Workers Free の D1 は、1日 500 万行の読み取り・10 万行の書き込み・合計 5GB まで。毎日 00:00 UTC にリセット。超えるとクエリがエラーになる。インデックスの書き込みも書き込み行に数える。
- このカウンターの書き込みは、1人生につき、表の1行・主キーの索引1行・`created_at` の索引1行・`counter` の更新1行で、およそ4行と見積もっています（**見積もりで、実測していません**）。この見積もりでは、無料枠で1日およそ2.5万人生までです。それを超える可能性があるときは、有料プランにするか、`lives` の `created_at` 索引を外す（上限の判定を別の方法に変える）ことを検討してください。
- **未確認**: Workers 自体の無料枠のリクエスト数、有料プランの現在の料金、無料枠の改定。公式ページで確認してください。

### 同時書き込みの保証（未確認）

- この環境で確認したのは、SQLite（`node:sqlite`）での挙動です。同じ ID を同時に何回送っても1回だけ数え、数と行数が一致します。
- 本番の D1 で、同時に来た別々のリクエストが同じトランザクション保証で処理されるかは、**この環境では未確認**です。D1 は SQLite を基にしており、1つの文は1つのトランザクションとして実行されます。この Worker は、挿入とカウントを1つの文（`INSERT OR IGNORE` ＋トリガー）にして、この保証に頼っています。上の手順 11 で、本番でも確かめてください。
- 1分の上限の判定（`SELECT COUNT(*)` のあとに挿入）は、判定と挿入が別の文なので、同時に大量に来ると上限を少し超えることがあります（厳密な上限ではなく、水増しの抑制です）。