# v1.0.251 受入・回帰検証

## 判定のルール

PASSはその試験で実際に実行・確認した範囲に限ります。ローカルのWordPress/wpdb契約double、合成API、署名付き合成Stripeイベントによる成功は、実MySQL・実メール・Stripe実アカウントの成功を意味しません。未実施と失敗を分け、初回失敗と修正後の再実行の証拠を両方残します。

入力のv1.0.250 ZIPを別ディレクトリへ保存し、編集前に全unitを取得します。性能比較にはそのZIPの実ソースを別のloopback originで配信し、同じv251を比較元にしてはいけません。

## 必須受入シナリオと試験

| 指示書 | ローカルで実行する試験 | 実環境で追加する確認 |
| --- | --- | --- |
| 1: 無料8匹・9匹目拒否・既存操作・表示 | `entitlements-unit.php`、`log-recorder-provenance-unit.php`、`plan-settings-unit.js`、新onboarding browser | 実DBの既存8匹・REST/管理画面・写真付き編集 |
| 2: 公開→登録→認証→申請→承認→枠外受領 | `passport-claim-registration-unit.php`、`transfer-slot-exemption-unit.php`、新acquisition browser | 実SMTPリンク、Cookie属性、実WordPress redirect/rewrite、二者の実セッション |
| 3: 元所有者の保存個体・記録者・QR保持 | `transfer-slot-exemption-unit.php`、`log-recorder-provenance-unit.php`、新acquisition browser | 実DBトランザクション、同時リクエスト、代表QRの既存URL照合 |
| 4: ベビー群→明示試用→選択保持→個体化→期限切れ | `entitlements-unit.php`、`log-recorder-provenance-unit.php`、`plan-settings-unit.js`、新onboarding browser | 実DB書込み障害・複数タブ・実時刻での期限境界 |
| 5: Price設定・未設定・注入拒否・再送・猶予・解約 | `stripe-plan-unit.php`、Entitlementsとの統合unit、plan UI/browser | StripeテストモードのCheckout/Portal/Webhook/支払い回復・本番設定照合 |
| 6: 全イベント・重複排除・7/30/90・情報最小化 | `product-events-unit.php`、`product-events-client-unit.js`、新browserの送信記録 | 実MySQL索引、集計SQL、同時INSERT、運用期間のD1/D7/D30 |
| 7: 二択・Community二次導線・表示/操作・入力保持 | `monetization-onboarding-unit.js`、`community-nav-demotion-unit.js`、`plan-settings-unit.js`、新browser2本、既存intake/overlay/UI suites | 物理iOS/Android、スクリーンリーダー、実プリンター |

## 新しいunit

PHPは指示書の6本を追加します。

- `entitlements-unit.php`: 4プラン、8/9匹、ボーナス、枠除外、既存超過、無料1群、試用一度/30日、累計、期限・猶予、標準REST/管理画面の迂回防止。
- `transfer-slot-exemption-unit.php`: 実QR managerとEntitlementsで、8匹の受領者、receipt、既存QR、公開オフ、作成者保持、失敗時の取り消し。
- `product-events-unit.php`: 実store/REST callback/adminを契約doubleで実行。DDL宣言、一意キー、server/client起源、禁止properties、署名context、レート制限、初回記録、0/未計測/観測待ち、管理者権限、全ユーザープラン読み取り。
- `stripe-plan-unit.php`: 同梱Stripe SDKの本物の署名検証、mock Stripe client、inbox lease、重複、順不同の最新状態、固定猶予、旧契約保護、任意Price拒否、Checkout原子的再送、保存失敗、再契約。
- `passport-claim-registration-unit.php`: 実認証/申請処理、トークン一度消費、既認証URLでCookieを再発行しない、明示意図、申請再利用、pending保持、自己所有/受付終了/無効対象。
- `log-recorder-provenance-unit.php`: 実個体・オフライン・ベビー群・QR記録経路、既存記録の編集、作成者とコピーの区別、初回イベント、群記録の非公開作成者map。

JavaScriptは `monetization-onboarding-unit.js / community-nav-demotion-unit.js / plan-settings-unit.js / passport-claim-copy-unit.js` と軽量イベントclientのunitを追加します。実moduleまたは実PHP生成HTMLを使い、固定文字列の存在検査だけにしません。実フォーカス・ファイル入力・モーダルはbrowserで別に確認します。

## 新しいBrowser QA

`browser-passport-acquisition-loop-qa.cjs` は一時的な127.0.0.1 HTTP serverを自身で起動・終了します。公開テンプレート、登録JS、PHP登録AJAX、メール認証入口、QR controller/managerを使い、WordPress state、SMTP、Cookie発行境界をdoubleにします。認証URLは合成であり実メールを送りません。通常受領・再訪・非明示意図・受付終了・一時失敗・Partner帰還、390px、Light/Dark/Forced Colors、200%/400%、keyboard/focus trap/Esc/送信中closeを検証します。

`browser-monetization-onboarding-qa.cjs` はproduction appをfixtureで起動し、APIだけを合成します。未知endpointは成功扱いしません。二択から既存QR/登録、各プラン、制限403、入力/写真/選択/フォーカス、明示試用後の再実行、Community二次導線を実DOMで確認します。Stripeへ接続しません。

両方とも確認対象のsource hashと結果を証拠へ残します。実行中のソース変更は最終合格と扱わず、固定したソースで再実行します。

## 回帰コマンド

プラグインディレクトリで実行します。実行環境のNode/PHP/Edgeへのパスは環境変数で指定し、テストの閾値は変更しません。

```text
node tests/run-all-unit-tests.cjs
node tests/run-all-browser-tests.cjs
```

主な環境変数:

- `PHP_BIN`: PHP実行ファイル。今回のWindows環境はPHP8.4.25。
- `OPENSSL_CONF`: portable PHPに付属するOpenSSL設定。PWAの暗号化試験で必要。
- `NODE_PATH`: 導入済みPlaywright等のライブラリ。
- `CHROME_PATH`: 導入済みEdge実行ファイル。
- `SETAE_QA_BASE`: v251のloopback配信origin。
- `SETAE_QA_EVIDENCE`: 各回で異なる証拠ディレクトリ。
- `SETAE_PERF_BASELINE_URL`: 保存したv250の `tests/fixtures/performance-v242.html`。
- `SETAE_PERF_CURRENT_URL`: v251の同fixture。
- `SETAE_PERF_ITERATIONS`: 既存の既定15を維持。

全unit runnerはプラグインの全 `*-unit.js / *-unit.php` と、workspaceに存在するGUI側の全 `*.test.mjs` を別プロセスで実行します。配布ZIP単体には外部GUI workspaceを追加しません。

PHP構文はvendor以外の全 `.php` に `php -l`、JavaScript構文は全first-party `.js/.cjs/.mjs` に `node --check` を実行します。Windowsではshellのfindの代わりに同じ対象を再帰列挙します。構文検査を実行時の結合試験として報告しません。

性能閾値で失敗した場合は同一環境のv250にも同じ試験を実行し、既存未達と新規退行を区別します。閾値引き下げ、assert削除、runnerから除外、失敗結果の上書きはしません。ばらつきで再試行する場合も各回を保存します。

## ZIPの検証

v250 ZIPのSHAを保持し、相対パスと各ファイルのSHAで追加/変更/削除を作成します。元のvendorの一致、必須source/test/docsの存在、バージョン、単一root、安全なパス、秘密/キャッシュの除外を確認します。

Python `ZipFile.testzip()` のCRCと独立した `unzip -tq` を実行し、ZIP内容が最終sourceと全件一致することを検証します。ZIP作成コマンドの終了だけを検証成功の根拠にしません。

## ローカルでは証明できない項目

実WordPress/MySQLでのDDL・ロック・rollback・集計、SMTP配信、WordPressの本物の認証Cookie/HTTPS/rewrite、Stripe実テストアカウントの課金・Portal、物理端末のカメラ/通知/iOS入力、外部テーマ適用、実プリンター、本番データ保全は別の試験です。未実施の場合はrelease reportにNOT RUNと残し、本番投入前の確認事項とします。
