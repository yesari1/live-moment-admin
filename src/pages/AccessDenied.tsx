import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export function AccessDeniedPage() {
  const { user, denialReason, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldX className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Access denied</h1>
            <p className="text-sm text-muted-foreground">
              {denialReason ??
                "This account is not authorized to access the Live Moment Admin Console."}
            </p>
          </div>
          {user?.email && (
            <p className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              Signed in as {user.email}
            </p>
          )}
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
