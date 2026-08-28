import { button, iconButton, modal } from '../../components/primitives.js';
import { escapeHtml } from '../../components/ui.js';

export function renderCollectionStatusDialog({ count = 0, error = '', submitting = false } = {}) {
  const headingId = 'collection-status-dialog-title';
  const statuses = [
    ['normal', '通常'],
    ['pre_molt', '脱皮前'],
    ['post_molt', '脱皮後'],
    ['fasting', '拒食']
  ];
  const content = `<header class="modal-header">
      <div><span class="dialog-meta">${count}匹を選択</span><h2 id="${headingId}">状態を変更</h2></div>
      ${iconButton('close', { action: 'cancel-collection-status', label: '閉じる', disabled: submitting })}
    </header>
    <div class="modal-body collection-status-dialog-body">
      <p>選択した個体へ同じ状態を設定します。</p>
      ${error ? `<div class="inline-error" role="alert" tabindex="-1" data-overlay-error>${escapeHtml(error)}</div>` : ''}
      <div class="collection-status-options-v4">${statuses.map(([value, label]) => button(label, {
        action: 'apply-collection-status',
        data: { status: value },
        disabled: submitting
      })).join('')}</div>
    </div>
    <footer class="collection-dialog-footer">${button('キャンセル', { action: 'cancel-collection-status', disabled: submitting })}</footer>`;

  return modal(content, {
    className: 'collection-status-dialog-v4',
    labelledBy: headingId,
    busy: submitting,
    busyLabel: '個体の状態を更新しています…',
    backdropAction: 'close-sheet',
    panelData: true
  });
}
