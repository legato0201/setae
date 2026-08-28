# SETAE v1.0.251 — 収益化基盤

## この版の範囲

既存の個体・ベビー群・QR・譲渡・記録・公開ページを接続し、無料受領、明示的な30日試用、Breeder Starter、利用者単位の計測を追加します。生体の売買決済や販売管理システムは追加しません。図鑑データも変更しません。

プランの判定は `Setae_Entitlements`、Stripeの状態変換は `Setae_Billing`、行動計測は `Setae_Product_Events` に分離しています。旧プロフィール項目・URL・QRコード・Stripe旧Price optionは残します。

## プランと上限

| 権限 | Keeper Free | ブリーダー試用 | Breeder Starter | 従来プレミアム |
| --- | ---: | ---: | ---: | ---: |
| 有効な手動登録・個体化 | 8＋既存ボーナス | 20＋既存ボーナス | 100＋既存ボーナス | 無制限 |
| QR受領・譲渡元の履歴保存個体 | 枠外 | 枠外 | 枠外 | 枠外 |
| 有効なベビー群 | 1 | 1 | 10 | 無制限 |
| 個体化 | 試用開始が必要 | 試用中の累計20匹 | 個体上限内 | 無制限 |
| 1回のラベル出力 | 20 | 20 | 100 | プラン上限なし |

`setae_free_spider_limit` の既存設定と `_setae_bonus_spider_limit` を尊重します。`setae_plan_limits` option、または `setae_entitlement_plan_limits` filterで `specimens / nursery_groups / promotions / label_batch` を変更できます。無制限は `-1`。旧プレミアムの無制限はこの設定で縮小しません。プロフィールの実使用数とStarter/試用の説明も設定値を使います。

ラベル生成はプランと別に1リクエスト5,000件のリソース上限を持ちます。これはQR受領の上限ではありません。`GET /qr/targets` のラベル用途では全選択数を一度に検査し、小分けリクエストで判定を迂回しません。

新規の枠消費操作のみ制限します。試用終了、解約、上限超過でも既存個体の閲覧・編集・記録・エクスポートは止めません。アーカイブ、死亡・譲渡済み等の終了状態は有効数から除外します。

## データ互換と遅延分類

`_setae_plan_id` のない `_setae_is_premium=1` は `legacy_premium` と解釈します。Stripe情報が不明な旧契約を推測で降格しません。管理者の既存無制限権限も維持します。旧フラグは互換用のwrite-throughであり、新しい業務判定には使いません。

取得元 `_setae_acquisition_source` は次の6値だけです。

- 枠内: `manual / nursery_promotion / import / legacy_manual`
- 枠外: `transfer_received / transfer_receipt`

既存個体はメタがなければ receipt → transferred_from_user → baby_origin_group → legacy_manual の順に読み取り時に分類します。全件の自動書き換えはしません。新規登録・オフライン同期・個体化・譲渡成立時には明示して保存します。WordPress標準REST・管理画面の新規作成もサーバー側で確認し、取得元や記録者メタの偽装を許しません。

譲渡は現所有者の承認が必要です。承認後、元の個体へ `transfer_received` と `_setae_received_at`、元所有者の保存個体へ `transfer_receipt` を付与します。QR文字列・短縮URLを再発行せず、受領側の公開・再譲渡設定は既存どおりオフに戻します。

新規記録の作成者を `_setae_log_recorded_by_user_id` に保存します。旧記録は譲渡前の `post_author` を保存してからアクセス用所有者を変更します。コピー履歴は新所有者の初回記録に数えません。ベビー群記録は非公開の `_setae_nursery_event_recorders_v1` に記録IDと作成者の対応を持ちます。不明な旧群記録の作者を推定しません。private APIは本人作成かのbooleanを返し、公開ページに生の記録者IDを追加しません。

## 登録・認証・引継ぎ

引継ぎ文脈の登録はメール・パスワード・規約同意の3項目です。紹介コードは取得済みならhiddenで保持します。明確な引継ぎ意図 `request_after_verification` が保存された場合だけ、メール認証後に申請します。

認証トークンは期待値付きで一度だけ消費します。新規に消費できた時だけログインCookieを発行し、申請を作成して303でトークンのないURLへ戻します。既認証アカウントのIDと任意トークンではログインできません。同一申請は再利用し、所有権を自動承認しません。

pending claimはページ表示だけでは消しません。申請成立、対象の消失・無効化、自分の個体等の確定条件でのみ消します。一時障害では残します。Partnerからの試用CTAは設定画面の確認に戻り、登録・認証だけで試用を開始しません。

## UIとAPI

- `POST /setae/v1/plans/trial`: ログイン必須、1ユーザー1回。30日、カード不要、明示操作のみ。
- `GET /setae/v1/plans`: 購入可能なStarterの表示価格と準備状況。秘密鍵・Price IDは返しません。
- プロフィール: `plan / inventory / nursery / entitlements / trial / onboarding` を追加。旧 `is_premium / spider_count / spider_limit / bonus_limit` は互換用に残します。
- `GET /qr/targets`: 既存契約に `purpose=labels` と任意 `operation_id` を追加。成功したラベル準備だけを重複排除して計測します。実プリンターの印刷完了を検出するものではありません。
- 安定した `setae_*` エラーをUIで判定し、入力・写真・選択を保持して試用、プラン、契約管理へ案内します。

Today/Collectionの空状態はQR引継ぎと手動登録の2択です。My SETAEの飼育スタイル設定は任意として残します。受領後7日以内の個体には確認・到着記録・写真・通知の案内を既存機能へ接続します。過去の引継ぎ記録や筐体記録だけでは本人の初回記録を完了扱いしません。

認証済みPCの主要ナビとモバイル上部からCommunityを外し、設定の「つながり」へ置きます。公開ルート、ディープリンク、投稿、通知、モバイル下部5項目は維持します。画面は既存PrimitiveとRender Islandsを使い、新しいcatch-all CSSは追加しません。

## Stripe設定手順

1. ステージングでDBバックアップを取り、先にテストモードで確認します。
2. WordPressのSETAE設定で既存の秘密鍵・Webhook署名シークレットを設定します。チャットやログへ貼りません。
3. Starterの月額PriceをStripe側で用意し、`setae_stripe_price_breeder_starter` へ設定します。旧 `setae_stripe_price_id` は既存契約の識別用に残します。
4. `setae_plan_breeder_starter_price_label` を実際の価格に合わせます。既定表示は「月額1,480円」。表示を変更してもStripeの課金額は変わりません。
5. `setae_billing_grace_days` は既定7日、管理画面では1〜30日です。
6. Webhook URLはサイトのREST URL `/setae/v1/stripe/webhook`。購読するイベントは `checkout.session.completed / customer.subscription.created / customer.subscription.updated / customer.subscription.deleted / invoice.payment_succeeded / invoice.payment_failed`。`invoice.paid` も受信できます。
7. Stripe Customer Portalを有効にし、支払い方法・解約をテストします。SETAEのsuccess/cancel/portal return URLはすべて `Setae_App_Shell::app_url()` です。

秘密鍵、Webhook秘密、Starter Price、SDKが揃わない場合は申込みを無効化します。試用は別で利用できます。クライアントからPriceを指定しても使用しません。同等以上の有効契約は新規Checkoutを作らずPortalへ進めます。

Checkoutはユーザー単位のロックとStripe冪等キーを使用します。正確なリクエスト・キー・セッションを1つの非公開メタ `_setae_checkout_attempt` に保存し、保存失敗の再送でも同じ申込になります。未完了の画面は再利用、完了直後は同期待ち、確実に期限切れまたは契約終了の場合だけ新しい申込を作ります。Price変更前の未確定申込は元の条件で再送するため、即時に別価格へ置き換えません。発行時のattempt IDをsubscriptionにも渡し、Webhookではサーバー保存したID・ユーザー・Starter用途・元Priceとの一致を確認します。これにより設定変更前の正当な支払いも有効化し、未知Priceを一般に許可することはありません。

セッションID不明のまま23時間を超えた申込は管理者確認が必要です。Stripeの冪等キーは24時間以降に破棄され得るため、新規課金を推測して開始しません。Stripeで対象ユーザーのmetadata、契約、Checkoutを確認し、未決済の確定または正しい契約のWebhook再送で整合させてから、必要なら当該ユーザーの申込状態だけを修復してください。無条件に全ユーザーのメタを削除しないでください。[Stripe冪等リクエスト](https://docs.stripe.com/api/idempotent_requests)

Webhookは生のbodyの署名を検証後に専用inboxへ予約します。同じeventは再適用せず、一時失敗は再送可能、処理中のリースは5分で回復できます。順不同の到着ではロック内で最新subscriptionを再取得し、itemsのPriceとstatusを使います。metadataだけではプランを付与しません。[Stripe Webhooks](https://docs.stripe.com/webhooks)

`active / trialing` は有効、`past_due` は初回から固定の猶予を付与します。再送で延長しません。`unpaid / canceled / incomplete_expired` の確定状態で無料へ戻します。`invoice.payment_failed` 単独では即時剥奪しません。旧契約のPrice・ユーザー・subscriptionが不明な場合は警告を残して確認に回します。旧契約の確認済みの終了・猶予切れと、情報不足による推測降格を区別します。既存legacy契約を初めて計測しただけでは `subscription_started` を作らず、新しいStarterの初回有効化を数えます。

## DB変更一覧

既存テーブルの破壊的変更・全件移行・アンインストール削除はありません。新設は以下の2表です（prefixはサイト設定に従います）。

| テーブル | 主な列と索引 |
| --- | --- |
| `setae_product_events` | ID、冪等キー、イベント名/起源、利用者/匿名/セッション、流入元/パートナー、対象、固定ページ分類、プラン、版、許可properties、UTC時刻。冪等一意・イベント時刻・起源/イベント時刻・ユーザー時刻・流入元時刻・パートナー時刻の索引 |
| `setae_billing_events` | `event_id` 主キー、`state`、`lock_token`、`locked_until`、作成/更新日時。`state_lease(state,locked_until)` 索引。Stripe生payloadや顧客情報なし |

有効化および早い `init` で `dbDelta()` を呼び、テーブル存在確認後にschema versionを保存します。新schema optionはautoload=false。詳細なProduct Events列定義は [product-events-v1.0.251.md](product-events-v1.0.251.md) を参照してください。

追加または利用拡張するユーザーメタ:

- プラン: `_setae_plan_id / _setae_plan_status`。旧 `_setae_is_premium` は互換用。
- 試用: `_setae_breeder_trial_used / _setae_trial_started_at / _setae_trial_ends_at / _setae_trial_promoted_count`。
- 課金: `_setae_stripe_customer_id / _setae_stripe_subscription_id / _setae_stripe_price_id / _setae_stripe_current_period_end / _setae_stripe_cancel_at_period_end / _setae_plan_grace_until / _setae_premium_cancel_at`。
- 同期/再送: `_setae_billing_subscription_plan / _setae_billing_warning / _setae_billing_payment_failed_at / _setae_billing_transition_event / _setae_checkout_attempt`。
- 初回・帰還: `_setae_first_record_created_at / _setae_verification_claim_code / _setae_registration_return_url` と既存pending claimの明示意図。

追加する個体・記録メタ:

- `_setae_acquisition_source / _setae_received_at / _setae_trial_promotion_counted`
- `_setae_log_recorded_by_user_id`
- `_setae_nursery_event_recorders_v1`（群に保存する非公開の記録者map）

## 計測と運用

### 保存の原子性とDB要件

試用開始、個体化1件、QR譲渡完了は、必要なメタ・所有者・履歴・累計を同じtransactionで保存し、DBから読み戻して一致を確認します。個体化の途中で失敗しても、それ以前に保存できた番号は保持し、再送で同じ個体を増やしません。群の一括編集・QR記録も同じ利用者ロックで、古いベビー一覧の上書きを防ぎます。

trialは `usermeta`、個体化・譲渡の共通transactionはWordPressの `users / posts / postmeta / usermeta / terms / term_taxonomy / term_relationships / termmeta` がInnoDBであることを確認します。`information_schema.TABLES` のENGINE参照、`GET_LOCK`、autocommit=1、既存transactionなし、START/SAVEPOINT/RELEASE/COMMITが必要です。確認不能やMyISAMを推測で成功扱いせず503で止め、テーブル変換はしません。このDB条件を満たさないサイトでは、該当する新規操作・譲渡は管理者による環境確認が必要です。

ロック/transaction中はwpdbの自動再接続・SQL再送を停止して、接続断後に別接続でautocommitされることを防ぎます。処理がPHPへ戻る場合はfinallyで設定を戻し、触れたpost/user/term cacheを破棄します。COMMITの応答を確認できない場合は成功ともrollback済みとも断定せず、プラグインへ戻った場合は503にします。保存済みの個体番号・試用状態で再試行の重複を防ぎますが、この不確定応答時には成立イベントが欠測する可能性があります。

実WordPressでは接続断時に `wpdb::check_connection()` がDBエラーでexitし、プラグインのfinallyまで戻らない場合があります。この場合のHTTP応答・永続キャッシュの復旧をローカルdoubleでは保証していません。実MySQLでの競合、接続断、COMMIT応答喪失、永続キャッシュを本番投入前に別途確認してください。[WordPress接続確認](https://developer.wordpress.org/reference/classes/wpdb/check_connection/)

管理画面は「設定 → SETAE Product Analytics」。7/30/90日、閲覧〜契約のファネル、24時間アクティベーション、D1/D7/D30、流入元・パートナー、期間内最終プランと全ユーザーの現在プランを分けて表示します。計測前、分母なし、観測待ち、0件を区別します。過去イベントは推定生成しません。

メール、名前、生IP、User-Agent全文、記録本文、写真URL、パスワード、秘密キーをイベント表へ保存しません。サーバー成立イベントを正とし、旧clientイベントは起源を分離します。DNT/GPCではclient ID生成・送信を止めます。計測が失敗しても個体操作を取り消しません。したがって障害・オプトアウト期間の件数は実業務の全件数とは一致しないことがあります。

## 後続版へ残す項目

v1.0.252: 専用Breeder Workspace、販売状態、購入者一覧、発行時の由来スナップショット、記録者別表示、明示同意による購入後共有。既存の一括個体化・QR/ラベル機能は今回も維持しますが、この専用ワークスペースを完成扱いしません。

v1.0.253以降: 英語、海外通貨・税・規約、CSV import UI、複数スタッフ、ブランドページ、外部販売リンク、Pro/Shopの検証。

生体売買、オークション、エスクロー、配送、AI相談、Community拡張、図鑑データ更新は今回の対象外です。未実装機能の販売ボタンは追加しません。
