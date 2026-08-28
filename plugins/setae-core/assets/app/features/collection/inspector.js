import {
  animalCode,
  escapeHtml,
  formatRelativeDays,
  genderLabel,
  normalizeStatus,
  scientificName,
  statusLabel
} from '../../components/ui.js';
import { renderAnimalMedia } from '../../components/media.js';
import {
  button,
  dataRow,
  iconButton,
  statusIndicator
} from '../../components/primitives.js';
import { icon } from '../../components/icons.js';

const statusTone = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'normal' || normalized === 'post_molt') return 'success';
  if (normalized === 'pre_molt' || normalized === 'fasting') return 'warning';
  return 'neutral';
};

export function renderCollectionInspector(animal) {
  if (!animal) {
    return `<aside class="collection-inspector-v4" aria-label="個体Inspector">
      <div class="collection-inspector-empty-v4">
        <span aria-hidden="true">${icon('collection')}</span>
        <strong>個体を選択</strong>
        <p>台帳から個体を選ぶと、状態と直近の記録をここで確認できます。</p>
      </div>
    </aside>`;
  }

  const id = escapeHtml(animal.id);
  return `<aside class="collection-inspector-v4" aria-label="${escapeHtml(animalCode(animal))}の概要">
    <header class="collection-inspector-header-v4">
      <div class="collection-inspector-label">Inspector</div>
      <div class="collection-inspector-tools">
        ${iconButton('edit', { action: 'edit-collection-animal', label: '個体を編集', data: { 'animal-id': id } })}
        ${iconButton('qr', { action: 'collection-animal-qr', label: 'ラベルを印刷', data: { 'animal-id': id } })}
      </div>
      <strong class="animal-code">${escapeHtml(animalCode(animal))}</strong>
      <h2>${escapeHtml(scientificName(animal))}</h2>
    </header>

    <div class="collection-inspector-photo-v4">${renderAnimalMedia(animal, { ratio: 'exhibit', loading: 'eager', fetchPriority: 'high' })}</div>

    <section class="collection-inspector-identity-v4" aria-label="現在の状態">
      ${statusIndicator(statusLabel(animal.status), { tone: statusTone(animal.status) })}
      <div><span>${escapeHtml(genderLabel(animal.gender))}</span><span>${animal.instar ? `齢期 ${escapeHtml(animal.instar)}` : '齢期不明'}</span>${animal.origin ? `<span>${escapeHtml(animal.origin)}</span>` : ''}</div>
    </section>

    <section class="collection-inspector-section-v4" aria-label="直近のお世話">
      <h3>お世話</h3>
      ${dataRow('給餌', formatRelativeDays(animal.last_feed ?? animal.last_feed_date), { metric: true })}
      ${dataRow('脱皮', formatRelativeDays(animal.last_molt ?? animal.last_molt_date), { metric: true })}
      ${dataRow('観察', formatRelativeDays(animal.last_observation ?? animal.last_observation_date), { metric: true })}
    </section>

    <div class="collection-inspector-actions-v4">
      ${button('給餌', { action: 'smart-quick-record', iconName: 'feed', primary: true, data: { 'record-type': 'feed', 'animal-id': id } })}
      ${button('観察', { action: 'smart-quick-record', iconName: 'observation', data: { 'record-type': 'observation', 'animal-id': id } })}
      ${button('記録する', { action: 'quick-record', iconName: 'plus', data: { 'animal-id': id } })}
    </div>

    <div class="collection-inspector-footer-v4">${button('個体詳細を開く', {
      action: 'open-collection-detail',
      iconName: 'chevronRight',
      className: 'text-button',
      data: { 'animal-id': id }
    })}</div>
  </aside>`;
}
