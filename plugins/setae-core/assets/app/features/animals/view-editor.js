import { escapeHtml } from '../../components/ui.js';
import { button, checkboxControl, iconButton, selectField, sheet, textField } from '../../components/primitives.js';

const querySetting = (query, field, operator = null) =>
  (query?.filters || []).find((item) => item.field === field && (!operator || item.operator === operator));

export function renderSavedViewEditor(editor) {
  if (!editor) return '';
  const view = editor.view || {};
  const query = view.query || {};
  const status = querySetting(query, 'status', '=')?.value || '';
  const excludePreMolt = querySetting(query, 'status', '!=')?.value === 'pre_molt';
  const feedDays = querySetting(query, 'days_since_feed', '>=')?.value ?? '';
  const favorite = querySetting(query, 'is_favorite', '=')?.value === true;
  const species = querySetting(query, 'species_name', 'contains')?.value || '';
  const classification = querySetting(query, 'classification', '=')?.value || '';
  const sortField = query.sort?.field || 'code';
  const sortDirection = query.sort?.direction || 'asc';

  const headingId = 'saved-view-editor-title';
  const content = `<div class="sheet-handle"></div><div class="sheet-title-row"><h2 id="${headingId}">${view.id ? '絞り込みを編集' : '絞り込みを作成'}</h2>${iconButton('close', { action: 'close-saved-view-editor', label: '閉じる' })}</div><form class="form-grid" data-role="saved-view-form" data-draft-policy="persist" data-draft-type="saved-view" data-draft-entity="${escapeHtml(view.id || 'new')}" data-view-id="${escapeHtml(view.id || '')}">
    ${textField({ label: '表示名', name: 'title', maxLength: 40, value: view.title || '', placeholder: '例: セラドニア', required: true })}
    <div class="form-section-title">抽出条件</div>
    ${selectField({ label: '状態', name: 'status', value: status, options: [{ value: '', label: 'すべて' }, { value: 'normal', label: '通常' }, { value: 'fasting', label: '拒食' }, { value: 'pre_molt', label: '脱皮前' }, { value: 'post_molt', label: '脱皮後' }] })}
    ${checkboxControl({ name: 'exclude_pre_molt', label: '脱皮前を除外', checked: excludePreMolt, className: 'checkbox-row' })}
    ${textField({ label: '最終給餌からの日数', name: 'feed_days', type: 'number', min: 0, max: 365, value: feedDays, placeholder: '指定なし', suffix: '日以上' })}
    ${textField({ label: '学名に含む文字', name: 'species', maxLength: 80, value: species, placeholder: '例: seladonia' })}
    ${selectField({ label: '分類', name: 'classification', value: classification, options: [{ value: '', label: 'すべて' }, { value: 'tarantula', label: 'タランチュラ' }, { value: 'true_spider', label: 'クモ' }, { value: 'scorpion', label: 'サソリ' }] })}
    ${checkboxControl({ name: 'favorite', label: 'お気に入りのみ', checked: favorite, className: 'checkbox-row' })}
    <div class="form-section-title">並び順</div>
    ${selectField({ label: '基準', name: 'sort_field', value: sortField, options: [{ value: 'code', label: '個体番号' }, { value: 'days_since_feed', label: '最終給餌' }, { value: 'days_since_molt', label: '最終脱皮' }, { value: 'instar', label: '齢期' }] })}
    ${selectField({ label: '方向', name: 'sort_direction', value: sortDirection, options: [{ value: 'asc', label: '昇順' }, { value: 'desc', label: '降順' }] })}
    <div class="form-actions">${button('キャンセル', { action: 'close-saved-view-editor' })}${button('保存', { type: 'submit', primary: true })}</div>
  </form>`;
  return sheet(content, {
    className: 'saved-view-sheet',
    backdropClassName: 'saved-view-backdrop',
    labelledBy: headingId,
    backdropAction: 'close-saved-view-editor',
    panelData: true,
    presentation: 'full-screen-mobile'
  });
}
