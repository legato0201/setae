# 旧AjaxからREST APIへの移行

既存GUIを壊さず移行できるよう、旧Ajaxは当面残します。新GUIはこの表のREST APIだけを使用してください。

| 現在の操作 | 旧経路 | 正式なREST API | 状態 |
|---|---|---|---|
| 新規仮登録 | `setae_register_user` | `POST /registration` | 共通処理へ接続済み |
| プロフィール更新 | `setae_update_profile` | `POST /me` | 共通処理へ接続済み |
| 図鑑修正提案 | `setae_submit_species_edit` | `POST /species/{id}/suggestions` | 共通処理へ接続済み |
| 図鑑検索 | `setae_search_species` | `GET /species` | REST実装済み。旧版はHTML断片専用 |
| Best Shot審査 | `setae_handle_best_shot` | `POST /admin/best-shots/{log_id}` | 共通処理へ接続済み |
| コミュニティ未読 | `setae_get_unread_community_count` | `GET /topics/unread` | REST実装済み |
| コミュニティ既読 | `setae_update_com_last_checked` | `POST /topics/mark-read` | REST実装済み |
| 利用計測 | `setae_track_event` | `POST /metrics/events` | 共通処理へ接続済み |

`SetaeAPI` に追加済みのGUI向け関数:

| JavaScript | REST API |
|---|---|
| `fetchAppBootstrap` | `GET /app/bootstrap` |
| `fetchOperations` | `GET /operations` |
| `registerUser` | `POST /registration` |
| `fetchSession` | `GET /session` |
| `createSession` | `POST /session` |
| `deleteSession` | `DELETE /session` |
| `requestPasswordReset` | `POST /password-reset` |
| `verifyEmail` | `POST /email-verification` |
| `fetchCurrentUser` | `GET /me` |
| `updateCurrentUser` | `POST /me` |
| `submitSpeciesSuggestion` | `POST /species/{id}/suggestions` |
| `trackMetricEvent` | `POST /metrics/events` |

## WordPress管理運用として残すもの

次は利用者向けGUIではなく、管理者がWordPress管理画面で行う保守操作です。通常のアプリAPIとは分離します。

- 外部DB移行のプレビュー・実行 (`setae_migration_preview`, `setae_migration_execute`)
- 図鑑の管理画面一括登録 (`setae_bulk_species_save`)
- ユーザー権限、停止、プレミアム、ボーナス枠の管理
- 広告の作成・編集
- 修正提案の承認・統合

これらを将来別管理GUIへ移す場合は `/setae-admin/v1` 等の管理専用名前空間を設計し、`manage_options` と監査ログを必須にします。

## 廃止手順

1. 新GUI内の `admin-ajax.php` 呼び出しを0件にする。
2. RESTの契約テストを本番相当環境で通す。
3. 旧GUIへの戻し期間中はAjaxを残す。
4. アクセスログで旧アクションが使われていないことを確認する。
5. 次のメジャー版で旧Ajaxフックと到達不能な旧処理を削除する。
