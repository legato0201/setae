import { button } from '../../components/primitives.js';
import { escapeHtml } from '../../components/ui.js';

const gateCodes = new Set(['manual_specimen_limit', 'nursery_group_limit', 'trial_required', 'trial_expired', 'trial_promotion_limit', 'trial_unavailable', 'label_batch_limit', 'plan_required', 'billing_past_due', 'qr_label_resource_limit']);
const gateCode = (error) => String(error?.code || '').replace(/^setae_/, '');
export const isPlanError = (error) => gateCodes.has(gateCode(error));

export function planErrorMessage(error) {
  const messages = {
    manual_specimen_limit: '手動登録・個体化の登録枠に達しました。QRからの受領は登録枠を使いません。',
    nursery_group_limit: 'このプランのベビー群数に達しました。既存の群は引き続き記録できます。',
    trial_required: '個体化にはブリーダー機能が必要です。カード不要で30日間試せます。上限はプラン画面で確認できます。',
    trial_expired: '試用期間が終了しました。既存の個体・ベビー群と記録はそのまま残ります。',
    trial_promotion_limit: '試用中に個体化できる累計数に達しました。アーカイブや削除をしても試用の累計は戻りません。既存の記録はそのまま使えます。',
    trial_unavailable: '試用は1アカウントにつき1回です。現在のプランと試用状況をご確認ください。',
    label_batch_limit: '1回に出力できるラベル数を超えています。選択数を減らすか、プランを確認してください。',
    billing_past_due: 'お支払いの確認が必要です。契約管理でご確認ください。',
    qr_label_resource_limit: '1回の処理件数を超えています。選択を分けて出力してください。'
  };
  return messages[gateCode(error)] || 'この操作には別のプランが必要です。入力内容は保持しています。';
}

export function createPlanController({ root, services, getProfile, setProfile, render, notify, mock = () => false } = {}) {
  let starting = false;
  const pricing = () => {
    const plan = getProfile()?.plan || {};
    const limits = plan.starter_limits || { specimens: 100, nursery_groups: 10, label_batch: 100 };
    const quantity = (value, unit) => value === -1 || value === null ? '無制限' : `${escapeHtml(value)}${unit}`;
    return `<div class="settings-section" data-plan-pricing><h3>Breeder Starter</h3><p>${escapeHtml(plan.price_label || '月額1,480円')}</p><p>手動登録・個体化${quantity(limits.specimens, '匹')}、ベビー群${quantity(limits.nursery_groups, '群')}、ラベル${quantity(limits.label_batch, '件')}。QR受領は枠外です。</p>${button(plan.billing_available ? 'Breeder Starterを申し込む' : '現在準備中', { action: 'billing-checkout', primary: true, disabled: !plan.billing_available })}</div>`;
  };
  function showError(error, form, { returnFocus } = {}) {
    if (!isPlanError(error)) return false;
    const activeForm = form?.isConnected ? form : root.querySelector(`form[data-role="${form?.dataset?.role || ''}"]`);
    const host = activeForm || root.querySelector('[data-app-error-root]');
    if (!host) return false;
    let panel = host.querySelector('[data-plan-gate]');
    if (!panel) { panel = host.ownerDocument.createElement('section'); panel.dataset.planGate = ''; host.append(panel); }
    if (returnFocus?.isConnected) panel.setaeReturnFocus = returnFocus;
    panel.className = 'plan-gate modal-body'; panel.setAttribute('role', 'alert');
    const trialAvailable = error.data?.trial_available === true;
    panel.innerHTML = `<h3>プランを確認</h3><p>${escapeHtml(planErrorMessage(error))}</p><p>入力内容と選択は保持しています。</p><div class="settings-form-actions settings-actions-start">
      ${trialAvailable ? button('ブリーダー機能を30日試す', { action: 'start-breeder-trial', primary: true }) : ''}
      ${gateCode(error) === 'billing_past_due' ? button('契約を管理', { action: 'billing-portal' }) : button('Breeder Starterを見る', { action: 'view-breeder-starter' })}
      ${button(['label_batch_limit', 'qr_label_resource_limit'].includes(gateCode(error)) ? '選択数を減らす' : '閉じる', { action: 'dismiss-plan-gate' })}</div>`;
    return true;
  }
  async function handleAction(action, element) {
    if (action === 'dismiss-plan-gate') {
      const gate = element.closest('[data-plan-gate]');
      const returnFocus = gate?.setaeReturnFocus;
      gate?.remove();
      if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
      return true;
    }
    if (action === 'view-breeder-starter') {
      const gate = element.closest('[data-plan-gate]');
      let panel = gate?.querySelector('[data-plan-pricing]') || root.querySelector('[data-plan-pricing]');
      if (gate && !gate.querySelector('[data-plan-pricing]')) { gate.insertAdjacentHTML('beforeend', pricing()); panel = gate.querySelector('[data-plan-pricing]'); }
      if (panel) panel.hidden = false;
      services.app.metric('pricing_viewed', location.pathname, { source: 'settings' }).catch(() => {});
      return true;
    }
    if (action === 'start-breeder-trial') {
      if (starting) return true;
      if (mock()) { notify('モックでは契約や試用期間を変更しません。', 'warning'); return true; }
      const gate = element.closest('[data-plan-gate]');
      starting = true; element.disabled = true;
      try {
        await services.integrations.startTrial();
        setProfile(await services.account.get());
        if (gate?.isConnected) {
          gate.setAttribute('role', 'status');
          gate.innerHTML = `<h3>30日間の試用を開始しました</h3><p>入力と選択はそのままです。内容を確認して、もう一度操作を実行してください。</p>${button('入力に戻る', { action: 'dismiss-plan-gate' })}`;
        } else render();
        notify('ブリーダー機能の試用を開始しました。');
      } catch (error) {
        notify(error?.message || '試用を開始できませんでした。入力内容は保持しています。', 'error');
      } finally { starting = false; if (element.isConnected) element.disabled = false; }
      return true;
    }
    if (!['billing-checkout', 'billing-portal'].includes(action)) return false;
    if (mock()) { notify('モックでは決済を開始しません。', 'warning'); return true; }
    element.disabled = true;
    try {
      const result = action === 'billing-checkout' ? await services.integrations.checkout() : await services.integrations.portal();
      const url = new URL(result?.url || '');
      if (url.protocol !== 'https:') throw new Error('安全な決済URLを確認できませんでした。');
      location.assign(url.href);
    } catch (error) { notify(error?.message || '契約画面を開けませんでした。', 'error'); }
    finally { if (element.isConnected) element.disabled = false; }
    return true;
  }
  return { showError, handleAction };
}
