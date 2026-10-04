import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Picker } from "./content-editor";
import { LANGUAGE_NAMES, type Locale, type NotificationCatalogEntry, type NotificationTemplate } from "@/lib/notifications";

const NAMES: Record<string, string> = {
  generation_ready: "Generation ready",
  plan_ending_soon: "Plan ending soon",
  plan_ended: "Plan ended",
  plan_renewed: "Plan renewed",
  campaign: "Admin campaigns",
  foreground_push_display: "Push display while the app is open",
  plan_ending_banner: "Plan ending banner",
  top_toast: "Screen status messages",
  wallpaper_service: "Wallpaper service",
};

export function NotificationCatalog({ entries, templates, onEdit }: {
  entries: NotificationCatalogEntry[];
  templates: NotificationTemplate[];
  onEdit: (template: NotificationTemplate) => void;
}) {
  const [locale, setLocale] = React.useState<Locale>("tr");
  return (
    <section className="space-y-5 border-t pt-6" aria-label="Notification catalogue">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-semibold">Notification catalogue ({entries.length})</h2>
          <p className="mt-1 text-sm text-muted-foreground">All push messages and app notification surfaces. Select a language to see the current push text.</p>
        </div>
        <Picker label="Preview language" value={locale} options={LANGUAGE_NAMES} onChange={value => setLocale(value as Locale)} />
      </div>
      {!entries.length && <p className="text-sm text-muted-foreground">No notification catalogue entries have been added yet.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map(entry => {
          const template = entry.templateId ? templates.find(t => t.id === entry.templateId) : undefined;
          const editable = entry.delivery === "push" && entry.editableIn === "notificationTemplates" && !!template;
          const noNotification = entry.textSource === "none";
          const previewLocale = template?.title[locale] && template.body[locale] ? locale : "en";
          return (
            <article key={entry.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{NAMES[entry.id] ?? entry.id}</h3>
                <Badge variant="muted">{noNotification ? "No notification" : entry.delivery === "push" ? "Push" : "In app"}</Badge>
                {template && <Badge variant={template.enabled ? "success" : "muted"}>{template.enabled ? "Enabled" : "Disabled"}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{entry.trigger}</p>
              {template && <div className="space-y-1 rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{LANGUAGE_NAMES[previewLocale]}</p>
                <p className="text-sm font-medium">{template.title[previewLocale] || "No title yet"}</p>
                <p className="whitespace-pre-wrap text-sm">{template.body[previewLocale] || "No message yet"}</p>
              </div>}
              <div className="flex-1 space-y-2 text-xs text-muted-foreground">
                {entry.channel && <p>Channel: {entry.channel}</p>}
                <p>{entry.needsInternet ? "Sent through the server and FCM" : "Available offline in the app"}</p>
                {entry.notes && <p>{entry.notes}</p>}
              </div>
              {editable ? <Button variant="outline" size="sm" onClick={() => onEdit(template)}>Edit template</Button>
                : <p className="text-xs text-muted-foreground">{entry.editableIn === "app_arb"
                  ? noNotification ? "No message to edit" : "Changes with an app update"
                  : entry.templateId ? "Editable template is unavailable"
                  : entry.id === "campaign" ? "Create and manage messages in History"
                  : "Displays the original push message; no separate text to edit"}</p>}
              <details className="border-t pt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Source details</summary>
                <p className="mt-2 break-words">ID: {entry.id}</p>
                <p className="mt-1 break-words">Text source: {entry.textSource || "Unspecified"}</p>
                <p className="mt-1">Catalogue entry is read only.</p>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
