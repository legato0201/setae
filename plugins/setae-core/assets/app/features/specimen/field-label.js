import { animalCode, escapeHtml, scientificName } from '../../components/ui.js';
import { button, iconButton, modal } from '../../components/primitives.js';
import { renderFieldLabel } from '../qr/labels.js';

function fieldLabelTarget(animal = {}, target = {}) {
  return {
    ...animal,
    ...target,
    manage_code: target.manage_code || animalCode(animal),
    species_name: target.species_name || scientificName(animal),
    instar: target.instar ?? animal.instar,
    gender: target.gender || animal.gender,
    url: target.url || target.permanent_url || animal.qr_url || animal.permanent_url || ''
  };
}

export function renderFieldLabelDialog(modalState = {}) {
  const animal = modalState.animal || {};
  const title = `${animalCode(animal)}の識別票`;
  const preview = renderFieldLabel(fieldLabelTarget(animal, modalState.target), modalState.labelConfig);
  const headingId = 'field-label-dialog-title';
  const content = `<header class="field-label-dialog-header"><div><span>識別票</span><h2 id="${headingId}">${escapeHtml(title)}</h2><p>印刷・貼付して使用する識別票です。</p></div>${iconButton('close', { action: 'close-modal', label: '閉じる' })}</header><div class="field-label-dialog-body">${preview}</div><footer class="field-label-dialog-actions">${button('リンクをコピー', { action: 'copy-animal-qr-url', iconName: 'externalLink', data: { 'animal-id': animal.id } })}${button('閉じる', { action: 'close-modal' })}${button('印刷設定を開く', { action: 'print-specimen-label', iconName: 'print', primary: true })}</footer>`;
  return modal(content, { className: 'field-label-dialog', labelledBy: headingId, backdropAction: 'close-modal' });
}
