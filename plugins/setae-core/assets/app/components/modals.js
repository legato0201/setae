import { escapeHtml, animalCode } from './ui.js';
import {
  alertDialog,
  button,
  checkboxControl,
  choiceControl,
  comboboxField,
  dateField,
  emptyState,
  fileField,
  fullScreenDialog,
  hiddenField,
  iconButton,
  modal as modalDialog,
  selectField,
  textareaField,
  textField
} from './primitives.js';
import { nurseryLivingCount } from '../features/nursery/model.js';
import {
  babyQrSelectionResult,
  babyQrStatusLabels,
  createBabyQrSelection,
  filterBabyQrItems
} from '../features/nursery/code-selection.js';
import { renderSpecimenIntake } from '../features/specimen-intake/view.js';
import { renderFieldLabelDialog } from '../features/specimen/field-label.js';
import { renderAboutDialog } from '../features/settings/about.js';
import { hasSpecimenPublicSettings, publicSettingEnabled, renderSpecimenPublicSettings } from '../features/specimen/public-settings.js';

const today = () => new Date().toLocaleDateString('sv-SE');

export function renderModal(modal, { animals = [], feeders = null, enclosures = null } = {}) {
  if (!modal) return '';
  if (modal.type === 'animal') return renderSpecimenIntake(modal, { enclosures });
  if (modal.type === 'field-label') return renderFieldLabelDialog(modal);
  if (modal.type === 'license-notices' || modal.type === 'content-credits') return renderAboutDialog(modal);
  const content = modalContent(modal, { animals, feeders, enclosures });
  const busy = Boolean(modal.submitting);
  const headingId = `setae-modal-${String(modal.type || 'dialog').replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-title`;
  const dialogContent = `<header class="modal-header"><h2 id="${headingId}">${escapeHtml(content.title)}</h2>${iconButton('close', { action: 'close-modal', label: '閉じる', disabled: busy })}</header>
    <div class="modal-body">${modal.error ? `<div class="inline-error" role="alert" tabindex="-1" data-overlay-error>${escapeHtml(modal.error)}</div>` : ''}${content.body}</div>`;
  const renderer = content.presentation === 'full-screen'
    ? fullScreenDialog
    : modal.type === 'confirm'
      ? alertDialog
      : modalDialog;
  return renderer(dialogContent, {
    className: 'surface',
    labelledBy: headingId,
    busy,
    busyLabel: content.busyLabel || modalBusyLabel(modal),
    backdropAction: 'close-modal'
  });
}

function modalActions({
  secondaryHtml = '<span></span>',
  cancelLabel = 'キャンセル',
  submitLabel = '保存する',
  submitType = 'submit',
  danger = false,
  busy = false,
  submitAction = '',
  cancelAction = 'close-modal',
  submitData = {},
  submitDisabled = false
} = {}) {
  return `<div class="modal-actions">${secondaryHtml}${button(cancelLabel, { action: cancelAction, disabled: busy })}${button(submitLabel, {
    type: submitType,
    action: submitAction,
    primary: !danger,
    className: danger ? 'danger-button' : '',
    loading: busy,
    disabled: busy || submitDisabled,
    data: submitData
  })}</div>`;
}

function modalBusyLabel(modal) {
  return ({
    'baby-group': 'ベビー群を保存しています…',
    'nursery-event': 'ベビー群の記録を保存しています…',
    'baby-bulk': '一括記録を保存しています…',
    'baby-promote': '通常個体へ移動しています…',
    'baby-qr': '識別票を準備しています…',
    'qr-settings': '公開設定を保存しています…',
    enclosure: '飼育容器を保存しています…',
    'enclosure-event': '容器の記録を保存しています…',
    'enclosure-occupancy': '個体を移動しています…',
    'feeder-action': '餌在庫を保存しています…',
    'egg-batch': '卵セットを保存しています…',
    'finish-egg': '卵セットを更新しています…',
    topic: '相談を投稿しています…',
    report: '通報を送信しています…',
    'external-token': 'トークンを発行しています…',
    'live-session': '期限付きURLを発行しています…',
    confirm: '処理しています…'
  })[modal.type] || '保存しています…';
}

function modalContent(modal, context) {
  switch (modal.type) {
    case 'baby-group': return babyGroupForm(modal, context.animals);
    case 'nursery-event': return nurseryEventForm(modal);
    case 'baby-bulk': return babyBulkForm(modal);
    case 'baby-promote': return babyPromoteForm(modal);
    case 'baby-qr': return babyQrForm(modal);
    case 'qr-settings': return qrSettingsForm(modal);
    case 'feeder-action': return feederActionForm(modal, context.feeders);
    case 'egg-batch': return eggBatchForm(modal, context.feeders);
    case 'finish-egg': return finishEggForm(modal);
    case 'enclosure': return enclosureForm(modal);
    case 'enclosure-event': return enclosureEventForm(modal);
    case 'enclosure-occupancy': return enclosureOccupancyForm(modal, context.animals);
    case 'task-action': return taskActionForm(modal);
    case 'topic': return topicForm(modal);
    case 'report': return reportForm(modal);
    case 'external-token': return externalTokenForm(modal);
    case 'live-session': return liveSessionForm(modal);
    case 'confirm': return confirmDialog(modal);
    default: return { title: '操作', body: '<div class="empty-state">表示できる内容がありません。</div>' };
  }
}

function taskActionForm(modal) {
  const task = modal.task || {};
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toLocaleDateString('sv-SE');
  const busy = Boolean(modal.submitting);
  return {
    title: `${task.title || '作業'}の予定を調整`,
    body: `<div class="task-action-summary"><strong>${escapeHtml(task.reason || '')}</strong><span>${escapeHtml(task.subtitle || '')}</span></div>
      <form class="form-grid" data-role="task-action-form" data-draft-policy="guard" data-task-id="${escapeHtml(task.id || '')}">
        ${dateField({ label: '延期先', name: 'retry_at', value: date, min: date, required: true, hint: '指定した日にTodayへ再表示します。', disabled: busy })}
        <div class="modal-actions task-action-buttons">${button('今回は見送る', { action: 'skip-task', className: 'danger-button', data: { 'task-id': task.id || '' }, disabled: busy })}${button('キャンセル', { action: 'close-modal', disabled: busy })}${button(busy ? '保存中…' : 'この日まで延期', { type: 'submit', primary: true, loading: busy, disabled: busy })}</div>
      </form>`
  };
}

function catalogSpeciesField(modal, {
  fieldName,
  label,
  optional = false,
  allowManual = false,
  manualFieldName = 'species_name'
}) {
  const data = modal.data || {};
  const selected = modal.selectedSpecies?.id ? modal.selectedSpecies : null;
  const manual = allowManual && modal.speciesMode === 'manual';
  if (manual) {
    return `<div class="catalog-species-manual">
      ${hiddenField(fieldName, '')}
      ${textField({
        label: '種名',
        name: manualFieldName,
        value: data[manualFieldName] || '',
        placeholder: '学名または管理上の種名',
        required: !optional,
        maxLength: 160,
        hint: '図鑑へ未登録の種として保存します。'
      })}
      ${button('図鑑から選ぶ', { action: 'related-species-catalog', className: 'text-button' })}
    </div>`;
  }
  if (selected) {
    return `<div class="field catalog-species-selected"><span>${escapeHtml(label)}</span>
      ${hiddenField(fieldName, selected.id)}
      ${allowManual ? hiddenField(manualFieldName, '') : ''}
      <div class="catalog-species-record">
        <div><strong>${escapeHtml(selected.ja_name || selected.scientific_name || '名称未設定')}</strong><em>${escapeHtml(selected.scientific_name || '')}</em></div>
        <div class="inline-actions">
          ${optional ? button('解除', { action: 'clear-related-species', className: 'text-button' }) : ''}
          ${button('変更', { action: 'change-related-species', className: 'text-button' })}
        </div>
      </div>
    </div>`;
  }
  return `<div class="catalog-species-search">
    ${hiddenField(fieldName, '')}
    ${allowManual ? hiddenField(manualFieldName, '') : ''}
    ${comboboxField({
      label,
      name: 'species_query',
      placeholder: '和名・学名で検索',
      inputId: `${modal.type}-species-query`,
      listId: `${modal.type}-species-listbox`,
      role: 'species-combobox-input',
      hint: optional ? '入力しない場合は、種を関連付けずに保存します。' : '候補は入力に合わせて最大8件表示します。'
    })}
    ${allowManual ? button('図鑑に見つからない', { action: 'related-species-manual', className: 'text-button' }) : ''}
  </div>`;
}

function babyGroupForm(modal, animals) {
  const group = modal.data || {};
  const editing = Boolean(group.id);
  const busy = Boolean(modal.submitting);
  const parents = (Array.isArray(group.parent_spider_ids) ? group.parent_spider_ids : [group.parent_spider_ids])
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(String);
  return {
    title: editing ? 'ベビー群の設定' : 'ベビー群を作成',
    presentation: 'full-screen',
    body: `
      <form class="form-grid" data-role="baby-group-form" data-draft-policy="persist" data-draft-type="baby-group" data-draft-entity="${escapeHtml(group.id || 'new')}" data-group-id="${escapeHtml(group.id || '')}">
        <div class="form-row">${textField({ label: '管理名', name: 'name', value: group.name || '', required: true, disabled: busy })}${editing ? '' : `${textField({ label: '番号の頭文字', name: 'prefix', value: group.prefix || 'B', maxLength: 8, required: true, disabled: busy })}${textField({ label: '管理数', name: 'count', type: 'number', value: group.count || 1, min: 1, max: 500, required: true, disabled: busy })}`}</div>
        ${editing ? '' : `${dateField({ label: '誕生日', name: 'birth_date', value: group.birth_date || '', disabled: busy })}${catalogSpeciesField(modal, { fieldName: 'species_id', label: '図鑑の種', allowManual: true })}${selectField({
          label: '親個体',
          name: 'parent_spider_ids',
          value: parents,
          options: animals.map((animal) => ({ value: animal.id, label: animalCode(animal) })),
          multiple: true,
          size: 4,
          disabled: busy,
          hint: '複数選択できます。'
        })}${textareaField({ label: '親についてのメモ', name: 'parent_note', value: group.parent_note || '', disabled: busy })}`}
        ${editing ? checkboxControl({ checked: Boolean(group.archived), label: 'アーカイブする', name: 'archived', disabled: busy, className: 'nursery-archive-control' }) : ''}
        <div class="modal-actions">${editing ? button('群を削除', { action: 'request-delete-baby', className: 'danger-button', disabled: busy, data: { 'group-id': group.id, 'group-name': group.name } }) : '<span></span>'}${button('キャンセル', { action: 'close-modal', disabled: busy })}${button('保存する', { type: 'submit', primary: true, loading: busy, disabled: busy })}</div>
      </form>
    `
  };
}

function babyBulkForm(modal) {
  const selected = modal.eventType || 'molt';
  const busy = Boolean(modal.submitting);
  return {
    title: 'ベビー一括記録',
    body: `<form class="form-grid" data-role="baby-bulk-form" data-draft-policy="guard" data-group-id="${escapeHtml(modal.groupId)}">${selectField({
      label: '記録種別',
      name: 'event',
      value: selected,
      options: [
        { value: 'molt', label: '脱皮' },
        { value: 'dead', label: '死亡' },
        { value: 'alive', label: '生存へ戻す' },
        { value: 'rehomed', label: '譲渡済み' }
      ],
      disabled: busy
    })}${dateField({ label: '日付', name: 'date', value: today(), required: true, disabled: busy })}${textareaField({ label: '番号', name: 'codes', required: true, placeholder: '例: A001-A010 または A001,A003', disabled: busy })}${textareaField({ label: 'メモ', name: 'note', disabled: busy })}<div class="modal-actions"><span></span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${button('記録する', { type: 'submit', primary: true, loading: busy, disabled: busy })}</div></form>`
  };
}

function nurseryEventForm(modal) {
  const group = modal.group || {};
  const type = modal.eventType || 'observation';
  const previous = nurseryLivingCount(group);
  const busy = Boolean(modal.submitting);
  const fields = type === 'feed'
    ? `<div class="form-row">${textField({ label: '餌', name: 'prey_type', maxLength: 160, placeholder: '例: Drosophila hydei', disabled: busy })}${textField({ label: '数量', name: 'quantity', type: 'number', min: 0, max: 100000, value: 0, hint: '群給餌で数えない場合は0', disabled: busy })}</div>`
    : type === 'observation'
      ? textField({ label: '状態', name: 'label', maxLength: 120, value: '状態確認', disabled: busy })
      : type === 'count_check'
        ? `<div class="nursery-count-check"><div><span>前回</span><strong data-role="nursery-previous-count">${escapeHtml(previous)}</strong></div>${textField({ label: '今回', name: 'current_count', type: 'number', min: 0, max: 500, value: previous, required: true, role: 'nursery-current-count', disabled: busy })}<div><span>差分</span><strong data-role="nursery-count-difference">0</strong></div></div><p class="nursery-count-warning" data-role="nursery-count-warning" hidden></p>`
        : `<div class="form-row">${textField({ label: '温度 °C', name: 'temperature', type: 'number', min: -50, max: 100, step: 0.1, disabled: busy })}${textField({ label: '湿度 %', name: 'humidity', type: 'number', min: 0, max: 100, step: 0.1, disabled: busy })}</div>`;
  const title = ({ feed: '群給餌', observation: '群の観察', count_check: '個体数確認', environment_check: '環境確認' })[type] || 'ベビー群を記録';
  return {
    title: `${group.name || 'ベビー群'} / ${title}`,
    body: `<form class="form-grid" data-role="nursery-event-form" data-draft-policy="guard" data-group-id="${escapeHtml(group.id)}">${hiddenField('type', type)}${dateField({ label: '日付', name: 'date', value: today(), required: true, disabled: busy })}${fields}${textareaField({ label: 'メモ', name: 'note', maxLength: 2000, disabled: busy })}<div class="modal-actions"><span></span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${button('記録する', { type: 'submit', primary: true, loading: busy, disabled: busy })}</div></form>`
  };
}

function babyPromoteForm(modal) {
  const busy = Boolean(modal.submitting);
  return { title: '通常個体へ移動', body: `<form class="form-grid" data-role="baby-promote-form" data-draft-policy="guard" data-group-id="${escapeHtml(modal.groupId)}"><p class="settings-copy">生存中の番号を通常個体として登録します。プレミアム会員限定です。</p>${textareaField({ label: '番号', name: 'codes', required: true, placeholder: '例: A001,A002', disabled: busy })}<div class="modal-actions"><span></span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${button('移動する', { type: 'submit', primary: true, loading: busy, disabled: busy })}</div></form>` };
}

function babyQrForm(modal) {
  const group = modal.group || {};
  const selection = modal.selection || createBabyQrSelection(group);
  const result = babyQrSelectionResult(group, selection);
  const items = result.items;
  const visibleCodes = new Set(filterBabyQrItems(group, selection.search).map((item) => item.code));
  const alive = items.filter((item) => (item.status || 'alive') === 'alive').length;
  const firstCode = items[0]?.code || '—';
  const lastCode = items.at(-1)?.code || '—';
  const mode = selection.mode || 'alive';
  const selected = new Set((selection.selectedCodes || []).map(String));
  const busy = Boolean(modal.submitting);
  const modeOption = (value, label, countLabel) => choiceControl({
    type: 'radio',
    name: 'selection_mode',
    value,
    checked: mode === value,
    label,
    description: countLabel,
    role: 'baby-qr-mode',
    className: 'baby-qr-mode',
    disabled: busy
  });
  const rangePanel = mode === 'range' ? `<div class="baby-qr-range" data-role="baby-qr-range-panel">${textField({ label: '開始', name: 'range_start', type: 'number', inputMode: 'numeric', min: items[0]?.number || 1, max: items.at(-1)?.number || 1, value: selection.start ?? '', role: 'baby-qr-range', data: { 'range-key': 'start' }, disabled: busy })}<span aria-hidden="true">〜</span>${textField({ label: '終了', name: 'range_end', type: 'number', inputMode: 'numeric', min: items[0]?.number || 1, max: items.at(-1)?.number || 1, value: selection.end ?? '', role: 'baby-qr-range', data: { 'range-key': 'end' }, disabled: busy })}</div>` : '';
  const individualPanel = mode === 'individual' ? `<section class="baby-qr-individual"><div class="baby-qr-individual-tools">${textField({ label: '検索', name: 'baby_qr_search', type: 'search', value: selection.search || '', placeholder: '例: B014 または 14', role: 'baby-qr-search', disabled: busy })}<div>${button('すべて選択', { action: 'baby-qr-select-all', disabled: busy })}${button('選択解除', { action: 'baby-qr-clear', disabled: busy })}</div></div><div class="baby-qr-item-list" data-role="baby-qr-item-list">${items.map((item) => choiceControl({
    type: 'checkbox',
    value: item.code,
    checked: selected.has(item.code),
    label: item.code,
    description: babyQrStatusLabels[item.status] || item.status || '生存',
    role: 'baby-qr-item',
    data: { 'baby-code': item.code, 'baby-number': item.number },
    className: 'baby-qr-item',
    disabled: busy,
    hidden: !visibleCodes.has(item.code)
  })).join('') || emptyState('該当する番号がありません。', { compact: true })}</div></section>` : '';
  return {
    title: 'ベビーQRラベル',
    body: `<form class="form-grid baby-qr-form" data-role="baby-qr-form" data-group-id="${escapeHtml(modal.groupId)}">
      <div class="baby-qr-summary"><span><strong>${escapeHtml(firstCode)} – ${escapeHtml(lastCode)}</strong><small>${escapeHtml(group.name || 'ベビー群')}</small></span><span><strong>全${items.length}匹</strong><small>生存${alive}匹</small></span></div>
      <fieldset class="form-fieldset baby-qr-mode-grid"><legend>印刷対象</legend>${modeOption('alive', '生存中', `${alive}匹`)}${modeOption('all', '全番号', `${items.length}匹`)}${modeOption('range', '範囲', '番号で指定')}${modeOption('individual', '個別選択', '必要な番号だけ')}</fieldset>
      ${rangePanel}${individualPanel}
      <div class="baby-qr-selection-status" data-role="baby-qr-selection-status"><strong>${result.codes.length}枚</strong><span>${result.error ? escapeHtml(result.error) : '印刷する識別票を準備します。'}</span></div>
      <div class="modal-actions"><span></span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${button(`${result.codes.length}枚のラベルを準備`, { type: 'submit', primary: true, loading: busy, disabled: busy || !result.codes.length || Boolean(result.error), data: { role: 'baby-qr-submit' } })}</div>
    </form>`
  };
}

function qrSettingsForm(modal) {
  const target = modal.data || {};
  const busy = Boolean(modal.submitting);
  return {
    title: '個体の公開設定',
    presentation: 'full-screen',
    body: `<form class="form-grid" data-role="qr-settings-form" data-animal-id="${escapeHtml(modal.animalId)}"><p class="settings-copy">個体情報の編集画面の「公開・管理」からも設定できます。変更は保存後に反映されます。</p>${renderSpecimenPublicSettings(target, { name: 'visibility', busy })}${modalActions({ busy, submitDisabled: !hasSpecimenPublicSettings(target) || publicSettingEnabled(target.transfer_receipt) })}</form>`
  };
}

const enclosureTypeOptions = [
  { value: 'unspecified', label: '種類未設定' },
  { value: 'acrylic', label: 'アクリル容器' },
  { value: 'glass', label: 'ガラス容器' },
  { value: 'plastic', label: 'プラケース' },
  { value: 'terrarium', label: 'テラリウム' },
  { value: 'vial', label: 'バイアル' },
  { value: 'rack_tub', label: 'ラックケース' },
  { value: 'custom', label: 'カスタム容器' }
];

const enclosureEventOptions = [
  { value: 'environment_check', label: '環境確認' },
  { value: 'maintenance', label: 'メンテナンス' },
  { value: 'watering', label: '給水' },
  { value: 'misting', label: '霧吹き' },
  { value: 'substrate_change', label: '床材交換' },
  { value: 'note', label: 'メモ' }
];

function enclosureForm(modal) {
  const enclosure = modal.data || {};
  const care = enclosure.care_plan_overrides || {};
  const editing = Boolean(enclosure.id);
  const cm = (value) => value === null || value === undefined || value === '' ? '' : Number(value) / 10;
  const busy = Boolean(modal.submitting);
  return {
    title: editing ? `${enclosure.code}の設定` : '飼育容器を登録',
    presentation: 'full-screen',
    body: `<form class="form-grid" data-role="enclosure-form" data-draft-policy="persist" data-draft-type="enclosure" data-draft-entity="${escapeHtml(enclosure.id || 'new')}" data-enclosure-id="${escapeHtml(enclosure.id || '')}">
      <div class="form-row">${textField({ label: '容器番号', name: 'code', value: enclosure.code || '', placeholder: '自動採番', maxLength: 50 })}${textField({ label: '名称', name: 'name', value: enclosure.name || '', placeholder: '例: 上段左', maxLength: 120 })}${selectField({ label: '種類', name: 'enclosure_type', value: enclosure.enclosure_type || 'unspecified', options: enclosureTypeOptions })}</div>
      <fieldset class="form-fieldset"><legend>寸法</legend><div class="form-row">${textField({ label: '幅', name: 'width_cm', type: 'number', value: cm(enclosure.width_mm), min: 0, max: 10000, step: 0.1, suffix: 'cm' })}${textField({ label: '奥行', name: 'depth_cm', type: 'number', value: cm(enclosure.depth_mm), min: 0, max: 10000, step: 0.1, suffix: 'cm' })}${textField({ label: '高さ', name: 'height_cm', type: 'number', value: cm(enclosure.height_mm), min: 0, max: 10000, step: 0.1, suffix: 'cm' })}</div></fieldset>
      <div class="form-row">${textField({ label: '設置場所', name: 'location', value: enclosure.location || '', placeholder: '例: 飼育棚A / 上段', maxLength: 180 })}${textField({ label: '容器写真のURL', name: 'photo_url', type: 'url', value: enclosure.photo_url || '', placeholder: 'https://' })}</div>
      <fieldset class="form-fieldset enclosure-target-ranges"><legend>目標環境</legend><div class="enclosure-target-range"><strong>温度</strong><div class="form-row">${textField({ label: '下限', name: 'target_temp_min', type: 'number', value: enclosure.target_temp_min ?? '', min: -20, max: 80, step: 0.1, suffix: '°C' })}${textField({ label: '上限', name: 'target_temp_max', type: 'number', value: enclosure.target_temp_max ?? '', min: -20, max: 80, step: 0.1, suffix: '°C' })}</div></div><div class="enclosure-target-range"><strong>湿度</strong><div class="form-row">${textField({ label: '下限', name: 'target_humidity_min', type: 'number', value: enclosure.target_humidity_min ?? '', min: 0, max: 100, step: 0.1, suffix: '%' })}${textField({ label: '上限', name: 'target_humidity_max', type: 'number', value: enclosure.target_humidity_max ?? '', min: 0, max: 100, step: 0.1, suffix: '%' })}</div></div></fieldset>
      <div class="form-row">${textField({ label: '床材', name: 'substrate', value: enclosure.substrate || '', maxLength: 180 })}${textField({ label: '床材の深さ', name: 'substrate_depth_cm', type: 'number', value: cm(enclosure.substrate_depth_mm), min: 0, max: 1000, step: 0.1, suffix: 'cm' })}</div>
      <fieldset class="form-fieldset"><legend>個別の飼育ルール</legend><p class="settings-copy">空欄は容器種別または全体の間隔を使用します。0でこの容器だけ予定を作成しません。</p><div class="care-plan-rule-grid enclosure-form-care-grid">${enclosureCareField('environment', '環境確認', care.environment)}${enclosureCareField('misting', '霧吹き', care.misting)}${enclosureCareField('watering', '給水', care.watering)}${enclosureCareField('maintenance', 'メンテナンス', care.maintenance)}${enclosureCareField('substrate', '床材交換', care.substrate)}</div></fieldset>
      <div class="modal-actions"><span></span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${button('保存する', { type: 'submit', primary: true, loading: busy, disabled: busy })}</div>
    </form>`
  };
}

function enclosureCareField(key, label, value) {
  return textField({ label, name: `care_${key}`, type: 'number', value: value === undefined ? '' : value, min: 0, max: 3650, suffix: '日' });
}

function enclosureEventForm(modal) {
  const selected = modal.eventType || 'environment_check';
  const busy = Boolean(modal.submitting);
  return {
    title: `${modal.enclosureCode || '飼育容器'}を記録`,
    body: `<form class="form-grid" data-role="enclosure-event-form" data-draft-policy="guard" data-enclosure-id="${escapeHtml(modal.enclosureId)}">
      <div class="form-row">${selectField({ label: '記録', name: 'event_type', value: selected, options: enclosureEventOptions })}${dateField({ label: '日付', name: 'event_date', value: today(), required: true })}</div>
      <div class="form-row">${textField({ label: '温度', name: 'temperature', type: 'number', value: '', min: -20, max: 80, step: 0.1, suffix: '°C' })}${textField({ label: '湿度', name: 'humidity', type: 'number', value: '', min: 0, max: 100, step: 0.1, suffix: '%' })}</div>
      <p class="settings-copy">環境確認では温度または湿度を入力してください。</p>
      ${textareaField({ label: 'メモ', name: 'note', maxLength: 2000, placeholder: '変化や作業内容を残せます' })}
      <div class="modal-actions"><span></span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${button('記録する', { type: 'submit', primary: true, loading: busy, disabled: busy })}</div>
    </form>`
  };
}

function enclosureOccupancyForm(modal, animals) {
  const candidates = animals.filter((animal) => Number(animal.enclosure_id) !== Number(modal.enclosureId));
  const busy = Boolean(modal.submitting);
  const options = candidates.map((animal) => {
    const currentEnclosure = animal.enclosure_record?.code || animal.enclosure;
    return {
      value: animal.id,
      label: `${animalCode(animal)}${animal.species_name ? ` / ${animal.species_name}` : ''}${currentEnclosure ? ` / 現在 ${currentEnclosure}` : ''}`
    };
  });
  return {
    title: `${modal.enclosureCode || '飼育容器'}へ個体を入れる`,
    body: `<form class="form-grid" data-role="enclosure-occupancy-form" data-draft-policy="guard" data-enclosure-id="${escapeHtml(modal.enclosureId)}">
      ${candidates.length ? selectField({ label: '個体', name: 'animal_ids', value: [], options, multiple: true, size: 8, required: true, hint: '複数選択できます。別の容器にいる個体は自動的に移動します。' }) : emptyState('移動できる個体がありません。', { compact: true })}
      <div class="form-row">${dateField({ label: '入居日', name: 'started_at', value: today(), required: true })}${textField({ label: 'メモ', name: 'note', value: '', maxLength: 500 })}</div>
      <div class="modal-actions"><span></span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${candidates.length ? button('入居させる', { type: 'submit', primary: true, loading: busy, disabled: busy }) : ''}</div>
    </form>`
  };
}

function feederActionForm(modal, feeders) {
  const types = feeders?.types || [];
  const busy = Boolean(modal.submitting);
  return { title: '餌在庫を記録', body: `<form class="form-grid" data-role="feeder-action-form">${selectField({ label: '餌', name: 'feeder_type', value: modal.feederType || '', options: types.map((type) => ({ value: type.key, label: type.common_name || type.label })), required: true, disabled: busy })}${selectField({ label: '操作', name: 'action', value: 'purchase', options: [{ value: 'purchase', label: '追加購入' }, { value: 'consume', label: '給餌に使用' }, { value: 'breed', label: '自家繁殖' }, { value: 'box_reset', label: 'ボックス清掃' }, { value: 'adjust', label: '在庫数を調整' }], disabled: busy })}<div class="form-row">${textField({ label: '匹数', name: 'quantity', type: 'number', min: 0, max: 100000, value: 1, required: true, disabled: busy })}${dateField({ label: '日付', name: 'date', value: today(), required: true, disabled: busy })}</div>${textareaField({ label: 'メモ', name: 'note', disabled: busy })}${modalActions({ submitLabel: '記録する', busy })}</form>` };
}

function eggBatchForm(modal, feeders) {
  const types = feeders?.types || [];
  const busy = Boolean(modal.submitting);
  return { title: '卵セットを追加', body: `<form class="form-grid" data-role="egg-batch-form">${selectField({ label: '餌', name: 'feeder_type', value: modal.feederType || types[0]?.key || '', options: types.map((type) => ({ value: type.key, label: type.common_name || type.label })), required: true, disabled: busy })}<div class="form-row">${dateField({ label: 'セット日', name: 'set_date', value: today(), required: true, disabled: busy })}${textField({ label: '温度', name: 'temperature', type: 'number', min: 18, max: 35, step: 0.5, value: 28, required: true, disabled: busy })}</div>${textareaField({ label: 'メモ', name: 'note', disabled: busy })}${modalActions({ submitLabel: '追加する', busy })}</form>` };
}

function finishEggForm(modal) {
  const hatched = modal.status === 'hatched';
  const busy = Boolean(modal.submitting);
  return { title: hatched ? '孵化を記録' : '卵セットを終了', body: `<form class="form-grid" data-role="finish-egg-form" data-batch-id="${escapeHtml(modal.batchId)}">${hiddenField('status', modal.status)}${hatched ? `<div class="form-row">${dateField({ label: '孵化日', name: 'actual_hatch_date', value: today(), required: true, disabled: busy })}${textField({ label: '孵化数', name: 'hatched_count', type: 'number', min: 0, max: 100000, value: 0, required: true, disabled: busy })}</div>` : ''}${textareaField({ label: 'メモ', name: 'note', disabled: busy })}${modalActions({ busy })}</form>` };
}

function topicForm(modal) {
  const data = modal.data || {};
  const selectedType = data.type || 'question';
  const busy = Boolean(modal.submitting);
  return { title: '相談を投稿', presentation: 'full-screen', body: `<form class="form-grid" data-role="topic-form" data-draft-policy="persist" data-draft-type="topic" data-draft-entity="new">${textField({ label: 'タイトル', name: 'title', maxLength: 120, value: data.title || '', required: true, disabled: busy })}${selectField({ label: '種類', name: 'type', value: selectedType, options: [{ value: 'question', label: '質問' }, { value: 'breeding', label: '飼育' }, { value: 'identification', label: '同定' }, { value: 'other', label: 'その他' }], disabled: busy })}${catalogSpeciesField(modal, { fieldName: 'related_species_id', label: '関連する種', optional: true })}${textareaField({ label: '本文', name: 'content', value: data.content || '', maxLength: 5000, disabled: busy })}<div class="topic-image-fields">${fileField({ label: '画像', name: 'image', accept: 'image/*', fileName: modal.imageFile?.name || '', buttonLabel: '写真を選ぶ', disabled: busy })}${textField({ label: '画像の説明', name: 'image_alt', value: data.image_alt || '', placeholder: '画像の説明', disabled: busy })}</div>${checkboxControl({ name: 'has_cw', label: '内容に注意表示を付ける', checked: Boolean(data.has_cw), className: 'checkbox-row', disabled: busy })}${modalActions({ submitLabel: '投稿する', busy })}</form>` };
}

function reportForm(modal) {
  const busy = Boolean(modal.submitting);
  return { title: '通報', body: `<form class="form-grid" data-role="report-form" data-draft-policy="none" data-target-type="${escapeHtml(modal.targetType)}" data-target-id="${escapeHtml(modal.targetId)}">${textareaField({ label: '理由', name: 'reason', maxLength: 500, required: true, disabled: busy })}${modalActions({ submitLabel: '通報する', danger: true, busy })}</form>` };
}

function externalTokenForm(modal) {
  const busy = Boolean(modal.submitting);
  return { title: '外部APIトークンを発行', body: `<form class="form-grid" data-role="external-token-form" data-draft-policy="none">${selectField({ label: '権限', name: 'mode', value: 'read', options: [{ value: 'read', label: '読み取りのみ' }, { value: 'read_write', label: '読み書き' }], disabled: busy })}<p class="settings-copy">発行結果は安全な場所で管理してください。</p>${modalActions({ submitLabel: '発行する', busy })}</form>` };
}

function liveSessionForm(modal) {
  const busy = Boolean(modal.submitting);
  return { title: '期限付きURLを発行', body: `<form class="form-grid" data-role="live-session-form" data-draft-policy="none">${selectField({ label: '権限', name: 'mode', value: 'read', options: [{ value: 'read', label: '読み取りのみ' }, { value: 'read_write', label: '読み書き' }], disabled: busy })}${selectField({ label: '有効期間', name: 'duration', value: '86400', options: [{ value: '3600', label: '1時間' }, { value: '86400', label: '24時間' }, { value: '604800', label: '7日間' }], disabled: busy })}${modalActions({ submitLabel: '発行する', busy })}</form>` };
}

function confirmDialog(modal) {
  const busy = Boolean(modal.submitting);
  const phrase = String(modal.confirmPhrase || '');
  const value = String(modal.confirmValue || '');
  const phraseField = phrase ? textField({
    label: modal.confirmHint || `削除するには「${phrase}」と入力してください。`,
    name: 'confirm_phrase',
    value,
    role: 'confirm-phrase',
    autocomplete: 'off',
    disabled: busy
  }) : '';
  return { title: modal.title || '確認', body: `<div class="confirm-copy"><p>${escapeHtml(modal.message || 'この操作を実行しますか？')}</p></div>${phraseField}${modalActions({ submitLabel: modal.confirmLabel || '実行する', submitType: 'button', submitAction: 'confirm-modal', danger: modal.danger !== false, busy, submitDisabled: Boolean(phrase && value.trim() !== phrase.trim()) })}` };
}
