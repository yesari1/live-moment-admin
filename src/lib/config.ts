export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AdminRuntimeConfig {
  firebase: FirebaseWebConfig;
  backendBaseUrl: string;
  adminEmails: string[];
  forceDemoData: boolean;
}

declare global {
  interface Window {
    LIVE_MOMENT_ADMIN_CONFIG?: Partial<AdminRuntimeConfig>;
  }
}

const FALLBACK: AdminRuntimeConfig = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  backendBaseUrl: "",
  adminEmails: [],
  forceDemoData: false,
};

function readConfig(): AdminRuntimeConfig {
  const raw = (typeof window !== "undefined" && window.LIVE_MOMENT_ADMIN_CONFIG) || {};
  return {
    firebase: { ...FALLBACK.firebase, ...(raw.firebase ?? {}) },
    backendBaseUrl: raw.backendBaseUrl ?? FALLBACK.backendBaseUrl,
    adminEmails: (raw.adminEmails ?? []).map((e) => e.toLowerCase()),
    forceDemoData: raw.forceDemoData ?? false,
  };
}

export const runtimeConfig: AdminRuntimeConfig = readConfig();

export const isFirebaseConfigured = Boolean(
  runtimeConfig.firebase.apiKey &&
    runtimeConfig.firebase.projectId &&
    runtimeConfig.firebase.authDomain,
);

export const hasWebAppId = Boolean(runtimeConfig.firebase.appId);

/**
 * True when the panel should render representative demo data instead of live data.
 * Live data requires a fully registered Firebase Web App (appId) plus deployed
 * admin security rules. Set `forceDemoData: true` in config.js to pin demo mode.
 */
export const useDemoData =
  runtimeConfig.forceDemoData || !isFirebaseConfigured || !hasWebAppId;

export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  if (runtimeConfig.adminEmails.length === 0) return false;
  return runtimeConfig.adminEmails.includes(email.toLowerCase());
};
