# Product Events v1.0.251

## 保存先と更新

新しい保存先は `{$wpdb->prefix}setae_product_events` だけです。既存の飼育データを移行・削除しません。`Setae_Product_Events::install_schema()` は有効化時、`maybe_upgrade()` は早い `init` で呼びます。`dbDelta()` 後にテーブルの存在を確認してから schema version `1.0.0` を保存します。

`setae_product_events_schema_version` と初回のみ設定する `setae_product_events_started_at` は autoload=false。アンインストール時の削除処理や既存の過去イベントの推定補完は追加していません。

| カラム | 型・用途 |
| --- | --- |
| id | bigint unsigned、主キー、自動採番 |
| idempotency_key | varchar(80)、一意、再送防止 |
| event_name / event_origin | varchar(64) / varchar(12)、イベント名と `client` / `server` |
| user_id | bigint unsigned nullable、サーバーで決定する利用者 |
| anonymous_id / session_id | varchar(64)、UUIDのみ、未識別時は空文字 |
| acquisition_source | varchar(64)、許可済み流入元の列挙値 |
| partner_user_id | bigint unsigned nullable、サーバーで解決した紹介者・現在のQR発行者 |
| object_type / object_id | varchar(32) / bigint unsigned nullable、許可された対象種別と業務ID |
| path | varchar(255)、固定のページ分類。実URLは保存しない |
| plan_id / app_version | varchar(40) / varchar(24)、サーバーの権限とバージョン |
| properties | longtext nullable、イベントごとに許可した小さなJSON |
| occurred_at / created_at | datetime、サーバーのUTC時刻 |

索引は主キー、一意 `idempotency_key`、`event_time(event_name,occurred_at)`、`origin_event_time(event_origin,event_name,occurred_at)`、`user_time(user_id,occurred_at)`、`source_time(acquisition_source,occurred_at)`、`partner_time(partner_user_id,occurred_at)` です。追加した `event_origin` により、旧クライアントの `email_verified` と新しいサーバーの認証成立を混同しません。

## 呼び出し契約

業務コードは `Setae_Product_Events::record($event_name, $context)` を使用します。contextはリクエスト本文のコピーではなく、処理済みの業務状態から組み立てます。

```php
Setae_Product_Events::record('specimen_created', array(
    'idempotency_key' => 'specimen:' . $spider_id,
    'user_id' => $owner_id,
    'object_type' => 'spider',
    'object_id' => $spider_id,
    'acquisition_source' => 'manual',
    'properties' => array('count' => 1),
));
```

返り値は `event / accepted / duplicate / count`、失敗時は `WP_Error` です。例外を外へ投げず、計測失敗で登録・記録・引継ぎ・課金の業務成功を取り消しません。呼び出し側は計測結果を業務成功判定に使いません。

サーバーの業務キーは80文字以内の英数字と `:_-`。例は `registration:<user_id>`、`verified:<user_id>`、`transfer-request:<request_id>`、`transfer-complete:<request_id>`。同じStripe webhookから複数のイベントを作る場合は種類ごとに別の接尾辞を使います。自由入力のoperation IDはハッシュ化して長さと保存内容を制限します。

`first_record_created` のキーは常に `first-record:<user_id>`。対象が本人所有の `setae_spider` または `setae_baby_group` であることを確認します。初回成功時だけ `_setae_first_record_created_at` にUNIX秒を保存します。再送でmetaだけ欠けている場合はDBに保存済みの初回時刻から回復し、再送時刻に書き換えません。引き継いだ過去履歴のコピーを、新所有者が作成した初回記録として呼び出してはいけません。

重複は一意索引と `INSERT IGNORE` により判定し、成功扱いで `duplicate:true` を返します。再送で行や旧日別件数を増やしません。

## REST・旧計測との互換

既存 `POST /setae/v1/metrics/events` とHTTP 202を維持します。受信する項目は `event / event_id / anonymous_id / session_id / path / payload`。IDは厳密なUUID、event_id省略は旧クライアント互換としてサーバー生成です。新クライアントは再送でも同じevent_idを使います。

クライアント由来の `user_id / plan_id / app_version / partner_user_id / object_id / occurred_at` は採用しません。新しい成立イベントはサーバー専用。旧許可リストは維持しますが、旧クライアントの成立名は `client` 起源として記録し、管理者ファネルの成立数には含めません。

旧Ajaxは `record_legacy()` 経由でクライアント起源になります。旧日別option `setae_metrics_YYYYMMDD` への互換書き込みは、旧許可イベントのクライアント起源・初回insertのみ。新しい分析の正はテーブルです。サーバー認証イベントで旧認証件数を二重加算しません。この互換書き込みの撤去は次版以降に別途判断します。

匿名RESTはOriginとFetch Metadataの同一サイト条件を確認し、既存のIPのHMACを使う短期レート制限を再利用します。匿名60件/分、ログイン中240件/分。生IPやUser-Agentをイベントへ保存しません。ヘッダーがない旧呼び出しは維持するため、これは完全なbot排除ではありません。

## 情報の最小化

payloadはフィルター前に4,096byte・深さ3まで。未知のキーは破棄し、数値・boolean・列挙値だけを許可します。メール、名前、パスワード、本文、メモ、写真URL、秘密情報の自由文字列を保存するキーはありません。受信本文全体も16KiBに制限します。エラーへSQL・DB詳細を返しません。

pathは `/`、`/partner/`、`/s/:code/`、`/setae-user/:ref/`、`/care/:id/`、`/app/` の固定分類だけです。URLクエリ・フラグメント・QR管理コードは保持しません。

主なpropertiesは、公開面のsurface、claim_intent/claim_available、対象数、record_id/record_type、group_id/request_id、label format、trial duration/limit、プランと契約状態です。自由なsource文字列は許可せず、`public_home / public_partner / public_passport / public_profile / public_care / app / qr / manual / nursery_promotion / offline / import / unknown` へ限定します。`qr_passport` 等の既存の既知別名のみ正規化します。

公開PHPの `public_config(surface,context)` は署名した短期contextを発行します。公開パスポートは対象個体ID、Partnerは既存の公開紹介コードを署名し、受信時点のサーバーで現在の所有者・紹介者を解決します。公開configへ所有者のユーザーIDは出しません。署名・有効期限は検証し、署名文字列そのものはpropertiesに保存しません。期限は24時間のため、長くキャッシュされた古いページは業務操作を妨げず計測だけ失敗し得ます。

## 軽量公開クライアント

`assets/js/public-product-events.js` は `window.SetaeProductEventsConfig` と既存DOMを利用します。Home / Partner / Passportの閲覧、登録開始、明示的な引継ぎCTAを計測します。メール・パスワードやフォーム全体を読みません。登録ダイアログでは `qr_claim_intent` の有無だけをbooleanへ変換します。

匿名ID cookieは `setae_product_anonymous_id`（90日、SameSite=Lax、HTTPSではSecure）、sessionStorageは `setae.product.session`（id / started_at / last_seen / day）、サーバー連携用session cookieは `setae_product_session_id`（30分）です。UTC日付変更または30分の無操作でセッションを更新します。保存が拒否された場合はメモリへ退避します。公開クライアントはDNT/GPC時にIDを作成・送信しません。

公開から登録するサーバーイベントはUUIDとして妥当なcookieだけを利用し、不正なcookieは無視します。cookieは利用者の認証ではありません。匿名IDとユーザーの集計上の連結は、同じ匿名IDから成立したサーバー登録が1アカウントだけの場合に限ります。

公開通信は同一オリジンだけ。ネットワークエラーまたは5xx時は1秒後に同じbody/UUIDで一度だけ再送します。429では再送せず、操作画面にエラーを出しません。SPAの `app_session_started` はSPA担当のセッション制御から送ります。サーバーでも `user_id + session_id` の一意キーで二重記録を防ぎます。

## 管理者の集計

WordPress「設定 → SETAE Product Analytics」。`manage_options` 必須で、期間は7 / 30 / 90日のUTC暦日です。計測開始前は未計測と表示し、計測済み期間の該当行がなければ0件。途中開始の期間は警告します。DBエラーを0件として隠しません。

ファネルは段階ごとの期間内件数・計測利用者数・識別不可イベント数です。重要な成立はserver起源だけを採用します。同一人物が全段階を順番に通ったコンバージョン率ではないことを画面に明記します。

アクティベーションは登録・受領から24時間以内の本人の管理対象への初回記録。ベビー群作成から初回群記録も対象です。開始イベントより前に初回記録を済ませた利用者を、新たな初回対象へ重複計上しません。24時間を観測済みの分母と、まだ観測中の人数を区別します。

D1 / D7 / D30は初回アクティベーションのUTC日付からN日後の `app_session_started` を集計します。対象日を終えた利用者だけを分母にし、未到達は観測待ち。分母なしを0%とは表示しません。

流入元・パートナーの内訳は集計値のみ（イベント数上位100件）。パートナー表示は業務IDで、氏名・メールや個体の本文は表示しません。期間内のプラン別は「期間内の最終計測時プランで1人1回」であり、サイト全登録者の現在プラン総数とは分けます。

別表「現在の全ユーザーの実効プラン」は、このサイトのユーザーIDを500件ずつ取得し、読み取り専用の `Setae_Entitlements::peek_plan_id()` で全件を集計します。イベントなしの旧プレミアム、期限切れ試用、支払い猶予も現在の判定で含みます。`sync_legacy_state()` は呼ばず、ユーザーメタの大量更新を行いません。管理者による無制限権限もlegacyに含むため「契約購入者数」とは異なることを画面に明記します。期間別の表と異なり、こちらは表示時点の値です。

## 検証の範囲

`tests/product-events-unit.php` は本物のstore/REST callback/admin formatterをWordPress・wpdbの契約doubleで実行します。schema宣言、重複SQLの契約、禁止情報、server/client境界、初回記録、署名、レート制限、0/未計測、観測待ち、管理者権限を検証します。`tests/product-events-client-unit.js` は本物の公開JSをVMで実行して匿名ID、cookie、プライバシー選択、再送とCTAを確認します。

これらは本番WordPress/MySQLでのDDL・実集計、物理端末、実Stripe・実メール配信の確認ではありません。デプロイ後の実テーブル作成・管理画面の実データ確認は別途必要です。
