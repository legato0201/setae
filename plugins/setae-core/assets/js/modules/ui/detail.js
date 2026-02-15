var SetaeUIDetail = (function ($) {
    'use strict';

    let currentSpiderId = null;
    let currentClassification = 'tarantula'; // ★追加: 現在の個体の分類を保持

    // ==========================================
    // DEEP DETAIL VIEW
    // ==========================================
    function loadSpiderDetail(id) {
        currentSpiderId = id;
        $.ajax({
            url: SetaeCore.state.apiRoot + '/spider/' + id,
            method: 'GET',
            cache: false, // ★追加: これにより、常に最新のデータをサーバーから取得します
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce); },
            success: function (spider) {
                renderSpiderDetailSection(spider);
            },
            error: function () {
                SetaeCore.showToast('詳細の読み込みに失敗しました', 'error');
            }
        });
    }

    function renderSpiderDetailSection(spider) {
        currentClassification = spider.classification || 'tarantula'; // ★分類を保存

        const $heroBackdrop = $('#section-my-detail .hero-backdrop');
        const imgUrl = spider.image_url || spider.thumb || spider.src || spider.full_image;

        if (imgUrl) {
            $heroBackdrop.css('background-image', `url('${imgUrl}')`);
        } else {
            $heroBackdrop.css('background-image', `url('https://placehold.co/600x400/333/999?text=No+Image')`);
        }

        // Basic Info & Dates
        $('#detail-spider-name').text(spider.title || spider.nickname || spider.species || 'Unknown');
        $('#detail-spider-species').text(spider.species_name || spider.scientific_name || 'Unknown Species');
        $('#detail-spider-id-badge').text(`#${spider.id}`);

        // --- Tabs Implementation (Fix Step 2) ---
        const $container = $('.setae-detail-container');
        $container.empty(); // Clear existing content

        // Tab Navigation HTML
        const tabsHtml = `
            <div class="setae-detail-tabs">
                <button class="tab-btn active" data-target="tab-overview">Overview</button>
                <button class="tab-btn" data-target="tab-history">History</button>
                ${(String(spider.owner_id) === String(SetaeCore.state.currentUserId) && currentClassification === 'tarantula') ? '<button class="tab-btn" data-target="tab-settings">Settings / BL</button>' : ''}
            </div>
            
            <div id="tab-overview" class="detail-tab-content active"></div>
            <div id="tab-history" class="detail-tab-content" style="display:none;"></div>
            <div id="tab-settings" class="detail-tab-content" style="display:none;"></div>
        `;
        $container.append(tabsHtml);

        // --- Tab 1: Overview (Status + Charts) ---
        // Helper for cycle color
        const statusMap = {
            'normal': { label: 'Normal', color: '#2c3e50' },
            'fasting': { label: 'Fasting', color: '#d35400' },
            'pre_molt': { label: 'Pre-molt', color: '#c0392b' },
            'post_molt': { label: 'Post-molt', color: '#2980b9' },
        };
        const st = statusMap[spider.status] || statusMap['normal'];

        // Determine labels based on classification
        const isPlant = (currentClassification === 'plant');
        const labelMolt = isPlant ? "Last Repot" : "Last Molt";
        const labelFeed = isPlant ? "Last Water" : "Last Feed";

        const overviewHtml = `
            <div class="status-grid">
                <div class="status-item"><span class="status-label">${labelMolt}</span><strong id="detail-spider-molt">${spider.last_molt || '-'}</strong></div>
                <div class="status-item"><span class="status-label">${labelFeed}</span><strong id="detail-spider-feed">${spider.last_feed || '-'}</strong></div>
                <div class="status-item"><span class="status-label">Cycle</span><strong id="detail-spider-cycle" style="color:${st.color}">${st.label}</strong></div>
            </div>
            <div class="setae-grid-dashboard">
                <div class="setae-card dashboard-card">
                    <h4>Growth Log</h4>
                    <div class="chart-container"><canvas id="growthChart"></canvas></div>
                </div>
                ${!isPlant ? `
                <div class="setae-card dashboard-card">
                    <h4>Prey Preferences</h4>
                    <div class="chart-container"><canvas id="preyChart"></canvas></div>
                </div>` : ''}
            </div>
        `;
        $('#tab-overview').html(overviewHtml);

        // --- Tab 2: History (Timeline) ---
        const historyHtml = `
            <div class="setae-timeline-section" style="margin-top:0;">
                <div id="setae-log-list" class="timeline-container"></div>
                <div id="log-sentinel"></div>
            </div>
        `;
        $('#tab-history').html(historyHtml);

        // --- Tab 3: Settings (BL Settings) ---
        if (String(spider.owner_id) === String(SetaeCore.state.currentUserId) && currentClassification === 'tarantula') {
            renderBLSettingsCard(spider, '#tab-settings'); // Pass target selector
        }

        // --- Tab Switch Event ---
        $('.tab-btn').on('click', function () {
            $('.tab-btn').removeClass('active');
            $(this).addClass('active');
            $('.detail-tab-content').hide();
            $('#' + $(this).data('target')).fadeIn(200);
        });

        // Load Logs (Render to #setae-log-list)
        loadSpiderLogs(spider.id);

        // Setup FAB
        setupFabButton();

        // Remove old elements if any remain
        $('.section-calendar').remove();

        // Show Section
        const $detailSection = $('#section-my-detail');
        if ($detailSection.is(':visible')) {
            $detailSection.show();
        } else {
            $('#section-my').hide();
            $detailSection.fadeIn().css('display', 'block');
        }
    }

    // ★ Helper: FAB Button (Moved out to function)
    function setupFabButton() {
        $('#btn-add-log').remove();
        const fabBtnHtml = `
            <button id="btn-add-log" class="setae-fab-record">
                <span class="fab-icon">＋</span>
                <span class="fab-text">Record</span>
            </button>
        `;
        $('#section-my-detail').append(fabBtnHtml);

        // CSS injection handled by initial check in previous implementations or can be added here if missing
        if ($('#setae-fab-style').length === 0) {
            // ... (Same CSS as before, simplified for brevity as it's likely already injected or can be added to views.css)
            // For now assuming existing CSS injection in head works or is present. 
            // actually I should include the CSS injection block if I removed it from the main flow.
            // To be safe, let's keep the CSS injection block.
            $('head').append(`
                <style id="setae-fab-style">
                    .setae-fab-record {
                        position: fixed; bottom: 30px; right: 30px; z-index: 9999;
                        background: linear-gradient(135deg, #2ecc71, #27ae60);
                        color: #fff; border: none; border-radius: 50px; padding: 12px 24px;
                        font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4);
                        cursor: pointer; display: flex; align-items: center; gap: 8px;
                        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    }
                    .setae-fab-record:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 8px 25px rgba(46, 204, 113, 0.6); }
                    .setae-fab-record:active { transform: translateY(1px) scale(0.98); box-shadow: 0 2px 10px rgba(46, 204, 113, 0.3); }
                    .setae-fab-record .fab-icon { font-size: 18px; line-height: 1; font-weight: 800; }
                    @media (max-width: 480px) {
                        .setae-fab-record { bottom: 90px; right: 20px; padding: 12px 20px; font-size: 14px; }
                    }
                </style>
            `);
        }
    }

    // デザイン用CSSの注入関数
    function injectTimelineStyles() {
        if ($('#setae-timeline-css').length > 0) return;
        const css = `
            .setae-timeline-wrapper { position: relative; padding-left: 30px; margin-left: 10px; border-left: 2px solid #e0e0e0; padding-bottom: 20px; }
            .timeline-date-label { position: relative; left: -39px; margin: 24px 0 12px 0; clear: both; }
            .timeline-date-label span { background: #95a5a6; color: #fff; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .timeline-date-label.is-today span { background: #2ecc71; }
            .timeline-item { position: relative; margin-bottom: 12px; }
            .timeline-node { position: absolute; left: -39px; top: 12px; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.15); z-index: 2; display: flex; align-items: center; justify-content: center; font-size: 10px; background: #95a5a6; color: white; }
            .timeline-node img.emoji { width: 12px !important; height: 12px !important; margin: 0 !important; vertical-align: middle !important; }
            .timeline-card { background: #fff; border-radius: 8px; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #f0f0f0; transition: transform 0.2s; }
            .timeline-card:active { transform: scale(0.98); }
            .timeline-note-content { font-size: 13px; color: #444; margin-top: 8px; padding: 8px 10px; background-color: #fff9c4; border-left: 3px solid #f1c40f; border-radius: 0 4px 4px 0; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
            .node-feed { background: #2ecc71; }
            .node-refused { background: #e74c3c; }
            .node-molt { background: #9b59b6; }
            .node-growth { background: #3498db; }
            .node-note { background: #f1c40f; }
            .node-default { background: #95a5a6; }
        `;
        $('head').append(`<style id="setae-timeline-css">${css}</style>`);
    }

    function getRelativeDateLabel(dateStr) {
        const d = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(d);
        target.setHours(0, 0, 0, 0);

        const diffTime = today - target;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays <= 30) return `${diffDays} Days ago`;
        if (diffDays <= 365) return `${Math.floor(diffDays / 30)} Months ago`;
        return d.getFullYear().toString();
    }

    function loadSpiderLogs(id) {
        injectTimelineStyles();

        $.ajax({
            url: SetaeCore.state.apiRoot + '/spider/' + id + '/events',
            method: 'GET',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce); },
            success: function (events) {
                if (typeof renderGrowthChart === 'function') renderGrowthChart(events);
                if (typeof renderPreyChart === 'function') renderPreyChart(events);

                const listContainer = $('#setae-log-list');
                const sentinel = $('#log-sentinel');
                listContainer.empty();
                sentinel.empty();

                const wrapper = $('<div class="setae-timeline-wrapper"></div>');
                listContainer.append(wrapper);

                let currentOffset = 0;
                const BATCH_SIZE = 15;
                const totalEvents = events.length;
                let lastDateLabel = null;

                if (totalEvents === 0) {
                    listContainer.html('<div class="setae-card" style="text-align:center; padding:30px; background:none; box-shadow:none;"><p style="color:#999;">No history yet.</p></div>');
                    return;
                }

                renderBatch();

                if (totalEvents > BATCH_SIZE) {
                    const observer = new IntersectionObserver((entries) => {
                        if (entries[0].isIntersecting && currentOffset < totalEvents) {
                            sentinel.html('<div class="spinner" style="padding:20px; text-align:center; color:#ccc;">Loading...</div>');
                            setTimeout(() => {
                                renderBatch();
                                if (currentOffset >= totalEvents) {
                                    sentinel.html('<div class="end-of-log" style="padding:20px; text-align:center; color:#eee;">End of logs</div>');
                                    observer.unobserve(sentinel[0]);
                                } else {
                                    sentinel.empty();
                                }
                            }, 500);
                        }
                    }, { rootMargin: '200px' });
                    if (sentinel.length) observer.observe(sentinel[0]);
                } else {
                    sentinel.html('<div class="end-of-log" style="padding:20px; text-align:center; color:#eee;">End of logs</div>');
                }

                function renderBatch() {
                    const batch = events.slice(currentOffset, currentOffset + BATCH_SIZE);
                    currentOffset += BATCH_SIZE;

                    batch.forEach(e => {
                        const currentDateLabel = getRelativeDateLabel(e.date);
                        if (currentDateLabel !== lastDateLabel) {
                            const isToday = currentDateLabel === 'Today';
                            wrapper.append(`
                                <div class="timeline-date-label ${isToday ? 'is-today' : ''}">
                                    <span>${currentDateLabel}</span>
                                </div>`);
                            lastDateLabel = currentDateLabel;
                        }

                        let iconChar = '📝';
                        let nodeClass = 'node-default';
                        let displayMeta = '';
                        let isRefused = false;

                        let parsedData = {};
                        try {
                            if (typeof e.data === 'string' && e.data.trim().length > 0) {
                                parsedData = JSON.parse(e.data);
                                if (parsedData.prey_type) displayMeta += ` ${parsedData.prey_type}`;
                                if (parsedData.refused) {
                                    isRefused = true;
                                    displayMeta += ` <span style="color:#e74c3c; font-weight:bold; font-size:11px;">(REFUSED)</span>`;
                                }
                                if (e.type === 'growth' && parsedData.size) displayMeta += ` <b style="color:#3498db;">${parsedData.size}cm</b>`;
                            }
                        } catch (err) { }

                        const typeKey = (e.type || '').toLowerCase();
                        let typeLabel = e.type.toUpperCase(); // ラベル用変数を用意

                        // ▼ 追加: 植物判定
                        const isPlant = (currentClassification === 'plant');

                        if (typeKey === 'feed') {
                            if (isPlant) {
                                iconChar = '💧'; // Water
                                nodeClass = 'node-growth'; // 青系クラスを流用
                                typeLabel = 'WATER';
                                if (displayMeta) displayMeta = displayMeta.replace('Cricket', '').replace('Dubia', ''); // デフォルト値を消す
                            } else {
                                iconChar = isRefused ? '✕' : '🦗';
                                nodeClass = isRefused ? 'node-refused' : 'node-feed';
                            }
                        } else if (typeKey === 'molt') {
                            if (isPlant) {
                                iconChar = '🪴'; // Repot
                                nodeClass = 'node-molt';
                                typeLabel = 'REPOT';
                            } else {
                                iconChar = '🧬';
                                nodeClass = 'node-molt';
                            }
                        } else if (typeKey === 'growth') {
                            iconChar = '📏';
                            nodeClass = 'node-growth';
                        } else if (typeKey === 'note' || typeKey === 'memo') {
                            iconChar = '📝';
                            nodeClass = 'node-note';
                        } else {
                            iconChar = '📝';
                            nodeClass = 'node-note';
                        }

                        // [Added] Image display
                        const imageHtml = e.image
                            ? `<div style="margin-top:10px; margin-bottom:5px;">
                                 <img src="${e.image}" style="max-width:100%; border-radius:6px; max-height:200px; object-fit:cover; border:1px solid #eee;" loading="lazy">
                               </div>`
                            : '';

                        const noteText = e.note || parsedData.note || '';
                        const noteHtml = noteText && noteText.trim() !== ''
                            ? `<div class="timeline-note-content">${noteText}</div>`
                            : '';

                        const listRow = `
                            <div class="timeline-item log-card-animate">
                                <div class="timeline-node ${nodeClass}">${iconChar}</div>
                                <div class="timeline-content">
                                    <button class="btn-delete-log" data-id="${e.id}" title="削除">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                                        </svg>
                                    </button>
                                    <div class="timeline-card">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <span style="font-weight:600; font-size:14px; color:#333;">
                                                ${typeLabel} <span style="font-weight:normal; color:#666; font-size:13px;">${displayMeta}</span>
                                            </span>
                                            <span style="color:#aaa; font-size:11px;">${e.date}</span>
                                        </div>
                                        ${imageHtml}  ${noteHtml} 
                                    </div>
                                </div>
                            </div>
                        `;
                        wrapper.append(listRow);
                    });
                }
            }
        });
    }

    // Delete Log Event Handler
    $(document).on('click', '.btn-delete-log', function (e) {
        e.stopPropagation();
        if (!confirm('この記録を削除しますか？\n（この操作は取り消せません）')) {
            return;
        }

        const id = $(this).data('id');
        const $item = $(this).closest('.timeline-item');

        SetaeAPI.deleteLog(id, function () {
            $item.fadeOut(300, function () { $(this).remove(); });
        });
    });

    /**
     * Helper to toggle chart data state
     */
    function toggleChartDataState(canvasId, hasData) {
        const $canvas = $('#' + canvasId);
        const $container = $canvas.parent();

        $container.find('.chart-no-data').remove();

        if (hasData) {
            $canvas.removeClass('chart-hidden');
        } else {
            $canvas.addClass('chart-hidden');
            const noDataHtml = `
                <div class="chart-no-data">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    <span>No Data Available</span>
                </div>
            `;
            $container.append(noDataHtml);
        }
    }

    /**
     * 成長グラフと脱皮履歴テーブルを描画
     */
    function renderGrowthChart(logs) {
        const ctx = document.getElementById('growthChart');
        if (!ctx) return;

        const $container = $(ctx).closest('.chart-container');

        // 既存のテーブルを削除 (初期化)
        $container.find('.molt-history-container').remove();
        $container.next('.molt-history-container').remove();

        // 2. データの準備（サイズ記録があるログのみ抽出・パース）
        const sizeLogs = logs.map(l => {
            let sizeVal = 0;
            if (l.size) {
                sizeVal = parseFloat(l.size);
            } else if (l.data) {
                try {
                    const d = typeof l.data === 'string' ? JSON.parse(l.data) : l.data;
                    if (d.size) sizeVal = parseFloat(d.size);
                } catch (e) { }
            }
            return { ...l, sizeVal: sizeVal };
        })
            .filter(l => l.sizeVal > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // ★追加: データ有無による表示切り替え
        const hasData = sizeLogs.length > 0;
        toggleChartDataState('growthChart', hasData);

        // 3. チャート描画 (Chart.js)
        if (window.setaeGrowthChart instanceof Chart) {
            window.setaeGrowthChart.destroy();
        }

        if (hasData) {
            window.setaeGrowthChart = new Chart(ctx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: sizeLogs.map(l => l.date),
                    datasets: [{
                        label: 'Leg Span (cm)',
                        data: sizeLogs.map(l => l.sizeVal),
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.15)',
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#2ecc71',
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: true, grid: { display: false } },
                        y: { beginAtZero: false, title: { display: true, text: 'cm' } }
                    }
                }
            });
        }


        // ==========================================
        // ★脱皮履歴テーブル (Pro View)
        // ==========================================
        const moltLogs = logs
            .filter(l => l.type === 'molt')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (moltLogs.length > 0) {
            let rows = '';
            moltLogs.forEach((m, i) => {
                // 前回脱皮からの経過日数を計算
                let interval = '-';
                let intervalClass = '';

                if (i < moltLogs.length - 1) {
                    const current = new Date(m.date);
                    const prev = new Date(moltLogs[i + 1].date);
                    const diffTime = Math.abs(current - prev);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    interval = `${diffDays} days`;
                    intervalClass = 'color:#27ae60; font-weight:bold;';
                }

                // ★変更: SIZEの代わりに脱皮回数(NO.)を計算
                // リストは新しい順(降順)なので、(総数 - インデックス) で 1, 2, 3... となる
                const countVal = moltLogs.length - i;

                rows += `
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:10px 8px; color:#555;">${m.date}</td>
                        <td style="padding:10px 8px; ${intervalClass}">${interval}</td>
                        <td style="padding:10px 8px; color:#666; font-weight:bold;">#${countVal}</td>
                    </tr>
                `;
            });

            // ▼ 追加: タイトル切り替え
            const historyTitle = (currentClassification === 'plant') ? 'REPOT HISTORY' : 'MOLT HISTORY';

            const tableHtml = `
                <div class="molt-history-container" style="margin-top:24px; border-top:2px solid #f5f5f5; padding-top:16px;">
                    <div style="font-size:12px; font-weight:bold; color:#999; text-transform:uppercase; margin-bottom:8px; letter-spacing:1px;">${historyTitle}</div>
                    <table style="width:100%; border-collapse:collapse; font-size:13px; line-height:1.4;">
                        <thead>
                            <tr style="text-align:left; color:#aaa; font-size:11px; border-bottom:1px solid #eee;">
                                <th style="padding:4px 8px; font-weight:normal;">DATE</th>
                                <th style="padding:4px 8px; font-weight:normal;">INTERVAL</th>
                                <th style="padding:4px 8px; font-weight:normal;">NO.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;

            // レイアウト崩れ防止のためコンテナの後ろに追加
            $container.after(tableHtml);
        }
    }

    function renderPreyChart(logs) {
        const ctx = document.getElementById('preyChart');
        if (!ctx) return;

        if (window.setaePreyChart instanceof Chart) window.setaePreyChart.destroy();

        const counts = {};
        logs.forEach(log => {
            if (log.type === 'feed') {
                let isRefused = false;
                let preyName = 'Cricket';
                try {
                    const d = JSON.parse(log.data);
                    if (d.refused) isRefused = true;
                    if (d.prey_type) preyName = d.prey_type;
                } catch (e) { }

                if (!isRefused) {
                    counts[preyName] = (counts[preyName] || 0) + 1;
                }
            }
        });

        const labels = Object.keys(counts);
        const data = Object.values(counts);

        // ★追加: データ有無による表示切り替え
        const hasData = labels.length > 0;
        toggleChartDataState('preyChart', hasData);

        if (hasData) {
            const palette = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c', '#1abc9c', '#34495e'];

            window.setaePreyChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } }
                        }
                    }
                }
            });
        }
    }

    function deleteSpider(id) {
        if (!confirm('本当に削除しますか？')) return;
        $.ajax({
            url: SetaeCore.state.apiRoot + '/spiders/' + id,
            method: 'DELETE',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce); },
            success: function () {
                SetaeCore.showToast('削除しました', 'success');
                $('#modal-edit-spider').fadeOut(); // ★追加: モーダルを閉じる
                $('#section-my-detail').hide();
                $('#section-my').fadeIn();
                if (window.SetaeUI && SetaeUI.renderMySpiders) {
                    SetaeAPI.fetchMySpiders(SetaeUI.renderMySpiders);
                }
            },
            error: function () {
                SetaeCore.showToast('削除に失敗しました', 'error');
            }
        });
    }


    // ==========================================
    // Edit Spider Modal Logic
    // ==========================================
    $(document).on('click', '#btn-edit-spider-trigger', function () {
        const spiderId = currentSpiderId;
        if (!spiderId) return;
        // リスト取得は不要になったので直接開く
        openEditModal(spiderId);
    });

    function openEditModal(spiderId) {
        SetaeAPI.getSpiderDetail(spiderId, function (data) {
            $('#edit-spider-id').val(data.id);
            $('#edit-spider-name').val(data.title);

            // ▼ 修正: 種類入力のハンドリング
            const $searchWrapper = $('#wrapper-edit-species-search');
            const $searchInput = $('#edit-spider-species-search');
            const $hiddenId = $('#edit-spider-species-id');
            const $customInput = $('#edit-spider-species-custom');
            const $toggleBtn = $('#btn-toggle-edit-species-input');

            // DBに登録された種類IDを持っているか確認
            if (data.species_id && data.species_id != 0) {
                // DBモード: 検索窓を表示し、初期値をセット
                $searchWrapper.show();
                $searchInput.val(data.species_name); // 名前を表示
                $hiddenId.val(data.species_id);      // IDを裏で保持

                $customInput.hide().val('');
                $toggleBtn.text('手入力に切り替え');
            } else {
                // 手入力モード
                $searchWrapper.hide();
                $searchInput.val('');
                $hiddenId.val('');

                $customInput.val(data.species_name || data.species || '').show();
                $toggleBtn.text('リストから選択');
            }

            // Gender
            const gender = data.gender || 'unknown';
            $(`input[name="edit_spider_gender"][value="${gender}"]`).prop('checked', true);

            // Preview Image
            if (data.thumb) {
                $('#edit-preview-img-tag').attr('src', data.thumb);
                $('#edit-spider-image-preview').show();
            } else {
                $('#edit-spider-image-preview').hide();
            }

            $('#modal-edit-spider').fadeIn();
        });
    }

    // ▼ 追加: 種類入力モードの切り替えイベント
    $(document).on('click', '#btn-toggle-edit-species-input', function (e) {
        e.preventDefault();
        const $searchWrapper = $('#wrapper-edit-species-search');
        const $custom = $('#edit-spider-species-custom');

        if ($searchWrapper.is(':visible')) {
            $searchWrapper.hide();
            $custom.show().focus();
            $(this).text('リストから選択');
            // モード切替時はIDをクリア
            $('#edit-spider-species-id').val('');
        } else {
            $custom.hide();
            $searchWrapper.show();
            $(this).text('手入力に切り替え');
            // カスタム入力をクリア
            $('#edit-spider-species-custom').val('');
        }
    });

    // ==========================================
    // ★追加: 編集モーダル用 オートコンプリート
    // ==========================================
    let editSearchTimer = null;

    // ① 入力イベント (検索トリガー)
    $(document).on('input', '#edit-spider-species-search', function () {
        const term = $(this).val();

        // 入力内容が変わったら、裏で保持しているIDをクリアする (リストからの再選択を強制)
        $('#edit-spider-species-id').val('');

        if (editSearchTimer) clearTimeout(editSearchTimer);

        // 2文字未満は検索しない (負荷軽減)
        if (term.length < 2) {
            $('#edit-spider-species-suggestions').hide();
            return;
        }

        editSearchTimer = setTimeout(function () {
            // API経由で検索
            SetaeAPI.searchSpecies(term, function (results) {
                if (!results || results.length === 0) {
                    $('#edit-spider-species-suggestions').hide();
                    return;
                }

                let html = '';
                results.forEach(s => {
                    const jaDisplay = s.ja_name ? `<span style="font-size:12px; color:#666; font-weight:normal; margin-left:8px;">(${s.ja_name})</span>` : '';

                    // ★重要: クラス名を .edit-suggestion-item にして、新規登録用と区別します
                    html += `<div class="edit-suggestion-item" data-id="${s.id}" data-name="${s.title}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0;">
                        <div style="font-weight:bold; font-size:14px;">${s.title}${jaDisplay}</div>
                        <div style="font-size:12px; color:#888;">${s.genus || ''}</div>
                    </div>`;
                });

                // 結果を表示
                $('#edit-spider-species-suggestions').html(html).show();
            });
        }, 300); // 0.3秒の遅延 (連打防止)
    });

    // ② 候補クリック時の処理
    $(document).on('click', '.edit-suggestion-item', function () {
        const name = $(this).data('name');
        const id = $(this).data('id');

        // 選択した名前とIDをセット
        $('#edit-spider-species-search').val(name);
        $('#edit-spider-species-id').val(id);

        // サジェストを隠す
        $('#edit-spider-species-suggestions').hide();
    });

    // ③ 候補外クリックで閉じる
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#wrapper-edit-species-search').length) {
            $('#edit-spider-species-suggestions').hide();
        }
    });

    // Delete Button Handler
    $(document).on('click', '#btn-delete-spider', function () {
        const id = $('#edit-spider-id').val();
        SetaeUIDetail.deleteSpider(id);
    });

    // Modal Image Upload Trigger
    $(document).on('click', '#btn-trigger-edit-upload', function () {
        $('#edit-spider-image').click();
    });

    // Modal Image Preview
    $(document).on('change', '#edit-spider-image', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#edit-preview-img-tag').attr('src', e.target.result);
                $('#edit-spider-image-preview').fadeIn();
            };
            reader.readAsDataURL(file);
        }
    });

    // Remove Image
    $(document).on('click', '#btn-remove-edit-image', function () {
        $('#edit-preview-img-tag').attr('src', '');
        $('#edit-spider-image-preview').fadeOut();
        $('#edit-spider-image').val('');
    });

    // ★Added: BL Settings Card Rendering & Event Handling (Updated for Tabs)
    function renderBLSettingsCard(spider, targetSelector = '#section-my-detail') {
        const blStatus = spider.bl_status || 'none';
        const blTerms = spider.bl_terms || '';

        const html = `
        <div id="bl-settings-card" class="setae-card" style="border-left:4px solid #2ecc71; margin-top:10px; background:#fafffa;">
            <h4 style="margin-top:0; color:#27ae60; display:flex; align-items:center; gap:6px;">
                <span>🤝</span> Breeding Loan Settings
            </h4>
            <p style="font-size:12px; color:#666; margin-bottom:15px;">
                この個体をブリーディングローン(BL)候補として公開設定します。<br>
                「募集中」にすると、コミュニティのBLボードに掲載されます。
            </p>
            <div style="margin-bottom:15px;">
                <label style="font-size:12px; font-weight:bold; color:#333; display:block; margin-bottom:6px;">Status</label>
                <select id="bl-status-select" class="setae-input" style="width:100%; padding:10px;">
                    <option value="none" ${blStatus === 'none' ? 'selected' : ''}>⛔ 募集停止 (Private)</option>
                    <option value="recruiting" ${blStatus === 'recruiting' ? 'selected' : ''}>✅ 募集中 (Recruiting)</option>
                    <option value="loaned" ${blStatus === 'loaned' ? 'selected' : ''}>🤝 貸出中 (Loaned)</option>
                </select>
            </div>
            <div style="margin-bottom:15px;">
                <label style="font-size:12px; font-weight:bold; color:#333; display:block; margin-bottom:6px;">Terms & Conditions</label>
                <textarea id="bl-terms-input" class="setae-input" rows="4" placeholder="条件を入力 (例: 子返し50%、発送は翌日着地域のみ、死着保証なし等)" style="width:100%; padding:10px;">${blTerms}</textarea>
            </div>
            <div style="text-align:right;">
                <button id="btn-save-bl-settings" class="setae-btn-sm btn-primary" data-id="${spider.id}" style="width:100%;">設定を保存</button>
            </div>
        </div>
        `;

        // Check if append to specific target or default
        if (targetSelector === '#section-my-detail') {
            $('#section-my-detail').append(html);
        } else {
            $(targetSelector).append(html);
        }

        // Event Handler
        $('#btn-save-bl-settings').off('click').on('click', function () {
            const status = $('#bl-status-select').val();
            const terms = $('#bl-terms-input').val();
            const id = $(this).data('id');

            const formData = new FormData();
            formData.append('bl_status', status);
            formData.append('bl_terms', terms);

            SetaeAPI.updateSpider(id, formData, function (response) {
                SetaeCore.showToast('BL設定を更新しました', 'success');
                // Update local data
                if (response.data) {
                    spider.bl_status = response.data.bl_status;
                    spider.bl_terms = response.data.bl_terms;
                }
            });
        });
    }



    // Close Modal (Icon & Cancel Button)
    $(document).on('click', '#close-edit-spider, #close-edit-spider-btn', function () {
        $('#modal-edit-spider').fadeOut();
    });

    // Submit Edit Form
    $(document).on('submit', '#form-edit-spider', function (e) {
        e.preventDefault();
        const id = $('#edit-spider-id').val();

        // Manual FormData construction for robustness
        // Manual FormData construction for robustness
        const formData = new FormData();

        // ▼ 修正: バリデーションとデータ取得
        if ($('#wrapper-edit-species-search').is(':visible')) {
            // DB検索モードの場合
            const speciesId = $('#edit-spider-species-id').val();

            // ★必須チェック: IDが空（＝リストから選んでいない）ならエラー
            if (!speciesId) {
                SetaeCore.showToast('種類をリストから選択してください', 'warning');
                return;
            }
            formData.append('species_id', speciesId);

        } else {
            // 手入力モードの場合
            const customName = $('#edit-spider-species-custom').val();
            if (!customName) {
                SetaeCore.showToast('種類名を入力してください', 'warning');
                return;
            }
            formData.append('species_name', customName);
        }
        // ▲ 修正ここまで
        formData.append('name', $('#edit-spider-name').val()); // Matches PHP 'name' expectation (which maps to post_title/nickname)
        formData.append('gender', $('input[name="edit_spider_gender"]:checked').val()); // ★Adde: Gender

        // [Fix] Check for file input manually since it might lack 'name' attribute or be outside form context
        const imageFile = $('#edit-spider-image')[0].files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        SetaeAPI.updateSpider(id, formData, function (response) {
            SetaeCore.showToast('個体情報を更新しました', 'success');
            $('#modal-edit-spider').fadeOut();

            // Server response (fresh data)
            if (response.data) {
                renderSpiderDetailSection(response.data);
            } else {
                loadSpiderDetail(id);
            }

            // Update List in Background
            if (window.SetaeUI && SetaeUI.renderMySpiders) {
                SetaeAPI.fetchMySpiders(SetaeUI.renderMySpiders);
            }
        });
    });


    return {
        loadSpiderDetail: loadSpiderDetail,
        render: renderSpiderDetailSection,
        deleteSpider: deleteSpider,
        loadSpiderLogs: loadSpiderLogs,
        renderBLSettingsCard: renderBLSettingsCard
    };

})(jQuery);
