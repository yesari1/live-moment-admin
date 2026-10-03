import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentEditor, Field } from "./content-editor";
import { TestNotificationButton } from "./test-notification-button";
import { contentErrors, type NotificationTemplate } from "@/lib/notifications";
import {
  notificationError,
  saveNotificationTemplate,
} from "@/services/notifications";
import { useAuth } from "@/hooks/use-auth";
export function ManualTemplateEditor({
  initial,
  getToken,
  onClose,
}: {
  initial: NotificationTemplate;
  getToken: () => Promise<string>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [error, setError] = React.useState("");
  async function save() {
    if (!user) return;
    const error = !value.name?.trim()
      ? "Give your template a name."
      : contentErrors(value, false)[0];
    if (error) {
      setError(error);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await saveNotificationTemplate({ ...value, enabled: false }, user);
      toast.success("Template saved");
      onClose();
    } catch (e) {
      setError(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && !translating && onClose()}
    >
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b p-6 pr-12">
          <DialogTitle>
            {initial.name ? "Edit template" : "Create template"}
          </DialogTitle>
          <DialogDescription>
            A message you can reuse whenever you want.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <fieldset disabled={busy || translating}>
            <Field label="Template name">
              <Input
                value={value.name ?? ""}
                placeholder="For example: New wallpaper collection"
                onChange={(e) => setValue({ ...value, name: e.target.value })}
              />
            </Field>
          </fieldset>
          <fieldset disabled={busy}>
            <ContentEditor
              value={value}
              onChange={setValue}
              getToken={getToken}
              onBusyChange={setTranslating}
            />
          </fieldset>
        </div>
        <div className="shrink-0 border-t bg-background p-4 px-6">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TestNotificationButton
              content={value}
              getToken={getToken}
              disabled={busy || translating}
            />
            <Button disabled={busy || translating} onClick={() => void save()}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}Save
              template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
