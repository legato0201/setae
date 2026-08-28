import { actionRow } from '../../components/primitives.js';
import { escapeHtml } from '../../components/ui.js';

const timestamp = (value) => typeof value === 'number' ? value * 1000 : Date.parse(value || '');
const viewedKey = (owner) => `setae.arrival.viewed.${Number(owner) || 0}`;
export function markArrivalViewed(id, owner, storage = globalThis.localStorage) {
  try { storage?.setItem(viewedKey(owner), String(id)); } catch { /* Viewing works without storage. */ }
}

export function deriveArrivalChecklist({ animals = [], records = [], ownerId = 0, notifications = false, now = Date.now(), storage = globalThis.localStorage } = {}) {
  const animal = animals.filter((item) => item.acquisition_source === 'transfer_received'
    && timestamp(item.received_at) <= now && timestamp(item.received_at) > now - 7 * 86400000)
    .sort((a, b) => timestamp(b.received_at) - timestamp(a.received_at))[0];
  if (!animal) return null;
  const recent = records.filter((record) => String(record.animal?.id || record.target_id || record.spider_id) === String(animal.id))
    .map((record) => record.event || record)
    .filter((event) => event.recorded_by_current_user === true && timestamp(event.created_at || event.date) >= timestamp(animal.received_at));
  let viewed = false;
  try { viewed = storage?.getItem(viewedKey(ownerId)) === String(animal.id); } catch { /* Optional progress. */ }
  return { animal, viewed, recorded: recent.length > 0,
    photographed: recent.some((event) => Boolean(event.image || event.image_url || event.data?.image || event.data?.image_url)),
    scheduled: Boolean(notifications) };
}

export function renderArrivalChecklist(options) {
  const state = deriveArrivalChecklist(options);
  if (!state) return '';
  const data = { 'animal-id': state.animal.id, 'record-type': 'observation' };
  const row = (label, description, complete, action) => actionRow({ label, description, action, data,
    iconName: complete ? 'check' : 'chevronRight', className: `onboarding-step${complete ? ' is-complete' : ''}` });
  return `<section class="getting-started" aria-labelledby="arrival-checklist-title" data-arrival-checklist>
    <header class="getting-started-header"><div><span class="eyebrow">受け取ってから7日間</span><h2 id="arrival-checklist-title">${escapeHtml(state.animal.title || state.animal.manage_code || '受け取った個体')}の記録を始める</h2></div></header>
    <div class="getting-started-steps">
      ${row('受け取った個体を確認', '引き継いだ履歴と個体情報を開きます。', state.viewed, 'open-arrival-animal')}
      ${row('到着時の状態を記録', '個体の様子を観察して残します。', state.recorded, 'smart-quick-record')}
      ${row('写真を追加', '観察記録の写真欄から追加できます。', state.photographed, 'smart-quick-record')}
      ${row('次回確認・通知を設定', '個体に合わせた確認予定や通知を設定します。', state.scheduled, 'open-onboarding-notifications')}
    </div>
  </section>`;
}
