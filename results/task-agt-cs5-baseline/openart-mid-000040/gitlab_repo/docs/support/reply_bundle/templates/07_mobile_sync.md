# Template 7 — Mobile sync issues

**Use when:** the mobile app does not sync in the background, crashes on launch after
an OS update, shows a stale file list, or a customer asks about mobile limitations.

**Do not use when:** the same account also fails on desktop — that points at the
account or namespace layer (Template 2).

**Verified facts this reply relies on**

- iOS 16+ and Android 13+ are supported for **file sync only**; desktop has the full
  feature set (`kb_articles/product_overview.md`).
- Android 14 background sync incompatibility was a known issue in v3.1, fixed in
  v3.2.1 (`release_notes/v3.1.md`, `product_docs/changelog.json`).
- A resolved iOS case: Background App Refresh was disabled for CloudSync; enabling it
  restored background sync (TKT-2024-014).
- A resolved Android case: auto-update was disabled and the client was on a build with
  the known crash; updating to v3.2.1 fixed it (TKT-2024-008).
- Mobile battery usage was reduced by 35% in v3.3 through background scheduling
  optimisation.

## Customer reply

Subject: Re: {{ticket_subject}} — {{ticket_id}}

Hello {{customer_name}},

Thank you for the report, and sorry the mobile app is not keeping up. Mobile sync is
governed by the operating system's background rules, so the cause is usually an OS
setting or an out-of-date build rather than the workspace itself.

**Step 1 — Confirm the version**

- iOS: App Store > CloudSync > check the installed version.
- Android: Play Store > CloudSync > check the installed version.

The minimum supported platforms are iOS 16 and Android 13. If you are on Android 14
with a build older than v3.2.1, you are on a version with a known background-sync
crash. Please update first.

**Step 2 — iOS: enable Background App Refresh**

1. Settings > CloudSync > **Background App Refresh** → on.
2. Settings > General > Background App Refresh → confirm it is on globally.
3. Also confirm **Low Power Mode** is off while testing.
4. Reopen CloudSync and leave it in the foreground for a minute.

**Step 3 — Android: exempt CloudSync from battery optimisation**

1. Settings > Apps > CloudSync > Battery → **Unrestricted**.
2. On Samsung/Xiaomi/Oppo devices, also disable "Put app to sleep" for CloudSync.
3. Confirm **Auto-sync** is enabled in the CloudSync app settings.
4. Reopen the app and trigger a manual refresh once.

**Step 4 — Test with a small file**

Create a small text file in a shared namespace from the desktop client and confirm it
appears on the phone within a few minutes. This separates "background sync is blocked"
from "the file list is stale".

**Step 5 — If it still fails**

Send me:

- phone model and OS version,
- CloudSync app version,
- whether the failure happens on Wi-Fi, cellular, or both,
- a screen recording of the refresh, if possible.

**A note on what mobile supports**

The mobile apps provide file sync only. Database sync, application-state sync and some
admin functions are desktop/web only. If the team needs those on a tablet, the web
interface is the better path.

I know mobile is often how people check work outside office hours. If this is blocking
a field team, tell me how many devices are affected and I will treat it as a
multi-device issue rather than a single-device setting.

Kind regards,
{{agent_name}}
CloudSync Support

---

**Internal handling notes**

- Always establish the OS version before suggesting settings; the Android 14 fix is
  version-dependent.
- Device-specific battery managers (Samsung, Xiaomi, Oppo, Huawei) override the stock
  Android setting. Ask which manufacturer if the standard exemption does not work.
- Do not promise full mobile parity. `product_overview.md` explicitly limits iOS and
  Android to file sync.
- If the customer reports data missing after a mobile edit, check conflict copies
  (TROUBLE-004) before treating it as data loss.

## Source citations

- `kb_articles/product_overview.md` — supported platforms and mobile limitations.
- `release_notes/v3.1.md` — Android 14 known issue.
- `product_docs/changelog.json` — 3.2.1 fix for Android 14 background sync crash.
- `release_notes/v3.3.yaml` — mobile battery optimisation.
- `ticket_history/tickets_q2.csv` — TKT-2024-014 (iOS Background App Refresh).
- `ticket_history/tickets_q1.json` — TKT-2024-008 (Android 14 crash, auto-update off).
- `kb_articles/troubleshooting.json` — TROUBLE-004 (conflict copies).
