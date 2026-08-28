# SETAE Application API v1

このディレクトリは、SETAEの利用者向けGUIを作り直す際の正本となるAPI仕様です。新しいGUIは、WordPressの投稿・メタデータ・Ajaxアクションへ直接依存せず、原則として `/wp-json/setae/v1/` 以下だけを利用します。

## 仕様書一覧

- [app-and-account.md](app-and-account.md): 初期化、登録、セッション、プロフィール、計測
- [animals-and-care.md](animals-and-care.md): 個体、お世話記録、フィード、ベビー、餌
- [qr-and-passport.md](qr-and-passport.md): 恒久QR、Field Label、Batch Record、Public Passport、引き継ぎ
- [enclosures.md](enclosures.md): 飼育容器、入居履歴、環境・メンテナンス記録
- [tasks.md](tasks.md): Taskの完了・試行・延期・見送り
- [community-and-catalog.md](community-and-catalog.md): 図鑑、相談、交流、繁殖貸与、広告
- [integrations.md](integrations.md): PWA、オフライン同期、外部アクセス、ChatGPT、Stripe
- [legacy-migration.md](legacy-migration.md): 旧Ajaxと新REST APIの対応
- [gui-rebuild.md](gui-rebuild.md): GUI再構築時の状態管理と実装順
- [species-api.md](../species-api.md): 図鑑編集APIの詳細
- [external-access-api.md](../external-access-api.md): 外部トークンAPIの詳細

## 基本URL

```text
https://setae.net/wp-json/setae/v1
```

WordPressをサブディレクトリへ設置する可能性があるため、GUIではURLを固定せず、`GET /app/bootstrap` の `links.api_root`、またはWordPressが出力するRESTルートを使用してください。

## 認証

| 区分 | 用途 | 認証方法 |
|---|---|---|
| `public` | 図鑑閲覧、相談閲覧、登録、修正提案など | なし |
| `login` | 通常の利用者操作 | WordPressログインCookie + `X-WP-Nonce` |
| `species_editor` | 図鑑の直接編集 | ログイン + `manage_setae_species_api` |
| `administrator` | Best Shot審査など | ログイン + `manage_options` |
| `bearer_token` | 外部ツールからの記録 | `Authorization: Bearer ...` |
| `oauth_or_protocol` | ChatGPT App | OAuthまたはMCPプロトコルの認証 |
| `stripe_signature` | Stripe Webhook | `Stripe-Signature` |

ブラウザからログイン後の更新系APIを呼ぶときは、`X-WP-Nonce: <wp_rest nonce>` を送信します。`POST /session` はログイン、`GET /session` は状態確認、`DELETE /session` はログアウト、`POST /password-reset` は再発行依頼、`POST /email-verification` は本登録です。

APIログイン直後は公開ページに埋め込まれていたnonceを再利用せず、`POST /session` のレスポンスに含まれる新しい `nonce` へ必ず差し替えます。

## リクエスト形式

- 通常: `application/json` または `application/x-www-form-urlencoded`
- 画像付き: `multipart/form-data`
- 日付: `YYYY-MM-DD`
- 日時: ISO 8601、またはレスポンスに明記されたWordPress日時
- 真偽値: JSONの `true` / `false` を推奨
- ID: 正の整数。QRコードとベビー番号は文字列

## レスポンスとエラー

成功時は各機能のデータを直接返します。旧Ajax形式の `{ success, data }` ではありません。

```json
{
  "code": "invalid_email",
  "message": "メールアドレスの形式を確認してください。",
  "data": { "status": 400 }
}
```

主なHTTPステータス:

| 状態 | 意味 |
|---|---|
| `200` | 取得・更新成功 |
| `201` | 新規作成成功 |
| `202` | 計測など非同期扱いの受付成功 |
| `400` | 入力不正 |
| `401` | 未ログイン・認証なし |
| `403` | 権限不足・利用上限 |
| `404` | 対象なし |
| `409` | 重複・現在状態との競合 |
| `429` | 回数制限 |
| `500` | 保存失敗 |
| `503` | 外部設定未完了 |

利用者固有データを返すAPIは `Cache-Control: no-store, private` を基本とします。

## 機械可読な操作一覧

`GET /operations` は、実行中のWordPressに登録されている `/setae/v1` の全ルートを列挙します。

```json
{
  "namespace": "setae/v1",
  "total": 90,
  "operations": [
    {
      "method": "GET",
      "path": "/setae/v1/my-spiders",
      "access": "login",
      "arguments": []
    }
  ]
}
```

この一覧は「ルートの存在確認」に使います。意味、入力制約、画面での扱いは本仕様書を正とします。

## API互換性

- 現行名前空間は `setae/v1`。
- v1内では既存フィールドを削除・別用途へ変更しない。
- フィールド追加は許可する。GUIは未知フィールドを無視する。
- 破壊的変更は `setae/v2` を作成する。
- 旧Ajaxは移行期間だけ維持し、新GUIからは呼ばない。
