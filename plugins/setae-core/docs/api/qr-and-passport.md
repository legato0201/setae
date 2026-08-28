# QR・Field Label・Public Passport API

QRは内部投稿IDではなく、`https://setae.net/v24b/`のような恒久URLを格納します。ケース移動、成長、所有者変更後もコードとURLを変更しません。物理ラベルは`Digital Identity + Temporary Field Notes`、SETAEは`Permanent Living Record`を担当します。

既存の4〜5文字コードは恒久URLとして維持します。新規発行は6文字を標準とし、衝突時だけ7〜8文字へ延長します。APIと公開ページはIP単位の照会上限を持ち、存在しないコードの連続照会にはより厳しい制限を適用します。

## ラベル対象

`GET /qr/targets`はログイン必須です。本人が管理する対象だけを最大100件返します。

| 対象 | Query |
|---|---|
| 通常個体 | `source=spider&ids[]=123` |
| Nursery内の番号 | `source=baby&group_id=103&codes[]=A001` |
| 飼育容器 | `source=enclosure&ids[]=22` |

主要レスポンスは`target_type`, `object_id`, `baby_code`, `code`, `url`, `manage_code`, `species_name`, `short_name`です。`url`をそのままQR SVGへ変換し、別tokenや内部IDをQRへ埋め込みません。

## QR解決

`POST /qr/resolve`はログイン必須で、本人が管理するQRだけを解決します。

```json
{ "code": "https://setae.net/v24b/" }
```

所有対象でない場合は`403 qr_not_owned`です。GUIはその場合だけ公開Passport APIへ切り替えます。これによりSingle Scannerは所有者へ給餌・観察・脱皮・詳細表示を示し、それ以外の利用者には公開範囲だけを示します。

## Public Passport

`GET /qr/passport/{code}`は認証不要です。公開モードは次の3段階です。

| `visibility` | 公開内容 |
|---|---|
| `private` | 個体番号、恒久URL、引き継ぎ可否だけ |
| `basic` | 写真、学名、Family、齢期、性別、由来を追加 |
| `life_history` | Basicに脱皮・成長・繁殖の公開履歴を追加 |

Basic例:

```json
{
  "visibility": "basic",
  "code": "C001",
  "permanent_url": "https://setae.net/v24b/",
  "managed_by_viewer": false,
  "transfer_available": false,
  "scientific_name": "Typhochlaena seladonia",
  "family_name": "Theraphosidae",
  "stage": "instar_8",
  "sex": "unknown",
  "origin": "CB",
  "image_url": "https://setae.net/...",
  "life_history": []
}
```

この専用APIは`user_id`, `email`, owner情報、内部オブジェクトID、非公開メモ、飼育場所、飼育容器情報、Care Task、購入金額、販売情報、非公開写真を返しません。公開ページは全モードで`noindex,follow`です。

## 公開範囲設定

`POST /qr/spiders/{id}/settings`はログイン必須です。

```json
{
  "visibility": "life_history",
  "transfer_enabled": true
}
```

`visibility`は`private|basic|life_history`です。旧クライアントの`public` booleanも互換用に受け付けます。
引き継ぎを有効にした個体は申請者が対象を確認できる必要があるため、公開表示は最低でも`basic`相当になります。

## Batch Record

`POST /qr/records`はログイン必須です。個体ごとに日付が異なる入力では`entries`を使います。

```json
{
  "entries": [
    { "code": "v24b", "type": "molt", "date": "2026-08-12", "note": "" },
    { "code": "v24c", "type": "molt", "date": "2026-08-13", "note": "" },
    { "code": "v24d", "type": "feed", "date": "2026-08-14", "prey_type": "D. hydei" }
  ]
}
```

1リクエスト最大100件です。対象の所有権と稼働状態を全件検証してから保存します。通常個体は飼育ログ、Baby QRはNursery内の番号別履歴へ保存します。容器QRはこのAPIへ混在できません。

通信失敗時、新GUIは同じpayloadをOffline Queueの`create_qr_records`として保存します。キューは`setae.gui.v2.offlineQueue.{userId}`へ利用者別に保存され、各操作の`owner_id`と現在のログイン利用者が一致するときだけ`POST /offline/sync`で再送されます。操作IDによって重複適用も防ぎます。

旧形式として、全対象へ同じ1記録を加える`codes + type + date`と、対象×記録の組み合わせを作る`codes + records[]`も維持します。個体別日付には必ず`entries`を使用します。

## Transfer

| 操作 | API |
|---|---|
| 申請・通知一覧 | `GET /qr/transfers` |
| 承認・見送り | `POST /qr/transfers/{id}` with `action=approve|reject` |
| 通知既読 | `POST /qr/notifications/read` |

他人のQRからの引き継ぎ申請は公開Passportページで行います。承認後も恒久URLとQRコードは維持し、管理者だけを変更します。
