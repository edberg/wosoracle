import { NextRequest } from "next/server";
import { issueAccessToken, MCP_PUBLIC_URL, MCP_RESOURCE } from "../../lib/oauth";

export async function POST(request: NextRequest) {
  const body = await request.formData();
  const grantType = body.get("grant_type");
  const code = body.get("code");
  const verifier = body.get("code_verifier");
  const resource = String(body.get("resource") || MCP_RESOURCE);
  if (grantType !== "authorization_code" || typeof code !== "string" || typeof verifier !== "string" || resource !== MCP_RESOURCE) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const githubResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${MCP_PUBLIC_URL}/oauth/callback`,
      code_verifier: verifier,
    }),
  });
  if (!githubResponse.ok) return Response.json({ error: "invalid_grant" }, { status: 400 });
  const githubToken = await githubResponse.json() as { access_token?: string };
  if (!githubToken.access_token) return Response.json({ error: "invalid_grant" }, { status: 400 });

  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${githubToken.access_token}`, "User-Agent": "wosoracle-mcp" },
  });
  if (!userResponse.ok) return Response.json({ error: "invalid_grant" }, { status: 400 });
  const user = await userResponse.json() as { id?: number; login?: string };
  if (typeof user.id !== "number") return Response.json({ error: "invalid_grant" }, { status: 400 });

  const accessToken = await issueAccessToken(`github:${user.id}`, user.login);
  return Response.json({ access_token: accessToken, token_type: "Bearer", expires_in: 3600, scope: "mcp:use" });
}
