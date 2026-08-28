import { animalCode, escapeHtml, scientificName } from '../../components/ui.js';
import {
  button,
  checkboxControl,
  dateField,
  fileField,
  hiddenField,
  iconButton,
  quantityStepper,
  selectField,
  sheet,
  textField,
  textareaField
} from '../../components/primitives.js';
import { recentPreyTypes } from './recent-records.js';
import { typeLabel } from './quick-record-view.js';
import { resolveRecordType } from './actions.js';

export function renderRecordForm({ quickRecord, animals = [], selectedAnimalId = '', recent = [], today = new Date().toLocaleDateString('sv-SE') }) {
  const headingId = 'quick-record-form-title';
  const selectedAnimal = quickRecord.animalId || selectedAnimalId || '';
  const batchIds = quickRecord.animalIds || [];
  const batchAnimals = batchIds.map((id) => animals.find((animal) => String(animal.id) === String(id))).filter(Boolean);
  const targetAnimal = animals.find((animal) => String(animal.id) === String(selectedAnimal)) || null;
  const type = resolveRecordType(quickRecord.type);
  const busy = Boolean(quickRecord.submitting);
  if (!type) return renderInvalidRecordForm(busy);
  const animalField = batchAnimals.length || targetAnimal
    ? ''
    : renderAnimalField(animals, selectedAnimal, busy);
  const recordFields = `${animalField}${dateField({ label: '日付', name: 'date', value: today, id: 'record-date', required: true, disabled: busy })}${renderTypeFields(type, targetAnimal, recent, busy)}${textareaField({ label: 'メモ（任意）', name: 'note', rows: 4, maxLength: 2000, disabled: busy })}`;
  const sharingSection = batchAnimals.length ? renderBatchRestriction() : renderMediaFields(type, busy);
  const content = `<div class="sheet-handle"></div>
    <header class="quick-record-header"><div><div class="eyebrow">${targetAnimal ? escapeHtml(animalCode(targetAnimal)) : batchAnimals.length ? `${batchAnimals.length}匹を選択` : 'QUICK RECORD'}</div><h2 id="${headingId}">${typeLabel(type)}</h2></div>${iconButton('close', { action: 'close-quick-record', label: '閉じる', disabled: busy })}</header>
    <form data-role="record-form" data-draft-policy="guard" data-draft-type="record" data-pending-label="保存中…" class="quick-record-form type-${escapeHtml(type)}">
      ${targetAnimal ? renderTargetIdentity(targetAnimal) : ''}
      <div class="quick-record-form-body">
        ${batchAnimals.length ? renderBatchContext(batchAnimals) : ''}
        ${quickRecord.error ? `<div class="inline-error" role="alert" tabindex="-1" data-overlay-error>${escapeHtml(quickRecord.error)}</div>` : ''}
        <section class="quick-record-form-section"><h3>記録</h3><div class="quick-record-field-grid">${recordFields}</div></section>
        ${sharingSection}
      </div>
      <footer class="quick-record-footer">${button(batchAnimals.length ? 'キャンセル' : '戻る', { action: batchAnimals.length ? 'cancel-bulk-record' : 'back-record-types', disabled: busy })}${button(busy ? '保存中…' : batchAnimals.length ? `${batchAnimals.length}匹に記録` : '記録する', { type: 'submit', primary: true, disabled: busy, loading: busy })}</footer>
    </form>`;

  return sheet(content, {
    className: 'quick-record-shell record-form-shell',
    backdropClassName: 'quick-record-backdrop',
    labelledBy: headingId,
    busy,
    busyLabel: '記録を保存しています…',
    backdropAction: 'close-sheet',
    panelData: true
  });
}

function renderInvalidRecordForm(busy) {
  const headingId = 'quick-record-form-title';
  const content = `<div class="sheet-handle"></div>
    <header class="quick-record-header"><div><div class="eyebrow">QUICK RECORD</div><h2 id="${headingId}">記録の種類を確認できませんでした</h2></div>${iconButton('close', { action: 'close-quick-record', label: '閉じる', disabled: busy })}</header>
    <div class="quick-record-form-body"><div class="inline-error" role="alert">画面を更新して、もう一度お試しください。</div></div>`;
  return sheet(content, {
    className: 'quick-record-shell record-form-shell',
    backdropClassName: 'quick-record-backdrop',
    labelledBy: headingId,
    busy,
    backdropAction: 'close-sheet',
    panelData: true
  });
}

function renderAnimalField(animals, selectedAnimal, disabled) {
  return selectField({
    label: '個体',
    name: 'animal_id',
    value: selectedAnimal,
    options: [
      { value: '', label: '選択してください' },
      ...animals.map((animal) => ({ value: animal.id, label: `${animalCode(animal)} / ${animal.species_name || ''}` }))
    ],
    id: 'record-animal',
    required: true,
    disabled
  });
}

function renderTargetIdentity(animal) {
  return `<div class="quick-record-target-identity"><strong>${escapeHtml(animalCode(animal))}</strong><span>${escapeHtml(scientificName(animal))}</span>${hiddenField('animal_id', animal.id)}</div>`;
}

function renderBatchContext(animals) {
  return `<div class="batch-record-context"><strong>${animals.length}匹に同じ記録を追加</strong><span>${escapeHtml(animals.slice(0, 5).map(animalCode).join('、'))}${animals.length > 5 ? ` ほか${animals.length - 5}匹` : ''}</span></div>`;
}

function renderTypeFields(type, animal, recent, disabled) {
  if (type === 'feed') {
    const preyTypes = recentPreyTypes(recent);
    const suggestions = preyTypes.map((prey) => button(prey, {
      action: 'use-recent-prey',
      className: 'recent-prey-button compact-button',
      data: { prey },
      disabled
    })).join('');
    return `<div class="quick-record-prey-field">${textField({ label: '餌', name: 'prey_type', placeholder: '例: レッドローチ M', id: 'record-prey', maxLength: 120, disabled })}${suggestions ? `<div class="recent-prey-list" aria-label="最近使用した餌"><span>最近使用</span><div>${suggestions}</div></div>` : ''}</div>${quantityStepper({ name: 'quantity', value: 1, min: 1, max: 100, disabled })}${checkboxControl({ label: '食べなかった', name: 'refused', value: 'on', disabled })}`;
  }
  if (type === 'observation') {
    return selectField({
      label: '状態',
      name: 'label',
      value: '異常なし',
      options: ['異常なし', '要注意', '行動の変化', '環境調整', 'その他'],
      id: 'record-observation',
      disabled
    });
  }
  if (type === 'molt') {
    const nextInstar = animal?.instar ? Math.min(30, Number(animal.instar) + 1) : '';
    return textField({ label: '新しい齢期', name: 'instar', type: 'number', value: nextInstar, id: 'record-instar', min: 1, max: 30, inputMode: 'numeric', disabled });
  }
  if (type === 'growth') {
    return textField({ label: 'サイズ', name: 'size', placeholder: '例: 8.5 cm', id: 'record-size', inputMode: 'decimal', disabled });
  }
  if (type === 'pairing') {
    return `${textField({ label: '相手個体', name: 'partner_name', id: 'record-partner', maxLength: 120, disabled })}${selectField({
      label: '結果',
      name: 'result',
      value: 'attempted',
      options: [
        { value: 'attempted', label: '試行' },
        { value: 'successful', label: '交接を確認' },
        { value: 'failed', label: '不成立' }
      ],
      id: 'record-pairing-result',
      disabled
    })}`;
  }
  return '';
}

function renderMediaFields(type, disabled) {
  const label = type === 'molt' ? '脱皮殻の写真' : '写真';
  return `<section class="quick-record-form-section quick-record-sharing-section"><h3>写真・共有</h3><div class="quick-record-field-grid">${fileField({ label, name: 'image', accept: 'image/*', buttonLabel: '写真を選ぶ', disabled })}${checkboxControl({ label: 'お世話フィードで共有する', name: 'share_to_feed', value: 'on', disabled })}${checkboxControl({ label: 'Best Shotへ応募する', name: 'is_best_shot', value: 'on', disabled })}</div></section>`;
}

function renderBatchRestriction() {
  return '<section class="quick-record-form-section quick-record-sharing-section"><h3>写真・共有</h3><p class="batch-record-note">写真とフィード共有は個体ごとの記録で設定できます。</p></section>';
}
