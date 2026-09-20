import * as React from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { isAdminEmail, useDemoData } from "@/lib/config";

export interface AdminSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
}

export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "unauthorized";

interface AuthContextValue {
  status: AuthStatus;
  user: AdminSession | null;
  isAdmin: boolean;
  demoMode: boolean;
  /** Reason the current user was denied, when status === "unauthorized". */
  denialReason: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const DEMO_SESSION: AdminSession = {
  uid: "demo_admin_uid",
  email: "admin@yesastudio.com",
  displayName: "Demo Administrator",
  photoUrl: null,
};

async function resolveAdmin(user: User): Promise<{
  isAdmin: boolean;
  reason: string | null;
}> {
  // 1) Preferred: a Firebase Authentication custom claim `admin: true`.
  try {
    const token = await user.getIdTokenResult(true);
    if (token.claims.admin === true) return { isAdmin: true, reason: null };
  } catch {
    // Fall through to the email allow-list.
  }

  // 2) Fallback: the email allow-list configured in config.js (adminEmails).
  if (isAdminEmail(user.email)) return { isAdmin: true, reason: null };

  return {
    isAdmin: false,
    reason:
      "This account is not authorized for the Live Moment Admin Console. " +
      "Grant the `admin: true` custom claim, or add this email to adminEmails in config.js.",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const demoMode = useDemoData;
  const [status, setStatus] = React.useState<AuthStatus>(
    demoMode ? "unauthenticated" : "loading",
  );
  const [user, setUser] = React.useState<AdminSession | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [denialReason, setDenialReason] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (demoMode) return;
    const auth = getFirebaseAuth();
    if (!auth) {
      setStatus("unauthenticated");
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsAdmin(false);
        setDenialReason(null);
        setStatus("unauthenticated");
        return;
      }
      const session: AdminSession = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoUrl: firebaseUser.photoURL,
      };
      const { isAdmin: allowed, reason } = await resolveAdmin(firebaseUser);
      setUser(session);
      setIsAdmin(allowed);
      setDenialReason(reason);
      setStatus(allowed ? "authenticated" : "unauthorized");
    });
    return unsubscribe;
  }, [demoMode]);

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      if (demoMode) {
        setUser({ ...DEMO_SESSION, email });
        setIsAdmin(true);
        setStatus("authenticated");
        return;
      }
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error(
          "Firebase Authentication is not configured. Add the Web App config to config.js.",
        );
      }
      await signInWithEmailAndPassword(auth, email, password);
    },
    [demoMode],
  );

  const signInWithGoogle = React.useCallback(async () => {
    if (demoMode) {
      setUser(DEMO_SESSION);
      setIsAdmin(true);
      setStatus("authenticated");
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error(
        "Firebase Authentication is not configured. Add the Web App config to config.js.",
      );
    }
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, [demoMode]);

  const signOut = React.useCallback(async () => {
    if (demoMode) {
      setUser(null);
      setIsAdmin(false);
      setStatus("unauthenticated");
      return;
    }
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
  }, [demoMode]);

  const getIdToken = React.useCallback(async () => {
    if (demoMode) return null;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, [demoMode]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAdmin,
      demoMode,
      denialReason,
      signIn,
      signInWithGoogle,
      signOut,
      getIdToken,
    }),
    [
      status,
      user,
      isAdmin,
      demoMode,
      denialReason,
      signIn,
      signInWithGoogle,
      signOut,
      getIdToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
