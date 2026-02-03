var SetaeUIDetail = (function ($) {
    'use strict';

    let currentSpiderId = null;

    // ==========================================
    // DEEP DETAIL VIEW
    // ==========================================
    function loadSpiderDetail(id) {
        currentSpiderId = id;
        $.ajax({
            url: SetaeCore.state.apiRoot + '/spider/' + id,
            method: 'GET',
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

        $('#detail-spider-molt').text(spider.last_molt || '-');
        $('#detail-spider-feed').text(spider.last_feed || '-');

        $('.section-calendar').remove();

        // 記録ボタンをタイムラインヘッダー横に復活させる
        const $timelineSection = $('.setae-timeline-section');
        if ($timelineSection.find('#btn-add-log').length === 0) {
            const $title = $timelineSection.find('h4');
            if (!$title.parent().hasClass('timeline-header-flex')) {
                $title.wrap('<div class="timeline-header-flex" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;"></div>');
            }
            const btnHtml = `
                <button id="btn-add-log" class="setae-btn" 
                    style="background:#2ecc71; color:white; border:none; padding:6px 16px; border-radius:20px; font-weight:bold; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size:14px;">
                    + Record
                </button>`;
            $title.parent().append(btnHtml);
            $title.css('margin', '0');
        }

        // Cycle (Status) Visuals
        const statusMap = {
            'normal': { label: 'Normal', color: '#2c3e50', bg: '#ecf0f1' },
            'fasting': { label: 'Fasting', color: '#d35400', bg: '#fadbd8' },
            'pre_molt': { label: 'Pre-molt', color: '#c0392b', bg: '#fdedec' },
            'post_molt': { label: 'Post-molt', color: '#2980b9', bg: '#d4e6f1' },
        };
        const currentStatus = statusMap[spider.status] || statusMap['normal'];

        let $cycleBadge = $('#detail-spider-cycle');
        if ($cycleBadge.length === 0) {
            $cycleBadge = $('.status-label:contains("Cycle")').next('strong');
        }

        $cycleBadge.text(currentStatus.label);
        $cycleBadge.css({ 'color': currentStatus.color });

        // Show Section
        const $detailSection = $('#section-my-detail');
        if ($detailSection.is(':visible')) {
            $detailSection.show();
        } else {
            $('#section-my').hide();
            $detailSection.fadeIn().css('display', 'block');
        }

        // ログ読み込み開始
        loadSpiderLogs(spider.id);
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
                        if (typeKey === 'feed') {
                            iconChar = isRefused ? '✕' : '🦗';
                            nodeClass = isRefused ? 'node-refused' : 'node-feed';
                        } else if (typeKey === 'molt') {
                            iconChar = '🧬';
                            nodeClass = 'node-molt';
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
                                <div class="timeline-card">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="font-weight:600; font-size:14px; color:#333;">
                                            ${e.type.toUpperCase()} <span style="font-weight:normal; color:#666; font-size:13px;">${displayMeta}</span>
                                        </span>
                                        <span style="color:#aaa; font-size:11px;">${e.date}</span>
                                    </div>
                                    ${imageHtml}  ${noteHtml} 
                                </div>
                            </div>
                        `;
                        wrapper.append(listRow);
                    });
                }
            }
        });
    }

    function renderGrowthChart(logs) {
        const ctx = document.getElementById('growthChart');
        if (!ctx) return;

        if (window.setaeGrowthChart instanceof Chart) window.setaeGrowthChart.destroy();

        const growthData = logs
            .filter(l => l.type === 'molt' || l.type === 'growth')
            .map(l => {
                let size = 0;
                try {
                    const d = JSON.parse(l.data);
                    if (d.size) size = parseFloat(d.size);
                } catch (e) { }
                return { x: l.date, y: size };
            })
            .filter(p => p.y > 0)
            .reverse();

        window.setaeGrowthChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: growthData.map(d => d.x),
                datasets: [{
                    label: 'Leg Span (cm)',
                    data: growthData.map(d => d.y),
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.15)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#2ecc71',
                    pointRadius: 5,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { beginAtZero: false, grid: { borderDash: [5, 5] } }
                }
            }
        });
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

    function deleteSpider(id) {
        if (!confirm('本当に削除しますか？')) return;
        $.ajax({
            url: SetaeCore.state.apiRoot + '/spiders/' + id,
            method: 'DELETE',
            beforeSend: function (xhr) { xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce); },
            success: function () {
                SetaeCore.showToast('削除しました', 'success');
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

        // Populate Species Options if empty
        const $speciesSelect = $('#edit-spider-species-select');
        if ($speciesSelect.find('option').length <= 1) {
            SetaeAPI.fetchSpecies('', function (speciesList) {
                speciesList.forEach(sp => {
                    $speciesSelect.append(new Option(sp.title, sp.id));
                });
                openEditModal(spiderId);
            });
        } else {
            openEditModal(spiderId);
        }
    });

    function openEditModal(spiderId) {
        SetaeAPI.getSpiderDetail(spiderId, function (data) {
            $('#edit-spider-id').val(data.id);
            $('#edit-spider-name').val(data.title);

            if (data.species_id) {
                $('#edit-spider-species-select').val(data.species_id);
            }

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
        $('#edit-spider-image').val(''); // Clear input
        $('#edit-preview-img-tag').attr('src', '');
        $('#edit-spider-image-preview').hide();
        // Note: This only clears the *new* upload. To remove existing, we might need a flag. 
        // For simplicity, we just hide preview. 
    });

    // Close Modal
    $(document).on('click', '#close-edit-spider', function () {
        $('#modal-edit-spider').fadeOut();
    });

    // Submit Edit Form
    $(document).on('submit', '#form-edit-spider', function (e) {
        e.preventDefault();
        const id = $('#edit-spider-id').val();
        const formData = new FormData(this);

        // Append ID to path, but also can be in data
        $.ajax({
            url: SetaeCore.state.apiRoot + '/spiders/' + id,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            beforeSend: function (xhr) {
                xhr.setRequestHeader('X-WP-Nonce', SetaeCore.state.nonce);
            },
            success: function (response) {
                SetaeCore.showToast('個体情報を更新しました', 'success');
                $('#modal-edit-spider').fadeOut();
                loadSpiderDetail(id); // Reload view

                // Refresh list if needed (optional)
                if (window.SetaeUI && SetaeUI.renderMySpiders) {
                    SetaeAPI.fetchMySpiders(SetaeUI.renderMySpiders);
                }
            },
            error: function () {
                SetaeCore.showToast('更新に失敗しました', 'error');
            }
        });
    });

    return {
        loadSpiderDetail: loadSpiderDetail,
        render: renderSpiderDetailSection,
        deleteSpider: deleteSpider,
        loadSpiderLogs: loadSpiderLogs
    };

})(jQuery);
