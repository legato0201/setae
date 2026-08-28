# SETAE v1.0.244 Human Usability Test

Status: **NOT RUN**  
Participants: **0 / 3 required**  
Build: `1.0.244`

この文書は実ユーザー検証用である。自動Task Flow、開発者による目視、Desktop Device Emulationを実ユーザー試験のPASSとして扱わない。

## Required Participant Mix

| Participant | Required background | Status |
|---|---|---|
| P1 | クモ・爬虫類等の飼育経験者 | NOT RUN |
| P2 | 生体管理アプリを初めて使う飼育者 | NOT RUN |
| P3 | SETAEを初めて見る利用者 | NOT RUN |

## Session Header

| Field | Value |
|---|---|
| Session ID | 未採番 |
| Test date | 未実施 |
| Participant | 未実施 |
| Husbandry experience | 未実施 |
| SETAE experience | 未実施 |
| Device / OS | 未実施 |
| Browser / PWA | 未実施 |
| Observer | 未実施 |

## Procedure

1. 操作方法を先に説明せず、Taskの目的だけを伝える。
2. 完了、所要時間、誤タップ、戻る操作、説明要求、手助け、迷った箇所、発話を記録する。
3. 各Task後にSEQを1から7で回答してもらう。
4. 操作不能・データ損失・誤保存をP0、自力完了不能をP1、迷い・遅延をP2、軽微な違和感をP3とする。
5. P0/P1および複数参加者で再現したP2は、修正と同じ条件での再試験を記録する。

## Required Tasks

| Task | Participant instruction | Completion condition |
|---|---|---|
| 1 | 新しい個体を登録してください。 | 個体登録を完了しCollectionに表示できる。 |
| 2 | その個体へ給餌を記録してください。 | Quick Record等から正しい個体へ1件保存できる。 |
| 3 | 脱皮前の個体を探してください。 | 検索・Saved View・Filter等で対象を特定できる。 |
| 4 | 個体のQRラベルを印刷してください。 | 対象識別票を選び、印刷画面まで進める。 |
| 5 | QRを読み取り、脱皮2件と給餌1件をまとめて登録してください。 | QR解決後、指定3件を正しい対象へ保存できる。 |
| 6 | 誤って削除したSaved Viewを元に戻してください。 | Undoで削除前の状態へ戻せる。 |

## Participant Record

| Task | Complete | Time | Mis-taps | Back actions | Asked for explanation | Help | SEQ 1-7 | Confusion / Quote |
|---|---|---:|---:|---:|---:|---|---:|---|
| 1. Specimen intake | NOT RUN | - | - | - | - | - | - | - |
| 2. Feeding record | NOT RUN | - | - | - | - | - | - | - |
| 3. Find pre-molt | NOT RUN | - | - | - | - | - | - | - |
| 4. Print QR label | NOT RUN | - | - | - | - | - | - | - |
| 5. QR batch record | NOT RUN | - | - | - | - | - | - | - |
| 6. Undo Saved View delete | NOT RUN | - | - | - | - | - | - | - |

SEQ question: 「この操作はどのくらい簡単でしたか？」 `1 = 非常に難しい`, `7 = 非常に簡単`。

## UX Issue Register

| ID | Severity | Participant(s) | Reproduction | File / Change | Retest | Status |
|---|---|---|---|---|---|---|
| UX-001 | - | - | - | - | NOT RUN | 未採番 |

## Summary

| Metric | Result |
|---|---|
| Participants | 0 / 3 |
| Task attempts | 0 / 18 minimum |
| Task completion rate | NOT RUN |
| Median task time | NOT RUN |
| Median SEQ | NOT RUN |
| P0 / P1 / repeated P2 | NOT RUN |

## Decision

参加者0名のため、Usability Testは**NOT RUN**。実ユーザー試験が完了するまでRelease Statusは**CANDIDATE**とする。
