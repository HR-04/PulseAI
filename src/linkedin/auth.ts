// One-time LinkedIn OAuth (3-legged). Prints an authorization URL; you approve
// in the browser; a local server catches the redirect, exchanges the code for an
// access token, fetches your member URN, and saves both to .env.
//   npm run linkedin:auth
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { config } from "../config";

const SCOPES = config.linkedin.scopes;

function authUrl(state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: config.linkedin.clientId,
    redirect_uri: config.linkedin.redirectUri,
    state,
    scope: SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p.toString()}`;
}

async function exchangeCode(code: string): Promise<string> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.linkedin.redirectUri,
      client_id: config.linkedin.clientId,
      client_secret: config.linkedin.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("no access_token in token response");
  return j.access_token;
}

async function memberUrn(token: string): Promise<string> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { sub?: string };
  if (!j.sub) throw new Error("no 'sub' in userinfo response");
  return `urn:li:person:${j.sub}`;
}

async function updateEnv(updates: Record<string, string>): Promise<void> {
  let env = await readFile(".env", "utf8");
  for (const [k, v] of Object.entries(updates)) {
    const line = `${k}="${v}"`;
    const re = new RegExp(`^${k}=.*$`, "m");
    env = re.test(env) ? env.replace(re, line) : `${env}\n${line}`;
  }
  await writeFile(".env", env, "utf8");
}

async function main(): Promise<void> {
  const { clientId, clientSecret, redirectUri } = config.linkedin;
  if (!clientId || !clientSecret) {
    console.error("Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env first.");
    process.exit(1);
  }
  const url = new URL(redirectUri);
  const port = Number(url.port || 80);
  const state = randomBytes(8).toString("hex");

  await new Promise<void>((resolve) => {
    const server = createServer(async (req, res) => {
      const reqUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (reqUrl.pathname !== url.pathname) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const code = reqUrl.searchParams.get("code");
      const gotState = reqUrl.searchParams.get("state");
      if (!code || gotState !== state) {
        res.writeHead(400);
        res.end("Auth failed (missing code or state mismatch). Check the terminal.");
        console.error("✗ authorization failed:", reqUrl.searchParams.get("error_description") ?? "no code / bad state");
        server.close();
        resolve();
        return;
      }
      try {
        const token = await exchangeCode(code);
        const urn = await memberUrn(token);
        await updateEnv({ LINKEDIN_ACCESS_TOKEN: token, LINKEDIN_AUTHOR_URN: urn });
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>&#10003; LinkedIn connected.</h2><p>You can close this tab and return to the terminal.</p>");
        console.log("\n✅ LinkedIn connected — access token + author URN saved to .env.");
        console.log("   author:", urn);
        console.log('   now run:  npm run linkedin:post -- "output/drafts/<base>-linkedin.txt"');
      } catch (e) {
        res.writeHead(500);
        res.end("Error — check the terminal.");
        console.error("✗", (e as Error).message);
      }
      server.close();
      resolve();
    });
    server.listen(port, () => {
      console.log("\n1) Open this URL in a browser signed in as the LinkedIn account to post as:\n");
      console.log("   " + authUrl(state) + "\n");
      console.log("2) Approve — you'll be redirected back and the token will be saved.\n");
      console.log(`(listening on ${redirectUri} …)`);
    });
  });
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
