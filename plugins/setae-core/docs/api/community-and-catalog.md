# 図鑑・コミュニティAPI

## 図鑑

| 操作 | API | 権限 |
|---|---|---|
| 一覧・検索 | `GET /species` | 公開 |
| 入力候補 | `GET /species/suggest` | 公開 |
| 詳細 | `GET /species/{id}` | 公開 |
| 種別集計 | `GET /species/{id}/stats` | 公開 |
| 修正提案 | `POST /species/{id}/suggestions` | 公開 |
| 直接更新 | `POST|PUT|PATCH /species/{id}` | 図鑑編集権限 |
| 画像追加 | `POST /species/{id}/image` | 図鑑編集 + upload権限 |
| 関連広告 | `GET /ads/species/{id}` | 公開 |

一覧クエリ:

| 入力 | 内容 |
|---|---|
| `search` | 学名・和名等の検索 |
| `page`, `per_page` | 1ページ1〜100件 |
| `offset` | オフセット指定 |
| `orderby` | `id`, `modified`, `title` |
| `order` | `asc`, `desc` |
| `genus` | 属slug |
| `modified_after` | ISO 8601以降の更新 |
| `context` | `view`, `edit` |
| `status` | `any`, `publish`, `draft`, `pending`, `private` |
| `review_status` | `unreviewed`, `draft`, `reviewed`, `verified` |

編集APIは `revision` / ETagによる競合検出に対応します。更新時は `expected_revision` または `If-Match` を送り、古い場合は上書きしません。`validate_only=true` で保存前検証ができます。研究情報、画像クレジット、出典、飼育プロファイルを含む詳細仕様は [species-api.md](../species-api.md) を参照してください。

画像追加は `image` multipart必須です。`role=thumbnail|gallery|both`、`alt_text`, `caption`, `credit_type`, `credit_text`, `credit_user`, `source_url`, `license`, `expected_revision` を指定できます。

種一覧と詳細は`representative_image`を返します。表示中の代表画像へattachment ID、次にURLで画像記録を突合しているため、撮影者・出典・ライセンスを別画像から流用しません。従来の`thumb`は互換性のため残ります。

### 入力候補 `GET /species/suggest`

個体登録などのCombobox専用APIです。`q`で学名、和名、属名を検索し、`limit`は1〜12件（既定8件）です。完全一致、前方一致、部分一致の順で候補を返します。

```json
{
  "id": 123,
  "ja_name": "セラドニア",
  "scientific_name": "Typhochlaena seladonia",
  "genus": "Typhochlaena"
}
```

入力候補は軽量応答であり、画像や説明文を含みません。詳細が必要になった時点で`GET /species/{id}`を利用します。

## 相談・投稿

### 一覧と詳細

| 操作 | API | 権限 | 入力 |
|---|---|---|---|
| 一覧 | `GET /topics` | 公開 | `type`, `page`, `per_page` 最大20, `s`, `sort=updated|newest|momentum`, `scope=all|following|mine`, `species_id` |
| 詳細 | `GET /topics/{id}` | 公開 | `page`。コメントは20件ずつ |
| 種別動向 | `GET /topics/species-pulse` | ログイン | `limit` |

未ログインは閲覧のみです。`following`, `mine` は未ログイン時に空になります。ブロックしたユーザーの投稿・コメントは返しません。

### 投稿とコメント

| 操作 | API | 入力 |
|---|---|---|
| 投稿作成 | `POST /topics` | `title`, `content`, `type`, `related_species_id`, `has_cw`, `image`, `image_alt` |
| コメント | `POST /topics/{id}/comments` | `content` 1000文字以下、`image` 任意 |
| 投稿リアクション | `POST /topics/{id}/reactions` | `reaction` |
| コメントリアクション | `POST /topics/comments/{id}/reactions` | `reaction` |
| 解決状態 | `POST /topics/{id}/status` | `status=open|resolved`。投稿者または管理者 |
| ベスト回答 | `POST /topics/{id}/best-answer` | `comment_id`。0で解除 |

投稿はタイトル必須で、本文または画像のどちらかが必要です。投稿・コメントには60秒の連投制限があります。1トピック1000コメントで書き込みを停止します。

### 未読

| 操作 | API | 内容 |
|---|---|---|
| 未読概要 | `GET /topics/unread` | 件数、対象トピック、最新内容 |
| 1件既読 | `POST /topics/{id}/mark-read` | 対象トピックの最終閲覧を更新 |
| 全件既読 | `POST /topics/mark-read` | 対象すべてを既読化 |

## フォロー・ブロック

| 操作 | API | 内容 |
|---|---|---|
| 関係一覧 | `GET /social/relationships` | フォロー・ブロック一覧と件数 |
| フォロー | `POST /social/users/{id}/follow` | 対象をフォロー |
| フォロー解除 | `DELETE /social/users/{id}/follow` | 対象を解除 |
| ブロック | `POST /social/users/{id}/block` | ブロックし、同時にフォロー解除 |
| ブロック解除 | `DELETE /social/users/{id}/block` | 対象を解除 |

自分自身は対象にできません。ブロック中はフォローできません。

## 繁殖募集ボード

| 操作 | API | 権限・入力 |
|---|---|---|
| 募集中一覧 | `GET /bl-candidates` | 公開。HTTPS外部連絡先を持つ募集だけ返す |
| 募集設定 | `POST /spiders/{id}` | 所有者のみ。`bl_status`, `bl_terms`, `breeding_contact_url`, `breeding_contact_label` |

SETAEは公開募集情報と外部連絡先だけを表示します。申請、契約状態、個別メッセージ、未読通知、メール転送は提供しません。交渉・連絡は掲載者が指定した外部サービスで行います。既存の契約・チャットテーブルは移行保全のため削除しませんが、APIとUIからは利用されません。

## 広告

### `GET /ads/species/{id}`（公開）

対象種に紐づく有効な広告を返します。新GUIでは図鑑本文と明確に区別し、広告であることを表示してください。広告の作成・編集はWordPress管理画面の運用機能であり、利用者向けGUI APIの対象外です。
