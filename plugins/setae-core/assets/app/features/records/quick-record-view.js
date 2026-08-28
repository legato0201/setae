import { animalCode, escapeHtml, scientificName } from '../../components/ui.js';
import { recordIcon } from '../../components/icons.js';
import { actionRow, iconButton, sheet } from '../../components/primitives.js';
import { buildQuickRecordModel } from './quick-record-model.js';
import { recordTypeLabel } from '../../content/terminology.js';

const primaryRecordActions = [
  { type: 'feed', label: recordTypeLabel('feed'), description: '餌・数量・拒食を記録' },
  { type: 'molt', label: recordTypeLabel('molt'), description: '脱皮日と新しい齢期を記録' },
  { type: 'observation', label: recordTypeLabel('observation'), description: '状態や行動の変化を記録' }
];

const secondaryRecordActions = [
  { type: 'growth', label: recordTypeLabel('growth'), description: 'サイズ・成長を記録' },
  { type: 'pairing', label: recordTypeLabel('pairing'), description: 'ペアリング結果を記録' }
];

const relatedActions = [
  { action: 'add-animal', label: '個体登録', iconName: 'plus' },
  { action: 'open-qr-page', label: 'QRで記録', iconName: 'qr' },
  { action: 'open-babies', label: 'ベビー一括記録', iconName: 'collection' },
  { action: 'open-husbandry', label: '飼育管理', iconName: 'husbandry' }
];

export function renderQuickRecordLauncher({ animals = [], recent = [], animalId = null, careTasks = [] } = {}) {
  const headingId = 'quick-record-launcher-title';
  const model = buildQuickRecordModel({ animals, recent, careTasks });
  const contextAnimal = animals.find((animal) => String(animal.id) === String(animalId)) || null;
  const content = `<div class="sheet-handle"></div>
    <header class="quick-record-header"><div><div class="eyebrow">QUICK RECORD</div><h2 id="${headingId}">記録する</h2></div>${iconButton('close', { action: 'close-quick-record', label: '閉じる' })}</header>
    <div class="quick-record-scroll">
      ${contextAnimal ? renderContext(contextAnimal) : renderRecommendations(model.recommendations)}
      ${renderTypes(contextAnimal?.id || '')}
      ${contextAnimal ? '' : renderRecent(model.recent)}
      ${contextAnimal ? '' : renderRelatedActions()}
    </div>`;

  return sheet(content, {
    className: 'quick-record-shell',
    backdropClassName: 'quick-record-backdrop',
    labelledBy: headingId,
    backdropAction: 'close-sheet',
    panelData: true
  });
}

function renderContext(animal) {
  return `<section class="quick-record-section quick-record-context"><h3>対象の個体</h3><div class="quick-record-identity"><strong>${escapeHtml(animalCode(animal))}</strong><span>${escapeHtml(scientificName(animal))}</span></div></section>`;
}

function renderRecommendations(items) {
  const rows = items.slice(0, 3).map(({ animal, type, reason }) => actionRow({
    label: animalCode(animal),
    description: scientificName(animal),
    meta: reason,
    iconName: type,
    action: 'quick-recommendation',
    data: { 'animal-id': animal.id, 'record-type': type },
    trailingLabel: typeLabel(type),
    trailingIcon: '',
    className: 'quick-recommendation-row'
  })).join('');
  return `<section class="quick-record-section quick-record-priority"><h3>優先</h3>${rows ? `<div class="quick-recommendation-list">${rows}</div>` : '<p class="quick-record-empty">現在、おすすめの記録はありません。</p>'}</section>`;
}

function renderRecent(items) {
  const rows = items.map(({ animal, entry }) => actionRow({
    label: animalCode(animal),
    description: scientificName(animal),
    action: 'quick-recent',
    data: { 'animal-id': animal.id, 'record-type': entry.type },
    trailingLabel: typeLabel(entry.type),
    trailingIcon: '',
    className: 'quick-recent-row'
  })).join('');
  return `<section class="quick-record-section"><h3>最近</h3>${rows ? `<div class="quick-recent-list">${rows}</div>` : '<p class="quick-record-empty">記録すると、よく使う個体がここに表示されます。</p>'}</section>`;
}

function renderTypes(animalId) {
  const renderRecordAction = ({ type, label, description }, hierarchy) => actionRow({
    label,
    description,
    iconName: type,
    action: 'record-type',
    data: { 'record-type': type, ...(animalId ? { 'animal-id': animalId } : {}) },
    className: `quick-record-action is-${hierarchy}`
  });
  return `<section class="quick-record-section quick-record-action-section"><h3>${animalId ? '何を記録しますか？' : '記録の種類'}</h3><div class="quick-record-action-list is-primary">${primaryRecordActions.map((item) => renderRecordAction(item, 'primary')).join('')}</div><h4>その他の記録</h4><div class="quick-record-action-list is-secondary">${secondaryRecordActions.map((item) => renderRecordAction(item, 'secondary')).join('')}</div></section>`;
}

function renderRelatedActions() {
  return `<section class="quick-record-section"><h3>関連操作</h3><div class="quick-record-related-list">${relatedActions.map((item) => actionRow({ ...item, className: 'quick-related-action' })).join('')}</div></section>`;
}

export function typeLabel(type) {
  return recordTypeLabel(type);
}

export function typeIcon(type) {
  return recordIcon(type);
}
