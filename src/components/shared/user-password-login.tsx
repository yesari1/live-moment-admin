import * as React from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { listPasswordLoginAccounts, updatePasswordLoginAccount, passwordLoginError } from "@/services/password-login";

export function UserPasswordLogin({ uid, email }: { uid: string; email: string | null }) {
  const { demoMode, getIdToken } = useAuth();
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(!demoMode);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const busy = React.useRef(false);
  const mounted = React.useRef(true);
  const inputId = React.useId();

  const token = React.useCallback(async () => {
    const value = await getIdToken();
    if (!value) throw new Error("Missing session");
    return value;
  }, [getIdToken]);

  const load = React.useCallback(async () => {
    if (demoMode) return;
    setLoading(true);
    setLoadError(null);
    try {
      const accounts = await listPasswordLoginAccounts(await token());
      if (mounted.current) setEnabled(accounts.find(account => account.uid === uid)?.passwordLogin ?? false);
    } catch (error) {
      if (mounted.current) setLoadError(passwordLoginError(error));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [demoMode, token, uid]);

  React.useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  function changeOpen(value: boolean) {
    if (busy.current) return;
    setOpen(value);
    setPassword("");
    setVisible(false);
    setActionError(null);
  }

  async function save(enable: boolean) {
    if (busy.current || demoMode || !email) return;
    busy.current = true;
    setSaving(true);
    setActionError(null);
    try {
      const result = await updatePasswordLoginAccount(await token(), enable
        ? { email, enabled: true, password }
        : { email, enabled: false });
      if (!mounted.current) return;
      setEnabled(result.passwordLogin);
      setLoadError(null);
      setPassword("");
      setVisible(false);
      setOpen(false);
      toast.success(enable ? "Password saved. Password login is enabled." : "Password login disabled.");
    } catch (error) {
      if (mounted.current) setActionError(passwordLoginError(error));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={demoMode || !email || loading} onClick={() => changeOpen(true)}>
        {enabled !== null && <span className={`border-r pr-2 text-xs ${enabled ? "text-success" : "text-muted-foreground"}`}>{enabled ? "On" : "Off"}</span>}
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {enabled ? "Change Password Login" : "Set Password Login"}
      </Button>
      {!email && <span className="text-xs text-muted-foreground">An email address is required.</span>}
      {loadError && <span role="alert" className="basis-full text-xs text-destructive">{loadError} <Button variant="link" size="sm" onClick={() => void load()} disabled={loading}>Retry</Button></span>}
    </div>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{enabled ? "Change Password Login" : "Set Password Login"}</DialogTitle>
          <DialogDescription>Set a password for {email} to enable email and password sign-in.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(true); }}>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Password</Label>
            <div className="relative">
              <Input id={inputId} type={visible ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} disabled={saving} className="pr-12" aria-describedby={`${inputId}-help`} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" disabled={saving} onClick={() => setVisible(value => !value)} aria-label={visible ? "Hide Password" : "Show Password"} aria-pressed={visible}>
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p id={`${inputId}-help`} className="text-xs text-muted-foreground">8–128 characters. The current password cannot be viewed.</p>
          </div>
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {enabled && <Button type="button" variant="outline" disabled={saving} onClick={() => void save(false)}>Disable Password Login</Button>}
            <Button type="button" variant="outline" disabled={saving} onClick={() => changeOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Password</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
