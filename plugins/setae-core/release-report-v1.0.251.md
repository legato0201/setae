# SETAE v1.0.251 実装・検証報告

作成日: 2026-08-28。ローカル配布候補です。本番サイト、実ユーザーデータ、Stripe実契約は更新していません。

## 1. 入力と実装範囲

元の `setae-core-1.0.250-wordpress.zip` を別ディレクトリへ展開して保存し、作業ソースがZIPと全件一致することを確認してから実装しました。

- 入力SHA-256: `9e4fec7e75ad19322f5c0dc8b6a54f0e384d789efa201ef61130afb9ce7a3be8`
- 入力: 4,359,502 bytes、1,830 files。
- 指示書: `CODEX_SETAE_v1.0.251_MONETIZATION_IMPLEMENTATION_BRIEF (1).md`。SHA-256: `2d25438edd31967e551de918795f29b3d93fc5a6355a0cff591fb24275f7db75`。
- 出力: `setae-core-1.0.251-wordpress.zip`。最上位は単一の `setae-core/`。

今回の必須範囲である、権限・枠の一元化、QR受領枠除外、明示試用、Starter課金、公開登録・認証・申請、初回導線、Community二次導線、利用者単位の計測を実装しました。

## 2. 主な変更と理由

| 実装先 | 変更 |
| --- | --- |
| `Setae_Entitlements`、個体・オフライン・ベビー群API、Admin | 4プランと上限を一元化。無料8、試用20/30日、Starter100、旧premium無制限。ボーナス保持。新規作成経路・取得元偽装をサーバー側で検査。 |
| `Setae_QR_Manager`、QR API | 受領個体・保存スナップショットを枠外化。記録作成者を保存してからアクセス所有者を変更。申請承認は必要なまま、元のQRを保持。 |
| `Setae_Claim_Registration`、認証処理、公開登録 | 明示した引継ぎ意図、3項目フォーム、新しく消費した認証トークンのみ自動ログイン、申請1件、303で安全な帰還。ページ表示でpendingを消さない。 |
| `Setae_Product_Events`、catalog、管理者Analytics | サーバー成立イベントとclient起源を分離、重複排除、許可した最小properties、7/30/90日とactivation/retention。 |
| `Setae_Billing`、Stripe API、Billing inbox | Price/statusを正とするプラン同期、署名・再送、固定猶予、旧契約保護、Checkoutの永続冪等キーと申込再利用。 |
| SPA plan/onboarding/arrival、公開Partner/Home | 二択の空状態、任意My SETAE設定、受領後7日案内、プラン表示、入力・写真・選択・focusを保持する制限UI。公開訴求「売る前から、譲った後まで。」。 |

変更・追加・削除の全ファイル一覧は [docs/changed-files-v1.0.251.md](docs/changed-files-v1.0.251.md) を参照してください。元ZIPとのbyte比較で生成し、既存vendorは変更しません。外部GUI workspaceは回帰検証に使用しますが配布ZIPへ混入させません。

## 3. DB変更と後方互換

新設2表: `{prefix}setae_product_events` と `{prefix}setae_billing_events`。前者はprivateイベントと冪等一意/期間別集計索引、後者はStripe event ID・処理状態・5分leaseを保存します。課金payloadや秘密鍵をイベント表へ保存しません。schema versionを独立optionに保存し、activationとinitからdbDeltaを適用します。実DBでの実行は未実施です。

既存表の破壊的変更、全件個体移行、既存データ削除はありません。追加メタの全一覧・列・索引・設定名は [docs/monetization-foundation-v1.0.251.md](docs/monetization-foundation-v1.0.251.md) と [docs/product-events-v1.0.251.md](docs/product-events-v1.0.251.md) にあります。

- `_setae_plan_id` のない既存premiumはlegacyとして無制限。未知Price/customerのみの旧契約は推測で降格しません。確認済みの終了と情報不足を分けます。
- 旧個体はメタがなければreceipt、受領、個体化、legacy_manualの順に読み取り時分類。全件を書き換えません。旧URL、QR、プロフィールのflat項目、旧Stripe Price optionを残します。
- 終了・超過・解約後も既存個体の閲覧、編集、記録、exportを止めません。新規の枠消費操作だけを制限します。
- 試用・個体化1件・譲渡はtransactionと保存値の読み戻しを使用します。個体化の一部が成立した後の再送は保存済み番号を重ねて作りません。

DB条件: 試用はusermeta、個体化・譲渡はusers/posts/postmeta/usermeta/terms/term_taxonomy/term_relationships/termmetaがInnoDBであること、ENGINE参照、GET_LOCK、autocommit=1、既存transactionなしが必要です。確認不能なら該当操作を拒否し、テーブルを勝手に変換しません。実wpdbの接続断はDBエラーexitでfinallyに戻らない場合があり、HTTP応答・永続cache復旧は実環境で要確認です。COMMIT応答不明を成功やrollback確定とは扱いません。[WordPress接続確認](https://developer.wordpress.org/reference/classes/wpdb/check_connection/)

## 4. 実行したテスト

Windows 10.0.19045、Node 24.19.0、PHP 8.4.25（mbstring/OpenSSLあり）、Edge 151.0.4129.107。詳細はworkspaceの `release-evidence/v1.0.251/environment.json`。各件数はテストファイル/suite単位で、assertの合計ではありません。

| 実行 | PASS | FAIL | NOT RUN |
| --- | ---: | ---: | ---: |
| 編集前v250全unit | 133 | 0 | 0 |
| 最終v251全unit（plugin 125、GUI 19） | 144 | 0 | 0 |
| 最終全browser 36 suites | 35 | 1 | 0 |
| PHP構文（vendor除外） | 126 | 0 | 0 |
| JS/CJS/MJS構文 | 390 | 0 | 0 |

新acquisition browserは12ケース、新onboarding browserは15ケースを実行。各結果は後述のJSONにあります。合成HTTP/API・WordPress状態doubleを用い、実SMTPやStripeへの通信はしません。

実行コマンド（Node/PHP/Edgeは導入済みruntimeを絶対パスで指定）:

```text
node wp-content/plugins/setae-core/tests/run-all-unit-tests.cjs
node wp-content/plugins/setae-core/tests/run-all-browser-tests.cjs
node tmp/verify-release-syntax-v251.cjs
python tmp/freeze-v251-sources.py --generation final-2 --verify
python tmp/package-setae-v251.py
```

設定変数はPHP_BIN、OPENSSL_CONF、NODE_PATH、CHROME_PATH、SETAE_QA_BASE、SETAE_QA_EVIDENCE。性能比較は保存したv250を別originとして指定し、15反復を維持しました。構文検査はPHP -l / node --checkであり、実環境結合試験ではありません。閾値引下げ、assert削除、runner除外はしていません。

初回統合unitは129 PASS / 9 FAIL。新仕様に対する古い認証・version・onboarding契約、fixtureの新依存読込み等を修正し、途中144 PASS、最終も上表の結果です。初回失敗の証拠は削除せず残しました。

全browser初回は 25 PASS / 11 FAIL。新規セッション計測を業務書込みと誤認するassert、本人記録を示す旧fixture項目、CSS変更後の公開fixture manifestを現契約へ更新して全件再実行しました。個体保存禁止のassertは維持し、計測の件数・型も追加検査しています。性能FAILは別に報告します。

## 5. 必須受入シナリオ

以下は実行したローカル契約/fixture範囲の判定です。実WordPress・決済・メールの受入完了ではありません。

| Scenario | 実行した確認 | ローカル結果 | 実環境 |
| --- | --- | --- | --- |
| 1 手動枠 | 8/9匹、新規経路、既存編集・記録、枠の別表示 | PASS | NOT RUN |
| 2 QR受領 | 公開本文、3項目、認証・303・申請1件、承認、8＋受領1 | PASS | NOT RUN |
| 3 譲渡元履歴 | receipt枠外、記録作成者、同じQR、保存失敗時の整合性 | PASS | NOT RUN |
| 4 試用 | 無料1群、明示30日試用、累計20、再試用拒否、選択保持 | PASS | NOT RUN |
| 5 Stripe | 設定/未設定、任意Price拒否、署名・重複、猶予、解約・旧契約保持 | PASS | NOT RUN |
| 6 計測 | 全event契約、冪等性、7/30/90、初回・継続、禁止properties | PASS | NOT RUN |
| 7 UI | 二択、Community二次導線、theme/textscale/keyboard、form保持 | PASS | NOT RUN |

詳細な対応表は [docs/validation-plan-v1.0.251.md](docs/validation-plan-v1.0.251.md)。新しい6 PHP unit・4 JS unit・2 browserを全runnerで実行しています。追加のclient計測unitも実行しました。

## 6. FAILと性能の扱い

失敗したbrowser suite: `browser-data-scale-v243-qa.cjs`。

v250の独立したdata-scale試験もlong task `[290, 117] ms` でFAILでした。今回の観測値を次に示します。同じ症状が変更前にあることは確認できますが、時刻の異なる1回の計測からすべてのばらつきが変更と無関係とは断定しません。

| data-scale観測値 | 元v250 | v251初回 | v251最終 | v250再確認 |
| --- | ---: | ---: | ---: | ---: |
| Records初期中央値 ms | 47.7 | 49.5 | 47.2 | 51.8 |
| Records追加中央値 ms | 49.2 | 49 | 54.2 | 50 |
| Nursery初期中央値 ms | 32.2 | 31.4 | 33.6 | 34.4 |
| Nursery追加中央値 ms | 35.3 | 34.4 | 35.8 | 37.5 |
| 検索中央値 ms | 15.8 | 17.5 | 17.6 | 16.8 |
| 100ms超long task | [290, 117] | [309, 124] | [294, 129] | [290, 133] |

最終回の計測上の未達: Records追加中央値 54.2ms（基準50ms）、検索目標中央値 17.6ms（基準16ms）、100ms超long task [294, 129]ms。検索は既存suiteでは旧21.8msからの改善でも通過しますが、16ms目標の達成とは区別します。

全browser終了後に元v250を同じ15反復で再確認しても、100ms超long taskでFAILでした。Records追加は元版49.2/50.0ms、v251は49.0/54.2msでばらつきがあり、最終回の50ms超過は未解決として残します。長時間処理は既存未達ですが、すべての性能差を既存問題と断定しません。

data-scaleでassert失敗した場合、それ以降の同suite内のresponsive検証は未実施です。別のbrowserによる表示確認と混ぜて成功扱いにしません。

別のv242性能比較は、実v250とv251を対称順序・各15サンプルで比較します。15%未満の閾値は変更していません。

| 性能比較 | v250中央値 ms | v251中央値 ms | 変化率 | 判定 |
| --- | ---: | ---: | ---: | --- |
| collection500 | 29 | 27 | -6.9% | PASS |
| collectionSearch | 23.8 | 24.5 | 2.94% | PASS |
| specimenOpen | 15.1 | 14.9 | -1.32% | PASS |
| quickRecordOpen | 14.7 | 14.7 | 0% | PASS |
| nursery500 | 32.8 | 33.7 | 2.74% | PASS |
| records1000 | 59 | 66.3 | 12.37% | PASS |

## 7. 未実施・既知の制約

- **NOT RUN**: 実WordPress/MySQLのDDL、同時操作、トランザクション、接続断、COMMIT応答喪失、永続オブジェクトキャッシュ。ローカルはSQL/WordPress契約doubleであり実DBの証明ではありません。
- **NOT RUN**: 実SMTP配送、実WordPress認証Cookie、HTTPS/rewrite/CDN設定。新browserはPHP実処理を呼びますがこれらの境界はdoubleです。
- **NOT RUN**: Stripe実テスト/本番アカウントのCheckout・Portal・支払回復。署名検証は本物の同梱SDK、Stripe clientはmockです。実課金は発生していません。
- **NOT RUN**: 物理iOS/Android、カメラ、通知、スクリーンリーダー、プリンター、実ブラウザーzoom。新QAの200%/400%は対象コンポーネントの文字拡大であり、ブラウザーzoomや物理端末合格とは異なります。
- **NOT RUN**: デプロイ先の外部テーマHome本文、実キャッシュ、本番データ保全照合。外部テーマの差替えコピーをdocsへ用意しました。ローカルにあるテーマ依存unitが通っても公開サイトへ適用済みとは扱いません。
- Stripe表示価格は管理者設定であり、実Price額との一致確認が必要です。申込み後のPrice変更はサーバー保存attemptとの照合で元の申込み条件を認識します。23時間超の未確定申込みは二重課金防止のため管理者確認になります。
- 計測前の履歴は推定生成しません。D1/D7/D30には観測期間が必要です。DNT/GPCでclient送信を止め、業務成立serverイベントは別扱い。障害時は欠測し得ます。label_exportedはラベル対象の準備であり印刷完了ではありません。
- 新しいDB条件を満たさない環境では、試用・個体化・譲渡の該当操作は失敗として返します。既存MyISAMを自動変換せず、事前確認が必要です。

## 8. 管理者設定・本番投入前

1. DB/uploads/設定と旧ZIPをバックアップし、ステージングへ適用します。
2. SETAE設定でStarter月額Priceを `setae_stripe_price_breeder_starter` に設定。旧Price optionは保持します。
3. Stripe秘密鍵、Webhook署名secret、Customer Portalをテストモードで確認。Webhookは `/setae/v1/stripe/webhook`、購読イベント一覧はfoundation doc参照。
4. 表示価格（既定月額1,480円）と実Price額を照合。猶予 `setae_billing_grace_days` は既定7日です。
5. 「設定 → SETAE Product Analytics」で7/30/90日、0/未計測/観測待ちと全ユーザープランを確認します。
6. 上記NOT RUNを実環境で実行し、性能FAILを評価したうえで本番投入を判断してください。

手順と戻し方は [docs/release-checklist-v1.0.251.md](docs/release-checklist-v1.0.251.md)。旧版へ戻してもStripeの契約は巻き戻りません。新表・個体・QRを削除して戻さないでください。

## 9. 将来バックログ（未実装）

- v1.0.252: 専用Breeder Workspace、販売状態・購入者一覧、発行時由来スナップショット、記録者別表示、購入者同意による購入後共有。既存の一括個体化/QRを維持することと専用workspace完成を区別します。
- v1.0.253以降: 英語、海外通貨・税・規約、CSV import UI、店舗・複数スタッフ、ブランドページ、外部販売リンク、Pro/Shop検証。
- 生体売買、配送、AI相談、図鑑データ更新、Community拡張は今回の範囲外です。

## 10. 証拠ファイル

workspaceの `release-evidence/v1.0.251/` 以下に保存しています。作業ログ・スクリーンショットはプラグインZIPへ混入させず、報告書・docs・testsを同梱します。

- `baseline-250.json`、`baseline-unit/all-unit-tests.json`: 元ZIPと編集前実行。
- `integration-unit-1/all-unit-tests.json`、`integration-unit-2/all-unit-tests.json`: 初回失敗と修正経過。
- `final-unit/all-unit-tests.json`: 最終レビュー前144 PASS。
- `final-unit-2/all-unit-tests.json`: 表示・Price引継ぎ修正後のunit。
- `final-unit-3/all-unit-tests.json`: 全fixture更新後の最終unit。
- `all-browser-final-1/all-browser-tests.json`: 全36 suite初回の失敗を含む実行ログ。
- `all-browser-final-2/all-browser-tests.json`: 全36 suite最終の実行ログ・終了値。各suiteサブディレクトリに実測値/画像。
- `baseline-data-scale/browser-data-scale-v243-measurements.json`: 元v250の性能FAIL実測値。
- `baseline-data-scale-recheck/browser-data-scale-v243-measurements.json`: 全browser終了後に元v250で再確認したFAIL実測値。
- `syntax-checks-final-2.json`: 全対象の構文結果とsource hash。
- `tested-source-final-2-manifest.json`、`tested-source-final-2-verification.json`: 試験前後で実行ソースが不変なことの確認。
- `validation-summary.json`: PASS/FAIL/NOT RUNの機械可読集計。
- `changed-files.json`、`package-verification.json`: ZIPとsourceの全ファイル一致、vendor一致、CRC、独立unzip、SHA。

## 11. 全browser結果

| Suite | 結果 |
| --- | --- |
| `browser-collection-window-qa.cjs` | PASS |
| `browser-data-scale-v243-qa.cjs` | FAIL |
| `browser-forced-colors-qa.cjs` | PASS |
| `browser-form-safety-qa.cjs` | PASS |
| `browser-form-safety-regression-v245-qa.cjs` | PASS |
| `browser-form-validation-qa.cjs` | PASS |
| `browser-interaction-continuity-qa.cjs` | PASS |
| `browser-media-loading-qa.cjs` | PASS |
| `browser-mobile-gestures-qa.cjs` | PASS |
| `browser-modal-action-boundary-qa.cjs` | PASS |
| `browser-monetization-onboarding-qa.cjs` | PASS |
| `browser-native-viewport-qa.cjs` | PASS |
| `browser-offline-task-flow-qa.cjs` | PASS |
| `browser-passport-acquisition-loop-qa.cjs` | PASS |
| `browser-performance-v242-qa.cjs` | PASS |
| `browser-print-calibration-qa.cjs` | PASS |
| `browser-product-ux-qa.cjs` | PASS |
| `browser-public-care-share-interaction-qa.cjs` | PASS |
| `browser-public-care-share-visual-qa.cjs` | PASS |
| `browser-public-partner-interaction-qa.cjs` | PASS |
| `browser-public-partner-visual-qa.cjs` | PASS |
| `browser-public-passport-interaction-qa.cjs` | PASS |
| `browser-public-passport-visual-qa.cjs` | PASS |
| `browser-public-profile-interaction-qa.cjs` | PASS |
| `browser-public-profile-visual-qa.cjs` | PASS |
| `browser-public-registration-shared-qa.cjs` | PASS |
| `browser-public-share-controller-qa.cjs` | PASS |
| `browser-qr-image-fallback-qa.cjs` | PASS |
| `browser-qr-label-option-visibility-qa.cjs` | PASS |
| `browser-qr-permission-states-qa.cjs` | PASS |
| `browser-render-islands-qa.cjs` | PASS |
| `browser-semantic-a11y-qa.cjs` | PASS |
| `browser-specimen-breeding-routing-qa.cjs` | PASS |
| `browser-specimen-intake-stability-qa.cjs` | PASS |
| `browser-text-scaling-qa.cjs` | PASS |
| `browser-visual-craft-qa.cjs` | PASS |
