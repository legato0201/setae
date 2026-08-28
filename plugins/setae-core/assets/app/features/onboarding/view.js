import { actionRow, button, progress } from '../../components/primitives.js';

const stepRow = ({ complete, label, description, action }) => actionRow({
  label,
  description,
  action,
  iconName: complete ? 'check' : 'chevronRight',
  trailingIcon: complete ? '' : 'chevronRight',
  className: complete ? 'onboarding-step is-complete' : 'onboarding-step'
});

export function renderGettingStarted(progressState = {}) {
  if (!progressState.collectionRegistered) return renderStartChoices({ dismissible: true });
  const completed = Number(progressState.completed || 0);
  const required = Number(progressState.required || 2);
  return `<section class="getting-started" aria-labelledby="getting-started-title">
    <header class="getting-started-header">
      <div><span class="eyebrow">はじめの記録</span><h2 id="getting-started-title">個体と履歴を残しましょう</h2></div>
      <div class="getting-started-progress"><strong>${completed} / ${required}</strong><span>完了</span></div>
      ${button('非表示', { action: 'dismiss-onboarding', className: 'text-button getting-started-dismiss' })}
    </header>
    ${progress(completed, { max: required, label: 'はじめの設定' })}
    <div class="getting-started-steps">
      ${stepRow({
        complete: progressState.collectionRegistered,
        label: '最初の個体またはベビー群を登録',
        description: progressState.collectionRegistered ? '登録済みです' : '個体番号と種を登録します',
        action: progressState.collectionRegistered ? 'open-onboarding-collection' : 'add-animal'
      })}
      ${stepRow({
        complete: progressState.firstRecordAdded,
        label: '最初の記録を追加',
        description: progressState.firstRecordAdded ? '記録済みです' : '給餌・脱皮・観察を記録します',
        action: progressState.firstRecordAdded ? 'open-onboarding-records' : 'open-record-sheet'
      })}
    </div>
    <footer class="getting-started-optional">
      ${button('飼育ルールを確認', { action: 'open-care-profile' })}
      ${button('通知を設定', { action: 'open-onboarding-notifications' })}
    </footer>
  </section>`;
}

export function renderStartChoices({ dismissible = false } = {}) {
  return `<section class="getting-started" aria-labelledby="getting-started-title" data-acquisition-start>
    <header class="getting-started-header"><div><span class="eyebrow">SETAEへようこそ</span><h2 id="getting-started-title">最初の個体から始める</h2><p>飼育スタイルは後からMy SETAEで選べます。</p></div></header>
    <div class="getting-started-steps">
      ${actionRow({ label: 'QRから個体を引き継ぐ', description: 'カメラ・画像・コード入力で履歴を開きます。所有者の承認後に受け取れます。', action: 'start-qr-acquisition', iconName: 'qr', className: 'onboarding-step' })}
      ${actionRow({ label: '自分で個体を登録する', description: '個体番号と種を入力して記録を始めます。', action: 'add-animal', iconName: 'collection', className: 'onboarding-step' })}
    </div>
    ${dismissible ? `<footer class="getting-started-optional">${button('後で始める', { action: 'dismiss-onboarding', className: 'text-button' })}</footer>` : ''}
  </section>`;
}
