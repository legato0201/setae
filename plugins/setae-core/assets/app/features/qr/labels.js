import { labelConfigValidation, labelDimensions, normalizeLabelConfig } from './state.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[character]);

const compactScientificName = (value) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || 'Species undetermined';
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
};

const specimenId = (item) => item?.manage_code || item?.label || item?.title || item?.name || String(item?.code || '').toUpperCase();
const scientificName = (item) => item?.species_name || item?.scientific_name || item?.short_name || '';

export function createQrSvg(text) {
  if (typeof document === 'undefined' || typeof globalThis.QRCode !== 'function') return '';
  const holder = document.createElement('div');
  try {
    const qr = new globalThis.QRCode(holder, {
      text: String(text || ''), width: 256, height: 256,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: globalThis.QRCode.CorrectLevel.M
    });
    const matrix = qr._oQRCode;
    if (!matrix || typeof matrix.getModuleCount !== 'function') return '';
    const count = matrix.getModuleCount();
    const quiet = 4;
    let path = '';
    for (let row = 0; row < count; row += 1) {
      let start = -1;
      for (let column = 0; column <= count; column += 1) {
        const dark = column < count && matrix.isDark(row, column);
        if (dark && start < 0) start = column;
        if (!dark && start >= 0) {
          const width = column - start;
          path += `M${start + quiet} ${row + quiet}h${width}v1h-${width}z`;
          start = -1;
        }
      }
    }
    const size = count + quiet * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QRコード" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  } catch {
    return '';
  }
}

export function renderFieldLabel(item, config = {}, options = {}) {
  const normalized = normalizeLabelConfig(config);
  const dimensions = labelDimensions(normalized);
  const id = specimenId(item);
  const microId = normalized.format === 'micro-id';
  const species = scientificName(item);
  const shortName = compactScientificName(species);
  const stage = item?.instar ? `I${item.instar}` : item?.stage || '';
  const sex = ({ female: '♀', male: '♂', unknown: '♀?' })[item?.gender || item?.sex] || '';
  const qrSvg = options.qrSvg ?? createQrSvg(item?.url || item?.qr_url || item?.permanent_url || '');
  const idLengthClass = id.length <= 5 ? 'id-short' : id.length <= 8 ? 'id-medium' : 'id-long';
  const showNotes = normalized.output === 'tape' || normalized.handwriting !== 'none';
  const style = `--label-width:${dimensions.width}mm;--label-height:${dimensions.height}mm`;
  const classes = [
    'field-label',
    `output-${normalized.output}`,
    `size-${normalized.a4Size}`,
    `format-${normalized.format}`,
    `handwriting-${normalized.handwriting}`,
    idLengthClass,
    normalized.outerBorder ? 'has-border' : '',
    normalized.output === 'a4' && normalized.cropMarks ? 'has-crop-marks' : '',
    normalized.guideLine ? 'has-guide-line' : ''
  ].filter(Boolean).join(' ');

  return `<article class="${classes}" style="${style}" data-field-label>
    <div class="field-label-digital">
      ${microId || normalized.showQr ? `<span class="field-label-qr" data-qr-svg-url="${escapeHtml(item?.url || item?.qr_url || item?.permanent_url || '')}">${qrSvg || '<i>QR</i>'}</span>` : ''}
      <span class="field-label-identity">
        ${microId || normalized.showSpecimenId ? `<strong>${escapeHtml(id)}</strong>` : ''}
        ${!microId && normalized.showScientificName ? `<b>${escapeHtml(shortName)}</b>` : ''}
        ${!microId && normalized.showStageSex && (stage || sex) ? `<small>${escapeHtml([stage, sex].filter(Boolean).join(' · '))}</small>` : ''}
      </span>
    </div>
    ${showNotes ? '<div class="field-label-notes" aria-label="手書きメモ欄"></div>' : ''}
  </article>`;
}

export function hydrateQrCodes(root = document) {
  root.querySelectorAll('[data-qr-svg-url]').forEach((holder) => {
    const url = holder.dataset.qrSvgUrl || '';
    if (!url || holder.querySelector('svg')) return;
    const svg = createQrSvg(url);
    if (svg) holder.innerHTML = svg;
  });
}

export function buildLabelPrintDocument(items, config = {}) {
  const normalized = normalizeLabelConfig(config);
  const validationError = labelConfigValidation(normalized);
  if (validationError) return { html: '', count: 0, error: validationError };
  const dimensions = labelDimensions(normalized);
  const labels = (items || []).map((item) => renderFieldLabel(item, normalized)).join('');
  if (!labels) return { html: '', count: 0, error: '印刷するラベルを選択してください。' };
  if (labels.includes('<i>QR</i>') && (normalized.format === 'micro-id' || normalized.showQr)) return { html: '', count: 0, error: 'QRコードを生成できませんでした。' };

  const pageRule = normalized.output === 'a4'
    ? '@page{size:A4 portrait;margin:7.5mm}'
    : `@page{size:${dimensions.width}mm ${dimensions.height}mm;margin:0}`;
  const body = normalized.output === 'a4'
    ? `<main class="label-print-a4" style="--print-columns:${dimensions.columns};--label-width:${dimensions.width}mm;--label-height:${dimensions.height}mm">${labels}</main>`
    : (items || []).map((item) => `<section class="label-print-tape">${renderFieldLabel(item, normalized)}</section>`).join('');
  const css = `${pageRule}
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#050505;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .label-print-a4{display:grid;grid-template-columns:repeat(var(--print-columns),var(--label-width));grid-auto-rows:var(--label-height);align-content:start;justify-content:center;width:195mm;min-height:282mm;margin:0 auto}
    .label-print-tape{width:${dimensions.width}mm;height:${dimensions.height}mm;break-after:page;page-break-after:always}.label-print-tape:last-child{break-after:auto;page-break-after:auto}
    .field-label{position:relative;display:grid;grid-template-columns:minmax(0,40%) minmax(0,60%);width:var(--label-width);height:var(--label-height);overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid}
    .field-label.output-a4.handwriting-medium{grid-template-columns:minmax(0,52%) minmax(0,48%)}.field-label.output-a4.handwriting-none{grid-template-columns:1fr}.field-label.output-a4.format-compact{grid-template-columns:minmax(0,52%) minmax(0,48%)}
    .field-label.has-border{box-shadow:inset 0 0 0 .18mm #555}.field-label.has-crop-marks:before,.field-label.has-crop-marks:after{content:"";position:absolute;z-index:3;width:2mm;height:2mm;border-color:#111}.field-label.has-crop-marks:before{top:0;left:0;border-top:.15mm solid;border-left:.15mm solid}.field-label.has-crop-marks:after{right:0;bottom:0;border-right:.15mm solid;border-bottom:.15mm solid}
    .field-label-digital{display:grid;grid-template-columns:minmax(8mm,36%) minmax(0,64%);align-items:center;gap:1mm;min-width:0;padding:1.4mm;border-right:.15mm dashed #888}.field-label-qr{display:grid;place-items:center;aspect-ratio:1;background:#fff}.field-label-qr svg{display:block;width:100%;height:100%}.field-label-identity{display:flex;min-width:0;flex-direction:column;gap:.8mm}.field-label-identity strong{overflow:hidden;font-size:3.2mm;line-height:1;white-space:nowrap}.field-label-identity b{overflow:hidden;font-family:Georgia,serif;font-size:2.1mm;font-weight:400;line-height:1.05;white-space:nowrap}.field-label-identity small{font-size:1.65mm;font-weight:700;white-space:nowrap}
    .field-label-notes{position:relative;min-width:0;padding:1.5mm 1.7mm}.field-label.has-guide-line .field-label-notes:after{content:"";position:absolute;top:50%;right:1mm;left:1mm;border-top:.1mm solid #c4c4c4;transform:translateY(-50%)}
    .field-label.output-tape.format-field{--digital-width:34mm}.field-label.output-tape.format-compact{--digital-width:28mm}.field-label.output-tape.format-micro-id{--digital-width:15.6mm}
    .field-label.output-tape{grid-template-columns:var(--digital-width) minmax(0,1fr)}.field-label.output-tape .field-label-digital{grid-template-columns:9mm minmax(0,1fr);height:100%;gap:.6mm;padding:.8mm;border-right:.15mm dashed #888}.field-label.output-tape .field-label-identity{gap:.35mm}.field-label.output-tape .field-label-identity strong{font-size:2.2mm}.field-label.output-tape .field-label-identity b{font-size:1.55mm}.field-label.output-tape .field-label-identity small{font-size:1.2mm}.field-label.output-tape .field-label-identity strong,.field-label.output-tape .field-label-identity b,.field-label.output-tape .field-label-identity small{overflow:visible;text-overflow:clip}.field-label.output-tape .field-label-notes{padding:.8mm 1mm}
    .field-label.output-a4.format-micro-id .field-label-digital{grid-template-columns:10.4mm minmax(3.6mm,1fr)}.field-label.format-micro-id .field-label-qr{width:10.4mm;height:10.4mm;min-width:10.4mm;overflow:visible}.field-label.format-micro-id .field-label-identity{display:grid;place-items:center;position:relative;height:100%;overflow:visible}.field-label.format-micro-id .field-label-identity strong{position:relative;left:-1mm;max-width:none;overflow:visible;font-family:Arial,Helvetica,sans-serif;font-size:2.4mm;line-height:1;text-overflow:clip;transform:rotate(-90deg);transform-origin:center;white-space:nowrap}.field-label.format-micro-id.id-medium .field-label-identity strong{font-size:2mm}.field-label.format-micro-id.id-long .field-label-identity strong{font-size:1.6mm}
    .field-label.output-tape.format-micro-id .field-label-digital{grid-template-columns:10.4mm 3mm;align-items:center;width:auto;height:100%;gap:.4mm;padding:.8mm .85mm .8mm .8mm;border-right:.15mm dashed #888}.field-label.output-tape.format-micro-id .field-label-identity{width:3mm;height:10.4mm}
    @media screen{body{padding:12px}.label-print-a4{outline:1px solid #ddd}}`;
  return {
    html: `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>SETAE Field Labels</title><style>${css}</style></head><body>${body}</body></html>`,
    count: items.length,
    error: ''
  };
}

export function buildPrintCalibrationDocument({ type = 'a4', version = '' } = {}) {
  const calibrationType = type === 'tape' ? 'tape' : 'a4';
  const generatedAt = new Date().toLocaleString('ja-JP');
  const qrSvg = createQrSvg('https://setae.net/print-calibration/');
  if (!qrSvg) return { html: '', type: calibrationType, error: '校正用QRコードを生成できませんでした。' };

  const common = `
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#050505;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    h1,p{margin:0}main{background:#fff}.calibration-note{font-size:3.2mm;line-height:1.45}.calibration-meta{display:flex;gap:8mm;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:2.6mm}.calibration-mark{position:relative}.calibration-label{font-size:2.5mm;font-weight:700;line-height:1.2}
    @media screen{body{padding:12px;background:#ecece8}main{margin-inline:auto;box-shadow:0 2px 12px #0002}}`;

  if (calibrationType === 'a4') {
    const css = `@page{size:A4 portrait;margin:12mm}${common}
      .print-calibration-a4{width:186mm;min-height:273mm;padding:0}
      .calibration-header{display:grid;gap:2mm;padding-bottom:8mm;border-bottom:.2mm solid #111}.calibration-header h1{font-size:5mm;letter-spacing:0}
      .calibration-grid{display:grid;grid-template-columns:110mm 1fr;gap:12mm;padding-top:12mm}
      .calibration-tests{display:grid;gap:12mm}.calibration-horizontal{width:50mm;border-top:.3mm solid #000;padding-top:2mm}.calibration-vertical{height:50mm;border-left:.3mm solid #000;padding-left:2mm}
      .calibration-ruler{display:grid;grid-template-columns:repeat(10,10mm);width:100mm;height:8mm;border-bottom:.3mm solid #000;background:repeating-linear-gradient(90deg,#000 0 .2mm,transparent .2mm 10mm)}
      .calibration-ruler span{padding-top:3mm;font:2mm/1 ui-monospace,SFMono-Regular,Menlo,monospace}.calibration-square{width:20mm;height:20mm;border:.3mm solid #000}.calibration-qr{display:grid;width:25mm;height:25mm}.calibration-qr svg{display:block;width:25mm;height:25mm}
      .calibration-sidebar{display:grid;align-content:start;gap:5mm;padding:6mm;border:.2mm solid #666}.calibration-tolerance{font-size:2.6mm;line-height:1.5}`;
    const body = `<main class="print-calibration-a4">
      <header class="calibration-header"><h1>SETAE A4 PRINT CALIBRATION</h1><p class="calibration-note">印刷設定は「実際のサイズ」または「100%」を使用してください。<br>「用紙に合わせる」は使用しないでください。</p><div class="calibration-meta"><span>${escapeHtml(generatedAt)}</span><span>SETAE ${escapeHtml(version || '—')}</span></div></header>
      <div class="calibration-grid"><div class="calibration-tests">
        <div class="calibration-mark calibration-horizontal"><span class="calibration-label">50 mm HORIZONTAL</span></div>
        <div class="calibration-mark calibration-vertical"><span class="calibration-label">50 mm VERTICAL</span></div>
        <div><div class="calibration-ruler">${Array.from({ length: 10 }, (_, index) => `<span>${index * 10}</span>`).join('')}</div><span class="calibration-label">10 mm SCALE</span></div>
        <div><div class="calibration-square"></div><span class="calibration-label">20 × 20 mm</span></div>
      </div><aside class="calibration-sidebar"><div class="calibration-qr">${qrSvg}</div><strong class="calibration-label">25 × 25 mm QR</strong><p class="calibration-tolerance">基準線の許容差：±0.5 mm または ±1%。印刷後、定規で実測して記録してください。</p></aside></div>
    </main>`;
    return { html: `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>SETAE A4 Print Calibration</title><style>${css}</style></head><body>${body}</body></html>`, type: calibrationType, error: '' };
  }

  const lengths = [18, 24, 36, 50, 70];
  const pageRules = lengths.map((length) => `@page tape-${length}{size:${length}mm 12mm;margin:0}`).join('');
  const css = `${pageRules}${common}
    .print-calibration-tape{width:70mm}.tape-calibration-strip{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;width:var(--tape-length);height:12mm;padding:.8mm;border:.2mm solid #000;page:var(--tape-page);break-after:page;page-break-after:always;overflow:hidden}.tape-calibration-strip:last-child{break-after:auto;page-break-after:auto}
    .tape-calibration-strip strong{font:700 2.3mm/1 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.tape-calibration-strip span{font-size:1.8mm;white-space:nowrap}.tape-micro{grid-column:1/-1;display:grid;grid-template-columns:10.4mm 1.6mm 1.8mm;align-items:center;gap:.3mm}.tape-micro .calibration-qr,.tape-micro .calibration-qr svg{width:10.4mm;height:10.4mm}.tape-micro b,.tape-micro strong{align-self:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1;writing-mode:vertical-rl;transform:rotate(180deg)}.tape-micro b{font-size:1mm}.tape-micro strong{font-size:1.1mm}
    @media screen{.tape-calibration-strip{margin-bottom:8px}}`;
  const strips = lengths.map((length, index) => `<section class="tape-calibration-strip" style="--tape-length:${length}mm;--tape-page:tape-${length}">${index === 0 ? `<div class="tape-micro"><div class="calibration-qr">${qrSvg}</div><b>MICRO ID</b><strong>${length} × 12 mm</strong></div>` : `<span>${length < 36 ? 'CAL' : length < 50 ? 'SETAE' : 'SETAE CALIBRATION'}</span><strong>${length} × 12 mm</strong>`}</section>`).join('');
  const body = `<main class="print-calibration-tape">${strips}</main>`;
  return { html: `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>SETAE 12 mm Tape Calibration</title><style>${css}</style></head><body>${body}</body></html>`, type: calibrationType, error: '' };
}

function openPrintDocument(output, title) {
  if (!output?.html) return output;
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0';
  frame.addEventListener('load', () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      printWindow.focus();
      printWindow.print();
    }));
  }, { once: true });
  frame.srcdoc = output.html;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 120000);
  return output;
}

export function printCalibration(type, version = '') {
  return openPrintDocument(buildPrintCalibrationDocument({ type, version }), '印刷サイズ校正');
}

export function printLabels(items, config) {
  const output = buildLabelPrintDocument(items, config);
  return openPrintDocument(output, 'Field Label印刷');
}
