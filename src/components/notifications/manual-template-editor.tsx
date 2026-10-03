import * as React from "react";
import { Loader2, Save, Send } from "lucide-react";
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
import { ContentEditor, Field, Notice } from "./content-editor";
import { DeviceStatus, TestResults } from "./device-status";
import {
  contentErrors,
  testContent,
  testContentErrors,
  type NotificationTemplate,
} from "@/lib/notifications";
import {
  notificationError,
  saveNotificationTemplate,
  sendNotificationTest,
  type TestResult,
} from "@/services/notifications";
import { useAuth } from "@/hooks/use-auth";

export function ManualTemplateEditor({
  initial,
  getToken,
  onClose,
  onSend,
}: {
  initial: NotificationTemplate;
  getToken: () => Promise<string>;
  onClose: () => void;
  onSend: (template: NotificationTemplate) => void;
}) {
  const { user } = useAuth();
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [translating, setTranslating] = React.useState(false);
  const [results, setResults] = React.useState<TestResult["results"]>([]);
  const errors = contentErrors(value, false);
  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      await saveNotificationTemplate({ ...value, enabled: false }, user);
      toast.success("Reusable template saved");
      onClose();
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setResults([]);
    try {
      const result = await sendNotificationTest(await getToken(), {
        content: testContent(value),
        target: "self",
      });
      setResults(result.results);
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && !translating && onClose()}
    >
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b p-5 pr-12">
          <DialogTitle>
            {initial.name
              ? "Edit notification template"
              : "New notification template"}
          </DialogTitle>
          <DialogDescription>
            Reusable content for announcements, updates or anything you want to
            send. No automatic trigger.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <fieldset disabled={busy || translating} className="space-y-5">
            <Field label="Template name">
              <Input
                value={value.name ?? ""}
                placeholder="For example: New weather scenes"
                onChange={(e) => setValue({ ...value, name: e.target.value })}
              />
            </Field>
          </fieldset>
          <fieldset disabled={busy} className="mt-5 space-y-5">
            <ContentEditor
              value={value}
              onChange={setValue}
              getToken={getToken}
              onBusyChange={setTranslating}
            />
            <DeviceStatus getToken={getToken} />
            <TestResults results={results} />
            {errors.length > 0 && <Notice danger>{errors.join(" · ")}</Notice>}
            <p className="text-xs text-muted-foreground">
              Test your source language immediately; translations are optional
              for tests. Test placeholders use sample values. Complete all six
              languages before a real send.
            </p>
          </fieldset>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-background p-4">
          <Button
            variant="outline"
            disabled={busy || translating}
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            variant="outline"
            disabled={
              busy || translating || testContentErrors(value).length > 0
            }
            onClick={() => void test()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Send />}Send Test to
            Me
          </Button>
          <Button
            variant="outline"
            disabled={
              busy || translating || !value.name?.trim() || errors.length > 0
            }
            onClick={() => void save()}
          >
            <Save />
            Save template
          </Button>
          <Button disabled={busy || translating} onClick={() => onSend(value)}>
            <Send />
            Send Notification
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
