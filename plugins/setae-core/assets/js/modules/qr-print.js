var SetaeQRPrint = (function () {
    'use strict';

    const MIN_LABEL_LENGTH = 43;
    const MAX_LABEL_LENGTH = 70;
    const TAPE_WIDTH = 12;
    const A4_CONTENT_WIDTH = 194;
    const A4_CONTENT_HEIGHT = 280;

    function normalizeLength(value) {
        return Math.max(MIN_LABEL_LENGTH, Math.min(MAX_LABEL_LENGTH, parseInt(value, 10) || 45));
    }

    function normalizeFormat(value) {
        return value === 'a4' ? 'a4' : 'tape';
    }

    function createQrMatrix(text) {
        const holder = document.createElement('div');
        try {
            const qr = new QRCode(holder, {
                text: String(text || ''),
                width: 256,
                height: 256,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
            const matrix = qr._oQRCode;
            return matrix && typeof matrix.getModuleCount === 'function' ? matrix : null;
        } catch (error) {
            return null;
        }
    }

    function createQrSvg(text) {
        try {
            const matrix = createQrMatrix(text);
            if (!matrix) return '';

            const moduleCount = matrix.getModuleCount();
            const quietZone = 4;
            const viewBoxSize = moduleCount + quietZone * 2;
            let path = '';

            for (let row = 0; row < moduleCount; row++) {
                let runStart = -1;
                for (let column = 0; column <= moduleCount; column++) {
                    const isDark = column < moduleCount && matrix.isDark(row, column);
                    if (isDark && runStart < 0) {
                        runStart = column;
                    } else if (!isDark && runStart >= 0) {
                        const width = column - runStart;
                        path += 'M' + (runStart + quietZone) + ' ' + (row + quietZone) + 'h' + width + 'v1h-' + width + 'z';
                        runStart = -1;
                    }
                }
            }

            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + viewBoxSize + ' ' + viewBoxSize + '" width="10mm" height="10mm" role="img" aria-label="QRコード" shape-rendering="crispEdges">' +
                '<rect width="100%" height="100%" fill="#fff"/>' +
                '<path d="' + path + '" fill="#000"/>' +
                '</svg>';
        } catch (error) {
            return '';
        }
    }

    function buildLabelHtml(item, length, valueFormat) {
        const labelLength = normalizeLength(length);
        const labelFormat = normalizeFormat(valueFormat);
        const qrSvg = createQrSvg(item && item.url);
        if (!qrSvg) return '';

        const shortNameLines = splitLabelText(item && item.short_name ? item.short_name : 'SETAE');
        const fallbackCode = item && item.code ? String(item.code).toUpperCase() : '';
        const manageCodeLines = splitLabelText(item && item.manage_code ? item.manage_code : fallbackCode);
        const dateLines = buildDateLines(item || {});

        return '<div class="setae-qr-strip-label is-' + labelFormat + '-format" style="--setae-label-length:' + labelLength + 'mm">' +
            '<div class="setae-qr-machine-zone">' +
                '<span class="setae-qr-code-image">' + qrSvg + '</span>' +
                '<span class="setae-qr-code-copy">' +
                    '<em>SETAE · LIVING</em>' +
                    '<strong>' + renderLabelLines(shortNameLines) + '</strong>' +
                    '<b>' + renderLabelLines(manageCodeLines) + '</b>' +
                    (dateLines.length ? '<small>' + renderLabelLines(dateLines) + '</small>' : '') +
                '</span>' +
            '</div>' +
            '<div class="setae-qr-hand-zone" aria-label="手書きエリア"><span></span><span></span></div>' +
        '</div>';
    }

    function getA4Layout(length) {
        const labelLength = normalizeLength(length);
        const columns = Math.max(1, Math.floor(A4_CONTENT_WIDTH / labelLength));
        const rows = Math.max(1, Math.floor(A4_CONTENT_HEIGHT / TAPE_WIDTH));
        return {
            columns: columns,
            rows: rows,
            perPage: columns * rows
        };
    }

    function getPageCount(count, length, valueFormat) {
        const total = Math.max(0, parseInt(count, 10) || 0);
        if (!total) return 0;
        if (normalizeFormat(valueFormat) === 'tape') return total;
        return Math.ceil(total / getA4Layout(length).perPage);
    }

    function buildTapePdf(items, length) {
        const sourceItems = Array.isArray(items) ? items : [];
        const labelLength = normalizeLength(length);
        const JsPdf = typeof jspdf !== 'undefined' && jspdf && jspdf.jsPDF ? jspdf.jsPDF : null;
        if (!sourceItems.length) {
            return { blob: null, pageCount: 0, fileName: '', error: '印刷する個体を選択してください' };
        }
        if (!JsPdf) {
            return { blob: null, pageCount: 0, fileName: '', error: 'PDF作成機能を読み込めませんでした' };
        }

        try {
            const pdf = new JsPdf({
                orientation: 'portrait',
                unit: 'mm',
                format: [TAPE_WIDTH, labelLength],
                compress: true,
                putOnlyUsedFonts: true,
                precision: 4
            });

            sourceItems.forEach(function (item, index) {
                if (index) pdf.addPage([TAPE_WIDTH, labelLength], 'portrait');
                drawTapePdfLabel(pdf, item || {}, labelLength);
            });

            return {
                blob: pdf.output('blob'),
                pageCount: sourceItems.length,
                fileName: 'setae-qr-12mm-' + labelLength + 'mm-' + sourceItems.length + 'labels.pdf',
                error: ''
            };
        } catch (error) {
            return {
                blob: null,
                pageCount: 0,
                fileName: '',
                error: error && error.message ? error.message : 'テプラ用PDFを作成できませんでした'
            };
        }
    }

    function drawTapePdfLabel(pdf, item, labelLength) {
        const machinePng = createTapeMachinePng(item);
        if (!machinePng) throw new Error('QRコードを生成できませんでした');

        pdf.addImage(machinePng, 'PNG', 0, 0, TAPE_WIDTH, 18, undefined, 'FAST');

        pdf.setDrawColor(70, 70, 70);
        pdf.setLineWidth(0.18);
        pdf.line(0, 18, TAPE_WIDTH, 18);

        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.14);
        pdf.line(1.3, 19.3, 1.3, labelLength - 1.3);
        pdf.line(6.7, 19.3, 6.7, labelLength - 1.3);
    }

    function createTapeMachinePng(item) {
        const matrix = createQrMatrix(item && item.url);
        if (!matrix) return '';

        const scale = 40;
        const source = document.createElement('canvas');
        const sourceContext = source.getContext('2d');
        if (!sourceContext) return '';

        source.width = 18 * scale;
        source.height = TAPE_WIDTH * scale;
        sourceContext.fillStyle = '#ffffff';
        sourceContext.fillRect(0, 0, source.width, source.height);
        drawQrMatrix(sourceContext, matrix, 0.5 * scale, 1 * scale, 10 * scale);

        const fallbackCode = item && item.code ? String(item.code).toUpperCase() : '';
        const nameLines = splitLabelText(item && item.short_name ? item.short_name : 'SETAE');
        const codeLines = splitLabelText(item && item.manage_code ? item.manage_code : fallbackCode);
        const dateLines = buildDateLines(item || {});
        drawMachineCopy(sourceContext, nameLines, codeLines, dateLines, scale);

        const output = document.createElement('canvas');
        const outputContext = output.getContext('2d');
        if (!outputContext) return '';
        output.width = source.height;
        output.height = source.width;
        outputContext.fillStyle = '#ffffff';
        outputContext.fillRect(0, 0, output.width, output.height);
        outputContext.translate(output.width, 0);
        outputContext.rotate(Math.PI / 2);
        outputContext.drawImage(source, 0, 0);
        return output.toDataURL('image/png');
    }

    function drawQrMatrix(context, matrix, x, y, size) {
        const moduleCount = matrix.getModuleCount();
        const quietZone = 4;
        const totalModules = moduleCount + quietZone * 2;
        const cellSize = Math.max(1, Math.ceil(size / totalModules));
        const actualSize = cellSize * totalModules;
        const offsetX = Math.round(x + (size - actualSize) / 2);
        const offsetY = Math.round(y + (size - actualSize) / 2);

        context.fillStyle = '#ffffff';
        context.fillRect(offsetX, offsetY, actualSize, actualSize);
        context.fillStyle = '#000000';
        for (let row = 0; row < moduleCount; row++) {
            for (let column = 0; column < moduleCount; column++) {
                if (matrix.isDark(row, column)) {
                    context.fillRect(
                        offsetX + (column + quietZone) * cellSize,
                        offsetY + (row + quietZone) * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
    }

    function drawMachineCopy(context, nameLines, codeLines, dateLines, scale) {
        const groups = [
            { lines: nameLines, size: 0.98 * scale, lineHeight: 1.05 * scale, gap: 0.28 * scale },
            { lines: codeLines, size: 1.08 * scale, lineHeight: 1.15 * scale, gap: 0.3 * scale },
            { lines: dateLines, size: 0.7 * scale, lineHeight: 0.78 * scale, gap: 0 }
        ].filter(function (group) { return group.lines.length; });
        const totalHeight = groups.reduce(function (total, group, index) {
            return total + (group.lines.length * group.lineHeight) + (index < groups.length - 1 ? group.gap : 0);
        }, 0);
        const brandHeight = 0.7 * scale;
        let y = Math.max(1.35 * scale, brandHeight + ((TAPE_WIDTH * scale - brandHeight - totalHeight) / 2));
        const x = 11.15 * scale;

        context.fillStyle = '#000000';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.font = '700 ' + Math.round(0.52 * scale) + 'px Arial, Helvetica, sans-serif';
        context.fillText('SETAE · LIVING', x, 0.35 * scale, 6.35 * scale);
        groups.forEach(function (group, groupIndex) {
            context.font = '700 ' + Math.round(group.size) + 'px Arial, Helvetica, sans-serif';
            group.lines.forEach(function (line) {
                context.fillText(toPdfText(line), x, y, 6.55 * scale);
                y += group.lineHeight;
            });
            if (groupIndex < groups.length - 1) y += group.gap;
        });
    }

    function buildDocument(items, length, valueFormat) {
        const sourceItems = Array.isArray(items) ? items : [];
        const labelLength = normalizeLength(length);
        const labelFormat = normalizeFormat(valueFormat);
        const labels = sourceItems.map(function (item) {
            return buildLabelHtml(item, labelLength, labelFormat);
        });

        if (!labels.length || labels.some(function (label) { return !label; })) {
            return { html: '', pageCount: 0, error: 'QRコードを生成できませんでした' };
        }

        const layout = getA4Layout(labelLength);
        let pages = [];
        if (labelFormat === 'tape') {
            pages = labels.map(function (label) {
                return '<section class="setae-qr-tape-page">' + label + '</section>';
            });
        } else {
            pages = chunk(labels, layout.perPage).map(function (pageLabels) {
                return '<section class="setae-qr-a4-page">' + pageLabels.join('') + '</section>';
            });
        }

        const title = labelFormat === 'a4' ? 'SETAE QRラベル A4' : 'SETAE QRラベル 12mm';
        const html = '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>' + title + '</title><style>' + buildPrintCss(labelLength, labelFormat, layout.columns) + '</style>' +
            '</head><body class="is-' + labelFormat + '">' + pages.join('') + '</body></html>';

        return {
            html: html,
            pageCount: pages.length,
            error: ''
        };
    }

    function buildPrintCss(length, valueFormat, columns) {
        // TEPRA drivers use 12mm as media width; a landscape custom size falls back to the 420mm roll length.
        const pageRule = valueFormat === 'a4'
            ? '@page{size:A4 portrait;margin:8mm}'
            : '@page{size:' + TAPE_WIDTH + 'mm ' + length + 'mm;margin:0}';

        return pageRule +
            '*{box-sizing:border-box}' +
            'html,body{margin:0!important;padding:0!important;background:#fff;color:#000}' +
            'body{font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
            '.setae-qr-strip-label{display:grid;grid-template-columns:18mm minmax(25mm,1fr);width:var(--setae-label-length);height:12mm;overflow:hidden;border:0;border-radius:0;background:#fff;color:#000}' +
            '.setae-qr-strip-label.is-a4-format{border:.18mm solid #73777b}' +
            '.setae-qr-machine-zone{display:grid;grid-template-columns:11mm 7mm;align-items:center;min-width:0;border-right:.18mm solid #555}' +
            '.setae-qr-code-image{display:grid;place-items:center;width:11mm;height:12mm;padding:1mm .5mm;background:#fff}' +
            '.setae-qr-code-image svg{display:block;width:10mm;height:10mm}' +
            '.setae-qr-code-copy{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-width:0;height:100%;padding:0 .35mm 0 .15mm}' +
            '.setae-qr-code-copy strong,.setae-qr-code-copy b,.setae-qr-code-copy small{display:flex;flex-direction:column;max-width:6.4mm;margin:0;overflow:hidden;line-height:1.05;letter-spacing:0;white-space:nowrap}' +
            '.setae-qr-code-copy strong span,.setae-qr-code-copy b span,.setae-qr-code-copy small span{display:block;overflow:hidden;text-overflow:clip}' +
            '.setae-qr-code-copy strong{font-size:.98mm;font-weight:800}' +
            '.setae-qr-code-copy b{margin-top:.28mm;font-size:1.08mm;font-weight:900}' +
            '.setae-qr-code-copy small{margin-top:.3mm;font-size:.7mm;font-weight:800}' +
            '.setae-qr-hand-zone{display:grid;grid-template-rows:1fr 1fr;gap:.6mm;min-width:25mm;padding:1.1mm 1.3mm;background:#fff}' +
            '.setae-qr-hand-zone span{display:block;border-bottom:.14mm solid #999}' +
            '.setae-qr-tape-page{position:relative;width:' + TAPE_WIDTH + 'mm;height:' + length + 'mm;margin:0;overflow:hidden;break-after:page;page-break-after:always}' +
            '.setae-qr-tape-page .setae-qr-strip-label{position:absolute;top:0;left:' + TAPE_WIDTH + 'mm;transform:rotate(90deg);transform-origin:0 0}' +
            '.setae-qr-tape-page:last-child{break-after:auto;page-break-after:auto}' +
            '.setae-qr-a4-page{display:grid;grid-template-columns:repeat(' + columns + ',' + length + 'mm);grid-auto-rows:12mm;align-content:start;justify-content:start;gap:0;width:194mm;height:280mm;margin:0;overflow:hidden;break-after:page;page-break-after:always}' +
            '.setae-qr-a4-page:last-child{break-after:auto;page-break-after:auto}' +
            '.setae-qr-a4-page .setae-qr-strip-label{break-inside:avoid;page-break-inside:avoid}' +
            '@media screen{body.is-a4{padding:8mm!important}.setae-qr-a4-page{outline:1px solid #ddd}}';
    }

    function splitLabelText(value) {
        const compact = String(value == null ? '' : value)
            .normalize('NFKC')
            .replace(/[^A-Za-z0-9.-]/g, '')
            .slice(0, 12);
        const lines = [];
        for (let index = 0; index < compact.length; index += 6) {
            lines.push(compact.slice(index, index + 6));
        }
        return lines;
    }

    function buildDateLines(item) {
        const lines = [];
        const managementDate = compactDate(item && item.management_start_date);
        const birthDate = compactDate(item && item.birth_date);
        if (managementDate) lines.push('M' + managementDate);
        if (birthDate) lines.push('H' + birthDate);
        return lines;
    }

    function compactDate(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? match[1].slice(-2) + match[2] + match[3] : '';
    }

    function renderLabelLines(lines) {
        return lines.map(function (line) {
            return '<span>' + escapeHtml(line) + '</span>';
        }).join('');
    }

    function toPdfText(value) {
        return String(value == null ? '' : value).replace(/[^\x20-\x7e]/g, '?');
    }

    function chunk(items, size) {
        const pages = [];
        for (let index = 0; index < items.length; index += size) {
            pages.push(items.slice(index, index + size));
        }
        return pages;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
        });
    }

    return {
        minLabelLength: MIN_LABEL_LENGTH,
        maxLabelLength: MAX_LABEL_LENGTH,
        normalizeLength: normalizeLength,
        createQrSvg: createQrSvg,
        buildLabelHtml: buildLabelHtml,
        getA4Layout: getA4Layout,
        getPageCount: getPageCount,
        buildTapePdf: buildTapePdf,
        buildDocument: buildDocument
    };
})();
