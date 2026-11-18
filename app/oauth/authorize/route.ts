import { NextRequest, NextResponse } from "next/server";
import { allowedRedirectUri, MCP_PUBLIC_URL, MCP_RESOURCE, signOAuthState } from "../../lib/oauth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const resource = params.get("resource") || MCP_RESOURCE;
  const githubClientId = process.env.GITHUB_CLIENT_ID;

  if (!redirectUri || !allowedRedirectUri(redirectUri) || !state || !codeChallenge || codeChallengeMethod !== "S256") {
    return new Response("Invalid OAuth request", { status: 400 });
  }
  if (resource !== MCP_RESOURCE || !githubClientId) return new Response("OAuth is not configured", { status: 503 });

  const brokerState = await signOAuthState({ redirectUri, state, resource, codeChallenge });
  const github = new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id", githubClientId);
  github.searchParams.set("redirect_uri", `${MCP_PUBLIC_URL}/oauth/callback`);
  github.searchParams.set("scope", "read:user user:email");
  github.searchParams.set("state", brokerState);
  github.searchParams.set("code_challenge", codeChallenge);
  github.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(github);
}
