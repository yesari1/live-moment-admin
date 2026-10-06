# Admin Panel Brief: Password Login Accounts

Some accounts (Google Play review account `livemoment.review@gmail.com`) sign in with a password instead of the email link. The app asks `POST /v1/auth/sign-in-method` and shows a password field only for flagged accounts. Passwords are stored only in Firebase Auth, never in Firestore.

## Endpoints (admin only)

Auth: `Authorization: Bearer <Firebase ID token>` + `X-Firebase-AppCheck`, like the other `/v1/admin/*` calls. The caller must be in `ADMIN_EMAILS` or have the `admin: true` claim, otherwise 403.

### GET /v1/admin/password-login
Response 200:
```json
{ "accounts": [ { "uid": "...", "email": "x@y.com", "passwordLogin": true, "updatedAt": "2026-10-06T10:00:00.000Z" } ] }
```
Lists every account whose `passwordLogin` flag was ever set (true or false), newest change first.

### POST /v1/admin/password-login
Body: `{ "email": "x@y.com", "enabled": true, "password": "min 8 chars" }`
- `enabled: true` requires `password` (8-128 chars). Sets the Firebase Auth password on the EXISTING user (same uid; Google sign-in and data stay) and `users/{uid}.passwordLogin = true`.
- `enabled: false` only clears the flag (no password needed).

Response 200: `{ "uid", "email", "passwordLogin" }`. Errors: 400 invalid body or `PASSWORD_TOO_SHORT`, 404 `USER_NOT_FOUND` (the person must have signed in once so the account exists).
The password is never logged or returned.

## UI suggestion
Page "Password Login": table (Email, Uid, Status chip "Enabled" / "Disabled", Updated). Row actions: "Set Password" (password input with show/hide, min 8 chars, button "Save Password") and a toggle "Enable" / "Disable". Top form "Add Account" (email + password). Clear the password field after saving, show a success toast, never echo the password. Title Case for all labels.
