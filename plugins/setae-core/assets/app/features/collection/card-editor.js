import {
  animalCardDensities,
  animalCardFieldKeys,
  animalCardModes,
  normalizeAnimalCardConfig
} from './card-config.js';
import { renderAnimalCard } from './card-view.js';
import {
  button,
  checkboxControl,
  iconButton,
  segmentedControl,
  selectControl,
  sheet
} from '../../components/primitives.js';
import { cardDensityLabel, cardModeLabel } from '../../content/terminology.js';

const fieldLabels = {
  scientificName: '学名',
  gender: '性別',
  instar: '齢期',
  status: '状態',
  lastFeed: '最終給餌',
  lastMolt: '最終脱皮',
  lastObservation: '最終観察',
  origin: '由来',
  temperature: '温度',
  humidity: '湿度',
  enclosure: '飼育容器',
  acquiredDate: '入手日'
};

export function renderAnimalCardEditor(config, previewAnimal) {
  const headingId = 'animal-card-editor-title';
  const cardConfig = normalizeAnimalCardConfig(config);
  const animal = previewAnimal || {
    id: 'preview',
    title: 'C001',
    species_name: 'Typhochlaena seladonia',
    gender: 'female',
    instar: 8,
    status: 'pre_molt',
    last_feed: '2026-08-03',
    last_molt: '2026-07-20',
    last_observation: '2026-08-10',
    origin: 'CB',
    temperature: 26,
    humidity: 75,
    enclosure: 'アクリルケース',
    acquired_date: '2025-12-25'
  };

  const content = `
      <div class="sheet-handle"></div>
      <div class="sheet-title-row"><div><span class="dialog-meta">写真表示</span><h2 id="${headingId}">カード設定</h2></div>${iconButton('close', { action: 'close-card-editor', label: '閉じる' })}</div>
      <div class="animal-card-editor-scroll">
        <section class="card-editor-section">
          <h3>表示形式</h3>
          ${segmentedControl(animalCardModes.map((mode) => ({ id: mode, label: cardModeLabel(mode) })), { activeId: cardConfig.mode, action: 'card-config-mode', dataKey: 'card-mode', label: 'カード表示形式', className: 'card-editor-segmented' })}
        </section>
        <section class="card-editor-section">
          <h3>情報量</h3>
          ${segmentedControl(animalCardDensities.map((density) => ({ id: density, label: cardDensityLabel(density) })), { activeId: cardConfig.density, action: 'card-config-density', dataKey: 'card-density', label: 'カード情報量', className: 'card-editor-segmented' })}
        </section>
        <section class="card-editor-section card-editor-preview">
          <h3>プレビュー</h3>
          <div class="card-preview-frame collection-gallery-v4 card-grid-${cardConfig.mode} density-${cardConfig.density}">${renderAnimalCard(animal, { config: cardConfig, preview: true })}</div>
        </section>
        <section class="card-editor-section">
          <h3>表示する項目</h3>
          <div class="card-field-grid">
            ${animalCardFieldKeys.map((field) => checkboxControl({ checked: cardConfig.fields[field], label: fieldLabels[field], role: 'card-config-field', className: 'card-field-option', data: { 'card-field': field } })).join('')}
          </div>
        </section>
        <section class="card-editor-section">
          <h3>クイック操作</h3>
          <div class="card-action-slots">
            ${[0, 1, 2].map((index) => `<div class="card-action-slot"><span>${index + 1}</span>${selectControl({ value: cardConfig.quickActions[index] || '', label: `クイック操作 ${index + 1}`, role: 'card-config-action', data: { 'card-action-index': index }, options: [{ value: '', label: 'なし' }, { value: 'feed', label: '給餌' }, { value: 'observation', label: '観察' }, { value: 'molt', label: '脱皮' }, { value: 'growth', label: '成長' }] })}</div>`).join('')}
          </div>
        </section>
      </div>
      <div class="card-editor-footer">${button('初期設定に戻す', { action: 'reset-card-config' })}${button('完了', { action: 'close-card-editor', primary: true })}</div>`;

  return sheet(content, {
    className: 'animal-card-editor-sheet',
    backdropClassName: 'animal-card-editor-backdrop',
    labelledBy: headingId,
    backdropAction: 'close-card-editor',
    panelData: true,
    presentation: 'full-screen-mobile'
  });
}
