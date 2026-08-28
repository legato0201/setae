# 通知・同期・外部連携API

## PWA通知

| 操作 | API | 権限・入力 |
|---|---|---|
| 設定状態 | `GET /pwa/config` | 公開。VAPID設定、ログイン、端末数、設定 |
| 端末登録 | `POST /pwa/subscriptions` | ログイン。PushSubscription, `device_name`, `timezone` |
| 端末解除 | `DELETE /pwa/subscriptions` | ログイン。`endpoint` |
| 通知設定取得 | `GET /pwa/preferences` | ログイン |
| 通知設定保存 | `POST /pwa/preferences` | 下表 |
| テスト通知 | `POST /pwa/test` | ログイン。30秒制限 |

通知設定:

| 入力 | 内容 |
|---|---|
| `enabled` | 通知全体 |
| `care_reminders` | お世話リマインダー |
| `community_messages` | 相談・返信通知 |
| `care_hour` | 0〜23 |
| `care_minute` | 0〜55、5分単位へ丸める |
| `timezone` | PHPが認識するタイムゾーン名 |

購読エンドポイントはHTTPSのみ。1ユーザー最大8端末です。

## オフライン同期

### `POST /offline/sync`（ログイン）

PWAでオフライン中に蓄積した個体・記録操作を順番に同期します。1回最大120操作です。

```json
{
  "operations": [
    {
      "operation_id": "device-a:20260810:0001",
      "action": "create_log",
      "entity_id": -42,
      "payload": {
        "spider_id": -1,
        "type": "feed",
        "date": "2026-08-10",
        "data": { "prey_type": "デュビア", "refused": false }
      }
    }
  ]
}
```

対応 `action` は `create_spider`, `update_spider`, `delete_spider`, `create_log`, `update_log`, `delete_log`。`operation_id` は12〜128文字で、同じ操作を再送すると保存済み結果を返し重複作成しません。`mapping` は端末側の一時IDとサーバーIDの対応です。

## 外部アクセストークン（旧連携）

| 操作 | API | 権限 |
|---|---|---|
| 状態 | `GET /external-access` | ログイン |
| 発行 | `POST /external-access/token` | ログイン、`mode=read|read_write` |
| 無効化 | `POST /external-access/disable` | ログイン |
| OpenAPI | `GET /external/openapi` | 公開 |
| 個体検索 | `GET /external/spiders` | Bearer token |
| 記録追加 | `POST /external/spiders/{id}/records` | 書込Bearer token |

記録追加には一意な `request_id`, `type`, `date` が必須で、再送は冪等です。詳細は [external-access-api.md](../external-access-api.md) を参照してください。この方式は互換維持用で、新規ChatGPT連携はMCP + OAuthを使います。

## GPT-Live URL連携

| 操作 | API | 権限 |
|---|---|---|
| 状態 | `GET /live/access` | ログイン |
| セッション発行 | `POST /live/access/session` | `mode=read|read_write`, `duration=3600|86400|604800` |
| 無効化 | `POST /live/access/disable` | ログイン |

発行後の実操作は `/live/{token}/...` の期限付きURLで行い、REST名前空間ではありません。書込は必ずprepareと5分間の確認チケットを経由します。詳細は [gpt-live-url-bridge.md](../gpt-live-url-bridge.md) を参照してください。

## ChatGPT App

| 操作 | API | 用途 |
|---|---|---|
| MCP | `POST /chatgpt/mcp` | MCP initialize, tools/list, tools/call |
| Protected Resource情報 | `GET /chatgpt/oauth-protected-resource` | OAuthメタデータ |
| Authorization Server情報 | `GET /chatgpt/oauth-authorization-server` | OAuthメタデータ |
| トークン | `POST /chatgpt/oauth/token` | Authorization Code + PKCE / refresh |
| 失効 | `POST /chatgpt/oauth/revoke` | token revoke |
| 接続状態 | `GET /chatgpt/access` | ログイン |
| 全接続解除 | `POST /chatgpt/access/disable` | ログイン |

MCPツールは `list_animals`, `get_animal`, `add_care_record`, `update_animal`。認証・スコープ・競合制御は [chatgpt-app.md](../chatgpt-app.md) を参照してください。

## Stripe

| 操作 | API | 権限 |
|---|---|---|
| Checkout開始 | `POST /stripe/create-checkout-session` | ログイン |
| 顧客ポータル | `POST /stripe/create-portal-session` | ログイン、Stripe customer登録済み |
| Webhook | `POST /stripe/webhook` | Stripe署名 |

Checkout・Portalは `{ "url": "https://checkout.stripe.com/..." }` を返します。GUIは返されたHTTPS URLへ遷移します。WebhookはGUIから呼びません。

