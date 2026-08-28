const blockedKey = /(?:token|cookie|nonce|email|user(?:name|_?id)?|animal|specimen|payload|offlineQueue|imageUrl)/i;

export function sanitizeDiagnosticData(value) {
  if (Array.isArray(value)) return value.map(sanitizeDiagnosticData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !blockedKey.test(key))
    .map(([key, item]) => [key, sanitizeDiagnosticData(item)]));
}

export function diagnosticJson(data) {
  return `${JSON.stringify(sanitizeDiagnosticData(data || {}), null, 2)}\n`;
}

export async function copyDiagnosticJson(data, { navigatorRef = navigator, documentRef = document } = {}) {
  const text = diagnosticJson(data);
  if (navigatorRef.clipboard?.writeText) {
    await navigatorRef.clipboard.writeText(text);
    return true;
  }
  const field = documentRef.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  documentRef.body.appendChild(field);
  field.select();
  const copied = documentRef.execCommand?.('copy') === true;
  field.remove();
  return copied;
}

export function downloadDiagnosticJson(data, { documentRef = document, urlRef = URL } = {}) {
  const blob = new Blob([diagnosticJson(data)], { type: 'application/json;charset=utf-8' });
  const href = urlRef.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = href;
  link.download = `setae-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  urlRef.revokeObjectURL(href);
  return true;
}
