<?php
/**
 * Partial: Baby Group Management
 */
?>
<div id="section-baby" class="setae-section" style="display:none; padding-bottom: 90px;">
    <div class="setae-header-bar baby-header" style="margin-top: 10px;">
        <div>
            <h3>ベビー管理</h3>
            <p>現在の管理と、これまでのベビー飼育記録</p>
        </div>
    </div>

    <section id="baby-dashboard" class="baby-dashboard" style="display:none;" aria-live="polite"></section>

    <div class="baby-layout">
        <div class="baby-sidebar">
            <div class="baby-list-panel">
                <div class="baby-list-head">
                    <strong>ベビー群</strong>
                    <div class="baby-list-head-actions">
                        <button type="button" id="baby-toggle-create" class="baby-toggle-create" aria-haspopup="dialog" aria-controls="baby-create-modal" aria-expanded="false">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                                <path d="M12 5v14M5 12h14"></path>
                            </svg>
                            <span>ベビー群を追加</span>
                        </button>
                    </div>
                </div>
                <div id="baby-group-scope-tabs" class="baby-group-scope-tabs" role="tablist" aria-label="ベビー群の表示切替"></div>
                <div id="baby-group-list" class="baby-group-list"></div>
            </div>
        </div>
        <div id="baby-group-detail" class="baby-group-detail"></div>
    </div>
</div>
