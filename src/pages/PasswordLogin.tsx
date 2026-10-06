import * as React from "react";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { listPasswordLoginAccounts, updatePasswordLoginAccount, passwordLoginError, type PasswordLoginAccount, type PasswordLoginUpdate } from "@/services/password-login";

function PasswordField({ id, value, onChange, disabled }: {
  id: string; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => { if (!value) setVisible(false); }, [value]);
  return <div className="space-y-2">
    <Label htmlFor={id}>Password</Label>
    <div className="relative">
      <Input id={id} type={visible ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" disabled={disabled} className="pr-12" aria-describedby={`${id}-help`} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setVisible(v => !v)} disabled={disabled} aria-label={visible ? "Hide Password" : "Show Password"} aria-pressed={visible}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">8–128 characters. Saving also enables password login.</p>
  </div>;
}

export function PasswordLoginPage() {
  const { getIdToken, demoMode } = useAuth();
  const [accounts, setAccounts] = React.useState<PasswordLoginAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [selected, setSelected] = React.useState<PasswordLoginAccount | null>(null);
  const [editPassword, setEditPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const saving = React.useRef(false);
  const loadVersion = React.useRef(0);

  const load = React.useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      if (demoMode) { setAccounts([]); return; }
      const token = await getIdToken();
      if (!token) throw new Error("Missing session");
      const result = await listPasswordLoginAccounts(token);
      if (version === loadVersion.current) setAccounts(result);
    } catch (err) {
      if (version === loadVersion.current) setError(passwordLoginError(err));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [getIdToken, demoMode]);

  React.useEffect(() => {
    void load();
    return () => { loadVersion.current++; };
  }, [load]);

  async function save(update: PasswordLoginUpdate, source: "add" | "edit" | "disable") {
    if (saving.current || demoMode) return;
    saving.current = true;
    setBusy(true);
    // Invalidate a pending list read so it cannot overwrite a successful mutation.
    ++loadVersion.current;
    setLoading(false);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Missing session");
      const result = await updatePasswordLoginAccount(token, update);
      setAccounts(current => [{ ...result, updatedAt: null }, ...current.filter(a => a.uid !== result.uid)]);
      if (source === "add") { setPassword(""); setEmail(""); }
      if (source === "edit") { setEditPassword(""); setSelected(null); }
      toast.success(update.enabled ? "Password saved. Password login is enabled." : "Password login disabled.");
      await load();
    } catch (err) {
      toast.error(passwordLoginError(err));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function openEditor(account: PasswordLoginAccount) {
    setEditPassword("");
    setSelected(account);
  }

  return <div className="space-y-6">
    <PageHeader title="Password Login" description="Set a password for an existing account so the user can sign in with email and password." actions={
      <Button variant="outline" onClick={() => void load()} disabled={loading || busy}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
    } />
    {demoMode && <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">Demo Mode: Connect Firebase and the backend to manage password login accounts.</p>}
    <Card>
      <CardHeader><CardTitle>Add Account</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">The user must have signed in to the app at least once. Their existing account and data are preserved.</p>
        <form className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]" onSubmit={e => { e.preventDefault(); void save({ email, enabled: true, password }, "add"); }}>
          <div className="space-y-2"><Label htmlFor="account-email">Email</Label><Input id="account-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy || demoMode} autoComplete="off" placeholder="user@example.com" /></div>
          <PasswordField id="account-password" value={password} onChange={setPassword} disabled={busy || demoMode} />
          <Button type="submit" className="sm:mt-6" disabled={busy || demoMode}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Account</Button>
        </form>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
      <CardContent>
        {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 p-3 text-sm"><p className="flex-1">{error}</p><Button variant="outline" size="sm" disabled={busy || loading} onClick={() => void load()}>Retry</Button></div>}
        {loading && <p role="status" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading Accounts…</p>}
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Uid</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {accounts.map(account => <TableRow key={account.uid}>
              <TableCell className="font-medium">{account.email}</TableCell>
              <TableCell className="font-mono text-xs">{account.uid}</TableCell>
              <TableCell><Badge variant={account.passwordLogin ? "success" : "muted"}>{account.passwordLogin ? "Enabled" : "Disabled"}</Badge></TableCell>
              <TableCell className="whitespace-nowrap">{formatDateTime(account.updatedAt)}</TableCell>
              <TableCell><div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={busy || loading || demoMode} onClick={() => openEditor(account)}>Set Password</Button>
                <Button variant="outline" size="sm" disabled={busy || loading || demoMode} onClick={() => account.passwordLogin ? void save({ email: account.email, enabled: false }, "disable") : openEditor(account)}>{account.passwordLogin ? "Disable" : "Enable"}</Button>
              </div></TableCell>
            </TableRow>)}
            {!accounts.length && !loading && !error && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No password login accounts yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">Disabling returns the app to its usual sign-in flow. It does not remove the Firebase password.</p>
      </CardContent>
    </Card>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open && !busy) { setSelected(null); setEditPassword(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Set Password</DialogTitle><DialogDescription>{selected?.email} — set a new password and enable password login.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (selected) void save({ email: selected.email, enabled: true, password: editPassword }, "edit"); }}>
          <PasswordField id="edit-password" value={editPassword} onChange={setEditPassword} disabled={busy} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => { setSelected(null); setEditPassword(""); }}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Password</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
