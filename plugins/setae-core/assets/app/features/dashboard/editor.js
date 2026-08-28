import { escapeHtml } from '../../components/ui.js';
import { findDashboardWidget, JOURNAL_WIDGET_TYPES } from './config.js';
import { getWidgetDefinition, listWidgetDefinitions } from '../../widgets/registry.js';
import {
  actionRow,
  button,
  checkboxControl,
  iconButton,
  selectField,
  sheet,
  textField
} from '../../components/primitives.js';

const sizeLabels = { small: '小', medium: '中', large: '大' };
const statusOptions = [
  { value: '', label: 'すべて' },
  { value: 'normal', label: '通常' },
  { value: 'fasting', label: '拒食' },
  { value: 'pre_molt', label: '脱皮前' },
  { value: 'post_molt', label: '脱皮後' }
];
const classificationOptions = [
  { value: '', label: 'すべて' },
  { value: 'tarantula', label: 'タランチュラ' },
  { value: 'true_spider', label: 'クモ' },
  { value: 'scorpion', label: 'サソリ' }
];
const sortOptions = [
  { value: 'code', label: '個体番号' },
  { value: 'days_since_feed', label: '最終給餌' },
  { value: 'days_since_molt', label: '最終脱皮' },
  { value: 'instar', label: '齢期' }
];
const directionOptions = [
  { value: 'asc', label: '昇順' },
  { value: 'desc', label: '降順' }
];
const quickActionOptions = [
  { value: '', label: 'なし' },
  { value: 'feed', label: '給餌' },
  { value: 'observation', label: '観察' },
  { value: 'molt', label: '脱皮' }
];

export function renderDashboardEditor(editor, dashboard) {
  if (!editor) return '';
  if (editor.kind === 'library') return renderLibrary(editor.sectionId);
  if (editor.kind === 'section') {
    const section = dashboard.sections.find((item) => item.id === editor.sectionId);
    return section ? renderSectionForm(section) : '';
  }
  if (editor.kind === 'widget') {
    const found = findDashboardWidget(dashboard, editor.widgetId);
    return found ? renderWidgetForm(found.widget) : '';
  }
  return '';
}

function shell(title, content, label) {
  const headingId = 'dashboard-editor-title';
  return sheet(`<div class="sheet-handle"></div><div class="sheet-title-row"><h2 id="${headingId}">${escapeHtml(title)}</h2>${iconButton('close', { action: 'close-dashboard-editor', label: '閉じる' })}</div>${content}`, {
    className: 'dashboard-editor-sheet',
    backdropClassName: 'dashboard-editor-backdrop',
    labelledBy: headingId,
    backdropAction: 'close-dashboard-editor',
    panelData: true,
    presentation: 'full-screen-mobile'
  });
}

function formActions() {
  return `<div class="form-actions">${button('キャンセル', { action: 'close-dashboard-editor' })}${button('保存', { type: 'submit', primary: true })}</div>`;
}

function renderLibrary(sectionId) {
  const content = `<div class="widget-library">${listWidgetDefinitions()
    .filter((definition) => JOURNAL_WIDGET_TYPES.includes(definition.type))
    .map((definition) => actionRow({
      label: definition.title,
      description: definition.description,
      action: 'add-dashboard-widget',
      data: { 'section-id': sectionId, 'widget-type': definition.type },
      trailingIcon: 'plus',
      className: 'widget-library-item'
    }))
    .join('')}</div>`;
  return shell('表示項目を追加', content);
}

function renderSectionForm(section) {
  const fields = textField({
    label: '区分名',
    name: 'title',
    value: section.title,
    maxLength: 40,
    required: true,
    id: 'dashboard-section-title'
  });
  return shell('区分設定', `<form class="form-grid" data-role="dashboard-section-form" data-section-id="${escapeHtml(section.id)}">${fields}${formActions()}</form>`);
}

function renderWidgetForm(widget) {
  const definition = getWidgetDefinition(widget.type);
  const config = widget.config || {};
  const filters = config.query?.filters || [];
  const filter = (field, operator = null) => filters.find((item) => item.field === field && (!operator || item.operator === operator));
  const feedDays = filter('days_since_feed', '>=')?.value ?? config.days ?? '';
  const status = filter('status', '=')?.value || '';
  const excludePreMolt = filter('status', '!=')?.value === 'pre_molt';
  const favorite = filter('is_favorite', '=')?.value === true;
  const species = filter('species_name', 'contains')?.value || '';
  const classification = filter('classification', '=')?.value || '';
  const sortField = config.query?.sort?.field || 'code';
  const sortDirection = config.query?.sort?.direction || 'asc';

  const smartFields = widget.type === 'smart_animals' ? `
    <div class="form-section-title">抽出条件</div>
    ${selectField({ label: '状態', name: 'status', value: status, options: statusOptions })}
    ${checkboxControl({ label: '脱皮前を除外', name: 'exclude_pre_molt', value: 'on', checked: excludePreMolt })}
    ${textField({ label: '最終給餌からの日数', name: 'feed_days', type: 'number', value: feedDays, placeholder: '指定なし', min: 0, max: 365, hint: '日以上' })}
    ${textField({ label: '学名に含む文字', name: 'species', value: species, placeholder: '例: seladonia', maxLength: 80 })}
    ${selectField({ label: '分類', name: 'classification', value: classification, options: classificationOptions })}
    ${checkboxControl({ label: 'お気に入りのみ', name: 'favorite', value: 'on', checked: favorite })}
    <div class="form-section-title">並び順と操作</div>
    ${selectField({ label: '並び順', name: 'sort_field', value: sortField, options: sortOptions })}
    ${selectField({ label: '方向', name: 'sort_direction', value: sortDirection, options: directionOptions })}` : '';

  const feedFields = widget.type === 'feed_due'
    ? '<div class="field-note">給餌対象は、設定内の「飼育ルール」にある全体・種・個体設定から自動判定します。</div>'
    : '';
  const quickField = ['smart_animals', 'feed_due'].includes(widget.type)
    ? selectField({ label: 'クイック操作', name: 'quick_action', value: config.quickAction || '', options: quickActionOptions })
    : '';
  const sizeOptions = (definition?.sizes || ['small', 'medium', 'large']).map((size) => ({ value: size, label: sizeLabels[size] }));
  const fields = `
    ${textField({ label: '表示名', name: 'title', value: widget.title, maxLength: 40, required: true })}
    ${selectField({ label: '大きさ', name: 'size', value: widget.size, options: sizeOptions })}
    ${smartFields}
    ${feedFields}
    ${quickField}
    ${textField({ label: '表示件数', name: 'limit', type: 'number', value: config.query?.limit || config.limit || 8, min: 1, max: 30 })}`;

  return shell(`${definition?.title || '表示項目'}の設定`, `<form class="form-grid dashboard-widget-form" data-role="dashboard-widget-form" data-draft-policy="persist" data-draft-type="dashboard-widget" data-draft-entity="${escapeHtml(widget.id)}" data-widget-id="${escapeHtml(widget.id)}" data-widget-type="${escapeHtml(widget.type)}">${fields}${formActions()}</form>`);
}
