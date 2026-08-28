# Task lifecycle API

Task Engineが生成した作業に対する結果を、再読込・別端末でも維持するためのAPIです。Taskそのものは給餌記録やCare Planから再生成し、このAPIには発生日ごとの結果だけを保存します。

## `GET /task-actions`

`since=YYYY-MM-DD` を指定すると、その日以降に操作した結果だけを返します。

## `POST /task-actions`

```json
{
  "taskId": "animal:123:feed",
  "targetType": "animal",
  "targetId": 123,
  "type": "feed",
  "scheduledFor": "2026-08-14",
  "outcome": "attempted",
  "retryAt": "2026-08-15",
  "actedOn": "2026-08-14",
  "reason": "給餌を試みましたが食べませんでした"
}
```

GUIは操作時点で期限超過または今日だったTaskに`required: true`を付けます。記録後に次回予定へ進んで現行Taskが一覧から消えても、この値でその日の進捗を維持します。`required`のない任意操作は`HANDLED`には表示しますが進捗へ加算しません。

`outcome`:

- `completed`: 作業と記録が完了
- `attempted`: 作業を試みたが完了条件を満たさず、`retryAt` に再確認
- `deferred`: 利用者が`retryAt`まで延期
- `skipped`: 今回を見送り、`retryAt`から次の周期を開始

同じ`taskId + scheduledFor`への送信は上書きです。任意の記録はTodayの進捗へ加算せず、その日に期限超過または予定日だったTaskと一致した場合だけ対応済みにします。

`targetType`は`animal`、`enclosure`、`nursery`です。Nurseryでは`feed`、`observation`、`count`、`environment`を保存します。

## `POST /task-actions/batch`

`{"items": [...]}`で最大100件を一度に保存します。一括給餌・一括観察ではこのルートを使い、利用者メタの更新を一回にまとめます。

通信失敗時は`POST /offline/sync`へ`save_task_action`または`save_task_actions_batch`として積み直します。同期結果の成功操作だけを端末キューから削除し、失敗分は次回再送に残します。
