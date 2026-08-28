# SETAE v1.0.240 Release Checklist

Build: `1.0.240`

Automated browser checks and physical-device checks are recorded separately. Emulator or static-test results never count as hardware evidence.

## Automated Browser Matrix

Status: PASS
Device: Codex local browser viewport matrix
OS: macOS
Browser / PWA: Codex In-app Browser (Chromium), browser mode
Build: 1.0.240
Date: 2026-08-26
Evidence: `release-evidence/v1.0.240/` and `release-evidence/v1.0.240/product/viewport/`.
Notes: Release harness 162 cases and 11 production fixtures 198 cases; 360/360 passed with no document/panel overflow, nested interactive element, or duplicate visible page heading. Covers 320, 360, 375, 390, 430, 768, 1024, 1280, and 1440px in Light and Dark. 132 primary viewport screenshots were captured.

## Modal Busy / Focus

Status: PASS
Device: Codex local browser
OS: macOS
Browser / PWA: Codex In-app Browser (Chromium), browser mode
Build: 1.0.240
Date: 2026-08-26
Evidence: `tests/fixtures/ui-system-v4-release-harness.html`, `tests/ui-system-v4-overlay-a11y-unit.js`, and `release-evidence/v1.0.240/`.
Notes: Browser run confirmed Tab/Shift+Tab looping, normal Escape close, busy Escape/backdrop lock, underlying inert, fixed-body scroll lock/unlock, and focus return to the opening control. Unit coverage additionally confirms topmost selection, desktop/mobile initial focus, error focus, and scroll-position restoration.

## Service Worker Upgrade

Status: NOT RUN
Device: Production-equivalent WordPress/PWA environment required
OS: Not recorded
Browser / PWA: Installed PWA
Build: 1.0.239 to 1.0.240
Date: Not run
Evidence: None
Notes: Verify update notice, one controlled reload, fresh split CSS, no `layouts.css` request, no white screen, and no reload loop.

## Offline Shell

Status: NOT RUN
Device: Production-equivalent WordPress/PWA environment required
OS: Not recorded
Browser / PWA: Installed PWA
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Load online once, switch offline, launch, and confirm the split CSS and offline shell remain available.

## Offline Queue

Status: NOT RUN
Device: Production-equivalent WordPress/PWA environment required
OS: Not recorded
Browser / PWA: Installed PWA
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Queue a record offline, reconnect, verify one resend, no duplicate, and removal after success.

## iPhone Safari Date Fields

Status: NOT RUN
Device: Physical iPhone required
OS: Not recorded
Browser / PWA: Safari
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Verify Quick Record, Nursery, Husbandry, QR History, and QR Batch dates; native picker; `YYYY-MM-DD` submission; no horizontal overflow.

## iPhone PWA Date Fields

Status: NOT RUN
Device: Physical iPhone required
OS: Not recorded
Browser / PWA: Home-screen PWA
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Repeat the Safari date-field matrix from the installed home-screen app.

## QR Camera

Status: NOT RUN
Device: Physical iPhone and Android device required
OS: Not recorded
Browser / PWA: Safari, iPhone PWA, Android Chrome
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Verify permission grant/denial, start, stop, recognition, background/foreground return, and batch scan.

## QR Image Import

Status: NOT RUN
Device: Physical phone required
OS: Not recorded
Browser / PWA: Mobile browser/PWA
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Verify photo-library selection, recognition, failure state, and reselection.

## A4 Print Preview and Output

Status: NOT RUN
Device: Physical A4 printer required
OS: Not recorded
Browser / PWA: Desktop print flow
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Record printer and driver. Verify scale 100%, crop marks, border, QR, scientific name, and specimen code.

## 12mm Tape Output

Status: NOT RUN
Device: Physical 12mm label printer required
OS: Not recorded
Browser / PWA: Desktop print flow
Build: 1.0.240
Date: Not run
Evidence: None
Notes: Record printer/driver and test 18, 24, 36, 50, and 70mm lengths, center rule on/off, actual cut length, and phone QR readability.

## Update Notice Contrast and Action

Status: NOT RUN
Device: Production-equivalent browser required
OS: Not recorded
Browser / PWA: Light and Dark installed PWA
Build: 1.0.239 to 1.0.240
Date: Not run
Evidence: None
Notes: Verify readable button, double-click prevention, `更新中…`, completed reload, and no stale UI.
