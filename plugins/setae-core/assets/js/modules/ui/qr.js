var SetaeUIQR = (function ($) {
    'use strict';

    const MAX_LABELS = 100;
    const MAX_DRAFT_RECORDS = 20;
    const MAX_BATCH_ENTRIES = 500;
    const RECORD_TYPE_LABELS = { feed: '給餌', molt: '脱皮', pairing: 'ペアリング', observation: 'メモ' };
    const QR_ICON_SVG = '<svg class="setae-qr-empty-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect width="5" height="5" x="3" y="3" rx="1"></rect><rect width="5" height="5" x="16" y="3" rx="1"></rect><rect width="5" height="5" x="3" y="16" rx="1"></rect>' +
        '<path d="M21 16h-3a2 2 0 0 0-2 2v3"></path><path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path>' +
        '<path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path><path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path></svg>';
    let source = { type: 'spider', title: 'マイ個体', items: [], group: null };
    let selectedKeys = new Set();
    let labelItems = [];
    let previewIndex = 0;
    let format = 'tape';
    let selectionTimer = null;
    let selectionVersion = 0;
    let cameraStream = null;
    let scanFrame = null;
    let scanBusy = false;
    let barcodeDetector = null;
    let scanQueue = new Map();
    let recordDrafts = [];
    let editingDraftId = '';
    let recordSaving = false;
    let closeRequestPending = false;
    let modalOpen = false;
    let lastDecoded = { code: '', at: 0 };
    let transferOverview = null;
    let lastTrigger = null;
    let printBusy = false;
    let activePrintFrame = null;
    let printCleanupTimer = null;
    let previewResizeTimer = null;

    function init() {
        bindEvents();
        updatePrintGuidance();
        $('#setae-qr-record-date').val(today());
        selectRecordType('feed');
        renderScanQueue();
        renderRecordDrafts();
        refreshTransfers({ announce: true });

        let deepCode = '';
        try {
            deepCode = new URLSearchParams(window.location.search).get('setae_qr_scan') || '';
        } catch (error) {}
        if (deepCode) {
            try {
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('setae_qr_scan');
                window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
            } catch (error) {}
            window.setTimeout(function () {
                openModal('scanner');
                resolveAndQueue(deepCode);
            }, 350);
        }
    }

    function bindEvents() {
        $(document).on('click', '#btn-qr-manager', function () {
            openForSpiders(getActiveSpiders());
        });
        $(document).on('click', '.setae-qr-close', function (event) {
            event.preventDefault();
            requestCloseModal();
        });
        $(document).on('click', '.setae-qr-dialog', function (event) {
            event.stopPropagation();
        });
        $(document).on('keydown.setaeQr', function (event) {
            if (!modalOpen || $('.setae-ux-dialog.is-open').length) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                requestCloseModal();
                return;
            }
            if (event.key === 'Tab') trapDialogFocus(event);
        });
        $(document).on('click', '.setae-qr-tab', function () {
            activatePanel($(this).data('qr-panel'));
        });
        $(document).on('input', '#setae-qr-target-search', renderTargetList);
        $(document).on('change', '.setae-qr-target-check', handleTargetCheck);
        $(document).on('click', '#setae-qr-select-all', toggleSelectAll);
        $(document).on('click', '[data-qr-format]', function () {
            format = $(this).data('qr-format') === 'a4' ? 'a4' : 'tape';
            $('[data-qr-format]').removeClass('is-active');
            $(this).addClass('is-active');
            $('#setae-qr-label-length').prop('disabled', false);
            updatePrintGuidance();
            renderPreview();
        });
        $(document).on('input', '#setae-qr-label-length', function () {
            $('#setae-qr-label-length-value').text($(this).val() + 'mm');
            renderPreview();
        });
        $(document).on('click', '#setae-qr-preview-prev', function () {
            changePreview(-1);
        });
        $(document).on('click', '#setae-qr-preview-next', function () {
            changePreview(1);
        });
        $(document).on('click', '#setae-qr-copy-url', copyCurrentUrl);
        $(document).on('click', '#setae-qr-print', printLabels);
        $(document).on('click', '#setae-qr-camera-toggle', toggleCamera);
        $(document).on('change', '#setae-qr-image-input', decodeImageFile);
        $(document).on('click', '.js-qr-queue-remove', function () {
            scanQueue.delete(String($(this).data('code') || ''));
            renderScanQueue();
        });
        $(document).on('click', '#setae-qr-queue-clear', function () {
            scanQueue.clear();
            renderScanQueue();
        });
        $(document).on('click', '[data-qr-record-type]', function () {
            selectRecordType($(this).data('qr-record-type'));
        });
        $(document).on('submit', '#setae-qr-record-form', addRecordDraft);
        $(document).on('click', '#setae-qr-record-submit', saveScannedRecords);
        $(document).on('click', '.js-qr-record-edit', function () {
            editRecordDraft(String($(this).data('draft-id') || ''));
        });
        $(document).on('click', '.js-qr-record-remove', function () {
            removeRecordDraft(String($(this).data('draft-id') || ''));
        });
        $(document).on('click', '#setae-qr-record-edit-cancel', resetRecordComposer);
        $(document).on('click', '#setae-qr-record-clear', clearRecordDrafts);
        $(document).on('click', '.js-qr-transfer-response', handleTransferResponse);
        $(document).on('click', '.js-qr-detail-print', function () {
            const spider = findSpider($(this).data('id'));
            if (spider) openForSpiders([spider], [String(spider.id)]);
        });
        $(document).on('click', '.js-qr-detail-copy', function () {
            copyText($(this).data('url') || '', '短縮URLをコピーしました');
        });
        $(document).on('change', '.js-qr-setting-toggle', saveDetailSettings);
        $(window).on('resize.setaeQr', function () {
            if (previewResizeTimer) window.clearTimeout(previewResizeTimer);
            previewResizeTimer = window.setTimeout(fitPreviewLabel, 80);
        });
    }

    function getActiveSpiders() {
        const spiders = SetaeCore && SetaeCore.state && Array.isArray(SetaeCore.state.cachedSpiders)
            ? SetaeCore.state.cachedSpiders
            : [];
        return spiders.filter(function (spider) { return spider && !spider.archived; });
    }

    function openForSpiders(spiders, preselectedIds) {
        const items = (Array.isArray(spiders) ? spiders : []).filter(Boolean).map(function (spider) {
            return {
                key: String(spider.id),
                id: spider.id,
                title: spider.title || '個体',
                species_name: spider.species_name || '種類未設定',
                image: spider.thumb || '',
                status: spider.status || 'normal',
                manage_code: '',
                original: spider
            };
        });
        source = { type: 'spider', title: 'マイ個体', items: items, group: null };
        selectedKeys = new Set((preselectedIds || []).map(String));
        openModal('labels');
        resetLabelWorkspace();
        renderTargetList();
        syncSelection();
    }

    function openForBabies(group, babies, preselectedCodes) {
        if (!group) return;
        const items = (Array.isArray(babies) ? babies : []).filter(function (baby) {
            return baby && baby.code && baby.status !== 'dead' && baby.status !== 'rehomed' && baby.status !== 'transferred';
        }).map(function (baby) {
            return {
                key: String(baby.code),
                id: baby.code,
                title: baby.code,
                species_name: group.species_name || group.name || 'ベビー',
                image: group.species_image || '',
                status: baby.status || 'alive',
                manage_code: baby.code,
                original: baby
            };
        });
        source = { type: 'baby', title: group.name || 'ベビー群', items: items, group: group };
        const requested = (preselectedCodes || []).map(String).filter(function (code) {
            return items.some(function (item) { return item.key === code; });
        });
        const defaults = requested.length ? requested : items.slice(0, MAX_LABELS).map(function (item) { return item.key; });
        selectedKeys = new Set(defaults);
        openModal('labels');
        resetLabelWorkspace();
        renderTargetList();
        syncSelection();
    }

    function openModal(panel) {
        if (!modalOpen) lastTrigger = document.activeElement;
        modalOpen = true;
        $('#setae-qr-modal').css('display', 'flex').attr('aria-hidden', 'false');
        $('body').addClass('setae-qr-modal-open');
        activatePanel(panel || 'labels');
        window.setTimeout(function () { $('.setae-qr-close').trigger('focus'); }, 30);
    }

    function requestCloseModal() {
        if (closeRequestPending || recordSaving) return;
        const pendingTargets = scanQueue.size;
        const pendingRecords = recordDrafts.length;
        if (!pendingTargets && !pendingRecords) {
            closeModal(false);
            return;
        }

        closeRequestPending = true;
        const confirmClose = SetaeCore && typeof SetaeCore.confirmAction === 'function'
            ? SetaeCore.confirmAction({
                title: '未保存の入力があります',
                message: '読み取り済みの個体と保存リストを破棄してQR管理を閉じますか？',
                details: [pendingTargets ? pendingTargets + '個体を読み取り済み' : '', pendingRecords ? pendingRecords + '件の記録が未保存' : ''],
                confirmLabel: '破棄して閉じる',
                cancelLabel: '入力を続ける',
                tone: 'danger'
            })
            : Promise.resolve(window.confirm('未保存の入力を破棄して閉じますか？'));

        confirmClose.then(function (confirmed) {
            closeRequestPending = false;
            if (confirmed) closeModal(true);
        }).catch(function () {
            closeRequestPending = false;
        });
    }

    function closeModal(discardScannerSession) {
        stopCamera();
        modalOpen = false;
        $('#setae-qr-modal').hide().attr('aria-hidden', 'true');
        $('body').removeClass('setae-qr-modal-open');
        if (discardScannerSession) resetScannerSession();
        if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    }

    function trapDialogFocus(event) {
        const dialog = document.querySelector('#setae-qr-modal .setae-qr-dialog');
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(function (element) {
            return !element.hidden && element.offsetParent !== null;
        });
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function resetScannerSession() {
        scanQueue.clear();
        recordDrafts = [];
        editingDraftId = '';
        resetRecordComposer();
        renderScanQueue();
        renderRecordDrafts();
        setScanStatus('ラベルを続けて読むと、まとめて記録できます。');
    }

    function activatePanel(panel) {
        const target = ['labels', 'scanner', 'transfers'].includes(panel) ? panel : 'labels';
        $('.setae-qr-tab').removeClass('is-active').attr('aria-selected', 'false');
        $('.setae-qr-tab[data-qr-panel="' + target + '"]').addClass('is-active').attr('aria-selected', 'true');
        $('[data-qr-panel-content]').removeClass('is-active').prop('hidden', true);
        $('[data-qr-panel-content="' + target + '"]').addClass('is-active').prop('hidden', false);

        if (target !== 'scanner') stopCamera();
        if (target === 'transfers') {
            refreshTransfers({ markRead: true });
        }
    }

    function resetLabelWorkspace() {
        selectionVersion++;
        if (selectionTimer) window.clearTimeout(selectionTimer);
        labelItems = [];
        previewIndex = 0;
        $('#setae-qr-source-title').text(source.title);
        $('#setae-qr-target-search').val('');
        $('#setae-qr-label-preview').html(renderEmptyPreview());
        $('#setae-qr-preview-name').text('対象を選択してください');
        $('#setae-qr-preview-counter').text('0 / 0');
        $('#setae-qr-copy-url, #setae-qr-print').prop('disabled', true);
        updatePrintButton();
    }

    function renderTargetList() {
        const query = String($('#setae-qr-target-search').val() || '').trim().toLowerCase();
        const visible = source.items.filter(function (item) {
            if (!query) return true;
            return [item.title, item.species_name, item.key].join(' ').toLowerCase().includes(query);
        });
        const $list = $('#setae-qr-target-list');
        if (!visible.length) {
            $list.html('<div class="setae-qr-list-empty">一致する対象がありません</div>');
            return;
        }

        $list.html(visible.map(function (item) {
            const checked = selectedKeys.has(item.key);
            return `
                <label class="setae-qr-target-row${checked ? ' is-selected' : ''}">
                    <input type="checkbox" class="setae-qr-target-check" value="${escapeHtml(item.key)}" ${checked ? 'checked' : ''}>
                    ${renderTargetThumb(item)}
                    <span class="setae-qr-target-copy">
                        <strong>${escapeHtml(item.title)}</strong>
                        <span>${escapeHtml(item.species_name)}</span>
                    </span>
                    <i aria-hidden="true"></i>
                </label>
            `;
        }).join(''));
    }

    function renderTargetThumb(item) {
        if (item.image) {
            return `<span class="setae-qr-target-thumb"><img src="${escapeHtml(item.image)}" alt=""></span>`;
        }
        return `<span class="setae-qr-target-thumb is-empty">${escapeHtml(String(item.title || 'S').slice(0, 1).toUpperCase())}</span>`;
    }

    function handleTargetCheck() {
        const key = String($(this).val() || '');
        if ($(this).prop('checked')) {
            if (selectedKeys.size >= MAX_LABELS) {
                $(this).prop('checked', false);
                SetaeCore.showToast('一度に印刷できるのは100件までです', 'warning');
                return;
            }
            selectedKeys.add(key);
        } else {
            selectedKeys.delete(key);
        }
        renderTargetList();
        syncSelection();
    }

    function toggleSelectAll() {
        const query = String($('#setae-qr-target-search').val() || '').trim().toLowerCase();
        const visible = source.items.filter(function (item) {
            return !query || [item.title, item.species_name, item.key].join(' ').toLowerCase().includes(query);
        }).slice(0, MAX_LABELS);
        const allSelected = visible.length && visible.every(function (item) { return selectedKeys.has(item.key); });
        visible.forEach(function (item) {
            if (allSelected) selectedKeys.delete(item.key);
            else if (selectedKeys.size < MAX_LABELS) selectedKeys.add(item.key);
        });
        renderTargetList();
        syncSelection();
    }

    function syncSelection() {
        const version = ++selectionVersion;
        const count = selectedKeys.size;
        $('#setae-qr-selection-count').text(count + '件選択');
        const available = source.items.length;
        $('#setae-qr-select-all').text(count && count === Math.min(available, MAX_LABELS) ? '選択解除' : 'すべて選択');
        labelItems = [];
        previewIndex = 0;
        $('#setae-qr-print, #setae-qr-copy-url').prop('disabled', true);
        updatePrintButton();
        if (selectionTimer) window.clearTimeout(selectionTimer);
        if (!count) {
            renderPreview();
            return;
        }
        $('#setae-qr-label-preview').html('<div class="setae-qr-preview-loading">短縮URLを発行しています</div>');
        selectionTimer = window.setTimeout(function () { fetchSelectedTargets(version); }, 220);
    }

    function fetchSelectedTargets(version) {
        const keys = Array.from(selectedKeys);
        const params = source.type === 'baby'
            ? { source: 'baby', group_id: source.group.id, codes: keys }
            : { source: 'spider', ids: keys };

        SetaeAPI.fetchQrTargets(params, function (response) {
            if (version !== selectionVersion) return;
            labelItems = response && Array.isArray(response.items) ? response.items : [];
            previewIndex = Math.min(previewIndex, Math.max(0, labelItems.length - 1));
            renderPreview();
            $('#setae-qr-copy-url').prop('disabled', labelItems.length !== 1);
        }, function (xhr) {
            if (version !== selectionVersion) return;
            labelItems = [];
            $('#setae-qr-label-preview').html('<div class="setae-qr-preview-error">QRラベルを準備できませんでした</div>');
            updatePrintButton();
            SetaeCore.showToast(getErrorMessage(xhr, 'QRラベルを準備できませんでした'), 'error');
        });
    }

    function renderPreview() {
        const $preview = $('#setae-qr-label-preview');
        if (!labelItems.length) {
            $preview.html(renderEmptyPreview());
            $('#setae-qr-preview-counter').text('0 / 0');
            $('#setae-qr-preview-name').text(selectedKeys.size ? '短縮URLを準備しています' : '対象を選択してください');
            updatePrintButton();
            return;
        }
        const item = labelItems[previewIndex] || labelItems[0];
        const length = getLabelLength();
        const labelHtml = getPrintModule() ? SetaeQRPrint.buildLabelHtml(item, length, format) : '';
        if (!labelHtml) {
            $preview.html('<div class="setae-qr-preview-error">QRコードを生成できませんでした</div>');
            updatePrintButton();
            return;
        }
        $preview.html(labelHtml);
        $('#setae-qr-preview-counter').text((previewIndex + 1) + ' / ' + labelItems.length);
        $('#setae-qr-preview-name').text(item.title + (item.baby_code ? ' / ' + item.baby_code : ''));
        window.requestAnimationFrame(fitPreviewLabel);
        updatePrintButton();
    }

    function renderEmptyPreview() {
        return '<div class="setae-qr-preview-empty">' + QR_ICON_SVG + '<strong>印刷する個体を選択</strong></div>';
    }

    function changePreview(delta) {
        if (!labelItems.length) return;
        previewIndex = (previewIndex + delta + labelItems.length) % labelItems.length;
        renderPreview();
    }

    function getLabelLength() {
        if (getPrintModule()) return SetaeQRPrint.normalizeLength($('#setae-qr-label-length').val());
        return Math.max(43, Math.min(70, parseInt($('#setae-qr-label-length').val(), 10) || 45));
    }

    function printLabels() {
        if (!labelItems.length || printBusy || !getPrintModule()) return;
        const length = getLabelLength();
        if (format === 'tape') {
            exportTapePdf(labelItems.slice(), length);
            return;
        }

        const printDocument = SetaeQRPrint.buildDocument(labelItems, length, format);
        if (!printDocument.html) {
            SetaeCore.showToast(printDocument.error || '印刷データを準備できませんでした', 'error');
            return;
        }

        openPrintDocument(printDocument, length);
    }

    function exportTapePdf(items, length) {
        printBusy = true;
        updatePrintButton();
        window.setTimeout(function () {
            const pdf = SetaeQRPrint.buildTapePdf(items, length);
            if (!pdf.blob) {
                printBusy = false;
                updatePrintButton();
                SetaeCore.showToast(pdf.error || 'テプラ用PDFを作成できませんでした', 'error');
                return;
            }

            downloadBlob(pdf.blob, pdf.fileName);
            printBusy = false;
            updatePrintButton();
            SetaeCore.showToast('PDFを作成しました。ChromeではなくPDFアプリから印刷してください', 'success');
            if (SetaeCore && typeof SetaeCore.track === 'function') {
                SetaeCore.track('qr_label_pdf', {
                    count: items.length,
                    pages: pdf.pageCount,
                    format: 'tape',
                    length_mm: length
                });
            }
        }, 30);
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }

    function updatePrintGuidance() {
        const isTape = format === 'tape';
        $('#setae-qr-print-note-title').text(isTape ? '実寸PDF' : 'A4印刷');
        $('#setae-qr-print-note-text').text(isTape
            ? 'macOS「プレビュー」またはAdobe Acrobatで開き、倍率100%で印刷します。SR-MK1 / SR5900Pなど360dpi機を推奨します。'
            : '家庭用プリンターで倍率100%に設定し、切り取って透明テープなどで貼り付けます。');
    }

    function getPrintModule() {
        if (typeof SetaeQRPrint === 'undefined' || !SetaeQRPrint) return false;
        return format === 'tape'
            ? typeof SetaeQRPrint.buildTapePdf === 'function'
            : typeof SetaeQRPrint.buildDocument === 'function';
    }

    function updatePrintButton() {
        const $button = $('#setae-qr-print');
        if (!$button.length) return;
        if (printBusy) {
            $button.prop('disabled', true).text(format === 'tape' ? 'PDFを作成中' : '印刷データを準備中');
            return;
        }

        const count = labelItems.length;
        const pages = count && getPrintModule()
            ? SetaeQRPrint.getPageCount(count, getLabelLength(), format)
            : 0;
        const label = format === 'a4'
            ? 'A4 / PDF・' + pages + '枚を印刷'
            : 'テプラ用PDF・' + count + '枚を作成';
        $button.prop('disabled', !count || !getPrintModule()).text(label);
    }

    function fitPreviewLabel() {
        const preview = document.getElementById('setae-qr-label-preview');
        const label = preview ? preview.querySelector('.setae-qr-strip-label') : null;
        if (!preview || !label) return;

        label.style.transform = 'scale(1)';
        const availableWidth = Math.max(1, preview.clientWidth - 24);
        const availableHeight = Math.max(1, preview.clientHeight - 24);
        const maxScale = window.matchMedia('(max-width: 640px)').matches ? 1.8 : 2.25;
        const scale = Math.max(0.72, Math.min(maxScale, availableWidth / label.offsetWidth, availableHeight / label.offsetHeight));
        label.style.transform = 'scale(' + scale.toFixed(3) + ')';
    }

    function openPrintDocument(printDocument, length) {
        cleanupPrintFrame();
        printBusy = true;
        updatePrintButton();

        const frame = document.createElement('iframe');
        activePrintFrame = frame;
        frame.setAttribute('title', 'QRラベル印刷');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.position = 'fixed';
        frame.style.top = '0';
        frame.style.left = '-10000px';
        frame.style.width = '1px';
        frame.style.height = '1px';
        frame.style.border = '0';
        frame.style.pointerEvents = 'none';

        let printStarted = false;
        frame.addEventListener('load', function () {
            if (printStarted || frame !== activePrintFrame) return;
            const printWindow = frame.contentWindow;
            if (!printWindow) {
                cleanupPrintFrame();
                SetaeCore.showToast('印刷画面を開けませんでした', 'error');
                return;
            }

            const startPrint = function () {
                if (printStarted || frame !== activePrintFrame) return;
                printStarted = true;
                window.clearTimeout(printFallbackTimer);
                printWindow.addEventListener('afterprint', function () {
                    window.setTimeout(cleanupPrintFrame, 0);
                }, { once: true });
                try {
                    printWindow.focus();
                    printWindow.print();
                    if (SetaeCore && typeof SetaeCore.track === 'function') {
                        SetaeCore.track('qr_label_print', {
                            count: labelItems.length,
                            pages: printDocument.pageCount,
                            format: format,
                            length_mm: length
                        });
                    }
                } catch (error) {
                    cleanupPrintFrame();
                    SetaeCore.showToast('印刷画面を開けませんでした', 'error');
                }
            };

            const printFallbackTimer = window.setTimeout(startPrint, 180);
            printWindow.requestAnimationFrame(function () {
                printWindow.requestAnimationFrame(startPrint);
            });
        });

        frame.srcdoc = printDocument.html;
        document.body.appendChild(frame);
        printCleanupTimer = window.setTimeout(cleanupPrintFrame, 120000);
    }

    function cleanupPrintFrame() {
        if (printCleanupTimer) {
            window.clearTimeout(printCleanupTimer);
            printCleanupTimer = null;
        }
        if (activePrintFrame && activePrintFrame.parentNode) {
            activePrintFrame.parentNode.removeChild(activePrintFrame);
        }
        activePrintFrame = null;
        printBusy = false;
        updatePrintButton();
    }

    function copyCurrentUrl() {
        const item = labelItems[previewIndex];
        if (item) copyText(item.url, '短縮URLをコピーしました');
    }

    function toggleCamera() {
        if (cameraStream) stopCamera();
        else startCamera();
    }

    function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setScanStatus('この端末ではカメラを利用できません。画像から読み取ってください。', 'error');
            return;
        }
        const $button = $('#setae-qr-camera-toggle').prop('disabled', true).text('起動中');
        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        }).then(function (stream) {
            cameraStream = stream;
            const video = document.getElementById('setae-qr-video');
            video.srcObject = stream;
            return video.play();
        }).then(function () {
            $('#setae-qr-camera-stage').addClass('is-active');
            $button.prop('disabled', false).text('カメラを停止');
            setScanStatus('QRを枠の中央に入れてください。読み取り後も続けて追加できます。');
            prepareBarcodeDetector();
            scanLoop();
        }).catch(function () {
            stopCamera();
            setScanStatus('カメラを開始できませんでした。権限を確認するか、画像から読み取ってください。', 'error');
        });
    }

    function stopCamera() {
        if (scanFrame) window.cancelAnimationFrame(scanFrame);
        scanFrame = null;
        scanBusy = false;
        if (cameraStream) {
            cameraStream.getTracks().forEach(function (track) { track.stop(); });
            cameraStream = null;
        }
        const video = document.getElementById('setae-qr-video');
        if (video) video.srcObject = null;
        $('#setae-qr-camera-stage').removeClass('is-active');
        $('#setae-qr-camera-toggle').prop('disabled', false).text('カメラを開始');
    }

    function prepareBarcodeDetector() {
        barcodeDetector = null;
        if (!('BarcodeDetector' in window)) return;
        try {
            barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (error) {
            barcodeDetector = null;
        }
    }

    function scanLoop() {
        if (!cameraStream) return;
        scanFrame = window.requestAnimationFrame(scanLoop);
        if (scanBusy) return;

        const video = document.getElementById('setae-qr-video');
        if (!video || video.readyState < 2 || !video.videoWidth) return;
        const canvas = document.getElementById('setae-qr-scan-canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const maxWidth = barcodeDetector ? 900 : 640;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        scanBusy = true;

        const done = function () { window.setTimeout(function () { scanBusy = false; }, barcodeDetector ? 90 : 160); };
        if (barcodeDetector) {
            barcodeDetector.detect(canvas).then(function (results) {
                if (results && results[0] && results[0].rawValue) handleDecodedValue(results[0].rawValue);
                done();
            }).catch(function () {
                barcodeDetector = null;
                decodeCanvasWithJsQr(canvas);
                done();
            });
            return;
        }
        decodeCanvasWithJsQr(canvas);
        done();
    }

    function decodeCanvasWithJsQr(canvas) {
        if (typeof jsQR !== 'function') return false;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
        if (result && result.data) {
            handleDecodedValue(result.data);
            return true;
        }
        return false;
    }

    function decodeImageFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = function () {
            const canvas = document.getElementById('setae-qr-scan-canvas');
            const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, canvas.width, canvas.height);
            const found = decodeCanvasWithJsQr(canvas);
            if (!found) setScanStatus('画像からQRを確認できませんでした。QR全体が写った画像をお試しください。', 'error');
            URL.revokeObjectURL(url);
            $('#setae-qr-image-input').val('');
        };
        image.onerror = function () {
            URL.revokeObjectURL(url);
            setScanStatus('画像を読み込めませんでした。', 'error');
        };
        image.src = url;
    }

    function handleDecodedValue(value) {
        const code = parseQrCode(value);
        if (!code) {
            setScanStatus('SETAEの短縮URLではありません。', 'error');
            return;
        }
        const now = Date.now();
        if (lastDecoded.code === code && now - lastDecoded.at < 1800) return;
        lastDecoded = { code: code, at: now };
        resolveAndQueue(code);
    }

    function parseQrCode(value) {
        let raw = String(value || '').trim();
        try {
            const parsed = new URL(raw, window.location.origin);
            const parts = parsed.pathname.split('/').filter(Boolean);
            raw = parts.length ? parts[parts.length - 1] : (parsed.searchParams.get('setae_qr') || raw);
        } catch (error) {}
        raw = raw.toLowerCase();
        return /^[23456789abcdefghjkmnpqrstuvwxyz]{4,8}$/.test(raw) ? raw : '';
    }

    function resolveAndQueue(code) {
        const normalized = parseQrCode(code);
        if (!normalized) {
            setScanStatus('SETAEの短縮コードを確認できませんでした。', 'error');
            return;
        }
        if (scanQueue.has(normalized)) {
            setScanStatus('この個体は読み取り済みです。');
            return;
        }
        if (scanQueue.size >= MAX_LABELS) {
            setScanStatus('一度に記録できるのは100件までです。先に保存してください。', 'error');
            return;
        }
        setScanStatus('個体を確認しています。');
        SetaeAPI.resolveQrTarget(normalized, function (target) {
            if (target.archived || ['dead', 'rehomed', 'transferred'].includes(target.status)) {
                setScanStatus('このQRは現在、記録できない状態です。', 'error');
                return;
            }
            scanQueue.set(normalized, target);
            renderScanQueue();
            setScanStatus((target.baby_code || target.title) + ' を追加しました。続けて読み取れます。', 'success');
            if (navigator.vibrate) navigator.vibrate(35);
        }, function (xhr) {
            setScanStatus(getErrorMessage(xhr, 'QRに紐づく個体を確認できませんでした。'), 'error');
        });
    }

    function renderScanQueue() {
        const items = Array.from(scanQueue.values());
        $('#setae-qr-queue-count').text(items.length + '件');
        const $queue = $('#setae-qr-scan-queue');
        if (!items.length) {
            $queue.html('<div class="setae-qr-queue-empty">読み取った個体がここに並びます</div>');
        } else {
            $queue.html(items.map(function (item) {
                return `
                    <div class="setae-qr-queue-row">
                        ${renderTargetThumb({ image: item.image, title: item.title })}
                        <span><strong>${escapeHtml(item.baby_code || item.title)}</strong><em>${escapeHtml(item.short_name || item.species_name)}</em></span>
                        <button type="button" class="js-qr-queue-remove" data-code="${escapeHtml(item.code)}" aria-label="${escapeHtml(item.title)}を外す">&times;</button>
                    </div>
                `;
            }).join(''));
        }
        updateBatchSaveButton();
    }

    function selectRecordType(value) {
        const type = Object.prototype.hasOwnProperty.call(RECORD_TYPE_LABELS, value) ? value : 'feed';
        $('#setae-qr-record-type').val(type);
        $('[data-qr-record-type]').each(function () {
            const active = $(this).data('qr-record-type') === type;
            $(this).toggleClass('is-active', active).attr('aria-pressed', active ? 'true' : 'false');
        });
        $('#setae-qr-prey-field').prop('hidden', type !== 'feed');
        $('#setae-qr-prey-field').closest('.setae-qr-record-row').toggleClass('is-single-field', type !== 'feed');
    }

    function addRecordDraft(event) {
        event.preventDefault();
        const type = $('#setae-qr-record-type').val();
        const date = String($('#setae-qr-record-date').val() || '');
        const preyType = type === 'feed' ? String($('#setae-qr-record-prey').val() || '').trim() : '';
        const note = String($('#setae-qr-record-note').val() || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            SetaeCore.showToast('記録日を入力してください', 'warning');
            $('#setae-qr-record-date').trigger('focus');
            return;
        }
        if (type === 'observation' && !note) {
            SetaeCore.showToast('メモを入力してください', 'warning');
            $('#setae-qr-record-note').trigger('focus');
            return;
        }
        if (!editingDraftId && recordDrafts.length >= MAX_DRAFT_RECORDS) {
            SetaeCore.showToast('一度に追加できる記録は20件までです', 'warning');
            return;
        }

        const draft = {
            id: editingDraftId || ('qr-record-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
            type: type,
            date: date,
            prey_type: preyType,
            note: note
        };
        if (editingDraftId) {
            recordDrafts = recordDrafts.map(function (item) { return item.id === editingDraftId ? draft : item; });
            SetaeCore.showToast('保存リストの記録を更新しました', 'success');
        } else {
            recordDrafts.push(draft);
        }
        resetRecordComposer({ preserveValues: true });
        renderRecordDrafts();
        const workspace = document.querySelector('.setae-qr-record-workspace');
        if (workspace) {
            window.requestAnimationFrame(function () { workspace.scrollTo({ top: 0, behavior: 'smooth' }); });
        }
    }

    function editRecordDraft(id) {
        const draft = recordDrafts.find(function (item) { return item.id === id; });
        if (!draft) return;
        editingDraftId = id;
        selectRecordType(draft.type);
        $('#setae-qr-record-date').val(draft.date);
        $('#setae-qr-record-prey').val(draft.prey_type || '');
        $('#setae-qr-record-note').val(draft.note || '');
        $('#setae-qr-record-form-title').text('記録を編集');
        $('#setae-qr-record-edit-cancel').prop('hidden', false);
        $('#setae-qr-record-add').text('変更を保存リストに反映');
        const workspace = document.querySelector('.setae-qr-record-workspace');
        if (workspace) workspace.scrollTo({ top: 0, behavior: 'smooth' });
        window.setTimeout(function () { $('#setae-qr-record-date').trigger('focus'); }, 180);
    }

    function removeRecordDraft(id) {
        recordDrafts = recordDrafts.filter(function (item) { return item.id !== id; });
        if (editingDraftId === id) resetRecordComposer();
        renderRecordDrafts();
    }

    function clearRecordDrafts() {
        if (!recordDrafts.length) return;
        const clear = function () {
            recordDrafts = [];
            resetRecordComposer();
            renderRecordDrafts();
        };
        if (recordDrafts.length === 1 || !SetaeCore || typeof SetaeCore.confirmAction !== 'function') {
            clear();
            return;
        }
        SetaeCore.confirmAction({
            title: '保存リストを空にしますか？',
            message: recordDrafts.length + '件の未保存記録を削除します。',
            confirmLabel: 'すべて削除',
            cancelLabel: '残す',
            tone: 'danger'
        }).then(function (confirmed) { if (confirmed) clear(); });
    }

    function resetRecordComposer(options) {
        const preserveValues = options && options.preserveValues;
        editingDraftId = '';
        $('#setae-qr-record-form-title').text('記録を追加');
        $('#setae-qr-record-edit-cancel').prop('hidden', true);
        $('#setae-qr-record-add').text('保存リストに追加');
        $('#setae-qr-record-note').val('');
        if (!preserveValues) {
            selectRecordType('feed');
            $('#setae-qr-record-date').val(today());
            $('#setae-qr-record-prey').val('');
        }
    }

    function renderRecordDrafts() {
        const $list = $('#setae-qr-record-draft-list');
        $('#setae-qr-record-draft-count').text(recordDrafts.length + '件');
        $('#setae-qr-record-clear').prop('hidden', !recordDrafts.length);
        if (!recordDrafts.length) {
            $list.html('<div class="setae-qr-record-draft-empty">給餌・脱皮・ペアリングなどを追加すると、ここにまとまります</div>');
            updateBatchSaveButton();
            return;
        }

        const sorted = recordDrafts.slice().sort(function (left, right) {
            return right.date.localeCompare(left.date);
        });
        $list.html(sorted.map(function (draft) {
            const summary = getRecordDraftSummary(draft);
            return `
                <article class="setae-qr-record-draft is-${escapeHtml(draft.type)}">
                    <i class="setae-qr-record-draft-mark" aria-hidden="true"></i>
                    <div class="setae-qr-record-draft-copy">
                        <div><strong>${escapeHtml(RECORD_TYPE_LABELS[draft.type] || '記録')}</strong><time datetime="${escapeHtml(draft.date)}">${escapeHtml(formatRecordDate(draft.date))}</time></div>
                        <p>${escapeHtml(summary)}</p>
                    </div>
                    <div class="setae-qr-record-draft-actions">
                        <button type="button" class="js-qr-record-edit" data-draft-id="${escapeHtml(draft.id)}">編集</button>
                        <button type="button" class="js-qr-record-remove" data-draft-id="${escapeHtml(draft.id)}" aria-label="${escapeHtml(RECORD_TYPE_LABELS[draft.type] || '記録')}を削除" title="削除">&times;</button>
                    </div>
                </article>
            `;
        }).join(''));
        updateBatchSaveButton();
    }

    function getRecordDraftSummary(draft) {
        const parts = [];
        if (draft.type === 'feed') parts.push(draft.prey_type || '餌の種類は未設定');
        if (draft.type === 'molt') parts.push('脱皮記録');
        if (draft.type === 'pairing') parts.push('ペアリング記録');
        if (draft.note) parts.push(draft.note);
        return parts.join(' ・ ') || 'メモなし';
    }

    function formatRecordDate(value) {
        const parts = String(value || '').split('-');
        return parts.length === 3 ? parts[0] + '.' + parts[1] + '.' + parts[2] : value;
    }

    function updateBatchSaveButton() {
        const targetCount = scanQueue.size;
        const recordCount = recordDrafts.length;
        const entryCount = targetCount * recordCount;
        const overLimit = entryCount > MAX_BATCH_ENTRIES;
        const $button = $('#setae-qr-record-submit');
        const $summary = $('#setae-qr-batch-summary');

        if (recordSaving) {
            $button.prop('disabled', true).text('まとめて保存中');
            $summary.removeClass('is-error').text(entryCount + '件の記録を保存しています');
            return;
        }
        if (overLimit) {
            $summary.addClass('is-error').text('合計' + entryCount + '件です。1回500件以内になるよう対象か記録を減らしてください');
        } else if (targetCount && recordCount) {
            $summary.removeClass('is-error').text(targetCount + '個体 × ' + recordCount + '記録 = 合計' + entryCount + '件');
        } else if (!targetCount && recordCount) {
            $summary.removeClass('is-error').text('記録は準備済みです。対象のQRを読み取ってください');
        } else if (targetCount) {
            $summary.removeClass('is-error').text(targetCount + '個体を選択中です。保存する記録を追加してください');
        } else {
            $summary.removeClass('is-error').text('個体を読み取り、記録を追加してください');
        }

        const ready = targetCount > 0 && recordCount > 0 && !overLimit;
        $button.prop('disabled', !ready).text(ready
            ? targetCount + '個体へ' + recordCount + '記録をまとめて保存'
            : 'まとめて保存');
    }

    function saveScannedRecords(event) {
        if (event) event.preventDefault();
        const codes = Array.from(scanQueue.keys());
        const drafts = recordDrafts.slice();
        if (!codes.length || !drafts.length || recordSaving) return;
        if (codes.length * drafts.length > MAX_BATCH_ENTRIES) {
            SetaeCore.showToast('一度に保存できるのは合計500件までです', 'warning');
            return;
        }

        recordSaving = true;
        updateBatchSaveButton();
        SetaeAPI.saveQrRecords({
            codes: codes,
            records: drafts.map(function (draft) {
                return { type: draft.type, date: draft.date, prey_type: draft.prey_type, note: draft.note };
            })
        }, function (response) {
            const count = response && response.count ? response.count : codes.length * drafts.length;
            const targetCount = response && response.target_count ? response.target_count : codes.length;
            const recordCount = response && response.record_count ? response.record_count : drafts.length;
            recordSaving = false;
            resetScannerSession();
            SetaeCore.showToast(targetCount + '個体に' + recordCount + '記録を保存しました（合計' + count + '件）', 'success');
            if (SetaeAPI.fetchMySpiders && window.SetaeUIList) {
                SetaeAPI.fetchMySpiders(SetaeUIList.renderMySpiders);
            }
            if (SetaeCore && typeof SetaeCore.track === 'function') {
                SetaeCore.track('qr_record_batch_saved', { targets: targetCount, records: recordCount, entries: count });
            }
        }, function (xhr) {
            recordSaving = false;
            SetaeCore.showToast(getErrorMessage(xhr, '記録を保存できませんでした。'), 'error');
            updateBatchSaveButton();
        });
    }

    function refreshTransfers(options) {
        options = options || {};
        if (!SetaeAPI || !SetaeAPI.fetchQrTransfers) return;
        SetaeAPI.fetchQrTransfers(function (overview) {
            transferOverview = overview || { incoming: [], outgoing: [], notifications: [] };
            renderTransfers();
            updateTransferBadges();
            if (options.announce) announceNotifications();
            if (options.markRead && transferOverview.unread_count) {
                SetaeAPI.markQrNotificationsRead(function () {
                    transferOverview.unread_count = 0;
                    (transferOverview.notifications || []).forEach(function (item) { item.read = true; });
                    updateTransferBadges();
                });
            }
        }, function () {
            if ($('#setae-qr-modal').is(':visible')) {
                $('#setae-qr-transfer-incoming, #setae-qr-transfer-outgoing').html('<div class="setae-qr-transfer-empty">引き継ぎ情報を読み込めませんでした</div>');
            }
        });
    }

    function updateTransferBadges() {
        const pending = transferOverview ? parseInt(transferOverview.pending_count, 10) || 0 : 0;
        const unread = transferOverview ? parseInt(transferOverview.unread_count, 10) || 0 : 0;
        const count = Math.max(pending, unread);
        $('#setae-qr-transfer-count').prop('hidden', !pending).text(pending);
        $('#setae-qr-notification-badge').prop('hidden', !count).text(count);
    }

    function announceNotifications() {
        const unread = transferOverview && Array.isArray(transferOverview.notifications)
            ? transferOverview.notifications.filter(function (item) { return !item.read; })
            : [];
        if (!unread.length) return;
        const latest = unread[0];
        let key = '';
        try {
            key = sessionStorage.getItem('setae_qr_notice_seen') || '';
        } catch (error) {}
        if (key === latest.id) return;
        SetaeCore.showToast(latest.message, 'info', { duration: 6500 });
        try { sessionStorage.setItem('setae_qr_notice_seen', latest.id); } catch (error) {}
    }

    function renderTransfers() {
        if (!transferOverview) return;
        renderTransferList('#setae-qr-transfer-incoming', transferOverview.incoming || [], true);
        renderTransferList('#setae-qr-transfer-outgoing', transferOverview.outgoing || [], false);
    }

    function renderTransferList(selector, items, incoming) {
        const $target = $(selector);
        if (!items.length) {
            $target.html('<div class="setae-qr-transfer-empty">該当する引き継ぎはありません</div>');
            return;
        }
        $target.html(items.map(function (item) {
            const person = incoming ? item.to_user_name : item.from_user_name;
            const status = transferStatusLabel(item.status);
            const actions = incoming && item.can_respond ? `
                <div class="setae-qr-transfer-actions">
                    <button type="button" class="js-qr-transfer-response is-reject" data-id="${escapeHtml(item.id)}" data-action="reject">見送る</button>
                    <button type="button" class="js-qr-transfer-response is-approve" data-id="${escapeHtml(item.id)}" data-action="approve">承認して譲渡</button>
                </div>
            ` : '';
            return `
                <article class="setae-qr-transfer-row is-${escapeHtml(item.status)}">
                    <div class="setae-qr-transfer-row-head">
                        <span>${escapeHtml(String(item.code || '').toUpperCase())}</span>
                        <i>${escapeHtml(status)}</i>
                    </div>
                    <strong>${escapeHtml(item.spider_name || '個体')}</strong>
                    <p>${escapeHtml(incoming ? person + 'さんからの申請' : person + 'さんが確認します')}</p>
                    ${actions}
                </article>
            `;
        }).join(''));
    }

    function transferStatusLabel(status) {
        return { pending: '承認待ち', approved: '完了', rejected: '見送り', cancelled: '終了' }[status] || status;
    }

    function handleTransferResponse() {
        const id = $(this).data('id');
        const action = $(this).data('action');
        const approve = action === 'approve';
        const options = approve ? {
            title: '個体の管理を譲渡',
            message: '相手へ写真と全履歴を移動します。自分側には譲渡時点の記録をアーカイブ保存します。',
            confirmLabel: '承認して譲渡'
        } : {
            title: '引き継ぎ申請を見送る',
            message: 'この申請を見送ります。個体データは変更されません。',
            confirmLabel: '見送る'
        };
        const confirmation = SetaeCore.confirmAction ? SetaeCore.confirmAction(options) : Promise.resolve(window.confirm(options.message));
        confirmation.then(function (confirmed) {
            if (!confirmed) return;
            SetaeAPI.respondQrTransfer(id, action, function (response) {
                SetaeCore.showToast(approve ? '譲渡が完了しました' : '申請を見送りました', 'success');
                refreshTransfers();
                if (SetaeAPI.fetchMySpiders && window.SetaeUIList) {
                    SetaeAPI.fetchMySpiders(SetaeUIList.renderMySpiders);
                }
                if (approve && response && response.snapshot_id && $('#section-my-detail').is(':visible') && window.SetaeUIDetail) {
                    SetaeUIDetail.loadSpiderDetail(response.snapshot_id);
                }
            });
        });
    }

    function renderSpiderSettings(spider, targetSelector) {
        const $target = $(targetSelector);
        if (!$target.length || !spider || !spider.id) return;
        if (spider.transfer_receipt) {
            $target.html(`
                <section class="setae-qr-detail-panel is-receipt">
                    <span class="setae-qr-detail-kicker">TRANSFERRED</span>
                    <h3>譲渡時点のアーカイブ</h3>
                    <p>この記録は譲渡前の写真と履歴を保存したものです。QRと公開設定は新しい所有者へ移動しています。</p>
                </section>
            `);
            return;
        }
        $target.html('<div class="setae-qr-settings-loading">QR設定を読み込んでいます</div>');
        SetaeAPI.fetchQrTargets({ source: 'spider', ids: [spider.id] }, function (response) {
            const item = response && response.items && response.items[0];
            if (!item) {
                $target.html('<div class="setae-qr-settings-error">QR設定を読み込めませんでした</div>');
                return;
            }
            spider.qr_code = item.code;
            spider.qr_url = item.url;
            spider.qr_public = item.public;
            spider.transfer_enabled = item.transfer_enabled;
            $target.html(buildSpiderSettingsHtml(spider, item));
            renderDetailTransferRequests(spider.id);
        }, function () {
            $target.html('<div class="setae-qr-settings-error">QR設定を読み込めませんでした</div>');
        });
    }

    function buildSpiderSettingsHtml(spider, item) {
        const disabled = spider.archived ? ' disabled' : '';
        return `
            <section class="setae-qr-detail-panel${spider.archived ? ' is-archived' : ''}">
                <header class="setae-qr-detail-head">
                    <div>
                        <span class="setae-qr-detail-kicker">QR LABEL</span>
                        <h3>ラベル・公開設定</h3>
                        <p>短縮URL <b>${escapeHtml(item.url.replace(/^https?:\/\//, ''))}</b></p>
                    </div>
                    <button type="button" class="setae-qr-detail-code js-qr-detail-print" data-id="${escapeHtml(spider.id)}"${disabled}>${escapeHtml(item.code.toUpperCase())}<span>ラベル</span></button>
                </header>
                <div class="setae-qr-detail-url-row">
                    <input type="text" readonly value="${escapeHtml(item.url)}" aria-label="短縮URL">
                    <button type="button" class="js-qr-detail-copy" data-url="${escapeHtml(item.url)}">コピー</button>
                </div>
                <div class="setae-qr-detail-toggles">
                    <label>
                        <span><strong>個体紹介を公開</strong><em>QRを通常のカメラで開いた人に、名前・種類・直近の記録を表示</em></span>
                        <input type="checkbox" class="js-qr-setting-toggle" data-id="${escapeHtml(spider.id)}" data-setting="public" ${item.public ? 'checked' : ''}${disabled}>
                        <i aria-hidden="true"></i>
                    </label>
                    <label>
                        <span><strong>引き継ぎを受け付ける</strong><em>申請を確認して承認したときだけ、履歴ごと相手へ移動</em></span>
                        <input type="checkbox" class="js-qr-setting-toggle" data-id="${escapeHtml(spider.id)}" data-setting="transfer" ${item.transfer_enabled ? 'checked' : ''}${disabled}>
                        <i aria-hidden="true"></i>
                    </label>
                </div>
                ${spider.archived ? '<p class="setae-qr-detail-archive-note">アーカイブ中はQRから記録できません。飼育一覧へ戻すと再開できます。</p>' : ''}
                <div id="setae-qr-detail-requests" class="setae-qr-detail-requests"></div>
            </section>
        `;
    }

    function saveDetailSettings() {
        const $toggle = $(this);
        const id = $toggle.data('id');
        const $panel = $toggle.closest('.setae-qr-detail-panel');
        const $toggles = $panel.find('.js-qr-setting-toggle');
        const payload = {
            public: $toggles.filter('[data-setting="public"]').prop('checked') ? 1 : 0,
            transfer_enabled: $toggles.filter('[data-setting="transfer"]').prop('checked') ? 1 : 0
        };
        $toggles.prop('disabled', true);
        SetaeAPI.updateQrSpiderSettings(id, payload, function () {
            $toggles.prop('disabled', false);
            SetaeCore.showToast('QR設定を保存しました', 'success');
        }, function (xhr) {
            $toggle.prop('checked', !$toggle.prop('checked'));
            $toggles.prop('disabled', false);
            SetaeCore.showToast(getErrorMessage(xhr, 'QR設定を保存できませんでした。'), 'error');
        });
    }

    function renderDetailTransferRequests(spiderId) {
        const render = function () {
            const incoming = transferOverview && Array.isArray(transferOverview.incoming)
                ? transferOverview.incoming.filter(function (item) { return String(item.spider_id) === String(spiderId) && item.status === 'pending'; })
                : [];
            const $target = $('#setae-qr-detail-requests');
            if (!$target.length || !incoming.length) {
                $target.empty();
                return;
            }
            $target.html('<strong>引き継ぎ申請</strong>' + incoming.map(function (item) {
                return `
                    <div><span>${escapeHtml(item.to_user_name)}さん</span>
                    <button type="button" class="js-qr-transfer-response is-reject" data-id="${escapeHtml(item.id)}" data-action="reject">見送る</button>
                    <button type="button" class="js-qr-transfer-response is-approve" data-id="${escapeHtml(item.id)}" data-action="approve">承認</button></div>
                `;
            }).join(''));
        };
        if (transferOverview) render();
        else SetaeAPI.fetchQrTransfers(function (overview) { transferOverview = overview; render(); });
    }

    function findSpider(id) {
        return getActiveSpiders().find(function (spider) { return String(spider.id) === String(id); }) || null;
    }

    function setScanStatus(message, type) {
        $('#setae-qr-scan-status').removeClass('is-error is-success').addClass(type ? 'is-' + type : '').text(message);
    }

    function copyText(text, message) {
        const value = String(text || '');
        if (!value) return;
        const fallback = function () {
            const area = document.createElement('textarea');
            area.value = value;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
            SetaeCore.showToast(message, 'success');
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(value).then(function () {
                SetaeCore.showToast(message, 'success');
            }).catch(fallback);
        } else {
            fallback();
        }
    }

    function getErrorMessage(xhr, fallback) {
        return xhr && xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : fallback;
    }

    function today() {
        const date = new Date();
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
        });
    }

    $(init);

    return {
        openForSpiders: openForSpiders,
        openForBabies: openForBabies,
        openScannerWithCode: function (code) { openModal('scanner'); resolveAndQueue(code); },
        renderSpiderSettings: renderSpiderSettings,
        refreshTransfers: refreshTransfers
    };
})(jQuery);
