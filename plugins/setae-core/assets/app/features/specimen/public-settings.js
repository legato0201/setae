import { checkboxControl, choiceControl } from '../../components/primitives.js';
import { qrVisibilityLabel } from '../../content/terminology.js';

const passportModes = ['private', 'basic', 'life_history'];
export const publicSettingEnabled = (value) => [true, 1, '1', 'true', 'on'].includes(value);

export function hasSpecimenPublicSettings(record = {}) {
  return (passportModes.includes(record.qr_visibility ?? record.visibility)
    || Object.hasOwn(record, 'qr_public') || Object.hasOwn(record, 'public'))
    && Object.hasOwn(record, 'transfer_enabled');
}

export function specimenPublicSettings(record = {}) {
  const mode = record.qr_visibility ?? record.visibility;
  return {
    visibility: passportModes.includes(mode) ? mode
      : publicSettingEnabled(record.qr_public ?? record.public) ? 'life_history' : 'private',
    transfer_enabled: publicSettingEnabled(record.transfer_enabled)
  };
}

export function renderSpecimenPublicSettings(record = {}, { name = 'qr_visibility', busy = false } = {}) {
  if (!hasSpecimenPublicSettings(record)) return '<fieldset class="form-fieldset"><legend>公開Passportの公開範囲</legend><p class="settings-copy">現在の公開設定を確認できません。個体詳細を開き直すと再取得できます。他の個体情報は編集できます。</p></fieldset>';
  const settings = specimenPublicSettings(record);
  const locked = publicSettingEnabled(record.transfer_receipt);
  const archived = publicSettingEnabled(record.archived);
  const options = [
    { value: 'private', description: '個体番号のみ。写真や生活史は表示しません（引き継ぎ受付中を除く）。' },
    { value: 'basic', description: '写真・学名・科・齢期・性別・由来（CB・WCなど）を表示します。' },
    { value: 'life_history', description: '基本情報に、脱皮・成長・繁殖の記録日を追加します。' }
  ];
  return `<fieldset class="form-fieldset form-grid"><legend>公開Passportの公開範囲</legend>
    <p class="settings-copy">QR・リンクを知っている人に見せる範囲です。変更は保存後に反映され、URLは変わりません。検索エンジンへの登録は許可しません。</p>
    <div>${options.map((option) => choiceControl({ type: 'radio', name, value: option.value,
      checked: settings.visibility === option.value, label: qrVisibilityLabel(option.value), description: option.description,
      disabled: busy || locked })).join('')}</div>
    <p class="settings-copy">飼育者名・内部ID・非公開メモ・飼育場所・給餌などの飼育作業は公開しません。</p>
    ${locked ? '<p class="settings-copy">譲渡済みの記録のため、公開範囲と引き継ぎ受付は変更できません。</p>' : ''}
  </fieldset>
  <fieldset class="form-fieldset form-grid"><legend>管理の引き継ぎ</legend>
    ${checkboxControl({ name: 'transfer_enabled', label: 'この個体の引き継ぎ申請を受け付ける',
      checked: settings.transfer_enabled && !archived && !locked, disabled: busy || locked || archived,
      description: '申請を承認するまで管理者は変わりません。受付を終了すると、未承認の申請は取り消されます。' })}
    <p class="settings-copy">受付中は「非公開」を選んでいても、受け渡し確認用の基本情報がQR・リンクから閲覧できます。</p>
    <p class="settings-copy" data-public-transfer-status role="status" ${archived && !locked ? '' : 'hidden'}>${archived && !locked ? 'アーカイブ中は引き継ぎ申請を受け付けません。' : ''}</p>
  </fieldset>`;
}

// Keep privacy changes explicit: an ordinary edit must never reapply a stale
// visibility value, and disabled receipt controls must not write settings.
export function appendSpecimenPublicSettings(data, form, record = {}) {
  const visibility = data.get('qr_visibility');
  const hasVisibility = data.has('qr_visibility');
  const transfer = form.elements.transfer_enabled;
  const archived = Boolean(form.elements.archived?.checked);
  const previous = specimenPublicSettings(record);
  data.delete('qr_visibility');
  data.delete('transfer_enabled');
  if (!form.dataset.animalId || !hasSpecimenPublicSettings(record) || publicSettingEnabled(record.transfer_receipt)) return false;
  if (hasVisibility && visibility !== previous.visibility) data.set('qr_visibility', visibility);
  if (transfer && (!transfer.disabled || archived)) {
    const enabled = !archived && transfer.checked;
    if (enabled !== previous.transfer_enabled) data.set('transfer_enabled', enabled ? '1' : '0');
  }
  return data.has('qr_visibility') || data.has('transfer_enabled');
}

export function syncSpecimenTransferControl(form, record = {}) {
  if (!form) return;
  const locked = publicSettingEnabled(record.transfer_receipt);
  if (locked) {
    if (form.elements.archived) form.elements.archived.checked = publicSettingEnabled(record.archived);
    form.querySelectorAll('[name="qr_visibility"]').forEach((control) => { control.checked = control.value === specimenPublicSettings(record).visibility; });
  }
  const transfer = form.elements?.transfer_enabled;
  if (!transfer) return;
  const archived = Boolean(form.elements.archived?.checked);
  if (!locked && archived && !Object.hasOwn(form.dataset, 'publicTransferBeforeArchive')) {
    form.dataset.publicTransferBeforeArchive = String(transfer.checked);
  } else if (!archived && Object.hasOwn(form.dataset, 'publicTransferBeforeArchive')) {
    transfer.checked = form.dataset.publicTransferBeforeArchive === 'true';
    delete form.dataset.publicTransferBeforeArchive;
  }
  transfer.disabled = archived || locked;
  transfer.setAttribute('aria-disabled', String(transfer.disabled));
  transfer.closest('.checkbox-control')?.classList.toggle('is-disabled', transfer.disabled);
  if (transfer.disabled) transfer.checked = false;
  const status = form.querySelector('[data-public-transfer-status]');
  if (status) {
    status.hidden = !archived || locked;
    status.textContent = archived && !locked ? 'アーカイブ中は引き継ぎ申請を受け付けません。' : '';
  }
}

export function qrSettingsPayload(data) {
  const visibility = data.get('visibility') || 'private';
  return { visibility, public: visibility !== 'private', transfer_enabled: publicSettingEnabled(data.get('transfer_enabled')) };
}

export function syncSpecimenPublicSettings(state, animalId, target) {
  const settings = specimenPublicSettings(target);
  const patch = { qr_visibility: settings.visibility, qr_public: settings.visibility !== 'private', transfer_enabled: settings.transfer_enabled };
  const matches = (id) => String(id) === String(animalId);
  state.animals = (state.animals || []).map((animal) => matches(animal.id) ? { ...animal, ...patch } : animal);
  if (matches(state.selectedAnimal?.id)) state.selectedAnimal = { ...state.selectedAnimal, ...patch };
  if (state.qr?.targets?.items) state.qr.targets = { ...state.qr.targets,
    items: state.qr.targets.items.map((item) => item.target_type === 'spider' && matches(item.object_id) ? { ...item, ...target } : item) };
}
