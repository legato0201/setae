import { countLabel, recordTypeLabel } from './terminology.js';

export const successMessage = Object.freeze({
  animalCreated: '個体を登録しました。',
  animalUpdated: '個体情報を更新しました。',
  nurseryCreated: 'ベビー群を作成しました。',
  nurseryUpdated: 'ベビー群を更新しました。',
  enclosureCreated: '飼育容器を登録しました。',
  enclosureUpdated: '飼育容器を更新しました。',
  recordCreated: '飼育記録を追加しました。',
  setupCompleted: 'SETAEの基本設定が完了しました。'
});

export const mutationSucceeded = (target, verb = '保存') => `${String(target || '内容')}を${verb}しました。`;
export const mutationFailed = (target, next = '入力内容を確認して、もう一度お試しください。') => `${String(target || '内容')}を保存できませんでした。${next}`;
export const recordsCreated = (count) => `${countLabel(count)}の飼育記録を追加しました。`;
export const recordSaved = (type, count = 1) => Number(count) > 1
  ? `${recordTypeLabel(type)}を${countLabel(count)}記録しました。`
  : `${recordTypeLabel(type)}を記録しました。`;

export const offlineSavedMessage = (count = 1) => `${count > 1 ? `${countLabel(count)}の操作を` : '操作を'}オフラインで保存しました。再接続後に同期します。`;
export const syncProgressMessage = (count) => `${countLabel(count)}を同期しています…`;
export const syncPartialMessage = (succeeded, failed) => `${countLabel(succeeded)}を同期しました。${countLabel(failed)}は再送が必要です。`;
export const syncCompleteMessage = (count) => `${countLabel(count)}を同期しました。`;

export const noSearchResultsMessage = (target = '項目') => `検索条件に一致する${target}はありません。`;
export const connectionFailedMessage = 'SETAEに接続できませんでした。通信環境をご確認のうえ、もう一度お試しください。';
export const permissionDeniedMessage = 'この内容を表示する権限がありません。ログイン状態をご確認ください。';
export const discardConfirmation = Object.freeze({
  title: '入力内容を破棄しますか？',
  description: '保存していない変更があります。このまま閉じると入力内容は失われます。',
  continueLabel: '編集を続ける',
  discardLabel: '変更を破棄'
});
