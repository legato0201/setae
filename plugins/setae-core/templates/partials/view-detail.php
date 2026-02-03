<?php
// My Spiders Detail Section (Hidden by Default)
?>
<div id="section-my-detail" class="setae-section" style="display: none;">
    <div class="setae-card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <button class="setae-btn-text" id="btn-back-to-list"
                style="margin-right:15px; font-size:18px; color:var(--setae-primary); border:none; background:none; cursor:pointer;">
                ← Back
            </button>
            <h3 style="margin:0;" id="detail-spider-name">Spider Name</h3>
            <!-- Edit Button (Pencil) Trigger -->
            <button id="btn-edit-spider-trigger" class="setae-btn"
                style="padding:5px 10px; font-size:20px; background:rgba(0,0,0,0.05); border-radius:50%;">✏️</button>
        </div>
    </div>

    <div class="setae-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
        <!-- Info Column -->
        <div class="setae-card">
            <h4 style="border-bottom:1px solid #eee; padding-bottom:5px;">基本情報</h4>
            <p><strong>種類:</strong> <span id="detail-spider-species">Species Name</span></p>
            <p><strong>最終脱皮:</strong> <span id="detail-spider-molt">-</span></p>
            <p><strong>最終給餌:</strong> <span id="detail-spider-feed">-</span></p>

            <!-- Prey Stats Placeholder -->
            <div id="prey-stats-wrapper" style="margin-top: 20px; display: block;">
                <canvas id="preyChart" style="max-height: 200px; width: 100%; display: block;"></canvas>
            </div>
        </div>

        <!-- Growth Graph Column -->
        <div class="setae-card">
            <h4 style="border-bottom:1px solid #eee; padding-bottom:5px;">成長記録 (Instar / Size)</h4>
            <canvas id="growthChart" style="max-height: 200px; width: 100%; display: block;"></canvas>
        </div>
    </div>

    <!-- Calendar Section -->
    <div class="setae-card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h4>Feeding &amp; Molt Log</h4>
            <div style="display:flex; gap:10px;">
                <button id="cal-prev" class="setae-btn-sm">&lt;</button>
                <span id="cal-month-label" style="font-weight:bold; padding-top:5px;">YYYY.MM</span>
                <button id="cal-next" class="setae-btn-sm">&gt;</button>
            </div>
        </div>
        <div id="setae-calendar" class="setae-calendar-grid">
            <!-- JS populated -->
        </div>
        <!-- Add Log Button moved to here for visibility -->
        <div style="text-align:right; margin-top:15px;">
            <button id="btn-add-log" class="setae-btn setae-btn-primary">+ 記録追加</button>
        </div>
    </div>

    <!-- Recent Logs List with Images -->
    <div class="setae-card">
        <h4>Log History</h4>
        <div id="setae-log-list" style="display:flex; flex-direction:column; gap:10px;">
            <!-- JS populated -->
        </div>
        <div id="log-sentinel" style="height:20px; text-align:center;"></div>
    </div>
</div>