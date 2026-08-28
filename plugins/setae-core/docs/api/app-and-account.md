# アプリ基盤・アカウントAPI

## 初期化

### `GET /app/bootstrap`（公開）

新GUIが最初に1回取得する設定です。API版、プラグイン版、ログイン状態、登録可否、有効機能、画像上限、関連URL、ログイン中ユーザーを返します。

主なレスポンス:

| フィールド | 型 | 内容 |
|---|---|---|
| `api_version` | string | 現在は `v1` |
| `plugin_version` | string | 配布中のプラグイン版 |
| `authenticated` | boolean | ログイン状態 |
| `nonce` | string/null | ログイン中の `wp_rest` nonce |
| `registration_enabled` | boolean | 新規登録受付中か |
| `features` | string[] | 利用可能モジュール |
| `upload_limits` | object | プロフィール・提案画像の上限byte |
| `terms_version` | string | 現在の利用規約版 |
| `links` | object | API、ログイン、再発行、利用規約URL |
| `user` | object/null | ログイン中は `/me` と同形式 |

## 操作一覧

### `GET /operations`（公開）

登録済みSETAE APIを `method`, `path`, `access`, `arguments` の配列で返します。開発・契約テスト用です。画面表示のたびに取得する必要はありません。

## 仮登録

### `POST /registration`（公開）

| 入力 | 必須 | 制約 |
|---|---:|---|
| `email` | yes | 有効なメールアドレス、未使用 |
| `password` | yes | 文字列 |
| `username` | no | 未入力時はメールアドレスから生成 |
| `referral_code` | no | 紹介コード |
| `referral_source` | no | 48文字以内の識別子 |
| `qr_claim_code` | no | 登録後に引き継ぐQRコード |
| `terms_accepted` | yes | `true`。未同意は `terms_not_accepted` / 400 |
| `terms_version` | no | Bootstrapで返された規約版 |

成功は `201`。`status` は `pending_verification` です。認証メール内URLを開くまで通常ログインできません。同一IPからの登録は3件までです。同意日時・規約版・規約URLはユーザーメタへ保存されます。

```json
{
  "user_id": 123,
  "status": "pending_verification",
  "email_sent": true,
  "message": "仮登録が完了しました。..."
}
```

## セッション

### `GET /session`（公開）

`authenticated`, `nonce` と、ログイン中なら `user` を返します。セッション切れの復帰判定に使います。

### `POST /session`（公開）

`login`, `password`, `remember` を送り、WordPressログインCookieを発行します。成功時は `authenticated: true`、以後の更新APIに使う新しい `nonce`、`/me` 形式の `user` を返します。失敗理由はユーザー名の存在を推測できないよう常に `invalid_credentials` とします。同一送信元は15分に10回までです。

返却する `nonce` は、`WP_Session_Tokens` へ登録したセッショントークンを使い、このレスポンスで発行するログインCookieと同じトークンから生成します。GUIは成功レスポンスを受け取った時点で保持中のnonceを差し替え、GETを含む以後のRESTリクエストすべてへ `X-WP-Nonce` として送信します。

### `DELETE /session`（ログイン）

WordPressログインCookieを破棄します。成功時は `{ "authenticated": false }`。

### `POST /password-reset`（公開）

`login` にメールアドレスまたはユーザー名を送り、再設定メールを要求します。アカウントの存在にかかわらず同じ `202` メッセージを返します。同一送信元は1時間に4回までです。メール内の新パスワード設定画面はWordPress標準画面を利用します。

### `POST /email-verification`（公開）

認証メールの `user_id` と `token` を送り、本登録を完了します。同じ認証を再実行した場合も `already_verified: true` として成功します。従来の `?setae_action=verify_email&uid=...&token=...` URLも同じ共通処理を利用して残します。

WordPress標準画面へフォールバックするURLは `GET /app/bootstrap` の `links.login`, `links.password_reset` から取得できます。

## 自分のプロフィール

### `GET /me`（ログイン）

| フィールド | 内容 |
|---|---|
| `id`, `display_name`, `email`, `avatar_url` | 基本情報 |
| `theme_preference` | `light`, `dark`, `system` |
| `show_care_focus` | 今日の確認を表示するか |
| `is_premium`, `cancel_timestamp` | 契約状態 |
| `spider_count`, `spider_limit`, `bonus_limit` | 個体枠。`spider_limit=-1` は無制限 |
| `referral_code`, `referral_stats` | 紹介情報 |
| `public_handle`, `public_profile_url` | 公開プロフィール |

### `POST /me`（ログイン）

部分更新です。送信したフィールドだけ変更します。

| 入力 | 制約 |
|---|---|
| `display_name` | 空不可 |
| `email` | 有効かつ他ユーザー未使用 |
| `password` | 空なら変更しない |
| `theme_preference` | `light`, `dark`, `system` |
| `show_care_focus` | boolean |
| `profile_image` | JPG/PNG/WebP、2MB以下、multipart |

成功時は更新後の `/me` 全体を返します。
パスワードを変更した場合は現在のブラウザセッションを再発行し、レスポンスに新しい `nonce` も含めます。

## UI設定

### `GET /ui/preferences`（ログイン）

GUIの端末間同期に使う表示設定を返します。

| フィールド | 内容 |
|---|---|
| `dashboard_widgets` | `key`, `visible`, `size` を持つウィジェット配列。配列順が表示順 |
| `dashboard_sections` | SectionとRegistry Widgetから成るGUI v2ダッシュボード構成 |
| `animal_saved_views` | 共通Animal Queryを持つ保存View。最大30件 |
| `animal_view` | `gallery` または `table` |
| `animal_card` | Collectionカードの表示形式・情報量・表示項目・クイック操作 |
| `personalization` | My SETAEの基準プリセット、カスタマイズ状態、初回セットアップ完了状態 |
| `care_profile` | Care Engineの全体デフォルト、種・個体ごとの上書きルール |
| `collection_tab` | `animals`, `babies`, `feeders` |

### `POST /ui/preferences`（ログイン）

送信した設定だけを更新します。未送信の設定は維持し、未知のウィジェット・Queryフィールド・演算子は保存しません。`dashboard_sections` は最大12 Section・各20 Widget、`animal_saved_views` は最大30件です。`animal_card.mode` は `photo`, `hybrid`, `data`、`density` は `compact`, `standard`, `detailed`、`quickActions` は `feed`, `observation`, `molt`, `growth` から重複なしで最大3件です。`personalization.presetId` は `simple`, `collection`, `breeder`, `research`, `custom` です。`care_profile` は `defaults → species → animals` の順で継承し、給餌間隔・観察間隔・脱皮前後の除外期間・近日表示期間を保存します。旧GUIの `dashboard_widgets` も後方互換のため維持します。

## 図鑑修正提案

### `POST /species/{id}/suggestions`（公開）

図鑑を直接編集せず、審査待ちの提案を作成します。未ログインでも送信可能です。

| 入力 | 制約 |
|---|---|
| `species_name` | 表示用の対象名 |
| `suggested_common_name_ja` | 和名案 |
| `suggested_lifestyle` | 生活様式案 |
| `suggested_temperature` | 温度案 |
| `suggested_humidity` | 湿度案 |
| `suggested_lifespan` | 寿命案 |
| `suggested_size` | サイズ案 |
| `suggested_temperament_ids` | 性格IDのカンマ区切り |
| `suggested_description` | 2000文字以下 |
| `suggested_image` | JPG/PNG/WebP/GIF、5MB以下、multipart |

成功は `201` で `id`, `status: pending`, `message` を返します。
同一送信元からの修正提案は1時間に8回までです。

## 利用計測

### `POST /metrics/events`（公開）

許可リスト方式のカウンタです。個人情報や自由入力本文は保存しません。

| 入力 | 必須 | 内容 |
|---|---:|---|
| `event` | yes | 許可されたイベント名 |
| `path` | no | 発生画面。現実装では集計キーに含めない |
| `payload` | no | 補助情報。現実装では集計値に保存しない |

成功は `202`。`event` と当日の `count` を返します。

## Best Shot審査

### `POST /admin/best-shots/{log_id}`（管理者）

| 入力 | 内容 |
|---|---|
| `action` | `approve`, `reject`, `revoke` |
| `species_id` | 承認・取消時に必須 |
| `image_id` | 記録に画像URLがない場合の補助 |

承認時は図鑑ギャラリーへ画像を追加し、初回承認時だけ投稿者の個体枠を1増やします。取消時はギャラリーから除外して `pending` に戻します。
