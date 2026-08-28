# SETAE v1.0.241 Release Checklist

Build: `1.0.241`  
Status: **CANDIDATE**  
Date: 2026-08-26

Automated evidence is kept separate from physical-device evidence. A physical item is never promoted to PASS from a static contract or desktop emulation.

| Area | Environment | Status | Evidence |
|---|---|---|---|
| Visual Craft Harness | Headless Chrome on macOS, 9 widths, Light/Dark | PASS | `release-evidence/v1.0.241/browser-qa.json` |
| Product screenshot matrix | Headless Chrome, 390x844 / 768x1024 / 1440x1200, Light/Dark | PASS | `release-evidence/v1.0.241/screenshots/` (72 images) |
| Geometry | 320 / 360 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440px | PASS | 540/540 cases; no document overflow, duplicate visible h1, nested interactive element, undersized mobile control, or console issue |
| Typography / state / contrast contracts | Node unit tests | PASS | Visual rhythm, typography, interaction craft, style ownership, and contrast tests |
| JavaScript unit tests | Node | PASS | 61/61 |
| PHP unit tests | PHP CLI | PASS | 12/12 |
| JavaScript syntax | Node | PASS | App and test sources |
| First-party PHP lint | PHP CLI | PASS | 81/81 |
| iPhone Safari date fields | Physical iPhone / Safari | NOT RUN | Real device required |
| iPhone PWA date fields | Physical iPhone / Home Screen PWA | NOT RUN | Installed PWA required |
| PWA 1.0.240 to 1.0.241 update | Installed production-equivalent PWA | NOT RUN | Update lifecycle required |
| QR camera | Physical iPhone / Android | NOT RUN | Camera permission and lifecycle required |
| QR image import | Physical phone | NOT RUN | Photo-library permission required |
| A4 output | Physical printer and driver | NOT RUN | Actual-size print required |
| 12mm tape output | Physical label printer and driver | NOT RUN | Tape and QR readability check required |

## Candidate Boundary

The code, automated geometry, visual states, Light/Dark themes, and package integrity are release-candidate ready. The status remains **CANDIDATE** until every physical-device row above has recorded Device / OS / Browser or Driver / Result / Evidence.
