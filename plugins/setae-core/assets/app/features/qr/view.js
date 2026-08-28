import { animalCode, escapeHtml, safeSameOriginHttpUrl } from '../../components/ui.js';
import { emptyBlock } from '../../components/content.js';
import { qrTransferStatusLabel, qrVisibilityLabel, recordTypeLabel } from '../../content/terminology.js';
import { hydrateQrCodes, renderFieldLabel } from './labels.js';
import {
  labelConfigValidation,
  labelDimensions,
  normalizeLabelConfig,
  parseQrCode,
  tapeLengthPresets
} from './state.js';
import {
  actionRow,
  button,
  checkboxControl,
  dateField,
  emptyState,
  fileAction,
  iconButton,
  linkButton,
  segmentedControl,
  selectionRow,
  tabPanel,
  tabs,
  textField,
  textIconButton
} from '../../components/primitives.js';

const eventLabels = Object.fromEntries(['feed', 'molt', 'observation', 'other'].map((type) => [type, recordTypeLabel(type)]));
const visibilityLabels = Object.fromEntries(['private', 'basic', 'life_history'].map((value) => [value, qrVisibilityLabel(value)]));
const qrSections = [
  { id: 'labels', label: 'ラベル' },
  { id: 'scan', label: '読み取り・一括記録' },
  { id: 'transfer', label: '引き継ぎ' }
];
const previewAnnouncementTimers = new WeakMap();

export function renderQrWorkspace({ qr = {}, animals = [] }) {
  const section = qrSections.some((item) => item.id === qr.section) ? qr.section : 'labels';
  return `<div class="qr-workspace">
    ${tabs(qrSections, {
      activeId: section,
      action: 'qr-workspace-section',
      dataKey: 'section',
      label: 'QRワークスペース',
      className: 'qr-workspace-tabs',
      idPrefix: 'qr-workspace',
      panelId: 'qr-workspace-tabpanel'
    })}
    ${tabPanel(section === 'labels' ? renderLabelStudio(qr, animals) : section === 'scan' ? renderScanner(qr) : renderTransfers(qr), {
    id: 'qr-workspace-tabpanel',
    idPrefix: 'qr-workspace',
    activeId: section,
    className: 'qr-workspace-tabpanel'
  })}
  </div>`;
}

function renderLabelStudio(qr, animals) {
  const config = normalizeLabelConfig(qr.labelConfig);
  const dimensions = labelDimensions(config);
  const validationError = labelConfigValidation(config);
  const targets = Array.isArray(qr.targets?.items) ? qr.targets.items : [];
  const preview = targets[0] || null;
  const previewUrl = safeSameOriginHttpUrl(preview?.url);
  const fixedTargetSet = targets.length > 0 && targets.some((item) => item.target_type && item.target_type !== 'spider');
  return `<section class="label-studio">
    <aside class="label-studio-source">
      <div class="workspace-section-heading"><div><span>${fixedTargetSet ? '選択済み' : '個体'}</span><strong>${fixedTargetSet ? '印刷対象' : '印刷する個体'}</strong></div><b>${targets.length}件</b></div>
      ${fixedTargetSet
    ? `<div class="label-target-list is-readonly">${targets.map((item) => `<div><span><strong>${escapeHtml(item.manage_code || item.title || item.code)}</strong><small>${escapeHtml(item.short_name || item.species_name || item.target_type)}</small></span></div>`).join('')}</div>`
    : `<form data-role="qr-label-target-form" class="label-target-form">
        <div class="label-target-list">
          ${animals.map((animal) => selectionRow({
    name: 'animal_ids',
    value: animal.id,
    checked: targets.some((item) => String(item.object_id || item.animal_id || item.spider_id) === String(animal.id)),
    label: animalCode(animal),
    description: animal.species_name || '',
    className: 'label-target-row'
  })).join('') || emptyState('', {
    title: '印刷する対象が選択されていません',
    description: 'コレクションで個体を選択するか、QRを読み取ってください。',
    iconName: 'qr',
    reason: 'initial',
    action: 'open-qr-collection',
    actionLabel: 'コレクションを開く',
    compact: true
  })}
        </div>
        ${button('選択したラベルを準備', { type: 'submit' })}
      </form>`}
    </aside>

    <div class="label-studio-editor">
      <header class="label-studio-header"><div><div class="eyebrow">識別票</div><h2>ラベルスタジオ</h2><p>左側は恒久的なデジタルID、右側は現場で使う手書き欄です。</p></div><div class="label-output-count"><strong>${targets.length}</strong><span>枚</span></div></header>
      <div class="label-config-grid">
        ${settingGroup('出力', [['a4', 'A4自由裁断'], ['tape', '12 mmテープ']], config.output, 'output')}
        ${config.output === 'a4'
    ? settingGroup('サイズ', [['compact', '50 × 20'], ['standard', '65 × 25'], ['large', '80 × 30']], config.a4Size, 'a4Size')
    : tapeLengthSetting(config)}
        ${settingGroup('形式', [['field', '識別票'], ['compact', 'コンパクトID'], ['micro-id', 'マイクロID']], config.format, 'format')}
        ${config.output === 'a4' ? settingGroup('手書き欄', [['large', '大'], ['medium', '中'], ['none', 'なし']], config.handwriting, 'handwriting') : ''}
      </div>
      ${renderLabelOptionGroups(config)}
      <div class="inline-error label-config-error" data-role="qr-label-config-error" role="alert" ${validationError ? '' : 'hidden'}>${escapeHtml(validationError)}</div>

      <section class="label-preview-stage">
        <div class="workspace-section-heading"><div><span>プレビュー</span><strong data-role="qr-label-dimensions">${escapeHtml(dimensions.label)}</strong></div><b data-role="qr-label-layout">${escapeHtml(config.output === 'a4' ? `${dimensions.columns}列` : '任意長')}</b></div>
        <div class="label-preview-canvas" data-role="qr-label-preview">
          ${preview ? renderFieldLabel(preview, config) : '<div class="label-preview-empty">左から印刷する個体を選択してください。</div>'}
        </div>
        <span class="visually-hidden" data-role="qr-label-preview-status" role="status" aria-live="polite" aria-atomic="true"></span>
        ${preview ? renderPermanentLink(preview, previewUrl) : ''}
      </section>
      ${qr.error ? `<div class="inline-error">${escapeHtml(qr.error)}</div>` : ''}
      <div class="label-studio-actions"><span>印刷倍率：100% / ヘッダー・フッター：OFF / 余白：なし</span>${button(`${targets.length}枚を印刷`, {
    action: 'print-field-labels',
    iconName: 'print',
    primary: true,
    disabled: !targets.length || Boolean(validationError)
  })}</div>
      <details class="label-calibration-tools">
        <summary>印刷サイズを確認</summary>
        <p>通常印刷の前に、定規で実寸を確認するための校正ページを出力します。</p>
        <div>${button('A4を校正', { action: 'print-label-calibration', iconName: 'print', data: { type: 'a4' } })}${button('12 mmテープを校正', { action: 'print-label-calibration', iconName: 'print', data: { type: 'tape' } })}</div>
      </details>
    </div>
  </section>`;
}

export function renderLabelOptionGroups(configInput = {}) {
  const config = normalizeLabelConfig(configInput);
  const microId = config.format === 'micro-id';
  const requiredDescription = microId ? '必須' : '';
  return `<div class="label-option-groups" data-role="qr-label-option-groups">
    <fieldset class="label-option-group">
      <legend>印刷内容</legend>
      <p class="label-option-group-description">ラベルへ表示する識別情報を選択します。</p>
      <div class="label-option-grid">
        ${labelToggle('showQr', 'QR', microId || config.showQr, { disabled: microId, description: requiredDescription })}
        ${labelToggle('showSpecimenId', '個体番号', microId || config.showSpecimenId, { disabled: microId, description: requiredDescription })}
        ${microId ? '' : labelToggle('showScientificName', '学名', config.showScientificName)}
        ${microId ? '' : labelToggle('showStageSex', '齢期・性別', config.showStageSex)}
      </div>
      ${microId ? '<p class="label-option-required-note">マイクロIDではQRと個体番号を必ず印刷します。</p>' : ''}
    </fieldset>
    <fieldset class="label-option-group">
      <legend>印刷・手書き補助</legend>
      <p class="label-option-group-description">裁断や手書きに使用する補助線を選択します。</p>
      <div class="label-option-grid">
        ${config.output === 'a4' ? labelToggle('cropMarks', '裁断マーク', config.cropMarks) : ''}
        ${labelToggle('outerBorder', '外枠', config.outerBorder)}
        ${labelToggle('guideLine', 'メモ中央罫線', config.guideLine)}
      </div>
    </fieldset>
  </div>`;
}

export function refreshQrLabelPreview(root, { qr = {}, announce = true } = {}) {
  const editor = root?.querySelector?.('.label-studio-editor');
  if (!editor) return { updated: false };
  const config = normalizeLabelConfig(qr.labelConfig);
  const targets = Array.isArray(qr.targets?.items) ? qr.targets.items : [];
  const preview = targets[0] || null;
  const dimensions = labelDimensions(config);
  const validationError = labelConfigValidation(config);
  const previewCanvas = editor.querySelector('[data-role="qr-label-preview"]');
  const dimensionLabel = editor.querySelector('[data-role="qr-label-dimensions"]');
  const layoutLabel = editor.querySelector('[data-role="qr-label-layout"]');
  const error = editor.querySelector('[data-role="qr-label-config-error"]');
  const printButton = editor.querySelector('[data-action="print-field-labels"]');
  if (previewCanvas) previewCanvas.innerHTML = preview
    ? renderFieldLabel(preview, config)
    : '<div class="label-preview-empty">左から印刷する個体を選択してください。</div>';
  if (previewCanvas) hydrateQrCodes(previewCanvas);
  if (dimensionLabel) dimensionLabel.textContent = dimensions.label;
  if (layoutLabel) layoutLabel.textContent = config.output === 'a4' ? `${dimensions.columns}列` : '任意長';
  if (error) {
    error.textContent = validationError;
    error.hidden = !validationError;
  }
  if (printButton) {
    const disabled = !targets.length || Boolean(validationError);
    printButton.disabled = disabled;
    if (disabled) printButton.setAttribute('aria-disabled', 'true');
    else printButton.removeAttribute('aria-disabled');
  }
  const status = editor.querySelector('[data-role="qr-label-preview-status"]');
  if (announce && status) {
    clearTimeout(previewAnnouncementTimers.get(status));
    status.textContent = '';
    previewAnnouncementTimers.set(status, setTimeout(() => {
      status.textContent = 'ラベルプレビューを更新しました。';
    }, 180));
  }
  return { updated: true, dimensions, validationError };
}

function renderPermanentLink(preview, previewUrl) {
  return `<div class="label-permanent-link"><span><strong>${escapeHtml(preview.manage_code || preview.title || '')}</strong><small>${escapeHtml(previewUrl || 'URLを確認できません')}</small></span><div class="label-permanent-actions">${previewUrl ? `${textIconButton('copy', 'リンクをコピー', { action: 'copy-label-url', data: { url: previewUrl } })}${linkButton('Passport', { href: previewUrl, external: true })}` : ''}${preview.target_type === 'spider' && preview.object_id ? button('公開設定', { action: 'animal-qr-settings', data: { 'animal-id': preview.object_id } }) : ''}</div></div>`;
}

function tapeLengthSetting(config) {
  return `<fieldset><legend>テープ長</legend>${segmentedControl(tapeLengthPresets.map((length) => ({ id: length, label: String(length) })), {
    activeId: config.tapeLengthMm,
    action: 'qr-label-config',
    dataKey: 'config-value',
    data: { 'config-key': 'tapeLengthMm' },
    label: 'テープ長',
    className: 'label-tape-presets'
  })}${textField({
    label: '任意',
    type: 'number',
    value: config.tapeLengthMm,
    min: 18,
    max: 120,
    step: 1,
    role: 'qr-tape-length',
    suffix: 'mm',
    className: 'label-tape-custom'
  })}<small>テープ幅は12mm固定です。テープを長くすると、右側の手書き欄だけが広がります。実際の最小長はプリンタ設定が優先されます。</small></fieldset>`;
}

function settingGroup(title, options, current, key) {
  return `<fieldset><legend>${escapeHtml(title)}</legend>${segmentedControl(options.map(([id, label]) => ({ id, label })), {
    activeId: current,
    action: 'qr-label-config',
    dataKey: 'config-value',
    data: { 'config-key': key },
    label: title
  })}</fieldset>`;
}

function labelToggle(key, label, checked, { disabled = false, description = '' } = {}) {
  return checkboxControl({
    checked,
    label,
    description,
    role: 'qr-label-toggle',
    data: { 'config-key': key },
    disabled,
    compact: true,
    labelMode: 'visible',
    className: 'label-option-toggle'
  });
}

function renderScanner(qr) {
  const mode = ['single', 'batch', 'transfer'].includes(qr.scannerMode) ? qr.scannerMode : 'single';
  const cameraState = ['idle', 'requesting', 'active', 'paused', 'denied', 'unavailable', 'busy', 'error'].includes(qr.cameraState)
    ? qr.cameraState
    : qr.cameraActive ? 'active' : 'idle';
  const cameraActive = cameraState === 'active';
  const cameraRequesting = cameraState === 'requesting';
  const cameraLabel = cameraActive ? 'カメラを停止' : cameraRequesting ? '準備中…' : 'カメラを開始';
  return `<section class="qr-scanner-workspace">
    <header class="qr-scanner-header"><div><div class="eyebrow">恒久URL</div><h2>ラベルを読み取る</h2></div>${segmentedControl([
    { id: 'single', label: '個別' },
    { id: 'batch', label: '一括' },
    { id: 'transfer', label: '引き継ぎ' }
  ], { activeId: mode, action: 'qr-scanner-mode', dataKey: 'mode', label: 'スキャン用途', disabled: qr.saving })}</header>
    <div class="qr-scanner-grid">
      <div class="qr-camera-column">
        <p class="qr-camera-introduction">カメラを使ってSETAEのQRを読み取ります。映像は端末内で処理され、アップロードされません。</p>
        <div class="qr-camera-stage ${cameraActive ? 'is-active' : ''}" data-camera-state="${escapeHtml(cameraState)}" role="group" aria-label="QRカメラ：${escapeHtml(cameraStateLabel(cameraState))}"><video data-role="qr-video" aria-label="QR読み取り用カメラ映像" playsinline muted></video><canvas data-role="qr-canvas" hidden></canvas><div class="qr-scan-frame" aria-hidden="true"></div><div class="qr-camera-placeholder" aria-hidden="true"><strong>SETAE QR</strong><span>${cameraRequesting ? 'カメラを準備しています…' : '恒久URLを枠内へ'}</span></div></div>
        <div class="qr-camera-actions">${button(cameraLabel, { action: 'toggle-qr-camera', primary: true, loading: cameraRequesting, disabled: cameraRequesting })}${fileAction({ label: '画像から読み取る', role: 'qr-image-input', accept: 'image/jpeg,image/png,image/webp', className: 'qr-image-button', iconName: 'photo', disabled: qr.saving })}</div>
        <form class="qr-manual-form" data-role="qr-resolve-form">${textField({ label: '手入力', name: 'code', value: qr.prefillCode || '', placeholder: 'コードまたはURL', autocomplete: 'off', required: true })}${button('確認', { type: 'submit' })}</form>
        <div class="qr-scan-status ${qr.scanStatusTone ? `is-${escapeHtml(qr.scanStatusTone)}` : ''}" data-role="qr-scan-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(qr.scanStatus || cameraStateMessage(cameraState))}</div>
      </div>
      <div class="qr-scan-result-column">
        ${mode === 'batch' ? renderBatchWorkspace(qr) : renderSingleResult(qr, mode)}
      </div>
    </div>
  </section>`;
}

function cameraStateLabel(state) {
  return ({
    idle: '停止中',
    requesting: '準備中',
    active: '読み取り中',
    paused: '一時停止中',
    denied: 'アクセス拒否',
    unavailable: '利用不可',
    busy: '使用中',
    error: 'エラー'
  })[state] || '停止中';
}

function cameraStateMessage(state) {
  if (state === 'requesting') return 'カメラを準備しています…';
  if (state === 'active') return 'QRを枠の中央に入れてください。続けて読み取れます。';
  if (state === 'paused') return 'カメラを一時停止しています。';
  return 'カメラ・画像・手入力のどれでも利用できます。';
}

function renderSingleResult(qr, mode) {
  const target = qr.resolved;
  const transferMode = mode === 'transfer';
  if (!target) return `<div class="qr-result-empty"><span>${transferMode ? 'TRANSFER' : 'SINGLE'}</span><strong>${transferMode ? '引き継ぐ個体のPassportを確認' : '1匹を読み取り、すぐ記録'}</strong><p>読み取った結果と利用できる操作がここに表示されます。</p></div>`;
  const isOwner = Boolean(target.object_id || target.managed_by_viewer);
  const id = target.object_id || '';
  const title = target.manage_code || target.title || target.code || 'Living specimen';
  const species = target.species_name || target.scientific_name || '';
  const url = safeSameOriginHttpUrl(target.url || target.permanent_url);
  const targetType = target.target_type || (target.object_id ? 'spider' : 'passport');
  return `<article class="qr-owner-result">
    <div class="eyebrow">${isOwner ? 'YOU MANAGE THIS SPECIMEN' : visibilityLabels[target.visibility] || 'PUBLIC PASSPORT'}</div>
    <h3>${escapeHtml(title)}</h3><p><i>${escapeHtml(species)}</i></p>
    ${target.last_molt || target.last_feed ? `<dl><div><dt>最終脱皮</dt><dd>${escapeHtml(target.last_molt || '—')}</dd></div><div><dt>最終給餌</dt><dd>${escapeHtml(target.last_feed || '—')}</dd></div></dl>` : ''}
    ${renderOwnerActions({ isOwner, targetType, id, url, target })}
    ${isOwner && ['spider', 'baby'].includes(targetType) && qr.historyEditorOpen ? renderHistoryEditor(qr, target) : ''}
  </article>`;
}

function renderOwnerActions({ isOwner, targetType, id, url, target }) {
  if (isOwner && targetType === 'spider' && id) {
    return `<div class="qr-owner-actions">${button('給餌', { action: 'smart-quick-record', data: { 'record-type': 'feed', 'animal-id': id } })}${button('観察', { action: 'smart-quick-record', data: { 'record-type': 'observation', 'animal-id': id } })}${button('脱皮', { action: 'smart-quick-record', data: { 'record-type': 'molt', 'animal-id': id } })}${button('一括記録に追加', { action: 'add-resolved-to-batch' })}${button('履歴をまとめて入力', { action: 'open-qr-history', primary: true })}</div>${actionRow({ label: '個体詳細を開く', action: 'open-collection-detail', data: { 'animal-id': id }, className: 'collection-open-detail' })}`;
  }
  if (isOwner && targetType === 'baby') {
    return `<div class="qr-owner-actions">${button('一括記録に追加', { action: 'add-resolved-to-batch' })}${button('ベビー群を開く', { action: 'open-baby-group', data: { 'group-id': id } })}${button('履歴をまとめて入力', { action: 'open-qr-history', primary: true })}</div>`;
  }
  if (isOwner && targetType === 'enclosure') {
    return `<div class="qr-owner-actions">${button('容器を開く', { action: 'open-enclosure', data: { 'enclosure-id': id }, primary: true })}</div>`;
  }
  return `<div class="qr-owner-actions">${url ? linkButton('Passportを開く', { href: url, primary: true, external: true }) : '<span class="inline-error">Passport URLを確認できません。</span>'}${target.transfer_available ? '<span class="status-chip">引き継ぎ受付中</span>' : ''}</div>`;
}

function renderHistoryEditor(qr, target) {
  const rows = qr.historyRows || [];
  const typeCounts = {};
  return `<form class="qr-history-editor" data-role="qr-history-record-form" data-draft-policy="guard">
    <header><div><span>履歴入力</span><strong>${escapeHtml(target.manage_code || target.title || target.code || '')}の履歴</strong></div>${iconButton('close', { action: 'close-qr-history', label: '履歴入力を閉じる', disabled: qr.saving })}</header>
    <div class="qr-history-add" aria-label="履歴を追加">${button('脱皮', { action: 'add-qr-history-row', iconName: 'plus', data: { 'event-type': 'molt' }, disabled: qr.saving })}${button('給餌', { action: 'add-qr-history-row', iconName: 'plus', data: { 'event-type': 'feed' }, disabled: qr.saving })}${button('観察', { action: 'add-qr-history-row', iconName: 'plus', data: { 'event-type': 'observation' }, disabled: qr.saving })}</div>
    <div class="qr-history-rows">${rows.map((row) => {
    typeCounts[row.type] = (typeCounts[row.type] || 0) + 1;
    const repeated = rows.filter((item) => item.type === row.type).length > 1;
    const label = `${eventLabels[row.type] || row.type}${repeated ? ` ${typeCounts[row.type]}` : ''}`;
    return `<div class="qr-history-row" data-history-row-id="${escapeHtml(row.id)}"><div class="qr-history-row-heading"><strong>${escapeHtml(label)}</strong>${iconButton('close', { action: 'remove-qr-history-row', label: `${label}を削除`, data: { 'row-id': row.id }, disabled: qr.saving })}</div><div class="qr-history-fields">${dateField({ label: '日付', value: row.date || '', data: { 'history-field': 'date' }, required: true, disabled: qr.saving })}${row.type === 'feed' ? textField({ label: '餌', value: row.prey_type || '', data: { 'history-field': 'prey_type' }, placeholder: '例: D. hydei', disabled: qr.saving }) : ''}${textField({ label: 'メモ', value: row.note || '', data: { 'history-field': 'note' }, maxLength: 2000, placeholder: '任意', className: 'qr-history-note', disabled: qr.saving })}</div></div>`;
  }).join('') || '<div class="empty-state compact">上のボタンから脱皮・給餌・観察を追加してください。</div>'}</div>
    ${qr.error ? `<div class="inline-error" role="alert">${escapeHtml(qr.error)}</div>` : ''}
    <footer><span>${rows.length} / 20件</span>${button(qr.saving ? '保存中…' : `${rows.length}件を保存`, { type: 'submit', primary: true, loading: qr.saving, disabled: !rows.length || qr.saving })}</footer>
  </form>`;
}

function renderBatchWorkspace(qr) {
  const queue = qr.scanQueue || [];
  const edit = qr.batchStep === 'edit' || qr.batchMode === 'capture';
  return `<div class="qr-batch-workspace">
    <header><div><span>一括記録</span><strong>${queue.length}件</strong></div>${segmentedControl([
    { id: 'queue', label: '一覧' },
    { id: 'capture', label: '入力' }
  ], { activeId: qr.batchMode, action: 'qr-batch-mode', dataKey: 'mode', label: '一括記録の表示', disabled: qr.saving })}</header>
    <div class="qr-batch-queue">
      ${queue.length ? queue.map((item) => `<div><span><strong>${escapeHtml(item.manage_code || item.title || item.code)}</strong><small>${escapeHtml(item.short_name || item.species_name || '')}</small></span>${iconButton('close', { action: 'remove-qr-batch-target', label: '一括記録から外す', data: { code: parseQrCode(item.code) }, disabled: qr.saving })}</div>`).join('') : '<div class="empty-state compact">QRを続けて読み取ると、ここに入力待ちの個体が並びます。</div>'}
    </div>
    ${queue.length && !edit ? button(`${queue.length}匹の記録を入力`, { action: 'edit-qr-batch', primary: true, className: 'qr-batch-continue', disabled: qr.saving }) : ''}
    ${queue.length && edit ? renderBatchEditor(qr) : ''}
  </div>`;
}

function renderBatchEditor(qr) {
  return `<form data-role="qr-batch-record-form" data-draft-policy="guard" class="qr-batch-editor">
    <fieldset><legend>記録</legend>${segmentedControl(Object.entries(eventLabels).map(([id, label]) => ({ id, label })), { activeId: qr.batchEventType, action: 'qr-batch-event', dataKey: 'event-type', label: '記録種別', disabled: qr.saving })}</fieldset>
    <div class="qr-same-date">${dateField({ label: '全て同じ日付', value: qr.sameDate || '', role: 'qr-same-date', disabled: qr.saving })}${button('全行へ適用', { action: 'apply-qr-same-date', disabled: qr.saving })}</div>
    <div class="qr-batch-rows">${(qr.scanQueue || []).map((item) => {
    const code = parseQrCode(item.code);
    const row = qr.batchRows?.[code] || {};
    return `<div class="qr-batch-row" data-qr-code="${escapeHtml(code)}"><span><strong>${escapeHtml(item.manage_code || item.title || code)}</strong><small>${escapeHtml(item.short_name || item.species_name || '')}</small></span>${dateField({ label: '日付', value: row.date || qr.sameDate || '', data: { 'batch-field': 'date' }, required: true, disabled: qr.saving })}${qr.batchEventType === 'feed' ? textField({ label: '餌', value: row.prey_type || '', data: { 'batch-field': 'prey_type' }, placeholder: '例: D. hydei', disabled: qr.saving }) : ''}${textField({ label: 'メモ', value: row.note || '', data: { 'batch-field': 'note' }, placeholder: '任意', className: 'qr-batch-note', disabled: qr.saving })}</div>`;
  }).join('')}</div>
    ${qr.error ? `<div class="inline-error">${escapeHtml(qr.error)}</div>` : ''}
    ${button(qr.saving ? '保存中…' : `${qr.scanQueue.length}件を保存`, { type: 'submit', primary: true, loading: qr.saving, disabled: qr.saving, className: 'qr-batch-save' })}
  </form>`;
}

function renderTransfers(qr) {
  const incoming = Array.isArray(qr.transfers?.incoming) ? qr.transfers.incoming : Array.isArray(qr.transfers?.items) ? qr.transfers.items : [];
  const outgoing = Array.isArray(qr.transfers?.outgoing) ? qr.transfers.outgoing : [];
  return `<section class="qr-transfer-workspace"><header><div class="eyebrow">管理の引き継ぎ</div><h2>引き継ぎ</h2><p>恒久QRと生活史を維持したまま、管理者だけを変更します。</p></header><div class="qr-transfer-columns">${transferColumn('届いた申請', incoming, true)}${transferColumn('申請中・完了', outgoing, false)}</div></section>`;
}

function transferColumn(title, items, incoming) {
  return `<section><div class="workspace-section-heading"><div><span>${incoming ? '受け取り' : '送信'}</span><strong>${title}</strong></div><b>${items.length}件</b></div>${items.length ? `<div class="qr-transfer-list">${items.map((item) => `<article><div><strong>${escapeHtml(item.spider_name || item.label || `申請 #${item.id}`)}</strong><span>${escapeHtml(item.code || qrTransferStatusLabel(item.status))}</span></div>${incoming && item.can_respond !== false ? `<div>${button('承認', { action: 'qr-transfer', primary: true, data: { 'transfer-id': item.id, 'transfer-action': 'approve' } })}${button('見送る', { action: 'qr-transfer', data: { 'transfer-id': item.id, 'transfer-action': 'reject' } })}</div>` : `<span class="status-chip">${escapeHtml(qrTransferStatusLabel(item.status))}</span>`}</article>`).join('')}</div>` : emptyBlock('該当する引き継ぎはありません。')}</section>`;
}
