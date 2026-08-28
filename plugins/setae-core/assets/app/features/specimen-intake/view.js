import {
  button,
  checkboxControl,
  comboboxField,
  comboboxOptions,
  dateField,
  fileField,
  hiddenField,
  iconButton,
  modal,
  selectField,
  textField,
  textareaField
} from '../../components/primitives.js';
import { animalCode, escapeHtml } from '../../components/ui.js';
import { icon } from '../../components/icons.js';
import { specimenHasPhoto, specimenSectionHasValues } from './model.js';
import { hasSpecimenPublicSettings, publicSettingEnabled, renderSpecimenPublicSettings, specimenPublicSettings } from '../specimen/public-settings.js';
import { qrVisibilityLabel } from '../../content/terminology.js';

const classificationOptions = [
  { value: 'tarantula', label: 'タランチュラ' },
  { value: 'true_spider', label: 'クモ' },
  { value: 'scorpion', label: 'サソリ' },
  { value: 'centipede', label: 'ムカデ' },
  { value: 'insect', label: '昆虫' },
  { value: 'plant', label: '植物' },
  { value: 'other', label: 'その他' }
];

const genderOptions = [
  { value: 'unknown', label: '不明' },
  { value: 'female', label: 'メス' },
  { value: 'male', label: 'オス' }
];

const statusOptions = [
  { value: 'normal', label: '通常' },
  { value: 'fasting', label: '拒食' },
  { value: 'pre_molt', label: '脱皮前' },
  { value: 'post_molt', label: '脱皮後' }
];

function selectedSpecies(modal, animal) {
  if (modal.selectedSpecies?.id) return modal.selectedSpecies;
  const id = Number(modal.speciesId || animal.species_id || 0);
  if (!id) return null;
  return {
    id,
    ja_name: modal.speciesNameJa || animal.species_name_ja || animal.common_name_ja || '',
    scientific_name: modal.speciesScientificName || animal.species_name || '',
    genus: ''
  };
}

export function renderSpecimenSpeciesRegion(modal = {}, animal = modal.data || {}, classification = modal.classification || animal.classification || 'tarantula') {
  const selected = selectedSpecies(modal, animal);
  const manual = classification !== 'tarantula' || modal.speciesMode === 'manual';
  if (manual) {
    return `<div class="specimen-species-manual">
      ${hiddenField('species_id', '')}
      ${textField({
        label: '種名',
        name: 'custom_species',
        value: animal.custom_species || (!animal.species_id ? animal.species_name || '' : ''),
        placeholder: '学名または管理上の種名',
        required: true,
        maxLength: 160,
        hint: classification === 'tarantula' ? '図鑑へ未登録の種として保存します。' : '図鑑を使わず自由入力で保存します。'
      })}
      ${classification === 'tarantula' ? button('図鑑から選ぶ', { action: 'specimen-species-catalog', className: 'text-button' }) : ''}
    </div>`;
  }
  if (selected) {
    return `<div class="field specimen-species-selected"><span>種</span>
      ${hiddenField('species_id', selected.id)}
      ${hiddenField('custom_species', '')}
      <div class="specimen-species-record">
        <div><strong>${escapeHtml(selected.ja_name || selected.scientific_name || `図鑑の種 #${selected.id}`)}</strong><em>${escapeHtml(selected.scientific_name || '')}</em></div>
        ${button('変更', { action: 'change-specimen-species', className: 'text-button' })}
      </div>
    </div>`;
  }
  return `<div class="specimen-species-search">
    ${hiddenField('species_id', '')}${hiddenField('custom_species', '')}
    ${comboboxField({
      label: '種',
      name: 'species_query',
      placeholder: '和名・学名で検索',
      inputId: 'specimen-species-query',
      listId: 'specimen-species-listbox',
      role: 'species-combobox-input',
      required: true,
      hint: '候補から選択してください。見つからない場合は種名を直接入力できます。'
    })}
    ${button('種名を直接入力', { action: 'specimen-species-manual', className: 'text-button' })}
  </div>`;
}

function enclosureOptions(enclosures, selectedId) {
  const items = Array.isArray(enclosures) ? enclosures : enclosures?.items || [];
  return [
    { value: '', label: '容器に入れない' },
    ...items.map((item) => ({
      value: item.id,
      label: `${item.code || `#${item.id}`}${item.name ? ` / ${item.name}` : ''}`
    }))
  ].map((option) => ({ ...option, selected: String(option.value) === String(selectedId || '') }));
}

function identitySection(modal, animal, classification) {
  return `<section class="specimen-intake-section" aria-labelledby="intake-identity-title">
    <header><span aria-hidden="true">01</span><div><h3 id="intake-identity-title">個体識別</h3><p>個体名と種を入力します。分類は必要に応じて変更してください。</p></div></header>
    <div class="specimen-intake-grid is-two-column">
      ${selectField({ label: '分類', name: 'classification', value: classification, options: classificationOptions, required: true, role: 'specimen-classification' })}
      ${textField({ label: '個体名・管理番号', name: 'name', value: animal.title || animal.name || '', placeholder: '例: C001', required: true, maxLength: 160, autocomplete: 'off' })}
    </div>
    <div data-specimen-intake-region="species">${renderSpecimenSpeciesRegion(modal, animal, classification)}</div>
  </section>`;
}

function conditionSection(animal, enclosures) {
  return optionalSection('condition', '02', '現在の状態', '性別や飼育容器など、分かる項目だけ入力できます。', animal,
    `<div class="specimen-intake-grid is-four-column">
      ${selectField({ label: '性別', name: 'gender', value: animal.gender || 'unknown', options: genderOptions })}
      ${textField({ label: '齢期', name: 'instar', value: animal.instar ?? '', type: 'number', min: 0, max: 30, inputMode: 'numeric' })}
      ${selectField({ label: '状態', name: 'status', value: animal.status || 'normal', options: statusOptions })}
      ${selectField({ label: '飼育容器', name: 'enclosure_id', value: animal.enclosure_id || '', options: enclosureOptions(enclosures, animal.enclosure_id) })}
    </div>`);
}

function husbandrySection(animal) {
  return optionalSection('husbandry', '03', '導入・飼育情報', '日付や飼育環境は、後から追加・変更できます。', animal,
    `<div class="specimen-intake-grid is-three-column">
      ${dateField({ label: '最終脱皮日', name: 'last_molt', value: animal.last_molt || '' })}
      ${dateField({ label: '最終給餌日', name: 'last_feed', value: animal.last_feed || '' })}
      ${dateField({ label: '入手日', name: 'acquired_date', value: animal.acquired_date || '' })}
    </div>
    <div class="specimen-intake-grid is-two-column">
      ${textField({ label: '温度（℃）', name: 'temperature', value: animal.temperature ?? '', inputMode: 'decimal', placeholder: '例: 26.0' })}
      ${textField({ label: '湿度（%）', name: 'humidity', value: animal.humidity ?? '', inputMode: 'decimal', placeholder: '例: 70' })}
      ${textField({ label: '床材', name: 'substrate', value: animal.substrate || '', maxLength: 120 })}
      ${textField({ label: '産地・由来', name: 'origin', value: animal.origin || '', maxLength: 120 })}
    </div>`);
}

function recordSection(animal, imageFile = null) {
  const hasImage = Boolean(imageFile) || specimenHasPhoto(animal);
  const hint = `${specimenHasPhoto(animal) ? '未選択なら現在の写真を保持します。' : ''}JPEG、PNG、WebPなどの画像を選択できます。`;
  return optionalSection('records', '04', '写真・メモ', '写真や特徴、入手経緯などを残せます。', animal,
    `${fileField({ label: '個体写真', name: 'image', accept: 'image/*', fileName: imageFile?.name || '', hint })}
    <div class="specimen-intake-file-status" data-specimen-intake-region="file-status" role="status" aria-live="polite" ${imageFile ? '' : 'hidden'}>${imageFile ? `${escapeHtml(imageFile.name)}を選択しています。` : ''}</div>
    ${textareaField({ label: 'メモ', name: 'notes', value: animal.notes || '', rows: 4, maxLength: 2000, placeholder: '特徴、入手経緯、飼育上の注意など' })}`, { hasImage });
}

function administrationSection(animal, busy) {
  if (!animal.id) return '';
  const visibility = hasSpecimenPublicSettings(animal) ? `保存済み：${qrVisibilityLabel(specimenPublicSettings(animal).visibility)}` : '公開範囲は未確認';
  return optionalSection('administration', '05', '公開・管理', `${visibility} · QR・リンクの公開範囲、引き継ぎ、繁殖募集を設定します。`, animal,
    `${renderSpecimenPublicSettings(animal, { busy })}
    <fieldset class="form-fieldset form-grid"><legend>繁殖募集</legend>
    <p class="settings-copy">繁殖募集の掲載は、Passportの公開範囲とは別に設定します。</p>
    <div class="specimen-intake-grid is-two-column">
      ${selectField({ label: '繁殖募集', name: 'bl_status', value: animal.bl_status === 'recruiting' ? 'recruiting' : 'none', options: [{ value: 'none', label: '募集しない' }, { value: 'recruiting', label: '募集中' }] })}
      ${textField({ label: '外部連絡先', name: 'breeding_contact_url', value: animal.breeding_contact_url || '', type: 'url', inputMode: 'url', placeholder: 'https://...' })}
      ${textField({ label: 'リンク表示名', name: 'breeding_contact_label', value: animal.breeding_contact_label || '', maxLength: 80, placeholder: '例: Xで連絡する' })}
    </div>
    ${textareaField({ label: '募集条件・備考', name: 'bl_terms', value: animal.bl_terms || '', rows: 3, maxLength: 2000 })}
    </fieldset>
    <fieldset class="form-fieldset"><legend>コレクション管理</legend>
    ${checkboxControl({ name: 'archived', checked: publicSettingEnabled(animal.archived), disabled: busy || publicSettingEnabled(animal.transfer_receipt),
      label: 'この個体をアーカイブする', description: '飼育一覧から外し、記録は保持します。引き継ぎ受付は終了しますが、公開範囲は変わりません。' })}
    </fieldset>`);
}

function optionalSection(key, number, title, hint, values, fields, options) {
  const headingId = `intake-${key}-title`;
  const hintId = `intake-${key}-hint`;
  return `<details class="specimen-intake-section specimen-intake-optional" data-specimen-intake-section="${key}" ${specimenSectionHasValues(key, values, options) ? 'open' : ''}>
    <summary aria-labelledby="${headingId}" aria-describedby="${hintId}"><span aria-hidden="true">${number}</span><span><strong id="${headingId}">${title}</strong><small id="${hintId}">任意 · ${hint}</small></span>${icon('chevronDown')}</summary>
    <div class="specimen-intake-section-fields">${fields}</div>
  </details>`;
}

export function renderSpecimenIntake(modalState = {}, { enclosures = null } = {}) {
  const headingId = 'specimen-intake-title';
  const animal = modalState.data || {};
  const editing = Boolean(animal.id);
  const classification = modalState.classification || animal.classification || 'tarantula';
  const busy = Boolean(modalState.submitting);
  const title = editing ? `${animalCode(animal)}を編集` : '個体を登録';
  const submitLabel = editing ? '変更を保存' : '登録する';
  const pendingLabel = editing ? '保存中…' : '登録中…';
  const body = `<form class="specimen-intake-form" data-role="animal-form" data-stable-form="specimen-intake" data-specimen-intake-root data-draft-policy="persist" data-draft-type="animal" data-draft-entity="${escapeHtml(animal.id || 'new')}" data-animal-id="${escapeHtml(animal.id || '')}" data-pending-label="${pendingLabel}">
    <header class="specimen-intake-header">
      <div><span class="dialog-meta">${editing ? '個体情報の編集' : 'コレクションに追加'}</span><h2 id="${headingId}">${escapeHtml(title)}</h2><p>${editing ? '入力済みの情報を確認し、変更した内容を保存します。' : '個体名と種を登録します。飼育情報や写真は後から追加できます。'}</p></div>
      ${iconButton('close', { action: 'close-modal', label: '閉じる', disabled: busy })}
    </header>
    <div id="specimen-intake-error" class="specimen-intake-error inline-error" role="alert" tabindex="-1" data-overlay-error data-specimen-intake-region="error" ${modalState.error ? '' : 'hidden'}>${escapeHtml(modalState.error || '')}</div>
    <div class="specimen-intake-body" data-form-notice-host>
      ${identitySection(modalState, animal, classification)}
      ${conditionSection(animal, enclosures)}
      ${husbandrySection(animal)}
      ${recordSection(animal, modalState.imageFile)}
      ${administrationSection(animal, busy)}
    </div>
    <footer class="specimen-intake-footer">
      <div>${editing ? button('個体を削除', { action: 'request-delete-animal', className: 'danger-button', data: { 'animal-id': animal.id, 'animal-name': animalCode(animal) }, disabled: busy }) : '<span class="specimen-intake-save-note">登録後も個体情報を編集できます。</span>'}</div>
      <div><span class="specimen-intake-busy-status" data-specimen-intake-region="busy" role="status" aria-live="polite" ${busy ? '' : 'hidden'}>${busy ? pendingLabel : ''}</span>${button('キャンセル', { action: 'close-modal', disabled: busy })}${button(busy ? pendingLabel : submitLabel, { type: 'submit', primary: true, loading: busy, disabled: busy, data: { 'specimen-intake-submit': 'true' } })}</div>
    </footer>
  </form>`;

  return modal(body, {
    className: 'specimen-intake-dialog full-screen-dialog',
    backdropClassName: 'full-screen-dialog-backdrop',
    labelledBy: headingId,
    busy,
    busyLabel: editing ? '個体情報を保存しています…' : '個体を登録しています…',
    backdropAction: 'close-modal'
  });
}

export function renderSpeciesComboboxResults({ items = [], activeIndex = -1, loading = false, error = '' } = {}) {
  if (loading) return '<div class="combobox-loading" role="status">候補を検索しています…</div>';
  if (error) return `<div class="combobox-error" role="alert">${escapeHtml(error)}</div>`;
  return comboboxOptions(items, {
    activeIndex,
    optionIdPrefix: 'specimen-species-option',
    emptyMessage: '一致する種は図鑑にありません。'
  });
}
