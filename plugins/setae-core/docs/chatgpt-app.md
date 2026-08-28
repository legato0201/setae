# SETAE ChatGPT App

## 目的

一般的なChatGPTの通常チャットから、ユーザー本人のSETAE飼育データを会話で操作する。

- 飼育一覧の検索
- 個体カルテと直近履歴の取得
- 給餌、脱皮、ペアリング、観察、成長記録の追加
- 個体名、種類、性別、状態、アーカイブ状態の更新

通常チャットではChatGPT AppのMCPとOAuth 2.1を使用する。GPT-Liveでは接続アプリを呼び出せないため、別途、短命トークンと確認チケットを使うURLブリッジを使用する。

## 重要な製品仕様

通常のプロンプトだけでは、ChatGPTに外部DBへの通信権限や認証情報を追加できない。ユーザーは初回だけPlugin DirectoryでSETAEを接続し、SETAEのログイン画面で許可する必要がある。その後は同じ通常チャット内で自然文から操作できる。

SETAE側では無料ユーザーを制限せず、無料プランを含む個人アカウントを対象にする。ただし、Plugin Directoryは全プランに表示されても、実際の接続可否はChatGPT側のプラン、地域、対応画面、アプリの提供状況に依存する。一般ユーザーへ届けるにはOpenAIの公開審査が必要。

ChatGPTのライブ音声モードは現在、外部アプリ操作には対応していないがWeb検索は利用できる。プロフィールの`GPT-Live連携`で発行する一度表示のプロンプトを同じ会話へ送り、その後GPT-Liveを開始する。詳細は`docs/gpt-live-url-bridge.md`を参照。

公式資料:

- https://help.openai.com/en/articles/11487775-apps-in-chatgpt
- https://help.openai.com/en/articles/20001274
- https://help.openai.com/en/articles/9237897-chatgpt-
- https://developers.openai.com/apps-sdk
- https://developers.openai.com/apps-sdk/build/auth
- https://developers.openai.com/apps-sdk/deploy/submission

## エンドポイント

本番環境ではすべてHTTPSが必須。

```text
MCP:
https://setae.net/wp-json/setae/v1/chatgpt/mcp

OAuth protected resource metadata:
https://setae.net/.well-known/oauth-protected-resource

OAuth authorization server metadata:
https://setae.net/.well-known/oauth-authorization-server

Authorization:
https://setae.net/chatgpt/oauth/authorize

Token:
https://setae.net/wp-json/setae/v1/chatgpt/oauth/token

Revocation:
https://setae.net/wp-json/setae/v1/chatgpt/oauth/revoke
```

## MCPツール

### `list_animals`

本人所有の個体を名前、種類、SETAE ID、分類、状態で検索する。読み取り専用。

### `get_animal`

本人所有の1個体について、基本情報、更新競合を防ぐ`version`、直近の飼育記録を返す。読み取り専用。

### `add_care_record`

明示された個体へ飼育記録を追加する。`request_id`による冪等性を持ち、通信再試行で同じ記録を重複保存しない。

### `update_animal`

基本情報の指定フィールドだけを更新する。直前に`get_animal`を呼び、返された`version`を`expected_version`として渡す必要がある。別操作で更新済みなら409相当の競合として停止する。

## 認証と安全性

- OAuth 2.1 authorization code + PKCE S256
- ChatGPT Client ID Metadata Document（CIMD）を検証
- `client_id`と`redirect_uri`はChatGPT/OpenAIのHTTPSホストに限定
- CIMD取得は`wp_safe_remote_get`を使い、SSRFを防止
- 認可コードは5分、一度だけ使用可能
- アクセストークンは1時間、リフレッシュトークンは30日
- リフレッシュ時に両トークンをローテーション
- 平文トークンはDBへ保存せず、HMACハッシュのみ保存
- トークンをユーザー、CIMDクライアント、MCP resource、scopeへ固定
- 全操作で個体の所有者を再検証
- 読み取りと書き込みのscopeを分離
- IP、接続、scope単位でレート制限
- トークン更新、失効、最終利用日時の保存をユーザー単位で直列化
- SETAEプロフィールから全接続を即時失効可能

## 公開前の確認

1. `setae-core`を本番へ配置する。
2. WordPressへ一度アクセスする。新しい認可URLのrewrite ruleは初回アクセス時に自動更新される。DBテーブルの追加作業はない。
3. 以下が200でJSONを返すことを確認する。

```bash
curl -fsS https://setae.net/.well-known/oauth-protected-resource
curl -fsS https://setae.net/.well-known/oauth-authorization-server
```

4. 認証不要のMCP初期化とツール検出を確認する。

```bash
curl -fsS https://setae.net/wp-json/setae/v1/chatgpt/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"deploy-check","version":"1"}}}'

curl -fsS https://setae.net/wp-json/setae/v1/chatgpt/mcp \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

5. MCP InspectorでOAuth接続、所有者境界、全4ツール、失効後の再認証を検証する。
6. OpenAI Platformで個人または事業者の本人確認を完了する。
7. Plugin submission portalで公開MCP URLを登録し、`Scan Tools`を実行する。
8. プライバシーポリシー、利用規約、サポートURL、ロゴ、説明、テストプロンプトを登録する。
9. OAuthのクライアント方式はCIMD、token endpoint auth methodは`none`を選択する。
10. 審査通過後、WordPress管理画面の`Setae Settings > ChatGPT App 連携 > 公開アプリURL`へPlugin Directory URLを保存する。

## 審査用テストプロンプト

```text
SETAEで飼育中の個体を一覧にして。
```

```text
「P023」という個体の種類と直近の給餌・脱皮記録を確認して。
```

```text
今日、P023にデュビアを給餌したと記録して。
```

```text
P023の状態を脱皮前に変更して。
```

複数候補がある名前では、保存前に候補を示してユーザーへ確認すること。未来日、他人の個体、古い`version`、同一`request_id`の再送も検証する。

## ユーザー向け初回プロンプト

プロフィールのChatGPT連携画面から以下をコピーできる。

```text
この会話ではSETAEアプリを使って、私自身の飼育個体と飼育記録を管理してください。
個体名だけで変更を頼んだ場合は、最初にSETAEの一覧を検索してください。候補が複数なら種類名とSETAE IDを示して確認し、曖昧なまま保存しないでください。
個体情報の編集前には最新の詳細を取得し、取得したversionを使って更新してください。
日付は日本時間として扱い、私が言っていない日付・個体・内容を推測して保存しないでください。
保存に成功した後だけ、個体名・日付・変更内容を短く復唱してください。
```

## 旧External API

`/setae/v1/external/*`とOpenAPIスキーマは互換性維持のため当面残しているが、新しいユーザー導線では使用しない。プロフィール画面から手動トークン発行とOpenAPI設定は撤去済み。公開ChatGPT Appの動作確認後、利用状況を確認して別リリースで廃止できる。
