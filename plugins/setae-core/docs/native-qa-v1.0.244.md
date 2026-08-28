# SETAE v1.0.244 Native QA Record

Status: **NOT RUN**  
Build: `1.0.244`

この文書は物理端末、インストール済みPWA、スクリーンリーダー、実プリンターの検証票である。Headless Chrome、Device Emulation、Mock VisualViewport、CSS geometry検査を物理試験のPASSとして扱わない。

## Automated Preparation

| Area | Automated result | Evidence | Physical status |
|---|---|---|---|
| Semantic landmarks / ARIA | PASS | `browser-semantic-a11y-qa.json` | NOT RUN |
| 200% text / 400% equivalent | PASS | `browser-text-scaling-qa.json` | NOT RUN |
| Forced Colors | PASS | `browser-forced-colors-qa.json` | NOT RUN |
| Visual Viewport regression | PASS | `browser-native-viewport-qa.json` | NOT RUN |
| QR permission mapping | PASS | `browser-qr-permission-states-qa.json` | NOT RUN |
| QR image fallback decode | PASS | `browser-qr-image-fallback-qa.json` | NOT RUN |
| Print CSS geometry | PASS | `browser-print-calibration-qa.json` | NOT RUN |

Evidence directory: `release-evidence/v1.0.244/`

## Device Session Header

| Field | Value |
|---|---|
| Evidence ID | 未採番 |
| Test date | 未実施 |
| Tester | 未実施 |
| Device | 未実施 |
| OS / version | 未実施 |
| Browser / version | 未実施 |
| Viewport | 未実施 |
| Installed PWA | 未実施 |
| SETAE version | 1.0.244 |
| Diagnostic JSON | 未取得 |

## iPhone Safari

| Check | Status | Measurement / Note | Evidence |
|---|---|---|---|
| Launch and login | NOT RUN | - | - |
| Today / Collection / Specimen / Records navigation | NOT RUN | - | - |
| Native date field stays inside form | NOT RUN | before / after未計測 | - |
| Software keyboard and focused field | NOT RUN | - | - |
| Sheet footer remains reachable | NOT RUN | - | - |
| Bottom navigation does not obstruct input | NOT RUN | - | - |
| Safe Area is applied once | NOT RUN | - | - |
| Safari back gesture | NOT RUN | - | - |
| Draft Guard | NOT RUN | - | - |
| QR permission / camera lifecycle | NOT RUN | - | - |
| QR image import | NOT RUN | - | - |

## iPhone Home Screen PWA

| Check | Status | Measurement / Note | Evidence |
|---|---|---|---|
| Install and launch | NOT RUN | - | - |
| App icon and standalone display | NOT RUN | - | - |
| Safe Area and Bottom Navigation | NOT RUN | - | - |
| Software keyboard and sticky footer | NOT RUN | - | - |
| Native date picker | NOT RUN | - | - |
| Back gesture / navigation restoration | NOT RUN | - | - |
| Draft Guard / Toast / Offline banner | NOT RUN | - | - |
| 1.0.243 to 1.0.244 PWA update | NOT RUN | - | - |

## Android Chrome / PWA

| Check | Status | Measurement / Note | Evidence |
|---|---|---|---|
| Chrome launch / login | NOT RUN | - | - |
| PWA install / launch | NOT RUN | - | - |
| System back button | NOT RUN | - | - |
| Native date picker | NOT RUN | - | - |
| File picker | NOT RUN | - | - |
| Camera permission and lifecycle | NOT RUN | - | - |
| QR camera read | NOT RUN | - | - |
| QR image import | NOT RUN | - | - |

## VoiceOver

Physical iPhone with VoiceOver is required.

| Flow | Status | Result / Issue | Evidence |
|---|---|---|---|
| Skip Link to main content | NOT RUN | - | - |
| Today task completion | NOT RUN | - | - |
| Collection search and specimen open | NOT RUN | - | - |
| Specimen tabs | NOT RUN | - | - |
| Quick Record form and validation | NOT RUN | - | - |
| QR permission and fallback | NOT RUN | - | - |
| Route announcement | NOT RUN | - | - |

## A4 Calibration

Use actual size / 100%. Disable fit-to-page. Record all values in millimetres.

| Field | Value |
|---|---|
| Printer | 未実施 |
| Driver version | 未実施 |
| Browser / OS | 未実施 |
| Expected horizontal line | 50.0 mm |
| Measured horizontal line | 未計測 |
| Expected vertical line | 50.0 mm |
| Measured vertical line | 未計測 |
| Expected square | 20.0 x 20.0 mm |
| Measured square | 未計測 |
| Expected QR | 25.0 x 25.0 mm |
| Measured QR | 未計測 |
| QR readability / distance | NOT RUN |
| Allowed tolerance | +/-0.5 mm or +/-1% |
| Overall result | NOT RUN |

## 12mm Tape Calibration

| Expected size | Measured W | Measured H | Cut length | Margin | iPhone QR | Android QR | Result |
|---|---:|---:|---:|---:|---|---|---|
| 18 x 12 mm / Micro ID | - | - | - | - | NOT RUN | NOT RUN | NOT RUN |
| 24 x 12 mm | - | - | - | - | NOT RUN | NOT RUN | NOT RUN |
| 36 x 12 mm | - | - | - | - | NOT RUN | NOT RUN | NOT RUN |
| 50 x 12 mm | - | - | - | - | NOT RUN | NOT RUN | NOT RUN |
| 70 x 12 mm | - | - | - | - | NOT RUN | NOT RUN | NOT RUN |

Allowed tolerance: width +/-0.3mm; length +/-0.5mm or +/-1%. Do not add automatic scale correction until a repeatable physical deviation has been measured.

## Issue Record

| Evidence ID | Severity | Device / Environment | Reproduction | Result | Fix / Retest |
|---|---|---|---|---|---|
| 未採番 | - | - | - | NOT RUN | - |

## Decision

No physical device, VoiceOver, installed PWA, or printer result has been recorded. Native QA remains **NOT RUN**, and Release Status remains **CANDIDATE**.
