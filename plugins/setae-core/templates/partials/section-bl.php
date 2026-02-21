<?php
/**
 * Partial: Breeding Loan Section
 */
?>
<div id="section-bl" class="setae-section" style="display:none;">
    <div class="setae-card">
        <h3><?php esc_html_e('Breeding Loan Match', 'setae-core'); ?></h3>
        <div class="setae-toolbar" style="margin-top:10px;">
            <button class="setae-btn-sm active" id="btn-bl-board"><?php esc_html_e('募集中', 'setae-core'); ?></button>
            <button class="setae-btn-sm" id="btn-bl-contracts"><?php esc_html_e('契約管理', 'setae-core'); ?></button>
        </div>
    </div>

    <div id="bl-board-view">
        <div id="setae-bl-grid">
            <!-- JS Populated -->
        </div>
    </div>

    <div id="bl-contracts-view" style="display:none;">
        <div id="setae-contracts-list">
            <!-- JS Populated -->
        </div>
    </div>
</div>