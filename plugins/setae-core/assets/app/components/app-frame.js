import {
  button,
  iconButton,
  navigationItem,
  statusIndicator,
  toast
} from './primitives.js';
import { escapeHtml } from './ui.js';
import { renderBrand } from './brand.js';

const isActivePage = (currentPage, targetPage) => currentPage === targetPage
  || (targetPage === 'animals' && currentPage === 'animal-detail');

const publicNavigationEnabled = ({ authenticated = false, mockMode = false } = {}) => !authenticated && !mockMode;

const mainNavigation = (page, publicNavigation) => publicNavigation
  ? navigationItem('交流', 'community', { nav: 'community', active: isActivePage(page, 'community'), className: 'app-rail-link' })
  : [
      ['today', '今日', 'today'],
      ['animals', 'コレクション', 'collection'],
      ['records', '記録', 'records'],
      ['husbandry', '飼育管理', 'husbandry']
    ].map(([target, label, iconName]) => navigationItem(label, iconName, {
      nav: target,
      active: isActivePage(page, target),
      className: 'app-rail-link'
    })).join('');

const collectionViewLink = (page, activeViewId, id, label) => navigationItem(label, '', {
  action: 'sidebar-collection-view',
  active: isActivePage(page, 'animals') && activeViewId === id,
  className: 'app-rail-sublink',
  data: { 'view-id': id }
});

const syncPresentation = ({ online = true, pendingSyncCount = 0, syncStatus = 'idle', syncFailedCount = 0 } = {}) => {
  const label = syncStatus === 'syncing'
    ? `${pendingSyncCount}件を同期中`
    : syncStatus === 'error'
      ? `${syncFailedCount || pendingSyncCount}件未同期`
      : !online || syncStatus === 'offline'
        ? pendingSyncCount ? `オフライン · 同期待ち ${pendingSyncCount}件` : 'オフライン'
        : pendingSyncCount
          ? `同期待ち ${pendingSyncCount}件`
          : '';
  return { label, tone: syncStatus === 'error' ? 'danger' : 'warning' };
};

export function renderAppRail(options = {}) {
  const {
    page = 'today', mockMode = false, userName = 'アカウント',
    activeViewId = 'all', savedViews = []
  } = options;
  const publicNavigation = publicNavigationEnabled(options);
  const library = publicNavigation ? '' : `<nav class="app-rail-library" aria-label="コレクション保存ビュー">
    <div class="app-rail-section-label">コレクション</div>
    ${collectionViewLink(page, activeViewId, 'all', 'すべて')}
    ${collectionViewLink(page, activeViewId, 'pre_molt', '脱皮前')}
    ${collectionViewLink(page, activeViewId, 'feeding', '給餌対象')}
    ${savedViews.slice(0, 4).map((view) => collectionViewLink(page, activeViewId, view.id, view.title)).join('')}
  </nav>`;
  const account = publicNavigation
    ? navigationItem('ログイン', 'user', { action: 'show-login', className: 'app-rail-link' })
    : `<div class="app-rail-account"><span class="app-rail-avatar" aria-hidden="true">${escapeHtml(userName.slice(0, 1))}</span><span>${escapeHtml(userName)}</span></div>
      ${navigationItem('設定', 'settings', { nav: 'settings', active: isActivePage(page, 'settings'), className: 'app-rail-link' })}
      ${navigationItem(mockMode ? 'モックを終了' : 'ログアウト', 'logout', { action: 'logout', className: 'app-rail-link' })}`;
  const sync = syncPresentation(options);
  const desktopSync = publicNavigation || !sync.label ? '' : navigationItem(sync.label, options.syncStatus === 'syncing' ? 'records' : 'settings', {
    nav: 'settings',
    className: 'app-rail-link app-rail-sync',
    data: { 'settings-tab': 'integrations' }
  });

  return `<aside class="app-rail" aria-label="SETAE">
    ${renderBrand({ className: 'app-rail-brand' })}
    <nav class="app-rail-navigation" aria-label="メインナビゲーション">${mainNavigation(page, publicNavigation)}</nav>
    ${library}
    <div class="app-rail-spacer"></div>
    <footer class="app-rail-footer">${desktopSync}${account}</footer>
  </aside>`;
}

export function renderMobileAppBar(options = {}) {
  const { pageTitle = 'SETAE', mockMode = false, online = true, syncStatus = 'idle' } = options;
  const publicNavigation = publicNavigationEnabled(options);
  const sync = syncPresentation(options);
  const mobileStatus = [
    sync.label && (!online || syncStatus === 'offline') ? statusIndicator(sync.label, { tone: sync.tone, className: 'mobile-app-status' }) : '',
    sync.label && online && syncStatus !== 'offline' ? button(sync.label, { nav: 'settings', className: 'mobile-sync-button', data: { 'settings-tab': 'integrations' }, disabled: syncStatus === 'syncing' }) : '',
    mockMode ? statusIndicator('モック', { className: 'mobile-app-status' }) : ''
  ].join('');

  return `<header class="mobile-app-bar">
    ${renderBrand({ subtitle: pageTitle, className: 'mobile-app-brand', size: 'compact' })}
    <div class="mobile-app-actions">
      ${mobileStatus}
      ${publicNavigation
        ? button('ログイン', { action: 'show-login', primary: true, className: 'compact-button' })
        : iconButton('settings', { action: '', label: '設定', className: 'mobile-app-icon', data: { nav: 'settings' } })}
    </div>
  </header>`;
}

export function renderMobileNavigation(options = {}) {
  const { page = 'today' } = options;
  if (publicNavigationEnabled(options)) {
    return `<nav class="mobile-navigation is-public" aria-label="モバイルナビゲーション">
      ${navigationItem('交流', 'community', { nav: 'community', active: isActivePage(page, 'community'), className: 'mobile-navigation-item' })}
      ${navigationItem('ログイン', 'user', { action: 'show-login', className: 'mobile-navigation-item' })}
    </nav>`;
  }
  return `<nav class="mobile-navigation" aria-label="モバイルナビゲーション">
    ${navigationItem('今日', 'today', { nav: 'today', active: isActivePage(page, 'today'), className: 'mobile-navigation-item' })}
    ${navigationItem('個体', 'collection', { nav: 'animals', active: isActivePage(page, 'animals'), className: 'mobile-navigation-item' })}
    ${navigationItem('記録', 'plus', { action: 'open-record-sheet', className: 'mobile-navigation-item is-record-action', ariaLabel: '記録を追加' })}
    ${navigationItem('履歴', 'records', { nav: 'records', active: isActivePage(page, 'records'), className: 'mobile-navigation-item' })}
    ${navigationItem('飼育', 'husbandry', { nav: 'husbandry', active: isActivePage(page, 'husbandry'), className: 'mobile-navigation-item' })}
  </nav>`;
}

export function renderAppSync(options = {}) {
  return !publicNavigationEnabled(options) && (!options.online || options.syncStatus === 'offline')
    ? '<div class="sync-notice" role="status">オフラインです。操作はこの端末に保存し、再接続後に同期します。</div>'
    : '';
}

export function renderAppError(errorMessage = '') {
  return errorMessage
    ? `<div class="app-frame-error"><div class="error-banner" role="alert">${escapeHtml(errorMessage)}${iconButton('close', { action: 'dismiss-error', label: '閉じる' })}</div></div>`
    : '';
}

export function renderAppFeedback(toastMessage = null) {
  return toastMessage ? toast(toastMessage.message, {
    type: toastMessage.type,
    actionLabel: toastMessage.actionLabel,
    action: toastMessage.action,
    data: toastMessage.data,
    dismissAction: 'dismiss-toast'
  }) : '';
}

export function renderAppFrameRegions(options = {}) {
  return {
    rail: renderAppRail(options),
    mobileBar: renderMobileAppBar(options),
    page: String(options.content || ''),
    mobileNavigation: renderMobileNavigation(options),
    sync: renderAppSync(options),
    error: renderAppError(options.errorMessage),
    overlays: String(options.overlaysHtml || ''),
    feedback: renderAppFeedback(options.toastMessage),
    updateNotice: String(options.updateNoticeHtml || '')
  };
}

export function renderAppFrame(options = {}) {
  const regions = renderAppFrameRegions(options);
  return `<div class="app-shell app-frame" data-app-frame>
    <a class="skip-link" href="#setae-main-content">メインコンテンツへ移動</a>
    <div data-app-rail-root>${regions.rail}</div>
    <div data-app-mobile-bar-root>${regions.mobileBar}</div>
    <main id="setae-main-content" class="main app-workspace" tabindex="-1" data-app-main>
      <div data-app-sync-root>${regions.sync}</div>
      <div data-app-error-root>${regions.error}</div>
      <div data-app-page-root>${regions.page}</div>
    </main>
    <div data-app-mobile-navigation-root>${regions.mobileNavigation}</div>
    <div data-app-overlay-root>${regions.overlays}</div>
    <div data-app-feedback-root>${regions.feedback}</div>
    <div data-app-update-root>${regions.updateNotice}</div>
    <div class="visually-hidden" data-app-route-announcer aria-live="polite" aria-atomic="true"></div>
  </div>`;
}
