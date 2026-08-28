import {
  animalCode,
  escapeHtml,
  familyName,
  formatRelativeDays,
  genderLabel,
  scientificName,
  statusChip
} from '../../components/ui.js';
import { renderAnimalMedia } from '../../components/media.js';
import { button, checkboxControl } from '../../components/primitives.js';
import { normalizeAnimalCardConfig } from './card-config.js';

const fieldValue = (value, suffix = '') => value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date);
};

const actionMeta = {
  feed: { label: '給餌', iconName: 'feed' },
  observation: { label: '観察', iconName: 'observation' },
  molt: { label: '脱皮', iconName: 'molt' },
  growth: { label: '計測', iconName: 'growth' }
};

export function renderAnimalCard(animal, {
  config,
  selected = false,
  focused = false,
  selectionMode = false,
  collection = false,
  preview = false
} = {}) {
  const cardConfig = normalizeAnimalCardConfig(config);
  const fields = cardConfig.fields;
  const photoMode = cardConfig.mode === 'photo';
  const id = escapeHtml(animal?.id);
  const code = escapeHtml(animalCode(animal));
  const family = familyName(animal);
  const attributes = preview
    ? 'aria-label="カードプレビュー"'
    : `data-animal-id="${id}" ${collection ? 'data-collection-animal' : ''} tabindex="0" aria-selected="${selected ? 'true' : 'false'}" ${focused ? 'data-focused="true"' : ''}`;

  const traits = [
    fields.gender ? genderLabel(animal?.gender) : '',
    !photoMode && fields.instar ? `齢期 ${fieldValue(animal?.instar)}` : ''
  ].filter(Boolean);

  const careMetrics = photoMode ? [] : [
    fields.lastFeed ? ['給餌', formatRelativeDays(animal?.last_feed ?? animal?.last_feed_date)] : null,
    fields.lastMolt ? ['脱皮', formatRelativeDays(animal?.last_molt ?? animal?.last_molt_date)] : null,
    fields.lastObservation ? ['観察', formatRelativeDays(animal?.last_observation ?? animal?.last_observation_date)] : null
  ].filter(Boolean);

  const detailMetrics = photoMode ? [] : [
    fields.origin ? ['由来', fieldValue(animal?.origin)] : null,
    fields.temperature ? ['温度', fieldValue(animal?.temperature, '℃')] : null,
    fields.humidity ? ['湿度', fieldValue(animal?.humidity, '%')] : null,
    fields.enclosure ? ['容器', fieldValue(animal?.enclosure_record?.code || animal?.enclosure)] : null,
    fields.acquiredDate ? ['入手日', formatDate(animal?.acquired_date)] : null
  ].filter(Boolean);

  return `
    <article class="animal-card animal-card-v2 card-mode-${cardConfig.mode} card-density-${cardConfig.density} surface ${selected ? 'is-selected' : ''} ${focused ? 'is-focused' : ''} ${preview ? 'is-preview' : ''}" ${attributes}>
      ${collection ? `<div class="collection-card-check ${selectionMode ? 'is-visible' : ''}">${checkboxControl({ checked: selected, action: 'toggle-collection-selection', label: `${animalCode(animal)}を選択`, compact: true, labelMode: 'sr-only', data: { 'animal-id': animal?.id } })}</div>` : ''}
      <div class="animal-card-media">
        ${renderAnimalMedia(animal, { ratio: 'auto', compact: true })}
      </div>
      <div class="animal-card-content">
        <div class="animal-card-info-section animal-card-identity">
          <div class="animal-card-title-row"><strong class="animal-code">${code}</strong>${fields.status ? statusChip(animal?.status) : ''}</div>
          ${fields.scientificName ? `<div class="scientific-name">${escapeHtml(scientificName(animal))}</div>` : ''}
          ${!photoMode && fields.scientificName && family ? `<div class="taxon-family">${escapeHtml(family)}</div>` : ''}
          ${traits.length ? `<div class="animal-card-traits">${traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join('')}</div>` : ''}
        </div>
        ${careMetrics.length ? `<dl class="animal-card-info-section animal-card-care">${careMetrics.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
        ${detailMetrics.length ? `<dl class="animal-card-info-section animal-card-details">${detailMetrics.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
        ${!photoMode && cardConfig.quickActions.length && !selectionMode ? `<div class="animal-card-info-section animal-card-actions">${cardConfig.quickActions.map((action) => {
          const meta = actionMeta[action];
          if (!meta) return '';
          return button(meta.label, {
            action: preview ? '' : 'smart-quick-record',
            iconName: meta.iconName,
            disabled: preview,
            data: preview ? {} : { 'record-type': action, 'animal-id': animal?.id }
          });
        }).join('')}</div>` : ''}
      </div>
    </article>`;
}
