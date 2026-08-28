import { button, dataRow, statusIndicator } from '../../components/primitives.js';
import { escapeHtml } from '../../components/ui.js';

const value = (item, fallback = '—') => item === null || item === undefined || item === '' ? fallback : String(item);

export function renderDiagnosticsPanel({ enabled = false, loading = false, data = null, error = '' } = {}) {
  if (!enabled) return '';
  const rows = data ? `<div class="diagnostics-summary">
    ${dataRow('表示モード', value(data.pwa?.mode))}
    ${dataRow('Viewport', `${value(data.viewport?.innerWidth)} × ${value(data.viewport?.innerHeight)}`)}
    ${dataRow('Visual viewport', `${value(data.viewport?.visualWidth)} × ${value(data.viewport?.visualHeight)}`)}
    ${dataRow('Safe area', ['top', 'right', 'bottom', 'left'].map((side) => value(data.viewport?.safeArea?.[side], '0')).join(' / '))}
    ${dataRow('Software keyboard', data.viewport?.keyboardOpen ? `OPEN · ${value(data.viewport?.keyboardInset, '0')}px` : 'CLOSED')}
    ${dataRow('Service Worker', data.serviceWorker?.controlled ? 'CONTROLLED' : 'NOT CONTROLLED')}
    ${dataRow('Camera', `${data.camera?.getUserMedia ? 'AVAILABLE' : 'UNAVAILABLE'} · ${value(data.camera?.permission, 'unknown')}`)}
    ${dataRow('Document width', `${value(data.viewport?.documentScrollWidth)}px`)}
  </div>` : '<p class="settings-copy">この端末のViewport、PWA、Service Worker、Camera、日付入力の状態を取得します。</p>';
  return `<section class="settings-section diagnostics-panel" aria-labelledby="diagnostics-title">
    <header class="settings-section-header"><div><h2 id="diagnostics-title">診断情報</h2><p>管理者向けQA情報。個人情報や飼育データは含みません。</p></div>${data ? statusIndicator('取得済み', { tone: 'success' }) : ''}</header>
    ${rows}
    ${error ? `<div class="inline-error" role="alert">${escapeHtml(error)}</div>` : ''}
    <div class="settings-form-actions settings-actions-start">
      ${button(loading ? '取得中…' : data ? '再取得' : '診断情報を取得', { action: 'refresh-diagnostics', loading, disabled: loading, primary: !data })}
      ${button('診断情報をコピー', { action: 'copy-diagnostics', iconName: 'copy', disabled: !data || loading })}
      ${button('JSONを保存', { action: 'download-diagnostics', iconName: 'download', disabled: !data || loading })}
    </div>
  </section>`;
}
