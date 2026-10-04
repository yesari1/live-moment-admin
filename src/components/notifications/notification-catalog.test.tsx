import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationCatalog } from "./notification-catalog";
import { emptyManualTemplate, type NotificationCatalogEntry } from "@/lib/notifications";

it("shows live push text and keeps app surfaces read only", () => {
  const entry: NotificationCatalogEntry = { id: "generation_ready", delivery: "push", editableIn: "notificationTemplates", templateId: "generation_ready", trigger: "A generation completed", textSource: "Firestore", needsInternet: true, notes: "" };
  const template = { ...emptyManualTemplate(), id: "generation_ready", enabled: true };
  template.title.tr = "Üretimin hazýr";
  template.body.tr = "Görmek için dokun.";
  const html = renderToStaticMarkup(<NotificationCatalog entries={[entry, { ...entry, id: "top_toast", delivery: "in_app", editableIn: "app_arb", templateId: undefined, needsInternet: false }]} templates={[template]} onEdit={() => {}} />);
  expect(html).toContain("Üretimin hazýr");
  expect(html).toContain("Changes with an app update");
  expect(html.match(/Edit template/g)).toHaveLength(1);
  expect(html).toContain("Notification catalogue (2)");
});
