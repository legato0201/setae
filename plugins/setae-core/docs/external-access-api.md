# SETAE External Care API（旧方式）

> 新しいChatGPT連携はOpenAPI ActionsではなくMCP + OAuth 2.1を使用する。実装・公開手順は `docs/chatgpt-app.md` を参照。このAPIは互換性維持のため一時的に残している。

SETAEにログインし、プロフィールの「外部連携」からトークンを発行します。
トークンは発行時に一度だけ表示され、サーバーにはハッシュだけが保存されます。

## ChatGPT Actions

1. OpenAPIスキーマURLをGPTの「アクション」に読み込ませます。
2. 認証方式を「APIキー」、方式を「Bearer」にします。
3. SETAEで発行したトークンを認証欄へ設定します。
4. SETAE画面の「操作プロンプト」をGPTのInstructionsへ追加します。

トークンをInstructionsや会話本文へ貼り付けないでください。

OpenAPI:

```text
https://setae.net/wp-json/setae/v1/external/openapi
```

## Endpoints

### List individuals

```http
GET /wp-json/setae/v1/external/spiders?q=P023&scope=active
Authorization: Bearer <ACCESS_TOKEN>
```

Query parameters:

- `q`: Individual name, species name, or individual ID
- `scope`: `active`, `archived`, or `all`
- `classification`: Classification slug
- `status`: Husbandry status
- `page`: Page number
- `per_page`: 1-100

### Add a record

```http
POST /wp-json/setae/v1/external/spiders/123/records
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json

{
  "request_id": "voice-20260723-001",
  "type": "feed",
  "date": "2026-07-23",
  "prey_type": "フタホシコオロギ",
  "refused": false,
  "note": "1匹"
}
```

Supported record types:

- `feed`: `prey_type`, `refused`, and `note`
- `molt`: `note`
- `pairing`: `note`
- `observation`: `label` or `note`
- `growth`: required `size_cm` and optional `note`

`request_id` must be unique for each logical operation. Reuse the same value only
when retrying that same operation. A repeated successful request returns the
existing log with `duplicate: true` and does not create another log.

## Security

- HTTPS is required.
- Tokens are accepted only in the `Authorization: Bearer` header.
- One active token is stored per user; reissuing immediately invalidates the old token.
- Read-only and read/write scopes are available.
- Every query and write is restricted to the token owner's records.
- Archived individuals cannot receive external records.
- Invalid authentication attempts and valid API requests are rate limited.
- Private responses use `Cache-Control: no-store`.

If a valid token always returns `401`, confirm that the web server forwards the
`Authorization` header to WordPress/PHP.
