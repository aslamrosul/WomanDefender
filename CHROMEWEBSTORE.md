# Chrome Web Store Listing: ModestyShield AI

> Single source of truth for Chrome Web Store listing metadata, permissions justifications, privacy disclosures, and store readiness.

**Last Updated:** October 4, 2026  
**Extension Name:** ModestyShield AI - YouTube Modesty & Gaze Protection  
**Extension Version:** 1.0.0  

---

## 1. Store Listing Details

### Title
ModestyShield AI - YouTube Modesty & Gaze Protection

### Summary (132 characters max)
Automatically filters and blurs video and thumbnail content displaying uncovered female hair and revealing clothing on YouTube.

### Detailed Description
ModestyShield AI helps you maintain your visual peace of mind and personal modesty standards while watching YouTube videos. 

Using intelligent on-device visual analysis, the extension automatically detects and covers video frames and video thumbnails that show uncovered female hair, prominent suggestive appearances, or revealing attire.

**Key Features:**
* **Real-time Video Shield:** Instantly blurs or covers video frames when modesty filters are triggered.
* **Thumbnail Protection:** Blurs suggested video and search thumbnails across YouTube home, search, and sidebars before you see them.
* **Customizable Strictness Levels:**
  - High (All Female): Covers all appearances of women with exposed hair.
  - Balanced (Recommended): Covers exposed hair, prominent beauty focal points, and suggestive outfits.
  - Modesty Only: Specifically targets revealing clothing and swimwear.
* **Peek Mode:** Click "Buka Sementara" (Temporary Peek) to preview the content for a custom duration (3–15 seconds) if needed.
* **Auto-Mute Option:** Automatically mutes video audio while content is shielded.
* **100% Free & Private:** All processing runs completely inside your browser on your device. No personal data, browsing history, or video feeds are ever sent to external cloud servers.

---

## 2. Permissions Justification

| Permission | Scope | Plain-English Justification for Chrome Web Store Review Team |
| :--- | :--- | :--- |
| `storage` | Browser API | Used to save user preferences (filter strictness level, cover style, auto-mute preference, peek duration, and filter counters) locally on the user's device. |
| `https://*.youtube.com/*` | Host Permission | Required to inspect video player frames and thumbnail elements on YouTube pages in order to apply real-time blur overlays. |

---

## 3. Privacy & Data Use Disclosure

* **Single Purpose:** ModestyShield AI has the single purpose of filtering and shielding visual content according to personal modesty preferences on YouTube.
* **Data Transmission:** The extension transmits **NO user data**, **NO browsing history**, and **NO video content** to external servers. All visual analysis and decision classification happen entirely on the client's local computer.
* **Data Collection:**
  - Personally Identifiable Information: **None**
  - Health / Financial / Authentication data: **None**
  - Web History: **None stored or transmitted**
  - User Activity: Only local counters (number of filtered videos/thumbnails) stored in `chrome.storage.local`.

---

## 4. Version History

* **v1.0.0 (October 4, 2026):**
  - Initial release with Manifest V3 support.
  - Integrated Julia-1 System 1 decision engine and fast-path visual filter.
  - Real-time video player shielding and thumbnail masking on YouTube.
  - Configurable sensitivity, cover style, auto-mute, and peek duration in popup.
