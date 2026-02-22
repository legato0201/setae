<?php
/**
 * クレジット / ライセンス表示用モーダル
 */
?>
<div id="setae-credits-modal" class="setae-modal" style="display:none; z-index: 100005;">
    <div class="setae-modal-content" style="max-width: 400px; max-height: 80vh; overflow-y: auto;">

        <div class="profile-header" style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 18px;">アプリについて</h3>
            <span class="setae-close" id="close-credits-modal">×</span>
        </div>

        <div class="credits-body" style="font-size: 13px; color: #555; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h4 style="margin: 0 0 5px 0; color: #333;">SETAE</h4>
                <p style="margin: 0; font-size: 12px; color: #999;">Version 1.0.0</p>
            </div>

            <div style="margin-bottom: 20px;">
                <p style="margin: 0;">&copy;
                    <?php echo date('Y'); ?> 中野かえる商店 All Rights Reserved.
                </p>
            </div>

            <h5 style="margin: 0 0 5px 0; font-size: 14px; border-bottom: 1px dashed #ccc; padding-bottom: 3px;">Credits
                & Licenses</h5>

            <div style="margin-bottom: 10px;">
                <strong>Twemoji (SVG Icons)</strong><br>
                <span style="font-size: 11px;">Graphics licensed under CC-BY 4.0 by Twitter, Inc and other
                    contributors.</span>
            </div>

            <div style="margin-bottom: 10px;">
                <strong>Chart.js</strong><br>
                <span style="font-size: 11px;">Released under the MIT License.</span>
            </div>

            <div style="margin-bottom: 10px;">
                <strong>QRCode.js</strong><br>
                <span style="font-size: 11px;">Released under the MIT License.</span>
            </div>

            <div style="margin-top: 25px; text-align: center;">
                <a href="https://nakano2835.com/2024/07/28/terms/"
                    style="color: #3498db; text-decoration: none; margin-right: 15px;">利用規約</a>
                <a href="https://nakano2835.com/privacy-policy/"
                    style="color: #3498db; text-decoration: none;">プライバシーポリシー</a>
            </div>
        </div>

    </div>
</div>