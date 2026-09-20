import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FlaskConical, Loader2, Lock, ShieldCheck, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { isFirebaseConfigured } from "@/lib/config";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn, signInWithGoogle, demoMode } = useAuth();
  const [pending, setPending] = React.useState<"password" | "google" | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setPending("password");
    try {
      await signIn(values.email, values.password);
      toast.success("Signed in.");
    } catch (error) {
      toast.error("Sign-in failed", {
        description:
          error instanceof Error
            ? error.message
            : "Check your credentials and try again.",
      });
    } finally {
      setPending(null);
    }
  };

  const onGoogle = async () => {
    setPending("google");
    try {
      await signInWithGoogle();
      toast.success("Signed in.");
    } catch (error) {
      toast.error("Google sign-in failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Waves className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">
              Live Moment Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              Internal operations console. Authorized administrators only.
            </p>
          </div>
        </div>

        {demoMode && (
          <Alert variant="warning">
            <FlaskConical className="h-4 w-4" />
            <AlertTitle>Demo mode</AlertTitle>
            <AlertDescription>
              Firebase Web config isn&apos;t complete, so the panel is showing
              representative demo data. Sign in with any email and a 6+ character
              password to explore the UI.
            </AlertDescription>
          </Alert>
        )}

        {!demoMode && !isFirebaseConfigured && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Firebase not configured</AlertTitle>
            <AlertDescription>
              Add your Firebase Web App values to <code>config.js</code>.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-5">
            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="admin@yesastudio.com"
                          disabled={pending !== null}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          disabled={pending !== null}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending !== null}
                >
                  {pending === "password" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Sign in
                </Button>
              </form>
            </Form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => void onGoogle()}
              disabled={pending !== null}
            >
              {pending === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
                  />
                </svg>
              )}
              Continue with Google
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Access is enforced by Firebase Authentication, Firestore security rules
          and backend authorization.
        </p>
      </div>
    </div>
  );
}
