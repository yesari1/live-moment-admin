import * as React from "react";
import { Bell, Check, Languages, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEEP_LINKS,
  LANGUAGE_NAMES,
  LOCALES,
  expandedText,
  localeErrors,
  previewText,
  type Locale,
  type NotificationContent,
} from "@/lib/notifications";
import {
  notificationError,
  translateNotification,
} from "@/services/notifications";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}
export function Picker({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {Object.entries(options).map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Notice({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      role={danger ? "alert" : "status"}
      className={cn(
        "rounded-lg border p-3 text-sm leading-relaxed",
        danger
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-primary/5 text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}
export function ContentEditor<T extends NotificationContent>({
  value,
  onChange,
  getToken,
  onBusyChange,
}: {
  value: T;
  onChange: (value: T) => void;
  getToken: () => Promise<string>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [locale, setLocale] = React.useState<Locale>(value.sourceLocale);
  const [translating, setTranslating] = React.useState(false);
  const [reviews, setReviews] = React.useState<
    Partial<Record<Locale, "review" | "edited" | "confirmed">>
  >({});
  const [failures, setFailures] = React.useState<
    Partial<Record<Locale, string[]>>
  >({});
  const [replace, setReplace] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const focusField = React.useRef<"title" | "body">("body");
  const replaceLocales = LOCALES.filter(
    (l) =>
      l !== value.sourceLocale &&
      (value.title[l] || value.body[l]) &&
      reviews[l] !== "review",
  );
  const errors = localeErrors(value, locale);
  const titleCount = expandedText(value.title[locale]).length;
  const bodyCount = expandedText(value.body[locale]).length;

  function edit(field: "title" | "body", text: string) {
    onChange({ ...value, [field]: { ...value[field], [locale]: text } });
    setReviews((prev) => ({ ...prev, [locale]: "edited" }));
    setFailures((prev) => ({ ...prev, [locale]: undefined }));
  }
  function insert(placeholder: string) {
    const field = focusField.current;
    const element = field === "title" ? titleRef.current : bodyRef.current;
    const text = value[field][locale];
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? start;
    edit(field, text.slice(0, start) + placeholder + text.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(
        start + placeholder.length,
        start + placeholder.length,
      );
    });
  }
  async function translate() {
    setReplace(false);
    setTranslating(true);
    onBusyChange(true);
    try {
      const source = value.sourceLocale;
      const result = await translateNotification(
        await getToken(),
        source,
        value.title[source],
        value.body[source],
      );
      const next = {
        ...value,
        title: { ...value.title },
        body: { ...value.body },
      };
      const nextReviews = { ...reviews };
      const nextFailures: Partial<Record<Locale, string[]>> = {};
      for (const l of LOCALES.filter((l) => l !== source)) {
        if (result.translations[l] && !result.failed[l]) {
          next.title[l] = result.translations[l]!.title;
          next.body[l] = result.translations[l]!.body;
          nextReviews[l] = "review";
        } else {
          next.title[l] = "";
          next.body[l] = "";
          delete nextReviews[l];
          nextFailures[l] = result.failed[l] ?? [
            "Translation was missing. Please enter this language manually.",
          ];
        }
      }
      onChange(next);
      setReviews(nextReviews);
      setFailures(nextFailures);
      toast.success("Translations filled for review", {
        description: "Review each language, then save when ready.",
      });
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setTranslating(false);
      onBusyChange(false);
    }
  }
  const sourceErrors = localeErrors(value, value.sourceLocale);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Picker
              label="Source language"
              value={value.sourceLocale}
              options={LANGUAGE_NAMES}
              disabled={translating}
              onChange={(l) => {
                onChange({ ...value, sourceLocale: l as Locale });
                setLocale(l as Locale);
              }}
            />
          </div>
          <Button
            type="button"
            onClick={() =>
              replaceLocales.length ? setReplace(true) : void translate()
            }
            disabled={translating || sourceErrors.length > 0}
          >
            {translating ? <Loader2 className="animate-spin" /> : <Languages />}
            {translating ? "Translating…" : "Translate to all languages"}
          </Button>
        </div>
        {translating && (
          <Notice>
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Translating from {LANGUAGE_NAMES[value.sourceLocale]} into five
              languages. This may take a few seconds.
            </span>
          </Notice>
        )}
        <p className="text-xs text-muted-foreground">
          Write in your source language, translate, and review. Translations are
          saved only when you press Save.
        </p>
        <Tabs value={locale} onValueChange={(l) => setLocale(l as Locale)}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/30 p-1">
            {LOCALES.map((l) => {
              const bad = localeErrors(value, l).length > 0 || !!failures[l];
              return (
                <TabsTrigger key={l} value={l} className="gap-2 px-3 py-2">
                  <span>{l.toUpperCase()}</span>
                  <span
                    aria-label={
                      bad
                        ? "Incomplete or invalid"
                        : reviews[l] === "review"
                          ? "Review translation"
                          : "Ready"
                    }
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      bad
                        ? "bg-destructive"
                        : reviews[l] === "review"
                          ? "bg-warning"
                          : "bg-success",
                    )}
                  />
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        <fieldset disabled={translating} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">
              {LANGUAGE_NAMES[locale]}{" "}
              {locale === value.sourceLocale && (
                <Badge variant="muted">Source</Badge>
              )}
            </h3>
            {reviews[locale] === "review" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setReviews((p) => ({ ...p, [locale]: "confirmed" }))
                }
              >
                <Check />
                Confirm translation
              </Button>
            )}
          </div>
          {reviews[locale] === "review" && (
            <div className="text-xs text-warning">
              Machine translated · please review this language
            </div>
          )}
          <Field label="Notification title">
            <Input
              ref={titleRef}
              value={value.title[locale]}
              onFocus={() => {
                focusField.current = "title";
              }}
              onChange={(e) => edit("title", e.target.value)}
              placeholder="A short, clear headline"
              aria-invalid={titleCount > 50}
            />
            <span
              className={cn(
                "block text-right text-xs",
                titleCount > 50 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {titleCount} / 50
            </span>
          </Field>
          <Field label="Message">
            <Textarea
              ref={bodyRef}
              rows={4}
              value={value.body[locale]}
              onFocus={() => {
                focusField.current = "body";
              }}
              onChange={(e) => edit("body", e.target.value)}
              placeholder="Give people a useful reason to open Live Moment."
              aria-invalid={bodyCount > 150}
            />
            <span
              className={cn(
                "block text-right text-xs",
                bodyCount > 150 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {bodyCount} / 150
            </span>
          </Field>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Insert at cursor:
            {["{date}", "{planName}"].map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(p)}
              >
                {p}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Counters include the longest sample values for placeholders.
          </p>
          {(errors.length > 0 || failures[locale]) && (
            <Notice danger>
              {[...errors, ...(failures[locale] ?? [])].join(" · ")}
            </Notice>
          )}
          <Field
            label="Image URL"
            hint="Optional · HTTPS · recommended: 2:1 JPG/PNG, under 1 MB"
          >
            <Input
              type="url"
              value={value.imageUrl}
              onChange={(e) => {
                setImageFailed(false);
                onChange({ ...value, imageUrl: e.target.value });
              }}
              placeholder="https://…"
            />
          </Field>
          <Picker
            label="Open in the app"
            value={value.deepLink}
            options={DEEP_LINKS}
            onChange={(deepLink) =>
              onChange({
                ...value,
                deepLink: deepLink as NotificationContent["deepLink"],
              })
            }
          />
        </fieldset>
      </div>
      <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Smartphone className="h-4 w-4" />
          Lock-screen preview{" "}
          <Badge variant="muted">{locale.toUpperCase()}</Badge>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-slate-700 via-slate-900 to-indigo-950 p-5 shadow-xl">
          <div className="mx-auto mb-7 h-1 w-12 rounded-full bg-white/30" />
          <p className="text-center text-sm text-white/60">
            Tuesday, 3 November
          </p>
          <p className="mb-8 mt-1 text-center text-5xl font-light tracking-tight text-white">
            09:41
          </p>
          <div className="rounded-2xl bg-white/90 p-3 text-slate-900 shadow-lg">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
              <span className="rounded-md bg-blue-600 p-1 text-white">
                <Bell className="h-3 w-3" />
              </span>
              Live Moment
              <span className="ml-auto font-normal text-slate-500">now</span>
            </div>
            <p className="break-words text-sm font-semibold">
              {previewText(value.title[locale], locale) ||
                "Your notification title"}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">
              {previewText(value.body[locale], locale) ||
                "Your message appears here."}
            </p>
            {value.imageUrl.startsWith("https://") && (
              <img
                key={value.imageUrl}
                src={value.imageUrl}
                alt="Notification attachment"
                className="mt-3 aspect-[2/1] w-full rounded-lg object-cover"
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
          <div className="mx-auto mt-14 h-1 w-20 rounded-full bg-white/50" />
        </div>
        {imageFailed && (
          <Notice danger>
            Image could not load. Check the public HTTPS URL.
          </Notice>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Preview uses sample plan and date values. A test arrives in the
          receiving phone’s app language.
        </p>
        <div className="space-y-2 rounded-xl border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Language readiness
          </p>
          {LOCALES.map((l) => (
            <button
              type="button"
              key={l}
              onClick={() => setLocale(l)}
              className="flex w-full items-center justify-between gap-2 py-1 text-xs"
            >
              <span>{LANGUAGE_NAMES[l]}</span>
              <span
                className={
                  localeErrors(value, l).length || failures[l]
                    ? "text-destructive"
                    : reviews[l] === "review"
                      ? "text-warning"
                      : "text-success"
                }
              >
                {failures[l]
                  ? "Translation failed"
                  : localeErrors(value, l).length
                    ? "Needs attention"
                    : reviews[l] === "review"
                      ? "Review"
                      : "Ready"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Dialog open={replace} onOpenChange={setReplace}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Replace {replaceLocales.length} edited translations?
            </DialogTitle>
            <DialogDescription>
              New translations will replace{" "}
              {replaceLocales.map((l) => LANGUAGE_NAMES[l]).join(", ")}. Your
              source text stays as written.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplace(false)}>
              Keep my edits
            </Button>
            <Button onClick={() => void translate()}>
              Replace and translate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
