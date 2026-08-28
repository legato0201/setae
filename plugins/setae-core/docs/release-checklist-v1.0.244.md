# SETAE v1.0.244 Release Checklist

Build: `1.0.244`  
Status: **CANDIDATE**  
Date: 2026-08-27

自動検証、Desktop Browser検証、物理端末・プリンター・実ユーザー検証を分離する。Device / OS / BrowserまたはPrinter Driver / Result / Evidenceが記録されるまで、物理検証をPASSにしない。

## Automated / Desktop Evidence

| Area | Environment | Status | Evidence |
|---|---|---|---|
| JavaScript syntax | Node.js 20.20.2 | PASS | 210/210 files |
| JavaScript unit | Node.js 20.20.2 | PASS | 78/78 files |
| PHP syntax | PHP 8.4.4 | PASS | 81/81 files |
| PHP unit / contract | PHP 8.4.4 | PASS | 12/12 files |
| Semantic landmarks / ARIA | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-semantic-a11y-qa.json` |
| Text scaling / reflow | Headless Chrome, 200% and 400% equivalent | PASS | `release-evidence/v1.0.244/browser-text-scaling-qa.json` |
| Forced Colors | Headless Chrome, forcedColors active | PASS | `release-evidence/v1.0.244/browser-forced-colors-qa.json` |
| Native viewport regression | Mock VisualViewport, Headless Chrome | PASS | `release-evidence/v1.0.244/browser-native-viewport-qa.json` |
| QR permission states | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-qr-permission-states-qa.json` |
| QR image fallback | Browser decode, HTMLImageElement fallback | PASS | `release-evidence/v1.0.244/browser-qr-image-fallback-qa.json` |
| Print calibration geometry | Browser CSS geometry only | PASS | `release-evidence/v1.0.244/browser-print-calibration-qa.json` |
| Render Island identity | Headless Chrome, 15 iterations | PASS | `release-evidence/v1.0.244/browser-render-islands-qa.json` |
| Records / Nursery data scale | Headless Chrome, 15 iterations | PASS | `release-evidence/v1.0.244/browser-data-scale-v243-qa.json` |
| Media lazy / fallback / CLS | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-media-loading-qa.json` |
| Scroll / focus / draft / camera continuity | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-interaction-continuity-qa.json` |
| Product UX task flows | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-product-ux-qa.json` |
| Form safety | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-form-safety-qa.json` |
| Form validation | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-form-validation-qa.json` |
| Offline task flow | Headless Chrome | PASS | `release-evidence/v1.0.244/browser-offline-task-flow-qa.json` |
| v1.0.243 / v1.0.244 performance | Headless Chrome, 15 iterations | PASS | `release-evidence/v1.0.244/browser-performance-v242-qa.json` |
| Visual Craft | Headless Chrome, 9 widths, Light/Dark | PASS | 540/540 checks; `release-evidence/v1.0.244/browser-qa.json` |
| Product screenshots | 390 / 768 / 1440px, Light/Dark | PASS | `release-evidence/v1.0.244/screenshots/` (72 images) |

## Semantic Evidence

| Check | Result |
|---|---|
| Visible authenticated main landmark | 1 |
| Nested main | 0 |
| Visible H1 per audited screen | 1 |
| Duplicate ID | 0 |
| Broken ARIA reference | 0 |
| Heading skip | 0 |
| Positive tabindex | 0 |
| Selected tab per tablist | 1 |
| Audited screens / overlays | 11 |

## Performance Evidence

The baseline was loaded from `setae-core-1.0.243-wordpress.zip`; the current build was loaded from the workspace. Each scenario was alternated for 15 samples. The allowed regression threshold was 15%.

| Operation | v1.0.243 median | v1.0.244 median | Change | Result |
|---|---:|---:|---:|---|
| Collection 500 | 64.7 ms | 61.2 ms | -5.41% | PASS |
| Collection search | 24.8 ms | 22.4 ms | -9.68% | PASS |
| Specimen open | 17.0 ms | 17.1 ms | +0.59% | PASS |
| Quick Record open | 31.6 ms | 31.6 ms | 0.00% | PASS |
| Nursery 500 | 16.1 ms | 17.5 ms | +8.70% | PASS |
| Records 1000 | 24.2 ms | 17.7 ms | -26.86% | PASS |
| Current script Long Task > 100 ms | - | 0 | - | PASS |

## Physical Device Matrix

| Area | Required environment | Status | Device / Result / Evidence |
|---|---|---|---|
| iPhone Safari daily flows and date fields | Physical iPhone / Safari | NOT RUN | 未実施 |
| iPhone Home Screen PWA | Installed PWA | NOT RUN | 未実施 |
| iPhone PWA Safe Area / Keyboard / Back | Installed PWA | NOT RUN | 未実施 |
| Android Chrome / PWA | Physical Android | NOT RUN | 未実施 |
| Android QR camera / image import | Physical Android | NOT RUN | 未実施 |
| PWA 1.0.243 to 1.0.244 update | Installed production-equivalent PWA | NOT RUN | 未実施 |
| VoiceOver main flows | Physical iPhone / VoiceOver | NOT RUN | 未実施 |
| Desktop Safari | macOS / Safari | NOT RUN | 未実施 |
| Desktop Edge | Windows / Edge | NOT RUN | 未実施 |

Details and recording fields are in `docs/native-qa-v1.0.244.md`.

## Physical Print Matrix

Browser geometry evidence proves CSS output dimensions only. It is not a substitute for paper or tape measurement.

| Area | Required environment | Status | Printer / Driver / Browser / Result |
|---|---|---|---|
| A4 50mm lines, 20mm square, 25mm QR | Physical A4 printer | NOT RUN | 未実施 |
| Tape 18 x 12mm | Physical label printer | NOT RUN | 未実施 |
| Tape 24 x 12mm | Physical label printer | NOT RUN | 未実施 |
| Tape 36 x 12mm | Physical label printer | NOT RUN | 未実施 |
| Tape 50 x 12mm | Physical label printer | NOT RUN | 未実施 |
| Tape 70 x 12mm | Physical label printer | NOT RUN | 未実施 |
| Micro ID QR read on iPhone | Printed label / physical iPhone | NOT RUN | 未実施 |
| Micro ID QR read on Android | Printed label / physical Android | NOT RUN | 未実施 |

## Human Usability

| Requirement | Status | Evidence |
|---|---|---|
| Minimum 3 participants | NOT RUN | 0 participants |
| Six required tasks | NOT RUN | `docs/usability-test-v1.0.244.md` |
| Completion / time / error / SEQ | NOT RUN | 未実施 |
| UX issue severity and retest | NOT RUN | 未実施 |

## Candidate Boundary

コード、Desktop自動操作、性能、画面geometry、Light/Dark、Forced Colors、配布物整合性は公開候補として検証済み。物理端末、実PWA更新、カメラ、VoiceOver、実印刷、実ユーザー検証が未実施のため、Release Statusは**CANDIDATE**を維持する。
