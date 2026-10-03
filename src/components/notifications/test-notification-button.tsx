import * as React from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice } from "./content-editor";
import { DeviceStatus } from "./device-status";
import {
  testContent,
  testContentErrors,
  type NotificationContent,
} from "@/lib/notifications";
import {
  notificationError,
  sendNotificationTest,
  type TestResult,
} from "@/services/notifications";

export function TestNotificationButton({
  content,
  getToken,
  disabled,
}: {
  content: NotificationContent;
  getToken: () => Promise<string>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<TestResult | null>(null);
  async function test() {
    const errors = testContentErrors(content);
    if (errors.length) {
      toast.error("Add a title and message before sending a test.", {
        description: errors[0],
      });
      return;
    }
    setBusy(true);
    try {
      setResult(
        await sendNotificationTest(await getToken(), {
          content: testContent(content),
          target: "self",
        }),
      );
    } catch (e) {
      toast.error(notificationError(e));
    } finally {
      setBusy(false);
    }
  }
  const sent = result?.results.some((r) => r.outcome === "sent");
  const noDevice = result?.results.some((r) => r.outcome === "no_devices");
  return (
    <>
      <Button
        variant="ghost"
        disabled={busy || disabled}
        onClick={() => void test()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Smartphone />}Send me a
        test
      </Button>
      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sent ? "Test sent" : "Test could not be sent"}
            </DialogTitle>
            <DialogDescription>
              {sent
                ? "Check the phone signed into your admin account."
                : noDevice
                  ? "This account does not have a registered phone yet."
                  : "Please try again. Your message has not been sent to anyone else."}
            </DialogDescription>
          </DialogHeader>
          {noDevice && (
            <details>
              <summary className="cursor-pointer text-sm">
                Check my phone registration
              </summary>
              <div className="mt-3">
                <DeviceStatus getToken={getToken} />
              </div>
            </details>
          )}
          {!sent && !noDevice && (
            <Notice danger>
              {result?.results.some((r) => r.outcome === "invalid_content")
                ? "Check the message and its translations."
                : "The delivery service returned an error."}
            </Notice>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setResult(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
