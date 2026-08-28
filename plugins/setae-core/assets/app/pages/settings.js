import { escapeHtml } from '../components/ui.js';
import { emptyBlock, formatDate, list, loadingBlock } from '../components/content.js';
import {
  button,
  checkboxControl,
  dataRow,
  fileField,
  hiddenField,
  navigationItem,
  selectField,
  statusIndicator,
  tabPanel,
  tabs,
  textField,
  textareaField
} from '../components/primitives.js';
import { renderMySetae } from '../features/personalization/preset-view.js';
import { renderAppInformation } from '../features/settings/about.js';
import { renderPlanSettings } from '../features/settings/plan.js';
import { renderDiagnosticsPanel } from '../features/diagnostics/view.js';
import { offlineActionLabel } from '../content/terminology.js';

const settingsGroups = [
  {
    label: '一般',
    items: [
      { id: 'my-setae', label: 'My SETAE' },
      { id: 'profile', label: 'プロフィール' },
      { id: 'plan', label: 'プラン・利用状況' },
      { id: 'notifications', label: '通知' }
    ]
  },
  {
    label: '詳細設定',
    items: [
      { id: 'integrations', label: '外部連携' },
      { id: 'social', label: 'つながり' },
      { id: 'about', label: 'アプリ情報' }
    ]
  }
];

const settingsItems = settingsGroups.flatMap((group) => group.items);

export function renderSettings({ tab = 'my-setae', data = {}, loading = false, offlineQueue = [], personalization = {}, dashboard = {}, animalCardConfig = {}, savedViewCount = 0, careProfile = {}, animals = [], todayTasks = {}, syncStatus = 'idle', syncMessage = '', syncFailedCount = 0, appInfo = {}, diagnostics = {} }) {
  const active = settingsItems.some((item) => item.id === tab) ? tab : 'my-setae';
  let content;
  if (loading) content = loadingBlock('設定を読み込み中…', 'form');
  else if (active === 'my-setae') content = renderMySetae({ personalization, dashboard, animalCardConfig, savedViewCount });
  else if (active === 'notifications') content = renderNotifications(data.pwaConfig, data.pwaPreferences);
  else if (active === 'integrations') content = renderIntegrations(data.integrations, offlineQueue, { syncStatus, syncMessage, syncFailedCount });
  else if (active === 'social') content = renderSocial(data.relationships);
  else if (active === 'plan') content = settingsSection('プラン・利用状況', '登録枠と契約を確認する', renderPlanSettings(data.profile), 'account-summary');
  else if (active === 'about') content = `${renderAppInformation(appInfo)}${renderDiagnosticsPanel(diagnostics)}`;
  else content = renderProfile(data.profile, todayTasks);

  return `
    <div class="page settings-page">
      <header class="page-header compact-header"><div><div class="eyebrow">設定</div><h1>${settingsTitle(active)}</h1></div></header>
      <div class="settings-workspace">
        ${renderSettingsNavigation(active)}
        <div class="settings-mobile-navigation">${tabs(settingsItems, {
    activeId: active,
    action: 'settings-tab',
    dataKey: 'tab',
    label: '設定画面',
    idPrefix: 'settings',
    panelId: 'settings-tabpanel'
  })}</div>
        ${tabPanel(content, {
    id: 'settings-tabpanel',
    idPrefix: 'settings',
    activeId: active,
    className: 'settings-content'
  })}
      </div>
    </div>
  `;
}

function renderSettingsNavigation(active) {
  return `<aside class="settings-navigation" aria-label="設定画面">${settingsGroups.map((group) => `<section class="settings-navigation-group"><span>${escapeHtml(group.label)}</span><nav aria-label="設定ナビゲーション：${escapeHtml(group.label)}">${group.items.map((item) => navigationItem(item.label, '', {
    action: 'settings-tab',
    active: active === item.id,
    data: { tab: item.id }
  })).join('')}</nav></section>`).join('')}</aside>`;
}

function settingsSection(title, description, content, className = '') {
  return `<section class="settings-section ${escapeHtml(className)}"><header class="settings-section-header"><div><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div></header>${content}</section>`;
}

function renderProfile(profile = {}, todayTasks = {}) {
  profile = profile || {};
  const basic = `<form class="panel-form" data-role="profile-form">
    ${textField({ label: '表示名', name: 'display_name', value: profile.display_name || '', id: 'profile-name', required: true })}
    ${textField({ label: 'メールアドレス', name: 'email', type: 'email', value: profile.email || '', id: 'profile-email', required: true })}
    ${textField({ label: '新しいパスワード', name: 'password', type: 'password', id: 'profile-password', autocomplete: 'new-password', placeholder: '変更するときだけ入力' })}
    ${fileField({ label: 'プロフィール画像', name: 'profile_image', accept: 'image/jpeg,image/png,image/webp', buttonLabel: '写真を選ぶ' })}
    <div class="settings-form-actions">${button('保存する', { type: 'submit', primary: true })}</div>
  </form>`;

  const appearance = `<form class="panel-form" data-role="appearance-form">
    ${selectField({
    label: 'テーマ',
    name: 'theme_preference',
    value: profile.theme_preference || 'system',
    id: 'theme-preference',
    options: [
      { value: 'system', label: '端末設定に合わせる' },
      { value: 'light', label: 'ライト' },
      { value: 'dark', label: 'ダーク' }
    ]
  })}
    ${checkboxControl({ name: 'show_care_focus', checked: todayTasks.visible !== false, label: 'Todayに「今日の作業」を表示する' })}
    <div class="settings-form-actions">${button('保存する', { type: 'submit', primary: true })}</div>
  </form>`;

  const account = renderPlanSettings(profile);

  return `<div class="settings-sections">
    ${settingsSection('基本情報', '公開名とログイン情報', basic)}
    ${settingsSection('表示', 'テーマとTodayの表示', appearance)}
    ${settingsSection('利用状況', '現在の登録枠とプラン', account, 'account-summary')}
  </div>`;
}

function renderNotifications(config = {}, preferences = {}) {
  const enabled = preferences?.enabled ?? config?.preferences?.enabled ?? false;
  const device = config?.configured
    ? `<p class="settings-copy">ブラウザ通知を許可すると、お世話予定や返信を受け取れます。</p><div class="settings-form-actions settings-actions-start">${button('この端末で通知を受け取る', { action: 'enable-push', primary: true })}${button('テスト通知', { action: 'test-push' })}</div>`
    : '<div class="error-banner">サーバー側の通知設定が完了していません。</div>';
  const preferencesForm = `<form class="panel-form" data-role="notification-form">
    ${checkboxControl({ name: 'enabled', checked: enabled, label: '通知を有効にする' })}
    ${checkboxControl({ name: 'care_reminders', checked: preferences?.care_reminders !== false, label: 'お世話リマインダー' })}
    ${checkboxControl({ name: 'community_messages', checked: preferences?.community_messages !== false, label: '相談・返信の通知' })}
    <div class="notification-time-fields">
      ${textField({ label: '時', name: 'care_hour', type: 'number', min: 0, max: 23, value: preferences?.care_hour ?? 20, inputMode: 'numeric' })}
      ${textField({ label: '分', name: 'care_minute', type: 'number', min: 0, max: 55, step: 5, value: preferences?.care_minute ?? 0, inputMode: 'numeric' })}
    </div>
    ${hiddenField('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo')}
    <div class="settings-form-actions">${button('保存する', { type: 'submit', primary: true })}</div>
  </form>`;
  return `<div class="settings-sections">
    ${settingsSection('この端末', `登録端末 ${config?.subscribed_devices ?? 0}台`, device)}
    ${settingsSection('通知内容', '受け取る通知と時刻', preferencesForm)}
  </div>`;
}

function renderIntegrations(integrations = {}, offlineQueue = [], sync = {}) {
  const external = integrations.external || {};
  const live = integrations.live || {};
  const chatgpt = integrations.chatgpt || {};
  const result = integrations.result || null;
  const integrationRows = [
    integrationRow('外部APIトークン', external.enabled || external.active ? '有効' : '未発行', '外部ツールから個体情報を読み書きします。', 'create-external-token', 'disable-external', external.enabled || external.active),
    integrationRow('期限付きURL連携', live.enabled || live.active ? '有効' : '未発行', '期限を区切った安全な連携URLを発行します。', 'create-live-session', 'disable-live', live.enabled || live.active),
    integrationRow('ChatGPT連携', chatgpt.connected || chatgpt.active ? '接続済み' : '未接続', 'ChatGPT Appから個体管理を利用します。', '', 'disable-chatgpt', chatgpt.connected || chatgpt.active)
  ].join('');
  const offline = offlineQueue.length
    ? `${sync.syncMessage ? `<p class="settings-copy" role="status">${escapeHtml(sync.syncMessage)}</p>` : ''}<div class="offline-ledger">${offlineQueue.map((item) => `<div class="offline-ledger-row"><div><strong>${escapeHtml(offlineActionLabel(item.action))}</strong><span>対象 ${escapeHtml(item.entity_id || '未指定')} · ${formatDate(item.created_at, true)}</span></div>${statusIndicator(sync.syncStatus === 'error' ? '再送が必要' : '同期待ち', { tone: sync.syncStatus === 'error' ? 'danger' : 'warning' })}<details><summary>詳細</summary><code>${escapeHtml(item.action)}</code><code>${escapeHtml(item.operation_id)}</code></details></div>`).join('')}</div><div class="settings-form-actions settings-actions-start">${button(sync.syncStatus === 'syncing' ? '同期中…' : '同期する', { action: 'sync-offline', primary: true, disabled: sync.syncStatus === 'syncing', loading: sync.syncStatus === 'syncing' })}${button('破棄する', { action: 'clear-offline', className: 'danger-button', disabled: sync.syncStatus === 'syncing' })}</div>`
    : '<p class="settings-copy">同期待ちの操作はありません。</p>';
  return `<div class="settings-sections">
    ${result ? `<section class="settings-secret-result"><header><h2>発行結果</h2><p>この情報は再表示できない場合があります。</p></header>${textareaField({ label: '接続情報', value: result.token || result.url || result.access_url || JSON.stringify(result, null, 2), rows: 5, readOnly: true })}<div class="settings-form-actions settings-actions-start">${button('コピー', { action: 'copy-integration-result', iconName: 'copy' })}</div></section>` : ''}
    ${settingsSection('外部連携', 'SETAEを外部サービスから利用するための接続', `<div class="integration-list">${integrationRows}</div>`)}
    ${settingsSection('オフライン同期待ち', `通信できない間に保存した操作 ${offlineQueue.length}件`, offline)}
  </div>`;
}

function renderSocial(data = {}) {
  const following = list(data, ['following', 'following_users']);
  const blocked = list(data, ['blocked', 'blocked_users']);
  return `<div class="settings-sections">
    ${settingsSection('交流', '相談・投稿・通知は引き続き利用できます。', button('交流を開く', { nav: 'community', iconName: 'community' }))}
    ${settingsSection('フォロー中', '新しい共有記録を追いかける利用者', following.length ? `<div class="social-settings-list">${following.map((user) => socialRow(user, 'unfollow-user', 'フォロー解除')).join('')}</div>` : emptyBlock('フォロー中の利用者はいません。'))}
    ${settingsSection('ブロック中', '交流を制限している利用者', blocked.length ? `<div class="social-settings-list">${blocked.map((user) => socialRow(user, 'unblock-user', 'ブロック解除')).join('')}</div>` : emptyBlock('ブロック中の利用者はいません。'))}
  </div>`;
}

function integrationRow(title, status, copy, enableAction, disableAction, enabled) {
  return `<article class="integration-row"><div class="integration-row-copy"><div><strong>${escapeHtml(title)}</strong>${statusIndicator(status, { tone: enabled ? 'success' : 'neutral' })}</div><p>${escapeHtml(copy)}</p></div><div>${enableAction && !enabled ? button('発行', { action: enableAction, primary: true }) : ''}${disableAction && enabled ? button('無効化', { action: disableAction, className: 'danger-button' }) : ''}</div></article>`;
}

function socialRow(user, action, label) {
  return `<div class="social-settings-row"><div><strong>${escapeHtml(user.display_name || user.name || '利用者')}</strong><span>${escapeHtml(user.handle || '')}</span></div>${button(label, { action, data: { 'user-id': user.id || user.user_id } })}</div>`;
}

function settingsTitle(tab) {
  return ({ 'my-setae': 'My SETAE', care: '飼育ルール', profile: 'プロフィール', notifications: '通知', integrations: '外部連携', social: 'つながり', about: 'アプリ情報' })[tab] || '設定';
}
