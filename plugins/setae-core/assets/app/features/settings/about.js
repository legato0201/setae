import { button, iconButton, linkButton, modal } from '../../components/primitives.js';
import { escapeHtml } from '../../components/ui.js';
import { renderBrand } from '../../components/brand.js';

const openSourceItems = [
  ['Lucide Icons', 'ISC License / Feather-derived icons MIT'],
  ['jsQR 1.4.0', 'Apache License 2.0'],
  ['QRCode.js', 'MIT License'],
  ['Chart.js', 'MIT License'],
  ['jsPDF', 'MIT License'],
  ['PHP dependencies', 'MIT licensed packages']
];

function noticeRows(items) {
  return `<div class="compact-list about-notice-list">${items.map(([name, license]) => `<div class="compact-list-row"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(license)}</span></div></div>`).join('')}</div>`;
}

export function renderAppInformation({ version = '', termsUrl = '', privacyUrl = '' } = {}) {
  return `<div class="settings-columns app-information">
    <section class="settings-section"><div class="app-information-identity">${renderBrand({ size: 'prominent' })}<p>Version ${escapeHtml(version || '—')}</p></div><p class="settings-copy">© 2026 中野かえる商店</p><div class="inline-actions">${linkButton('利用規約', { href: termsUrl, external: true, iconName: 'externalLink' })}${linkButton('プライバシーポリシー', { href: privacyUrl, external: true, iconName: 'externalLink' })}</div></section>
    <section class="settings-section"><div class="section-header"><div><div class="section-title">権利表示</div><div class="secondary">SETAEを構成するソフトウェアとコンテンツ</div></div></div><div class="app-information-links">${button('オープンソースライセンス', { action: 'open-license-notices', iconName: 'chevronRight' })}${button('画像・コンテンツのクレジットについて', { action: 'open-content-credits', iconName: 'chevronRight' })}</div></section>
  </div>`;
}

export function renderAboutDialog(dialogState = {}) {
  const licenses = dialogState.type === 'license-notices';
  const title = licenses ? 'オープンソースライセンス' : '画像・コンテンツのクレジット';
  const content = licenses
    ? `<p>SETAEは以下のオープンソースソフトウェアを利用しています。完全な著作権表示とライセンス本文は配布物の <code>THIRD_PARTY_NOTICES.md</code> と <code>licenses/</code> に収録しています。</p>${noticeRows(openSourceItems)}`
    : `<div class="about-credit-copy"><p>図鑑写真の作者、出典、ライセンス、変更内容は、各画像と直接結び付いた位置に表示します。</p><p>利用者が投稿した写真と文章の権利は、それぞれの投稿者および適用される利用条件に従います。SETAEのUIアイコンと外部ソフトウェアについては、オープンソースライセンス画面をご確認ください。</p></div>`;

  const headingId = 'about-dialog-title';
  return modal(`<header class="modal-header"><div><span class="dialog-meta">APPLICATION INFORMATION</span><h2 id="${headingId}">${escapeHtml(title)}</h2></div>${iconButton('close', { action: 'close-modal', label: '閉じる' })}</header><div class="modal-body about-dialog-body">${content}</div>`, {
    className: 'about-dialog',
    labelledBy: headingId,
    backdropAction: 'close-modal'
  });
}
