# SETAE v1.0.243 Release Checklist

Build: `1.0.243`  
Status: **CANDIDATE**  
Date: 2026-08-27

自動検証、Desktop Browser検証、物理端末・プリンター・実ユーザー検証を分離する。Device / OS / BrowserまたはPrinter Driver / Result / Evidenceが記録されるまで、物理検証をPASSにしない。

## Automated / Desktop Evidence

| Area | Environment | Status | Evidence |
|---|---|---|---|
| Render Island identity | Headless Chrome, 15 iterations | PASS | `release-evidence/v1.0.243/browser-render-islands-qa.json` |
| Records / Nursery data scale | Headless Chrome, 15 iterations | PASS | `release-evidence/v1.0.243/browser-data-scale-v243-qa.json` |
| Media lazy / fallback / CLS | Headless Chrome | PASS | `release-evidence/v1.0.243/browser-media-loading-qa.json` |
| Scroll / focus / draft / camera element continuity | Headless Chrome | PASS | `release-evidence/v1.0.243/browser-interaction-continuity-qa.json` |
| Product UX task flows | Headless Chrome | PASS | `release-evidence/v1.0.243/browser-product-ux-qa.json` |
| Form Safety / Validation | Headless Chrome | PASS | `release-evidence/v1.0.243/browser-form-*-qa.json` |
| Offline task flow | Headless Chrome | PASS | `release-evidence/v1.0.243/browser-offline-task-flow-qa.json` |
| v1.0.242 performance comparison | Headless Chrome, 15 iterations | PASS | `release-evidence/v1.0.243/browser-performance-v242-qa.json` |
| Visual Craft | Headless Chrome, 9 widths, Light/Dark | PASS | `release-evidence/v1.0.243/browser-qa.json` |
| Product screenshots | 390 / 768 / 1440px, Light/Dark | PASS | `release-evidence/v1.0.243/screenshots/` (72 images) |
| JavaScript unit | Node.js | PASS | 72/72 |
| PHP unit | PHP CLI | PASS | 12/12 |

## Performance Evidence

| Operation | Result | Budget |
|---|---:|---:|
| Records initial 100 / 1000 | 16.5 ms median | <= 80 ms |
| Records add 100 | 14.8 ms median | <= 50 ms |
| Nursery initial 100 / 500 | 10.4 ms median | <= 60 ms |
| Nursery add 100 | 10.6 ms median | <= 40 ms |
| Toast update | 0.2 ms median | <= 16 ms |
| Overlay update | 0.2 ms median | <= 50 ms |
| Collection search / 500 | 21.5 ms median | 16 ms target; v1.0.242 21.8 msより改善 |
| JavaScript Long Task > 100 ms | 0 | 0 |
| CLS | 0 | < 0.1 |

## Physical Device / Print Evidence

| Area | Required environment | Status | Device / Result / Evidence |
|---|---|---|---|
| iPhone Safari date fields and daily flows | Physical iPhone / Safari | NOT RUN | 未実施 |
| iPhone Home Screen PWA / Safe Area / Keyboard / Back | Installed PWA | NOT RUN | 未実施 |
| Android camera / back / file / date | Physical Android | NOT RUN | 未実施 |
| PWA 1.0.242 to 1.0.243 update | Installed production-equivalent PWA | NOT RUN | 未実施 |
| QR camera permission and lifecycle | Physical iPhone or Android | NOT RUN | 未実施 |
| QR image import | Physical phone photo library / files | NOT RUN | 未実施 |
| VoiceOver main flows | Physical iPhone / VoiceOver | NOT RUN | 未実施 |
| A4 label output | Physical A4 printer and driver | NOT RUN | 未実施 |
| 12mm tape 18 / 24 / 36 / 50 / 70mm | Physical label printer and driver | NOT RUN | 未実施 |
| Micro ID QR scan | Printed label and physical phone | NOT RUN | 未実施 |
| Human usability test | Target user | NOT RUN | `docs/usability-test-v1.0.243.md` |

## Candidate Boundary

コード、Desktop自動操作、性能、画面geometry、Light/Dark、配布物整合性は公開候補として検証する。物理端末、実PWA更新、カメラ、VoiceOver、実印刷、実ユーザー検証が未実施のため、Release Statusは**CANDIDATE**を維持する。
