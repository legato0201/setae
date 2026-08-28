# SETAE v1.0.242 Release Checklist

Build: `1.0.242`  
Status: **CANDIDATE**  
Date: 2026-08-27

自動検証、デスクトップ目視、物理端末・プリンター検証を分離する。実機項目はDevice / OS / BrowserまたはDriver / Result / Evidenceが記録されるまでPASSにしない。

## Automated / Desktop Evidence

| Area | Environment | Status | Evidence |
|---|---|---|---|
| Product UX task flows | Headless Chrome on macOS | PASS | `release-evidence/v1.0.242/browser-product-ux-qa.json` |
| Form safety | Headless Chrome on macOS | PASS | `release-evidence/v1.0.242/browser-form-safety-qa.json` |
| Form validation | Headless Chrome on macOS | PASS | `release-evidence/v1.0.242/browser-form-validation-qa.json` |
| Offline task flow | Headless Chrome on macOS | PASS | `release-evidence/v1.0.242/browser-offline-task-flow-qa.json` |
| Visual Craft | Headless Chrome, 9 widths, Light/Dark | PASS | `release-evidence/v1.0.242/browser-qa.json` |
| Product screenshots | 390 / 768 / 1440px, Light/Dark | PASS | `release-evidence/v1.0.242/screenshots/` (72 images) |
| Geometry | 320 / 360 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440px | PASS | 540/540 cases; overflow、visible h1、nested interactive、44px target、consoleを検査 |
| Performance regression | Chrome, v1.0.241 / v1.0.242 same fixture | PASS | `release-evidence/v1.0.242/browser-performance-v242-qa.json` |
| JavaScript unit | Node.js | PASS | 68/68 |
| PHP unit | PHP CLI | PASS | 12/12 |
| JavaScript / CJS syntax | Node.js | PASS | 204/204 |
| First-party PHP lint | PHP CLI | PASS | 81/81 |

## Physical Device / Print Evidence

| Area | Required environment | Status | Device / Result / Evidence |
|---|---|---|---|
| iPhone Safari date fields | Physical iPhone / Safari | NOT RUN | 未実施 |
| iPhone PWA date fields | Physical iPhone / Home Screen PWA | NOT RUN | 未実施 |
| iPhone PWA navigation / safe area / keyboard / back / draft guard | Installed PWA | NOT RUN | 未実施 |
| PWA 1.0.241 to 1.0.242 update | Installed production-equivalent PWA | NOT RUN | 未実施 |
| QR camera permission / lifecycle | Physical iPhone and Android | NOT RUN | 未実施 |
| QR image import | Physical phone photo library / files | NOT RUN | 未実施 |
| A4 label output | Physical A4 printer and driver | NOT RUN | 未実施 |
| 12mm tape 18 / 24 / 36 / 50 / 70mm | Physical label printer and driver | NOT RUN | 未実施 |
| Human usability test | Target user | NOT RUN | `docs/usability-test-v1.0.242.md` |

## Performance Note

6操作のv1.0.241比中央値はすべて15%未満の変化だった。変化率はCollection 500件 -1.06%、検索 -11.02%、Specimen -1.57%、Quick Record -1.28%、Nursery 500件 +1.22%、Records 1000件 +1.92%。1000件Ledgerを一度にDOMへ挿入する合成ケースでは最大189.5msのJavaScript実行を検出した。v1.0.241からの回帰ではないが、将来の段階描画またはserver-side pagination候補として追跡する。

## Candidate Boundary

コード、自動task flow、画面geometry、Light/Dark、性能回帰、配布物整合性は公開候補として検証する。物理端末、カメラ、PWA更新、実印刷、実ユーザー検証が未実施のため、Release Statusは**CANDIDATE**を維持する。
