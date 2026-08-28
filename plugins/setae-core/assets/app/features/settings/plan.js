import { button, dataRow } from '../../components/primitives.js';
import { escapeHtml } from '../../components/ui.js';

export const planNames = Object.freeze({ keeper_free: 'Keeper Free', breeder_trial: 'ブリーダー試用', breeder_starter: 'Breeder Starter', legacy_premium: '従来プレミアム' });
const statuses = { active: '有効', trialing: '試用中', past_due: 'お支払いを確認してください', canceled: '契約終了', unpaid: '未払い', incomplete: 'お支払い手続き中', incomplete_expired: 'お申し込み期限終了', paused: '停止中' };
const dateLabel = (value) => value ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleDateString('ja-JP') : '—';
const isUnlimited = (value) => value === null || value === -1;
const limitLabel = (value) => isUnlimited(value) ? '無制限' : String(value ?? '—');

export function trialDaysRemaining(value, now = Date.now()) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(typeof value === 'number' ? value * 1000 : value).getTime() - now) / 86400000));
}

export function renderPlanSettings(profile = {}) {
  const { plan, inventory = {}, nursery = {}, entitlements = {} } = profile || {};
  if (!plan?.id) return '<p class="settings-copy" role="status">プラン情報を取得できませんでした。設定画面を開き直してください。</p>';
  const paid = ['breeder_starter', 'legacy_premium'].includes(plan.id);
  const trial = plan.id === 'breeder_trial';
  const starter = plan.starter_limits || { specimens: 100, nursery_groups: 10, label_batch: 100 };
  const quantity = (value, unit) => `${escapeHtml(limitLabel(value))}${isUnlimited(value) ? '' : unit}`;
  return `<div class="settings-property-list" data-plan-summary>
    ${dataRow('プラン', planNames[plan.id] || plan.label || plan.id)}
    ${dataRow('状態', trial ? '試用中' : statuses[plan.status] || plan.status || '—')}
    ${trial ? dataRow('試用終了', `${dateLabel(plan.trial_ends_at)}（残り${trialDaysRemaining(plan.trial_ends_at)}日）`) : ''}
    ${plan.cancel_at ? dataRow('契約終了予定', dateLabel(plan.cancel_at)) : plan.current_period_end ? dataRow('次回更新', dateLabel(plan.current_period_end)) : ''}
    ${plan.grace_until ? dataRow('支払い猶予', dateLabel(plan.grace_until)) : ''}
    ${dataRow('手動登録・個体化', `${inventory.active_slot_bearing ?? 0}匹 / ${limitLabel(inventory.limit)}${isUnlimited(inventory.limit) ? '' : '匹'}`)}
    ${dataRow('残りの登録枠', `${limitLabel(inventory.remaining)}${isUnlimited(inventory.remaining) ? '' : '匹'}`)}
    ${dataRow('QRで受け取った個体', `${inventory.received_exempt ?? 0}匹（登録枠の対象外）`)}
    ${dataRow('ベビー群', `${nursery.active_groups ?? 0}群 / ${limitLabel(nursery.limit)}${isUnlimited(nursery.limit) ? '' : '群'}`)}
    ${dataRow('1回のラベル出力', `${limitLabel(entitlements.label_batch_limit)}${isUnlimited(entitlements.label_batch_limit) ? '' : '件'}`)}
    ${trial ? dataRow('試用中の個体化', `累計${profile.trial?.promoted_count ?? plan.trial_promoted_count ?? 0} / ${quantity(profile.trial?.promotion_limit ?? plan.trial_limits?.promotions ?? 20, '匹')}`) : ''}
  </div>
  ${inventory.over_limit ? '<p class="settings-copy" role="status">登録枠を超えています。既存個体の閲覧・編集・記録・エクスポートは引き続き利用できます。</p>' : ''}
  ${plan.id === 'legacy_premium' ? '<p class="settings-copy">従来プレミアムの無制限権限を維持しています。</p>' : ''}
  ${plan.status === 'past_due' ? '<p class="settings-copy" role="status">契約管理でお支払い方法をご確認ください。既存データは削除されません。</p>' : ''}
  <div class="settings-form-actions settings-actions-start">
    ${plan.trial_available ? button('ブリーダー機能を30日試す', { action: 'start-breeder-trial', primary: true }) : ''}
    ${!paid ? button(trial ? 'Breeder Starterへ移行' : 'Breeder Starterを見る', { action: 'view-breeder-starter' }) : ''}
    ${paid || plan.status === 'past_due' ? button('契約を管理', { action: 'billing-portal' }) : ''}
  </div>
  <section class="settings-section" data-plan-pricing hidden>
    <h3>Breeder Starter</h3><p>${escapeHtml(plan.price_label || '月額1,480円')}</p>
    <p class="settings-copy">手動登録・個体化${quantity(starter.specimens, '匹')}、ベビー群${quantity(starter.nursery_groups, '群')}、1回のラベル出力${quantity(starter.label_batch, '件')}。QRで受け取る個体は登録枠を使いません。</p>
    ${button(plan.billing_available ? 'Breeder Starterを申し込む' : '現在準備中', { action: 'billing-checkout', primary: true, disabled: !plan.billing_available })}
  </section>`;
}
