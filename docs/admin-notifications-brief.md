# Admin panel brief: push notifications

For the agent that updates the admin panel. You have no access to the Live Moment app/backend repo, so this file is
self-contained. Background: `D:\_MobileProjects\LiveMoment\docs\notifications.md` in the app repo (not needed to do the work).

## Where the panel lives

Not in the Live Moment app repo (searched: no `admin/`, `web/` or console code here; `hosting/public` only holds legal
pages and the auth link pages). The panel is the separate repo **`yesari1/live-moment-admin`**, deployed to GitHub Pages
at **https://admin.yesastudio.com**. It signs the admin in with Firebase Auth, reads/writes Firestore directly with the
`admin: true` custom claim, and calls the backend with `adminFetch` in `src/services/backend.ts` (adds
`Authorization: Bearer <Firebase ID token>`; see `docs/admin-quota-adjust.md` for the same pattern). Follow how the existing
pages do Motion Templates (Firestore CRUD with the claim) and the quota adjust (backend call).

Backend base URL: `https://living-memories-api-okmceddtoa-uc.a.run.app`. CORS already allows the admin origin on the three
notification endpoints below (`test`, `audience-preview`, `translate`). No App Check token is needed from the panel.

## What the panel does vs. the backend

- The panel **writes Firestore directly** for config: `notificationTemplates`, `notificationSettings/global`,
  `notificationCampaigns` (admin claim; rules already deployed with the backend change).
- The panel **reads** `notificationLog` and the campaign `stats` for the stats views.
- The panel calls the **backend** for actions that need FCM or a server scan: send a test, audience preview.
- The backend (Cloud Scheduler) does all real sending: `plan_*` templates fire from billing events, `plan_ending_soon`
  from an hourly sweep, campaigns when `status == "scheduled"` and `scheduledAt` is null or past (checked every 10 min).
  The panel never sends to users itself.

## Firestore schemas

Timestamps are Firestore `Timestamp`. Write with `serverTimestamp()` for `updatedAt` / `createdAt`.

### `notificationTemplates/{id}`: 3 documents today (`plan_ending_soon`, `plan_ended`, `plan_renewed`)

```
id: string                      // = doc id; do not let the admin rename it
enabled: boolean
channel: "plan_reminders" | "product_updates"
title: { en, tr, es, "pt-BR", de, fr }   // map of locale -> text, each <= 50 chars, placeholders allowed
body:  { en, tr, es, "pt-BR", de, fr }   // each <= 150 chars
sourceLocale: string            // language the admin typed first, default "tr"
imageUrl?: string               // https only; omit the field when empty
deepLink: "livemoment://home" | "livemoment://library" | "livemoment://weather-set" | "livemoment://plan"
trigger: string                 // read-only description, show it, do not edit
params: { daysBefore?: number, sendHourLocal?: number }   // plan_ending_soon only: daysBefore 1-14, sendHourLocal 0-23
audience: { plans: ("free"|"live_weather"|"live_weather_plus")[], excludeAdminGrant: boolean }   // empty plans = any
updatedAt: Timestamp
```
Placeholders: `{planName}` and `{date}`. Show a live preview per locale with sample values ("Live Weather Plus", a date in
that language, e.g. "3 Kasım 2026"). **Localization**: the 6 supported languages are `en` (fallback), `tr`, `es`, `pt-BR`, `de`,
`fr`. A plain string (old documents) means `en`: when you load one, show it in the English tab and save back as a map. The
seed fills all six languages for the three templates. Always write the map with exactly these keys (`pt-BR` with a hyphen).
Do not allow creating new template ids (the backend only reacts to the three existing ones) and do not delete.

### `notificationSettings/global`: one document

```
enabled: boolean                // GLOBAL KILL-SWITCH. Missing doc = disabled.
quietHours: { start: "HH:mm", end: "HH:mm" } | null    // user's local time; wraps midnight (22:00 -> 08:00)
maxPerUserPerDay: number        // rolling 24 h cap per account, 0-20
defaultChannel: "plan_reminders" | "product_updates"
defaultTimezone: string         // IANA, fallback for devices that never reported one, e.g. "UTC"
testRecipients: string[]        // Firebase uids that "send test to recipients" targets
updatedAt: Timestamp
```

### `notificationCampaigns/{autoId}`

```
title: { en, tr, es, "pt-BR", de, fr }   // each <= 50 (same map shape as templates; plain string = en)
body:  { en, tr, es, "pt-BR", de, fr }   // each <= 150
sourceLocale: string            // default "tr"
imageUrl?: string               // https
deepLink: (same four values)
channel: "product_updates"      // use this for campaigns
audience: {
  kind: "all" | "plans" | "lapsedOnly" | "uids",
  plans?: ("free"|"live_weather"|"live_weather_plus")[],   // kind = plans
  uids?: string[],                                         // kind = uids
  locales?: string[]                                       // optional device-language filter, e.g. ["tr"]
}
scheduledAt: Timestamp | null   // null = send as soon as the next dispatcher run (<= 10 min)
status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled"
stats: { targeted: 0, sent: 0, failed: 0, skipped: 0, deferred: 0 }   // create with zeros; the backend increments
createdBy: string               // admin uid
createdAt: Timestamp
// backend-owned, read only: leaseUntilMs, startedAt, finishedAt, lastError, updatedAt
```
Panel-side transitions only: create as `draft` or `scheduled`; `draft` -> `scheduled`; `scheduled` -> `cancelled` /
`draft`. `sending`/`sent`/`failed` are backend-owned: show them, never write them. Cancelling a `sending` campaign:
allowed (set `cancelled`; the dispatcher stops at the next batch), warn that some users already received it.
Editing: only `draft` and `scheduled` campaigns. No delete (rules forbid it); `cancelled` is the end state.
`failed` + `lastError` (for example `title_too_long:tr,deep_link_unknown`; `:<locale>` says which language broke the rule) means validation failed; show the error.

### `notificationLog/{id}` (read only)

```
uid, kind ("template"|"campaign"|"test"), templateId?, campaignId?, dedupeKey,
status ("sending"|"sent"|"failed"|"deferred"|"expired"),
title, body, imageUrl?, deepLink, channel, createdAt, sentAt?, deviceCount, deliveredCount, reason?, expireAt
```
Auto-deleted after 90 days (TTL). Query examples: last 100 by `createdAt desc` (single-field index, fine);
`where templateId == X` or `campaignId == X` (single field) then sort client-side; do not add composite indexes.
`reason` is an FCM error code or `no_result`, never a message body.

## Backend endpoints

Both need `Authorization: Bearer <Firebase ID token>` of an account whose verified email is in the backend `ADMIN_EMAILS`
(the owner's is). 403 `{"error":{"code":"FORBIDDEN"}}` otherwise; 401 `AUTH_REQUIRED` without a token. Errors always look
like `{"error":{"code":"..."}}`.

### `POST /v1/admin/notifications/test`: send a test through FCM

Ignores the kill-switch, quiet hours, daily cap and dedupe (it is a test), so it works with everything off.

Request, one of:
```json
{ "templateId": "plan_renewed", "target": "self" }
```
```json
{ "content": { "title": { "en": "New looks", "tr": "Yeni görünümler" },
               "body": { "en": "Fresh weather scenes just landed.", "tr": "Yeni hava sahneleri geldi." },
               "imageUrl": "https://...", "deepLink": "livemoment://home", "channel": "product_updates" },
  "target": "self" }
```
`content.title` / `content.body` are a locale map (a plain string = English). **The test is sent in the language of the
receiving device** (the admin's phone), using the same resolution as a real send, so "Send test to me" shows the admin what
a user with that app language sees; to check another language, change the app language on the test phone.
`target`: `self` (the admin's own devices, default) or `testRecipients` (uids from `notificationSettings/global`). Exactly one
of `templateId` / `content`. A template test uses sample values (plan "Live Weather Plus", date 3 days ahead).

Response 200:
```json
{ "results": [ { "uid": "abc", "outcome": "sent", "devices": 1 } ] }
```
(`devices` is present for template tests; content tests return `uid` + `outcome`.)
`outcome`: `sent` | `failed` | `no_devices` (no registered device: the admin has not opened the app with notifications
allowed) | `invalid_content`. Errors: 400 `INVALID_ARGUMENT` (bad shape, title > 50, body > 150, unknown deepLink),
400 `INVALID_CONTENT:<codes>`, 400 `NO_TEST_RECIPIENTS`, 404 `TEMPLATE_NOT_FOUND`.

### `POST /v1/admin/notifications/audience-preview`: live audience size

Request: `{ "audience": { "kind": "plans", "plans": ["live_weather_plus"], "locales": ["tr"] } }`
(`kind`: `all` | `plans` | `lapsedOnly` | `uids`; `uids` max 1000, `locales` max 20).
Response 200: `{ "users": 1840, "reachable": 1213 }`. `users` = accounts matching the audience; `reachable` = of those, the
ones with at least one registered device (matching the locale filter): the number of people who can actually get the push.
It scans all users: debounce 500 ms after the last change, show a spinner, and do not call it on every keystroke. For
large audiences it can take several seconds.

### `POST /v1/admin/notifications/translate`: translate to all languages

Request: `{ "sourceLocale": "tr", "title": "Planın {date} tarihinde bitiyor", "body": "...", "targetLocales": ["en","es","pt-BR","de","fr"] }`
(`targetLocales` optional, default = every supported language except the source; `title` <= 50, `body` <= 150, both required).
Response 200:
```json
{ "translations": { "en": { "title": "...", "body": "..." }, "es": { "title": "...", "body": "..." } },
  "failed": { "de": ["title is 57 characters, the limit is 50; shorten it"] } }
```
The source language is not in `translations`. `{placeholders}` and the brand names (Live Moment, Live Weather, Live Weather Plus)
come back untouched. The backend already validated every text (lengths, placeholders, brand names) and retried once;
`failed` lists the languages that still broke a rule (leave those tabs empty/red and let the admin write them). It takes
a few seconds (one model call): show a spinner and disable the button meanwhile. Rate limited to 20 calls per 10 minutes per
admin. Errors: 400 `UNSUPPORTED_LOCALE` / `INVALID_ARGUMENT`, 429 `TRANSLATE_RATE_LIMITED`, 502 `TRANSLATION_PROVIDER_FAILED` /
`TRANSLATION_BAD_RESPONSE` / `TRANSLATION_CREDITS_EXHAUSTED` (tell the owner the translation provider needs credits), 503
`TRANSLATION_NOT_CONFIGURED`. Never auto-save a translation: it only fills the tabs for review.

There is **no** "send campaign" endpoint: scheduling is writing the campaign document (below).

## UI to build (new "Notifications" section with four tabs)

1. **Templates**: list of the 3 templates with an enabled switch, channel badge and the `trigger` text. Editor: title and
   body as **per-language tabs** (En, Tr, Es, Pt-BR, De, Fr; Turkish is the default source tab and `sourceLocale`), live
   character counters 50/150 per tab, a tab badge showing empty / over-limit languages, placeholder chips `{date}`
   `{planName}` that insert at the cursor, a **Translate to all languages** button (see below) and a rendered per-language
   preview as a lock-screen card, image URL (https validation, thumbnail preview), deep link as a dropdown with the four values
   labelled Home / Library / Weather set / Plan, trigger params (`daysBefore`, `sendHourLocal` only for `plan_ending_soon`),
   audience (plans multi-select, "exclude admin grants"), **Send test to me** (calls `/test` with `templateId`, shows the
   outcome; on `no_devices` explain how to register a device), Save (writes the document with `updatedAt`).
2. **Settings**: kill-switch (big switch; turning it OFF is immediate, turning it ON asks for confirmation), quiet hours
   (two time pickers + an off toggle), max per user per day, default time zone, test recipients (list of uids with an
   "add me" button).
3. **Campaigns**:
   - List: title, status chip, audience summary, scheduled time, stats (targeted / sent / failed / skipped / deferred).
     Live updates with `onSnapshot` while any campaign is `sending`.
   - Create/edit (draft or scheduled): title and body as per-language tabs (Turkish is the default source; counters 50/150
     per tab; a per-language lock-screen **preview** card), the **Translate to all languages** button, image, deep link,
     channel `product_updates`; audience picker (All / By
     plan / Lapsed only / Specific uids, optional language filter) with the live **audience count** from
     `audience-preview` ("1,213 can receive this, 1,840 match"); "Send now" (`scheduledAt: null`) or date-time picker
     (show the admin's time zone and the UTC equivalent); lock-screen preview; **Send test** (`/test` with `content`, target
     `self` or `testRecipients`; the test arrives in the language of the receiving device); Save as draft; Schedule / Send.
   - **Translate flow** (templates and campaigns): the admin writes the source tab (Turkish by default, can switch the source
     language), clicks **Translate to all languages** -> call `/translate` with `sourceLocale`, `title`, `body` -> fill the
     other tabs with the result, mark them "machine translated, review" (yellow) until the admin edits or confirms each
     one, show `failed` languages as empty/red. Re-translating must not silently overwrite tabs the admin edited: ask first
     ("Replace the 4 edited translations?"). Nothing is saved until the admin presses Save.
   - Cancel button on `scheduled` and `sending` campaigns (confirm dialog).
4. **Log / stats**: table of the latest `notificationLog` entries (time, account uid linked to the user page, template or
   campaign, status, delivered/devices, reason) with filters (status, template, campaign) and a per-campaign and
   per-template summary (counts by status for the last 7 / 30 days, computed from the log or the campaign `stats`).

## Validation (enforce in the form, the backend validates again)

- title 1-50 chars, body 1-150 chars **in every language** (count after replacing placeholders with the longest sample:
  "Live Weather Plus", "30 September 2026").
- **Every language must be non-empty before Send / Schedule / Save of an enabled template.** A language needs both title and
  body (the backend fails a campaign with `locale_incomplete:<locale>` otherwise). Default: block with a message naming the
  empty languages. Allowed alternative: a checkbox "Use English for the empty languages" that shows a warning ("Users with
  these app languages will see English: Tr, Es...") and, when confirmed, **omits** those keys (never write empty strings).
  `en` itself must always be filled: it is the fallback for everyone.
- Placeholders must be identical in every language of the same field (`{date}` in all or in none); warn when a translation
  drops or renames one.
- imageUrl empty or `https://` URL; show a preview and warn when it does not load. Recommend a 2:1 JPG/PNG under 1 MB.
- deepLink one of the four values only (dropdown, no free text).
- `sendHourLocal` 0-23, `daysBefore` 1-14, `maxPerUserPerDay` 0-20, quiet hours `HH:mm`.
- Scheduled time in the future. A campaign needs a non-empty audience (`plans` with at least one plan, `uids` with at
  least one uid).
- Campaigns use channel `product_updates`; plan templates use `plan_reminders`.

## Safety (required)

- **Always fetch and show the audience count before Send/Schedule**, and show it again in the confirm dialog:
  "Send to 1,213 devices' owners (1,840 match the audience)".
- **"Send to all" (`audience.kind == "all"`) needs a typed confirmation** (type SEND) in addition to the dialog, and a Send
  test must have been run for this exact content in this session (otherwise disable the button with an explanation).
- Disable Send/Schedule while `settings.enabled == false` and say why (campaigns would just wait); link to Settings.
- Warn when `maxPerUserPerDay` or quiet hours will defer or skip recipients (the stats show `skipped` = capped / no
  device, `deferred` = held for quiet hours and sent later).
- Never edit a `sending`/`sent` campaign; offer "Duplicate" instead.
- Write `createdBy` with the admin's uid; keep the existing admin audit log pattern (`admin_audit_logs`, append only) for
  template/settings/campaign changes if the panel already logs other edits.
- Do not display or export FCM tokens; the panel has no access to them (`users/{uid}/devices` is backend only).

## Check list when done

- Create the three templates screen against the seeded documents (seed script creates them; they exist after go-live).
- Toggle the kill-switch and run "Send test to me": the test still arrives (tests ignore it); a scheduled campaign does not.
- Create a campaign for `uids: [your uid]`, schedule it "now": within 10 minutes it moves to `sending` then `sent` with
  `stats.sent = 1` and a `notificationLog` entry.
- Write a Turkish text, click Translate to all languages: the other five tabs fill; the preview of each looks right; "Send
  test to me" arrives in the app language of the phone; clearing one tab blocks Send with a clear message.
