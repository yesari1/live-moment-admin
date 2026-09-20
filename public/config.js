/**
 * Live Moment Admin — runtime configuration.
 *
 * This file is served as-is (it is NOT bundled by Vite), so the same build can be
 * deployed to any environment by editing this file after deployment.
 *
 * These Firebase Web SDK values are PUBLIC by design. They are not secrets.
 * Never put service-account credentials, private API keys or AI provider secrets here.
 *
 * Register a Web App for the existing Firebase project (Project settings -> Your apps
 * -> Add app -> Web) and paste the generated values below, especially `appId` and
 * `authDomain`. Until then the panel runs in read-only demo mode so the UI stays usable.
 */
window.LIVE_MOMENT_ADMIN_CONFIG = Object.freeze({
  firebase: {
    apiKey: "AIzaSyCZlaQ0TEJ8a4iOFNZgrf_ZKpuDQYY0dZk",
    authDomain: "living-memories-staging.firebaseapp.com",
    projectId: "living-memories-staging",
    storageBucket: "living-memories-staging.firebasestorage.app",
    messagingSenderId: "657614948972",
    // Required for a fully working Firebase Auth web session. Replace after
    // registering the Web App. Example:
    // "1:657614948972:web:xxxxxxxxxxxxxxxxxxxxxx"
    appId: "1:657614948972:web:01bba8f1801c1106722649",
  },

  // Trusted backend (Express API on Cloud Run) used for privileged operations.
  backendBaseUrl: "https://living-memories-api-okmceddtoa-uc.a.run.app",

  // Admin authorization. Prefer the `admin: true` custom claim (see
  // admin/tools/set-admin-claim.mjs) and leave this list EMPTY: this file is
  // PUBLIC, so any address listed here is visible to everyone at /admin/config.js.
  // Only use this list if you accept that the addresses are public.
  adminEmails: [],

  // Set to true to always render representative demo data (useful for design review).
  forceDemoData: false,
});
