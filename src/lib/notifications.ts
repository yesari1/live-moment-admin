export const LOCALES = ["en", "tr", "es", "pt-BR", "de", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
  es: "Español",
  "pt-BR": "Português",
  de: "Deutsch",
  fr: "Français",
};
export const TEMPLATE_IDS = [
  "plan_ending_soon",
  "plan_ended",
  "plan_renewed",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const PLANS = ["free", "live_weather", "live_weather_plus"] as const;
export type NotificationPlan = (typeof PLANS)[number];
export const DEEP_LINKS = {
  "livemoment://home": "Home",
  "livemoment://library": "Library",
  "livemoment://weather-set": "Weather set",
  "livemoment://plan": "Plan",
} as const;
export type DeepLink = keyof typeof DEEP_LINKS;
export type LocaleText = Record<Locale, string>;
export interface NotificationContent {
  title: LocaleText;
  body: LocaleText;
  sourceLocale: Locale;
  imageUrl: string;
  deepLink: DeepLink;
  channel: "plan_reminders" | "product_updates";
}
export interface NotificationTemplate extends NotificationContent {
  id: string;
  name?: string;
  enabled: boolean;
  trigger: string;
  params: { daysBefore?: number; sendHourLocal?: number };
  audience: { plans: NotificationPlan[]; excludeAdminGrant: boolean };
}
export function isManualTemplate(id: string): boolean {
  return id.startsWith("manual_");
}
export function emptyManualTemplate(): NotificationTemplate {
  const campaign = emptyCampaign();
  return {
    title: campaign.title,
    body: campaign.body,
    sourceLocale: campaign.sourceLocale,
    imageUrl: "",
    deepLink: campaign.deepLink,
    channel: "product_updates",
    id: `manual_${crypto.randomUUID()}`,
    name: "",
    enabled: false,
    trigger: "manual",
    params: {},
    audience: { plans: [], excludeAdminGrant: false },
  };
}
export function templateCampaign(
  template: NotificationTemplate,
  uid: string,
): NotificationCampaign {
  return {
    ...emptyCampaign(),
    title: { ...template.title },
    body: { ...template.body },
    sourceLocale: template.sourceLocale,
    imageUrl: template.imageUrl,
    deepLink: template.deepLink,
    audience: { kind: "uids", uids: [uid] },
  };
}
export function testContent(content: NotificationContent): NotificationContent {
  return {
    ...content,
    title: Object.fromEntries(
      LOCALES.filter(
        (l) => content.title[l].trim() && content.body[l].trim(),
      ).map((l) => [l, previewText(content.title[l], l)]),
    ) as LocaleText,
    body: Object.fromEntries(
      LOCALES.filter(
        (l) => content.title[l].trim() && content.body[l].trim(),
      ).map((l) => [l, previewText(content.body[l], l)]),
    ) as LocaleText,
  };
}
export function testContentErrors(content: NotificationContent): string[] {
  return [
    ...contentErrors(content, false),
    ...localeErrors(content, content.sourceLocale, true).map(
      (e) => `${LANGUAGE_NAMES[content.sourceLocale]}: ${e}`,
    ),
  ];
}
export function renderNotificationVariables(
  content: NotificationContent,
  planName: string,
  date: string,
): NotificationContent {
  const parsedDate = date ? new Date(`${date}T12:00:00Z`) : null;
  const render = (text: string, locale: Locale) => {
    const localizedDate =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(parsedDate)
        : "{date}";
    return text
      .split("{planName}")
      .join(planName || "{planName}")
      .split("{date}")
      .join(localizedDate);
  };
  return {
    ...content,
    title: Object.fromEntries(
      LOCALES.map((l) => [l, render(content.title[l], l)]),
    ) as LocaleText,
    body: Object.fromEntries(
      LOCALES.map((l) => [l, render(content.body[l], l)]),
    ) as LocaleText,
  };
}
export interface NotificationSettings {
  enabled: boolean;
  quietHours: { start: string; end: string } | null;
  maxPerUserPerDay: number;
  defaultChannel: "plan_reminders" | "product_updates";
  defaultTimezone: string;
  testRecipients: string[];
}
export interface Audience {
  kind: "all" | "plans" | "lapsedOnly" | "uids";
  plans?: NotificationPlan[];
  uids?: string[];
  locales?: Locale[];
}
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";
export const STAT_KEYS = [
  "targeted",
  "sent",
  "failed",
  "skipped",
  "deferred",
] as const;
export type CampaignStats = Record<(typeof STAT_KEYS)[number], number>;
export interface NotificationCampaign extends NotificationContent {
  id: string;
  audience: Audience;
  scheduledAt: Date | null;
  status: CampaignStatus;
  stats: CampaignStats;
  createdAt: Date | null;
  lastError?: string;
}
export interface NotificationLogEntry {
  id: string;
  uid: string;
  kind: string;
  templateId?: string;
  campaignId?: string;
  status: string;
  createdAt: Date | null;
  sentAt: Date | null;
  deviceCount: number;
  deliveredCount: number;
  reason?: string;
}
export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  quietHours: null,
  maxPerUserPerDay: 3,
  defaultChannel: "product_updates",
  defaultTimezone: "UTC",
  testRecipients: [],
};
export const ZERO_STATS: CampaignStats = {
  targeted: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  deferred: 0,
};
export function localeMap(value?: unknown): LocaleText {
  const map =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    LOCALES.map((l) => [
      l,
      typeof value === "string"
        ? l === "en"
          ? value
          : ""
        : typeof map[l] === "string"
          ? map[l]
          : "",
    ]),
  ) as LocaleText;
}
export function emptyCampaign(): NotificationCampaign {
  return {
    id: "",
    title: localeMap(),
    body: localeMap(),
    sourceLocale: "tr",
    imageUrl: "",
    deepLink: "livemoment://home",
    channel: "product_updates",
    audience: { kind: "uids", uids: [] },
    scheduledAt: null,
    status: "draft",
    stats: { ...ZERO_STATS },
    createdAt: null,
  };
}
export function expandedText(text: string): string {
  return text
    .split("{planName}")
    .join("Live Weather Plus")
    .split("{date}")
    .join("30 September 2026");
}
export function previewText(text: string, locale: Locale): string {
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date("2026-11-03T12:00:00Z"));
  return text
    .split("{planName}")
    .join("Live Weather Plus")
    .split("{date}")
    .join(date);
}
function placeholders(text: string): string {
  return [...new Set(text.match(/\{[^{}]+\}/g) ?? [])].sort().join(",");
}
export function localeErrors(
  content: NotificationContent,
  locale: Locale,
  required = true,
): string[] {
  const errors: string[] = [];
  for (const field of ["title", "body"] as const) {
    const text = content[field][locale];
    const max = field === "title" ? 50 : 150;
    if (!text.trim() && required) errors.push(`${field} is empty`);
    if (expandedText(text).length > max)
      errors.push(`${field} exceeds ${max} characters after placeholders`);
    if (
      /\{[^{}]+\}/g.test(text) &&
      (text.match(/\{[^{}]+\}/g) ?? []).some(
        (p) => p !== "{date}" && p !== "{planName}",
      )
    )
      errors.push(`${field} has an unknown placeholder`);
    if (
      text.trim() &&
      placeholders(text) !== placeholders(content[field][content.sourceLocale])
    )
      errors.push(`${field} placeholders differ from the source`);
  }
  return errors;
}
export function contentErrors(
  content: NotificationContent,
  required = true,
): string[] {
  const errors = LOCALES.flatMap((l) =>
    localeErrors(content, l, required).map((e) => `${LANGUAGE_NAMES[l]}: ${e}`),
  );
  if (!(content.deepLink in DEEP_LINKS))
    errors.push("Choose a supported destination.");
  if (content.imageUrl) {
    try {
      if (new URL(content.imageUrl).protocol !== "https:") throw new Error();
    } catch {
      errors.push("Image must be a valid HTTPS URL.");
    }
  }
  return errors;
}
export function audienceErrors(audience: Audience): string[] {
  if (!["all", "plans", "lapsedOnly", "uids"].includes(audience.kind))
    return ["Choose an audience."];
  if (audience.kind === "plans" && !audience.plans?.length)
    return ["Select at least one plan."];
  if (audience.kind === "uids" && !audience.uids?.length)
    return ["Add at least one account UID."];
  if ((audience.uids?.length ?? 0) > 1000)
    return ["At most 1,000 account UIDs are allowed."];
  if (audience.plans?.some((p) => !PLANS.includes(p)))
    return ["Choose supported plans."];
  if (audience.locales?.some((l) => !LOCALES.includes(l)))
    return ["Choose supported languages."];
  return [];
}
export function settingsErrors(settings: NotificationSettings): string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(settings.maxPerUserPerDay) ||
    settings.maxPerUserPerDay < 0 ||
    settings.maxPerUserPerDay > 20
  )
    errors.push("Daily cap must be an integer from 0 to 20.");
  if (
    settings.quietHours &&
    (!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.quietHours.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.quietHours.end))
  )
    errors.push("Quiet hours must use HH:mm.");
  try {
    new Intl.DateTimeFormat("en", {
      timeZone: settings.defaultTimezone,
    }).format();
  } catch {
    errors.push("Enter a valid IANA time zone, such as Europe/Istanbul.");
  }
  return errors;
}
export function sendContentErrors(content: NotificationContent): string[] {
  const errors = contentErrors(content, false);
  const source = content.sourceLocale;
  if (!content.title[source].trim() || !content.body[source].trim())
    errors.unshift(`Add a title and message in ${LANGUAGE_NAMES[source]}.`);
  for (const locale of LOCALES) {
    if (!!content.title[locale].trim() !== !!content.body[locale].trim())
      errors.push(
        `Finish the ${LANGUAGE_NAMES[locale]} translation or clear both fields.`,
      );
  }
  return errors;
}
export function campaignErrors(
  campaign: NotificationCampaign,
  schedule: boolean,
): string[] {
  return [
    ...(schedule
      ? sendContentErrors(campaign)
      : contentErrors(campaign, false)),
    ...(schedule &&
    LOCALES.some((l) => /\{[^{}]+\}/.test(campaign.title[l] + campaign.body[l]))
      ? ["Choose the plan and date to use in this message."]
      : []),
    ...audienceErrors(campaign.audience),
    ...(schedule &&
    campaign.scheduledAt &&
    (!Number.isFinite(campaign.scheduledAt.getTime()) ||
      campaign.scheduledAt.getTime() <= Date.now())
      ? ["Scheduled time must be in the future."]
      : []),
  ];
}
export function canEditCampaign(status: CampaignStatus): boolean {
  return status === "draft" || status === "scheduled";
}
export function canTransitionCampaign(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  return (
    (from === "draft" && to === "scheduled") ||
    (from === "scheduled" && ["draft", "cancelled"].includes(to)) ||
    (from === "sending" && to === "cancelled")
  );
}
export function contentFingerprint(content: NotificationContent): string {
  return JSON.stringify({
    title: LOCALES.map((l) => content.title[l]),
    body: LOCALES.map((l) => content.body[l]),
    imageUrl: content.imageUrl,
    deepLink: content.deepLink,
    channel: content.channel,
  });
}
export function audienceSummary(audience: Audience): string {
  const label =
    audience.kind === "all"
      ? "All accounts"
      : audience.kind === "plans"
        ? audience.plans?.join(", ")
        : audience.kind === "uids"
          ? `${audience.uids?.length ?? 0} specific accounts`
          : "Lapsed subscribers";
  return `${label ?? "No plans"}${audience.locales?.length ? ` · ${audience.locales.join(", ")}` : ""}`;
}
export function parseUids(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}
