import * as React from "react";
import { Bell, Languages, Loader2, ImagePlus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
        <span className="block text-xs text-muted-foreground">{hint}</span>
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
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
          : "bg-muted/30 text-muted-foreground",
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
  previewContent,
  allowVariables = false,
}: {
  value: T;
  onChange: (value: T) => void;
  getToken: () => Promise<string>;
  onBusyChange: (busy: boolean) => void;
  previewContent?: NotificationContent;
  allowVariables?: boolean;
}) {
  const [locale, setLocale] = React.useState<Locale>(value.sourceLocale);
  const [translating, setTranslating] = React.useState(false);
  const [languagesOpen, setLanguagesOpen] = React.useState(false);
  const [replace, setReplace] = React.useState(false);
  const [failures, setFailures] = React.useState<
    Partial<Record<Locale, string[]>>
  >({});
  const [imageFailed, setImageFailed] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const focused = React.useRef<"title" | "body">("body");
  const errors = localeErrors(value, locale, false);
  const populated = LOCALES.filter(
    (l) => l !== value.sourceLocale && (value.title[l] || value.body[l]),
  );
  const titleCount = expandedText(value.title[locale]).length;
  const bodyCount = expandedText(value.body[locale]).length;
  function edit(field: "title" | "body", text: string) {
    onChange({ ...value, [field]: { ...value[field], [locale]: text } });
    setFailures((p) => ({ ...p, [locale]: undefined }));
  }
  function insert(text: string) {
    const field = focused.current;
    const el = field === "title" ? titleRef.current : bodyRef.current;
    const start = el?.selectionStart ?? value[field][locale].length;
    const end = el?.selectionEnd ?? start;
    edit(
      field,
      value[field][locale].slice(0, start) +
        text +
        value[field][locale].slice(end),
    );
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
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
      const failed: Partial<Record<Locale, string[]>> = {};
      for (const l of LOCALES.filter((l) => l !== source)) {
        if (result.translations[l] && !result.failed[l]) {
          next.title[l] = result.translations[l]!.title;
          next.body[l] = result.translations[l]!.body;
        } else {
          failed[l] = result.failed[l] ?? [
            "Could not translate this language. Try again or write it yourself.",
          ];
        }
      }
      onChange(next);
      setFailures(failed);
      setLanguagesOpen(true);
      toast.success(
        Object.keys(failed).length
          ? "Some languages could not be translated"
          : "Translations ready",
        { description: "You can review and edit them below." },
      );
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setTranslating(false);
      onBusyChange(false);
    }
  }
  const preview = previewContent ?? value;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <Picker
              label="Writing language"
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
            variant="outline"
            disabled={
              translating || localeErrors(value, value.sourceLocale).length > 0
            }
            onClick={() =>
              populated.length ? setReplace(true) : void translate()
            }
          >
            {translating ? <Loader2 className="animate-spin" /> : <Languages />}
            {translating ? "Translating…" : "Translate"}
          </Button>
        </div>
        <fieldset disabled={translating} className="space-y-5">
          {languagesOpen && (
            <Tabs value={locale} onValueChange={(l) => setLocale(l as Locale)}>
              <TabsList className="flex h-auto flex-wrap justify-start">
                {LOCALES.map((l) => (
                  <TabsTrigger key={l} value={l}>
                    {l.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <Field label="Title">
            <Input
              ref={titleRef}
              value={value.title[locale]}
              onFocus={() => (focused.current = "title")}
              onChange={(e) => edit("title", e.target.value)}
              placeholder="What’s new?"
              aria-invalid={titleCount > 50}
            />
            <span
              className={cn(
                "block text-right text-xs",
                titleCount > 50 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {titleCount}/50
            </span>
          </Field>
          <Field label="Message">
            <Textarea
              ref={bodyRef}
              rows={4}
              value={value.body[locale]}
              onFocus={() => (focused.current = "body")}
              onChange={(e) => edit("body", e.target.value)}
              placeholder="Write the notification people will receive."
              aria-invalid={bodyCount > 150}
            />
            <span
              className={cn(
                "block text-right text-xs",
                bodyCount > 150 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {bodyCount}/150
            </span>
          </Field>
          {(errors.length > 0 || failures[locale]) && (
            <p role="alert" className="text-sm text-destructive">
              {failures[locale]
                ? "This translation is unavailable. Try again or write it yourself."
                : errors[0]}
            </p>
          )}
          {allowVariables && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Personalize with
              <Button
                type="button"
                size="sm"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert("{planName}")}
              >
                Plan name
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert("{date}")}
              >
                Expiry date
              </Button>
            </div>
          )}
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setLanguagesOpen((p) => !p);
              setLocale(value.sourceLocale);
            }}
          >
            <Languages className="h-4 w-4" />
            {languagesOpen
              ? "Hide translations"
              : `Other languages${populated.length ? ` (${populated.length})` : ""}`}
            <ChevronDown className="h-3 w-3" />
          </button>
          {!languagesOpen && (
            <p className="text-xs text-muted-foreground">
              {allowVariables
                ? "Translations are used in each person’s app language."
                : "Translate to use each person’s app language. Otherwise, your writing language is used."}
            </p>
          )}
          <details className="rounded-lg border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">
              Image & destination{" "}
              <span className="ml-1 font-normal text-muted-foreground">
                Optional
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              <Field label="Image URL">
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
            </div>
          </details>
        </fieldset>
      </div>
      <aside className="space-y-3 lg:self-start">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Preview · {LANGUAGE_NAMES[locale]}
        </p>
        <div className="rounded-3xl bg-gradient-to-b from-slate-700 to-slate-950 px-4 py-8 shadow-sm">
          <p className="mb-8 text-center text-4xl font-light text-white">
            09:41
          </p>
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium">
              <Bell className="h-4 w-4 text-blue-600" /> LIVE MOMENT{" "}
              <span className="ml-auto text-slate-400">now</span>
            </div>
            <p className="break-words text-sm font-semibold">
              {previewText(preview.title[locale], locale) || "Your title"}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">
              {previewText(preview.body[locale], locale) || "Your message"}
            </p>
            {value.imageUrl.startsWith("https://") && (
              <img
                src={value.imageUrl}
                alt="Notification image"
                className="mt-3 aspect-[2/1] w-full rounded-lg object-cover"
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
          <div className="mx-auto mt-12 h-1 w-16 rounded bg-white/30" />
        </div>
        {imageFailed && (
          <p className="flex items-center gap-2 text-xs text-destructive">
            <ImagePlus className="h-3 w-3" />
            Image unavailable. Check the URL.
          </p>
        )}
      </aside>
      <Dialog open={replace} onOpenChange={setReplace}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update translations?</DialogTitle>
            <DialogDescription>
              This will replace the other language versions with a new
              translation of your current text.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplace(false)}>
              Keep current text
            </Button>
            <Button onClick={() => void translate()}>Translate again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
