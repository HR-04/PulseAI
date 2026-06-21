// Post text to LinkedIn as the authorized member (UGC Posts API). Requires
// LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN in .env (set by linkedin:auth).
import { config } from "../config";

export async function postToLinkedIn(text: string): Promise<string> {
  const { accessToken, authorUrn } = config.linkedin;
  if (!accessToken || !authorUrn) {
    throw new Error("LinkedIn not connected. Run `npm run linkedin:auth` first.");
  }

  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  const txt = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error("LinkedIn token expired/invalid — re-run `npm run linkedin:auth`.");
    throw new Error(`LinkedIn post failed: ${res.status} ${txt}`);
  }
  try {
    return (JSON.parse(txt) as { id?: string }).id ?? "(posted)";
  } catch {
    return "(posted)";
  }
}
