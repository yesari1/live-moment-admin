/*
 * set-admin-claim.mjs
 * ---------------------------------------------------------------------------
 * Grants (or removes) the Firebase Authentication custom claim `admin: true`
 * for an admin account, using the Firebase Admin SDK.
 *
 * The Admin SDK is NOT part of the web panel and never runs in the browser.
 * It runs here, locally, with a service-account key.
 *
 * Usage (from the admin/tools folder):
 *
 *   1) Install dependencies once:
 *        npm install
 *
 *   2) Download a service-account key:
 *        Firebase Console -> Project settings -> Service accounts
 *        -> "Generate new private key"  (save as service-account.json)
 *
 *   3) Grant admin to an email:
 *        node set-admin-claim.mjs admin@yesastudio.com --key ./service-account.json
 *
 *      Grant admin by UID instead:
 *        node set-admin-claim.mjs --uid <UID> --key ./service-account.json
 *
 *      Remove admin:
 *        node set-admin-claim.mjs admin@yesastudio.com --key ./service-account.json --remove
 *
 *   Alternatively, set GOOGLE_APPLICATION_CREDENTIALS to the key path and omit --key.
 *
 * The user must sign out and back in afterwards (or refresh) so the new claim
 * appears in their ID token.
 */

import { readFileSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function parseArgs(argv) {
  const options = { email: null, uid: null, key: null, remove: false, project: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--key") options.key = argv[++i];
    else if (arg === "--uid") options.uid = argv[++i];
    else if (arg === "--email") options.email = argv[++i];
    else if (arg === "--project") options.project = argv[++i];
    else if (arg === "--remove") options.remove = true;
    else if (!arg.startsWith("--") && !options.email) options.email = arg;
  }
  return options;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));

if (!options.email && !options.uid) {
  console.error(
    "\nUsage: node set-admin-claim.mjs <email> [--key ./service-account.json] [--remove]\n" +
      "   or: node set-admin-claim.mjs --uid <UID> [--key ./service-account.json] [--remove]\n",
  );
  process.exit(1);
}

const keyPath = options.key ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;

let credential;
if (keyPath) {
  let json;
  try {
    json = JSON.parse(readFileSync(keyPath, "utf8"));
  } catch (error) {
    fail(`Could not read service-account key at "${keyPath}": ${error.message}`);
  }
  credential = cert(json);
} else {
  credential = applicationDefault();
}

initializeApp({
  credential,
  ...(options.project ? { projectId: options.project } : {}),
});

const auth = getAuth();

async function main() {
  let user;
  try {
    user = options.uid
      ? await auth.getUser(options.uid)
      : await auth.getUserByEmail(options.email);
  } catch (error) {
    fail(
      `User not found (${options.email ?? options.uid}). ` +
        "Create the account first under Firebase Console -> Authentication -> Users. " +
        `(${error.message})`,
    );
  }

  const existing = user.customClaims ?? {};
  const claims = { ...existing };
  if (options.remove) delete claims.admin;
  else claims.admin = true;

  await auth.setCustomUserClaims(user.uid, claims);

  console.log(
    `\n✔ ${options.remove ? "Removed" : "Granted"} admin claim for ${user.email ?? user.uid}`,
  );
  console.log(`  UID: ${user.uid}`);
  console.log(`  Claims: ${JSON.stringify(claims)}`);
  console.log(
    "\nNext: sign out and back in (or refresh) in the admin panel so the new token is used.\n",
  );
}

main().catch((error) => fail(error.message));
