import { renderBrand } from '../components/brand.js';
import {
  button,
  checkboxControl,
  hiddenField,
  textButton,
  textField
} from '../components/primitives.js';
import { escapeHtml, safeHttpUrl } from '../components/ui.js';

const authTitle = (view) => view === 'register'
  ? '新規登録'
  : view === 'reset' ? 'パスワード再設定' : 'ログイン';

function registerForm({ termsUrl, termsVersion, submitting }) {
  const safeTermsUrl = safeHttpUrl(termsUrl || '/terms/');
  const consentHtml = `<a href="${escapeHtml(safeTermsUrl)}" target="_blank" rel="noopener noreferrer">利用規約</a>に同意します`;
  return `<form class="auth-form" data-role="registration-form" data-draft-policy="none">
    ${textField({ label: 'メールアドレス', name: 'email', type: 'email', autocomplete: 'email', required: true, disabled: submitting })}
    ${textField({ label: 'ユーザー名', name: 'username', autocomplete: 'username', disabled: submitting })}
    ${textField({ label: 'パスワード', name: 'password', type: 'password', minLength: 8, autocomplete: 'new-password', required: true, disabled: submitting })}
    ${textField({ label: '紹介コード', name: 'referral_code', disabled: submitting })}
    ${hiddenField('terms_version', termsVersion)}
    ${checkboxControl({ name: 'terms_accepted', value: '1', label: '利用規約に同意します', labelHtml: consentHtml, required: true, disabled: submitting, className: 'checkbox-row auth-consent' })}
    ${button(submitting ? '登録中…' : '無料アカウントを作る', { type: 'submit', primary: true, loading: submitting, disabled: submitting, className: 'auth-submit' })}
  </form>`;
}

function resetForm({ submitting }) {
  return `<form class="auth-form" data-role="password-reset-form" data-draft-policy="none">
    ${textField({ label: 'メールアドレスまたはユーザー名', name: 'login', required: true, disabled: submitting })}
    ${button(submitting ? '送信中…' : '再設定メールを送信', { type: 'submit', primary: true, loading: submitting, disabled: submitting, className: 'auth-submit' })}
  </form>`;
}

function loginForm({ submitting }) {
  return `<form class="auth-form" data-role="login-form" data-draft-policy="none">
    ${textField({ label: 'メールアドレスまたはユーザー名', name: 'login', id: 'login-name', autocomplete: 'username', required: true, disabled: submitting })}
    ${textField({ label: 'パスワード', name: 'password', id: 'login-password', type: 'password', autocomplete: 'current-password', required: true, disabled: submitting })}
    ${checkboxControl({ name: 'remember', value: 'on', label: 'ログイン状態を保持する', checked: true, disabled: submitting, className: 'checkbox-row auth-remember' })}
    ${button(submitting ? 'ログイン中…' : 'ログイン', { type: 'submit', primary: true, loading: submitting, disabled: submitting, className: 'auth-submit' })}
  </form>`;
}

function authLinks({ view, registrationEnabled, mockEnabled }) {
  const accountLinks = view !== 'login'
    ? textButton('ログインへ戻る', { action: 'auth-view', data: { 'auth-view': 'login' } })
    : `${textButton('パスワードを再設定', { action: 'auth-view', data: { 'auth-view': 'reset' } })}${registrationEnabled ? textButton('新規登録', { action: 'auth-view', data: { 'auth-view': 'register' } }) : ''}`;
  return `<div class="auth-links">${accountLinks}${textButton('ログインせず相談・図鑑を見る', { action: 'browse-public' })}${mockEnabled ? textButton('モックで画面を見る', { action: 'use-mock' }) : ''}</div>`;
}

export function renderAuthPage({
  view = 'login',
  registrationEnabled = true,
  termsUrl = '/terms/',
  termsVersion = '',
  submitting = false,
  error = '',
  message = '',
  mockEnabled = false
} = {}) {
  const resolvedView = ['login', 'register', 'reset'].includes(view) ? view : 'login';
  const form = resolvedView === 'register'
    ? registerForm({ termsUrl, termsVersion, submitting })
    : resolvedView === 'reset' ? resetForm({ submitting }) : loginForm({ submitting });
  return `<main class="auth-layout"><section class="auth-panel" aria-labelledby="auth-title">
    ${renderBrand({ className: 'auth-brand', size: 'prominent' })}
    <div class="auth-heading"><div class="eyebrow">LIVING COLLECTION</div><h1 id="auth-title">${authTitle(resolvedView)}</h1></div>
    ${error ? `<div class="inline-error" role="alert">${escapeHtml(error)}</div>` : ''}
    ${message ? `<div class="success-banner" role="status">${escapeHtml(message)}</div>` : ''}
    ${form}
    ${authLinks({ view: resolvedView, registrationEnabled, mockEnabled })}
  </section></main>`;
}

export function renderConnectionErrorPage({ error = '', mockEnabled = false } = {}) {
  return `<main class="auth-layout connection-screen"><section class="auth-panel" aria-labelledby="connection-title">
    ${renderBrand({ className: 'auth-brand', size: 'prominent' })}
    <div class="auth-heading"><div class="eyebrow">接続</div><h1 id="connection-title">APIに接続できません</h1></div>
    <div class="error-banner connection-error" role="alert">${escapeHtml(error)}</div>
    <div class="auth-actions">${button('再接続', { action: 'retry-connection', primary: true })}${mockEnabled ? button('モックで画面を見る', { action: 'use-mock' }) : ''}</div>
  </section></main>`;
}

export function renderBootPage() {
  return `<main class="boot-screen" aria-busy="true" aria-live="polite">${renderBrand({ className: 'boot-brand', size: 'prominent' })}<div class="boot-status"><div class="spinner" aria-hidden="true"></div><span>コレクションを準備しています</span></div></main>`;
}
