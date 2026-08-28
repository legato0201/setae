# Setae 図鑑 REST API

外部ツールやCodexから図鑑情報を取得・更新するためのAPIです。公開情報の取得は認証不要、編集と画像アップロードは`manage_setae_species_api`権限を持つWordPressユーザーの認証が必要です。管理者にはこの権限が自動付与されます。

## エンドポイント

| Method | Path | 認証 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/wp-json/setae/v1/species` | 不要 | 図鑑一覧・検索 |
| `GET` | `/wp-json/setae/v1/species/{id}` | 不要 | 個別情報 |
| `PATCH` / `POST` / `PUT` | `/wp-json/setae/v1/species/{id}` | 専用編集権限 | 個別情報の更新 |
| `POST` | `/wp-json/setae/v1/species/{id}/image` | 専用編集権限 | 画像アップロード |

`{id}` はプレースホルダーです。波括弧ごと入力せず、`/species/3190` のように実在する数値IDへ置き換えてください。

機械可読な仕様は `docs/species-api.openapi.yaml` にあります。

## 認証

外部アクセスにはWordPressのApplication Passwordsを使います。WordPress管理画面の「ユーザー > プロフィール > アプリケーションパスワード」で、この連携専用のパスワードを発行してください。

運用では専用の編集者ユーザーを作り、WP-CLIなどで`manage_setae_species_api`だけを追加する方法を推奨します。そのユーザーには図鑑投稿の編集と画像アップロードに必要な標準権限も必要です。

```bash
wp user add-cap codex_research manage_setae_species_api
```

必ずHTTPSを使い、メインのログインパスワードはAPIへ渡さないでください。認証情報はソースコードやGitへ保存せず、実行環境のシークレットまたは環境変数で管理します。

```bash
export SETAE_BASE_URL="https://example.com"
export SETAE_API_USER="wordpress-user"
read -s SETAE_APP_PASSWORD
export SETAE_APP_PASSWORD
```

## 一覧取得

```bash
curl --fail-with-body \
  "$SETAE_BASE_URL/wp-json/setae/v1/species?per_page=100&page=1&orderby=title&order=asc"
```

レスポンス本文は既存画面との互換性を保つため配列です。総件数はレスポンスヘッダーから取得します。

- `X-WP-Total`: 総件数
- `X-WP-TotalPages`: 総ページ数

主なクエリ:

| Parameter | 内容 |
| --- | --- |
| `search` | 学名または和名の部分一致 |
| `page` | 1始まりのページ番号 |
| `per_page` | 1〜100件 |
| `orderby` | `title`, `modified`, `id` |
| `order` | `asc`, `desc` |
| `genus` | 属タクソノミーのslug |
| `modified_after` | ISO 8601。指定時刻より後に更新された項目 |
| `context=edit` | 下書きを含む編集用情報。認証必須 |
| `status` | `any`, `publish`, `draft`, `pending`, `private` |
| `review_status` | `unreviewed`, `draft`, `reviewed`, `verified`。`context=edit`時のみ |

編集対象を探す例:

```bash
curl --fail-with-body \
  --user "$SETAE_API_USER:$SETAE_APP_PASSWORD" \
  "$SETAE_BASE_URL/wp-json/setae/v1/species?context=edit&status=any&review_status=unreviewed&per_page=100"
```

## 個別取得

```bash
curl --fail-with-body \
  "$SETAE_BASE_URL/wp-json/setae/v1/species/123?include_related=false"
```

`include_related=false`にすると相談・お世話フィードを省略でき、Codexの巡回取得が軽くなります。レスポンスの`revision`と`ETag`は更新競合の防止に使います。

`context=edit`では調査メモ、最終API更新情報、直近10件の`api_update_history`、編集権限も返します。

個別レスポンスには、静的な図鑑本文に加えて次の情報が含まれます。

- `content_sections`: 同定、分布、生態、飼育、給餌、繁殖、保全、注意点
- `care_profile`: ケージ、床材、通気、給水、給餌、成長、繁殖、接触
- `research`: 出典、調査状態、最終調査日時
- `related_summary`: 飼育者、公開飼育記録、相談、繁殖募集、ショップ、出典の総数
- `related_care_logs`, `related_topics`: Setaeに蓄積された実記録と相談
- `breeding_candidates`: この種で募集中の繁殖貸与候補
- `shop_links`: 管理者が掲載申請を承認し、公開・掲載期間内にあるショップリンクのみ
- `data_quality`: 必須情報12項目の充足率と不足項目
- `representative_image`: 一覧・詳細で表示する代表画像と、その画像に厳密に対応する撮影者、出典、正規化済みライセンス、変更表示

`representative_image`は`url`, `alt`, `credit`, `source_url`, `license`, `changes`を返します。既存互換の`thumb`, `image_credit`, `image_records`も維持します。`license.code`と`license.url`は既知のCreative Commons表記だけに設定し、未知の自由記述をCCライセンスとして扱いません。

`related_*`, `breeding_candidates`, `shop_links`は各機能の実データから生成される読み取り専用項目です。PATCHで直接書き換えません。

## 個別更新

更新前に必ず最新の個別情報を取得し、返された`revision`を`If-Match`ヘッダーまたは`expected_revision`へ渡します。古いrevisionの場合は`409 species_revision_conflict`となり、既存データを上書きしません。

```json
{
  "scientific_name": "Grammostola pulchra",
  "ja_name": "ブラジリアンブラック",
  "description": "飼育情報の本文",
  "lifespan": "メスは20年以上の記録がある",
  "size": 16,
  "difficulty": "beginner",
  "temperature": "24-28°C",
  "humidity": "60-70%",
  "genus": "Grammostola",
  "habitats": ["Brazil"],
  "lifestyles": ["地上性"],
  "temperaments": ["Calm"],
  "content_sections": {
    "identification": "同定に使える外見上の特徴。",
    "distribution": "確認された分布域。",
    "natural_history": "野外での生活史。",
    "husbandry": "一次資料と実飼育を区別した飼育上の要点。",
    "feeding": "食性と給餌上の注意。",
    "breeding": "繁殖行動と既知の条件。",
    "conservation": "保全・流通上の留意事項。",
    "cautions": "刺激毛や咬傷などの注意。"
  },
  "care_profile": {
    "enclosure": "成長段階に応じた容器の目安。",
    "substrate": "床材と深さ。",
    "ventilation": "必要な通気。",
    "water": "給水方法。",
    "feeding": "給餌頻度の目安。",
    "growth": "成長速度の傾向。",
    "breeding": "交接・産卵管理。",
    "handling": "原則としてハンドリング非推奨。"
  },
  "external_links": [
    {
      "title": "World Spider Catalog",
      "url": "https://wsc.nmbe.ch/",
      "type": "taxonomy",
      "note": "分類・有効名の確認"
    }
  ],
  "research_sources": [
    {
      "title": "参照した論文または一次資料",
      "url": "https://example.org/paper",
      "doi": "10.0000/example",
      "authors": ["A. Author"],
      "year": 2024,
      "accessed_at": "2026-07-18T00:00:00Z",
      "note": "寿命と分布の根拠"
    }
  ],
  "research_notes": "Codexの調査メモ。公開レスポンスには含まれない。",
  "review_status": "draft",
  "update_source": "codex_research",
  "research_run_id": "codex-2026-07-18-grammostola-pulchra",
  "codex_model": "利用したモデル名",
  "change_note": "分類・分布・飼育情報を一次資料で再調査"
}
```

```bash
REVISION="個別取得で返されたrevision"

curl --fail-with-body \
  --user "$SETAE_API_USER:$SETAE_APP_PASSWORD" \
  --request PATCH \
  --header "Content-Type: application/json" \
  --header "If-Match: \"$REVISION\"" \
  --data @species-update.json \
  "$SETAE_BASE_URL/wp-json/setae/v1/species/123"
```

更新可能な主なフィールド:

- 基本情報: `scientific_name`, `ja_name`, `description`, `excerpt`, `slug`, `status`
- 飼育情報: `lifespan`, `size`, `difficulty`, `temperature`, `humidity`
- 分類: `genus`, `habitats`, `lifestyles`, `temperaments`
- 画像: `featured_media`, `featured_images`, `image_credit`
- 構造化本文: `content_sections`, `care_profile`, `external_links`
- 調査: `research_sources`, `research_notes`, `review_status`, `last_researched_at`
- 監査情報: `update_source`, `research_run_id`, `codex_model`, `change_note`

`review_status`は`unreviewed`, `draft`, `reviewed`, `verified`のいずれかです。自動調査は原則`draft`で保存し、人間が確認した後に`reviewed`または`verified`へ進めます。

`content_sections`と`care_profile`は部分更新ではなく、渡したオブジェクト全体で置換します。既存キーを残したい場合は、GETした現在値へ変更をマージしてから送信してください。未対応キーはタイプミスを見逃さないため`400`になります。

### 書き込み前の検証

同じPATCH本文へ`"validate_only": true`を追加すると、権限・revision・全フィールドの形式だけ検証し、データを変更しません。成功時は`valid`, `species_id`, `revision`, `fields`を返します。Codexはまず検証し、その後`validate_only`を外して同じrevisionで本更新してください。

## 画像アップロード

`file`または`image`というmultipartフィールドで送信します。`role`は`thumbnail`, `gallery`, `both`です。

```bash
curl --fail-with-body \
  --user "$SETAE_API_USER:$SETAE_APP_PASSWORD" \
  --request POST \
  --header "If-Match: \"$REVISION\"" \
  --form "file=@/absolute/path/species.webp" \
  --form "role=both" \
  --form "alt_text=ブラジリアンブラックの成体メス" \
  --form "credit_type=text" \
  --form "credit_text=Photographer Name / Wikimedia Commons" \
  --form "source_url=https://commons.wikimedia.org/example" \
  --form "license=CC BY 4.0" \
  "$SETAE_BASE_URL/wp-json/setae/v1/species/123/image"
```

自分が撮影した画像は`credit_type=user`を使えます。`credit_user`を省略すると、APIで認証したユーザーが提供者になります。外部画像は、再利用可能なライセンスと提供元URLを確認できた場合だけアップロードしてください。

## Codexによる安全な更新フロー

1. `context=edit`の一覧を取得し、`review_status=unreviewed`または情報が不足している個体を1件選ぶ。
2. `include_related=false&context=edit`で最新情報と`revision`を取得する。
3. 学名を確認し、査読論文、原記載、学術データベースなど一次資料を優先して調査する。
4. 各主張の根拠を`research_sources`へ保存し、推測は本文へ断定的に書かない。論文由来の情報とSetaeの実飼育傾向を混同しない。
5. `validate_only=true`と`If-Match`付きPATCHで入力を事前検証する。
6. 検証済み本文から`validate_only`を外し、`review_status=draft`、一意な`research_run_id`、`change_note`を付けて1匹だけ更新する。
7. 更新レスポンスの`data_quality`, `research`, `revision`, `last_api_update`を検査し、次の個体へ進む。
8. 画像は権利とライセンスが明確なものだけ別APIで追加する。

失敗時は同じPATCHを無条件で再送せず、`409`なら個別情報を再取得して差分を作り直してください。`401`は認証、`403`は権限、`413`は画像サイズ、`415`は画像形式の問題です。

## 現在の範囲

このAPIは既存図鑑の全本文・分類・画像指定・調査情報の取得と更新、画像追加を対象とします。飼育記録、相談、繁殖募集、承認ショップは各機能を正とする読み取り専用データです。新しい種の作成と添付画像ファイル自体の削除は対象外です。
