# 個体・お世話API

この文書のAPIは、特記がない限りログイン必須で、本人が所有するデータだけを操作します。

## マイ個体

| 操作 | API | 主な入力・動作 |
|---|---|---|
| 一覧 | `GET /my-spiders` | `scope=active|archived|all`, `sort`, `paged`, `per_page` |
| 今日の状況 | `GET /care-summary` | 要記録、連続日数、直近カレンダー等 |
| 新規登録 | `POST /spiders` | `classification`, `species_id` または `custom_species`, `name`, `last_molt`, `last_feed`, `image` |
| 詳細 | `GET /spider/{id}` | 所有者または管理者のみ |
| 更新 | `POST /spiders/{id}` | 下表の部分更新、画像はmultipart |
| 削除 | `DELETE /spiders/{id}` | 個体を完全削除 |
| お気に入り | `POST /spiders/{id}/favorite` | `favorite` または `is_favorite` |

新規登録は無料枠 + ボーナス枠までです。プレミアムは無制限です。タランチュラは図鑑の `species_id` または図鑑未登録時の `custom_species` が必須です。その他分類は `custom_species` を使用します。

`GET /my-spiders`は`per_page`最大100件のページングAPIです。全件を必要とするクライアントは、返却件数が`per_page`未満になるまで`paged=1,2,...`を順に取得します。

個体更新フィールド:

| 入力 | 制約・意味 |
|---|---|
| `name` | 個体名 |
| `status` | `normal`, `fasting`, `pre_molt`, `post_molt` 等 |
| `archived` | boolean。譲渡済み受領記録は復帰不可 |
| `gender` | `male`, `female`, `unknown` 等 |
| `species_id` / `custom_species` | 図鑑種または自由入力種。旧`species_name`も互換入力として受付 |
| `temperature`, `humidity` | 個体の参考値。現在の環境実測は飼育容器記録を正とする |
| `substrate`, `origin` | 飼育情報、各120文字まで |
| `enclosure_id` | 正式な飼育容器へ入居・移動。空で現在の入居を終了 |
| `acquired_date` | `YYYY-MM-DD` |
| `instar` | 1〜30。0で削除 |
| `notes` | 2000文字まで |
| `bl_status`, `bl_terms` | 繁殖募集状態（`none`, `recruiting`）・公開条件。条件は2000文字まで |
| `breeding_contact_url` | 募集用の外部連絡先。`https://` のみ。募集中では必須 |
| `breeding_contact_label` | 外部リンク表示名、80文字まで |
| `image` | 個体写真、multipart |

## お世話記録

| 操作 | API | 主な入力・動作 |
|---|---|---|
| 履歴 | `GET /spider/{id}/events` | `offset`, `per_page`（最大100） |
| 全体時系列 | `GET /care-events` | 自分の全個体を横断。`limit`（最大100）、`offset`、`type` |
| 統合Journal | `GET /journal-events` | 個体と飼育容器の時系列を統合。`limit`（最大200）、`offset`、`type` |
| 記録追加 | `POST /spider/{id}/events` | `type`, `date`, `data`, `image`, `compact_response` |
| 記録更新 | `POST /logs/{id}` | 現在は主に `refused` の更新 |
| 記録削除 | `DELETE /logs/{id}` | 最終給餌・脱皮等も残存履歴から再計算 |
| フィード共有 | `POST /logs/{id}/share` | `shared` を省略すると共有、falseで解除 |

記録種別の中心は `feed`, `molt`, `growth`, `pairing`, `observation` です。`note`, `memo` は `observation` に正規化されます。`data` はJSONオブジェクトまたはJSON文字列で、全体5000文字までです。

代表的な `data`:

```json
{
  "note": "デュビアMを1匹",
  "prey_type": "デュビア",
  "refused": false,
  "label": "異常なし",
  "size": "8.5",
  "share_to_feed": true,
  "is_best_shot": false
}
```

給餌成功は最終給餌日と状態を更新し、拒食は `fasting`、脱皮は `post_molt`、観察は最終確認内容を更新します。

`GET /care-events` は旧クライアント向けの個体専用時系列です。新GUIのToday、Dashboard、Laboratory Journalは `GET /journal-events` を共通データ源にします。

統合Journalの各項目は `target_type=animal|enclosure`, `target_id`, `event` を共通で持ちます。個体項目は `animal_id`、容器項目は `enclosure_id` と `enclosure` も返します。レスポンスには `total`, `limit`, `offset` が含まれます。

## お世話フィード

| 操作 | API | 入力 |
|---|---|---|
| 一覧 | `GET /care-feed` | `page`, `per_page`, `classification`, `sort=active|new`, `scope=all|following|mine` |
| 詳細 | `GET /care-feed/{id}` | `page`, `focus_comment` |
| 共有解除 | `DELETE /care-feed/{id}` | 所有者のみ |
| 通報 | `POST /care-feed/{id}/report` | `reason` |
| リアクション | `POST /care-feed/{id}/reaction` | `reaction` |
| コメント | `POST /care-feed/{id}/comments` | `content` 1000文字まで、`parent_id` 任意 |
| コメント削除 | `DELETE /care-feed/comments/{id}` | 投稿者または管理者 |
| コメント通報 | `POST /care-feed/comments/{id}/report` | `reason` |
| 未読数 | `GET /care-feed/unread` | 返信・リアクションを返す |
| 既読化 | `POST /care-feed/mark-read` | 最終確認日時を更新 |

## ベビー群

1匹ずつ通常個体を作らず、番号付きの群として大量管理します。

| 操作 | API | 主な入力 |
|---|---|---|
| 群一覧 | `GET /baby-groups` | 自分の群と集計 |
| 群作成 | `POST /baby-groups` | `name`, `prefix`, `count` 1〜500, `birth_date`, `species_id`, `species_name`, `parent_spider_ids`, `parent_note` |
| 群詳細 | `GET /baby-groups/{id}` | 番号別履歴を含む |
| 群更新 | `POST /baby-groups/{id}` | `name`, `archived` |
| 群削除 | `DELETE /baby-groups/{id}` | 完全削除 |
| 一括記録 | `POST /baby-groups/{id}/bulk` | `event`, `date`, `codes`, `note` |
| マイ個体へ移動 | `POST /baby-groups/{id}/promote` | `codes`。プレミアム限定 |
| 群イベント一覧 | `GET /baby-groups/{id}/events` | 群全体の給餌・観察・個体数・環境確認 |
| 群イベント記録 | `POST /baby-groups/{id}/events` | `type`, `date` と種別固有データ |

Nurseryは、群全体の飼育記録と番号別記録を分離します。

- Nursery-level event: `feed`, `observation`, `count_check`, `environment_check`
- Baby-level event: `molt`, `dead`, `alive`, `rehomed`, `transferred`

`count_check`は`current_count`を受け取り、直前の確認数との差を`data.previous_count`、`data.difference`として保存します。番号別状態は自動変更しないため、未確認個体が判明した後に番号別記録で確定できます。

`GET /baby-groups`と`GET /baby-groups/{id}`は、`events`、`living_count`、齢期別の`development`を返します。`GET /journal-events`には個体・容器と同じ時系列でNursery-level eventも含まれます。

一括記録の `event`:

| 値 | 意味 |
|---|---|
| `molt` | 脱皮日を履歴へ追加 |
| `dead` | 死亡日を記録 |
| `alive` | 死亡・譲渡状態を取り消して生存へ戻す |
| `rehomed` | 譲渡済みにする |

`codes` は `A001,A002`、改行区切り、`A001-A010` の範囲表記を利用できます。死亡・譲渡・通常個体へ移動済みの番号へ脱皮等を追加することはできません。

## 餌在庫

| 操作 | API | 主な入力 |
|---|---|---|
| ダッシュボード | `GET /feeders` | 在庫、履歴、卵セット、推定日 |
| 在庫記録 | `POST /feeders/actions` | `feeder_type`, `action`, `quantity`, `date`, `note` |
| 卵セット | `POST /feeders/eggs` | `feeder_type`, `set_date`, `temperature` 18〜35, `note` |
| 孵化・中止 | `POST /feeders/eggs/{uuid}` | `status=hatched|cancelled`, `actual_hatch_date`, `hatched_count`, `note` |

在庫 `action` は `purchase`（購入）、`consume`（使用）、`breed`（繁殖増加）、`box_reset`（清掃）、`adjust`（棚卸し）です。匹数上限は100,000。孵化完了時は孵化数を在庫へ加算します。

## QR

恒久URL、Public Passport、Label Studio、個体別日付のBatch Record、引き継ぎの正本は[qr-and-passport.md](qr-and-passport.md)です。

| 操作 | API | 主な入力 |
|---|---|---|
| ラベル対象取得 | `GET /qr/targets` | 個体: `source=spider&ids[]`; ベビー: `source=baby&group_id&codes[]`; 容器: `source=enclosure&ids[]`。最大100 |
| QR解決 | `POST /qr/resolve` | `code` またはSETAE QR URL |
| QR一括記録 | `POST /qr/records` | 個体別の`entries`、または互換用の共通記録 |
| Public Passport | `GET /qr/passport/{code}` | 認証不要。公開専用の最小レスポンス |
| 個体QR設定 | `POST /qr/spiders/{id}/settings` | `visibility`, `transfer_enabled` |
| 引き継ぎ一覧 | `GET /qr/transfers` | 申請・通知概要 |
| 引き継ぎ回答 | `POST /qr/transfers/{id}` | `action=approve|reject` |
| 通知既読 | `POST /qr/notifications/read` | QR通知を既読化 |

共通一括記録は `codes`, `type`, `date`, `note`, `prey_type` を送ります。個体ごとに日付や内容が違う場合は、`code`, `type`, `date`, `note`, `prey_type`を持つ`entries`配列を使います。

容器QRを `POST /qr/resolve` すると `target_type=enclosure` と `object_id` を返します。GUIは対象容器を開き、環境確認・メンテナンスの記録フォームへ接続します。個体向けの `/qr/records` へ容器QRを混在させません。
