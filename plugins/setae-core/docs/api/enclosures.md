# 飼育容器API

飼育容器は個体の文字列属性ではなく、独立した飼育対象です。容器の設定、現在の入居個体、過去の入居履歴、環境確認、給水、清掃などを一つの台帳として管理します。

すべてのルートはWordPressログインCookieと `X-WP-Nonce` が必要です。利用者は自分の容器と個体だけを操作できます。

## データ構造

```json
{
  "id": 42,
  "code": "T-04",
  "name": "樹上種ラック 上段",
  "enclosure_type": "acrylic",
  "type_label": "アクリル容器",
  "width_mm": 150,
  "depth_mm": 150,
  "height_mm": 200,
  "dimensions_label": "15 × 15 × 20 cm",
  "location": "飼育棚A / 上段",
  "target_temp_min": 24,
  "target_temp_max": 27,
  "target_humidity_min": 70,
  "target_humidity_max": 80,
  "substrate": "ヤシガラ",
  "substrate_depth_mm": 40,
  "environment_interval_days": 1,
  "maintenance_interval_days": 14,
  "occupants": [],
  "occupant_count": 0,
  "last_environment": null,
  "last_maintenance": null,
  "care": {
    "environment_due_at": "2026-08-14",
    "environment_due": false,
    "maintenance_due_at": "2026-08-27",
    "maintenance_due": false
  },
  "events": []
}
```

`GET /enclosures/{id}` だけが `occupancy_history` を返します。一覧は画面表示に必要な直近情報に絞ります。

新GUIのTask EngineはUI Preferencesの`enclosure_care_profile`を使い、全体デフォルト → 容器種別 → 個別容器の順で間隔を解決します。対象は環境確認、霧吹き、給水、メンテナンス、床材交換です。値が`0`の作業は予定を作成しません。旧GUI向けの`care.environment_due_at`と`care.maintenance_due_at`も互換性のため維持します。

## 容器一覧

### `GET /enclosures`

クエリ:

| 名前 | 値 | 既定値 |
|---|---|---|
| `status` | `active`, `archived`, `all` | `active` |

初回アクセス時は、既存個体の `_setae_spider_enclosure` を容器レコードと入居履歴へ自動移行します。元の個体メタも互換性のため維持します。

## 作成・更新・アーカイブ

### `POST /enclosures`

`code` を省略すると `E001` 形式で自動採番します。`animal_ids` と `started_at` を同時に送ると、作成直後に個体を入居させます。

### `GET /enclosures/{id}`

容器の詳細、最大100件のイベント、全入居履歴を返します。

### `POST /enclosures/{id}`

容器設定を更新します。寸法と床材の深さはmm単位です。

### `DELETE /enclosures/{id}`

論理削除としてアーカイブします。入居中の個体がいる場合は `409 enclosure_has_occupants` です。

## 容器記録

### `POST /enclosures/{id}/events`

```json
{
  "event_type": "environment_check",
  "event_date": "2026-08-13",
  "temperature": 26.2,
  "humidity": 76,
  "note": "異常なし"
}
```

`event_type`:

- `environment_check`: 環境確認。温度または湿度が必須
- `maintenance`: 清掃・メンテナンス
- `watering`: 給水
- `misting`: 霧吹き
- `substrate_change`: 床材交換
- `note`: その他のメモ

個体の入退居時は `animal_move_in` / `animal_move_out` が自動記録されます。

## 入居履歴

### `POST /enclosures/{id}/occupancies`

```json
{
  "animal_ids": [123, 124],
  "started_at": "2026-08-13",
  "note": "容器交換"
}
```

個体が別の容器へ入居中なら、旧容器の入居を同日で終了してから新しい入居を開始します。一匹につき同時に一つの容器だけを有効にします。

### `DELETE /enclosures/{id}/occupancies/{animal_id}`

```json
{
  "ended_at": "2026-08-13",
  "note": "個体を譲渡"
}
```

履歴は削除せず、終了日を設定します。

## 個体APIとの互換性

`GET /my-spiders` と `GET /spider/{id}` は次を返します。

```json
{
  "enclosure": "T-04",
  "enclosure_id": 42,
  "enclosure_record": {
    "id": 42,
    "code": "T-04",
    "name": "樹上種ラック 上段",
    "enclosure_type": "acrylic",
    "location": "飼育棚A / 上段"
  },
  "housing": {
    "current": {},
    "history": [
      {
        "enclosure_id": 42,
        "enclosure_code": "T-04",
        "started_at": "2026-01-12",
        "ended_at": ""
      }
    ]
  }
}
```

`housing` は個体詳細だけが返します。現在の容器情報、最新の環境実測、移動履歴を一度に取得できます。

個体作成・更新では `enclosure_id` を正規入力とします。旧クライアントが `enclosure` の文字列を送った場合も、同名の容器を検索または作成して関連付けます。レスポンスの `enclosure` は互換用の派生値で、正規データはOccupancyです。

## 統合JournalとQR

- `GET /journal-events` は容器イベントを個体イベントと同じ時系列で返します。
- `GET /qr/targets?source=enclosure&ids[]=42` は容器QRラベルを発行します。
- `POST /qr/resolve` で容器QRを解決すると `target_type=enclosure`、`object_id=42` を返します。
