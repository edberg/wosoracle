import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const MCP_SCOPE = "mcp:use";
export const MCP_PUBLIC_URL = (process.env.MCP_PUBLIC_URL || "https://wosoracle-mcp.vercel.app").replace(/\/$/, "");
export const MCP_RESOURCE = MCP_PUBLIC_URL;
export const MCP_AUTHORIZATION_SERVER = MCP_PUBLIC_URL;

function secret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return new TextEncoder().encode(value);
}

export function authServerMetadata() {
  return {
    issuer: MCP_AUTHORIZATION_SERVER,
    authorization_endpoint: `${MCP_PUBLIC_URL}/oauth/authorize`,
    token_endpoint: `${MCP_PUBLIC_URL}/oauth/token`,
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [MCP_SCOPE],
  };
}

export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE,
    authorization_servers: [MCP_AUTHORIZATION_SERVER],
    scopes_supported: [MCP_SCOPE],
  };
}

export function allowedRedirectUri(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.origin === "https://chatgpt.com" ||
      url.origin === "https://chat.openai.com"
    );
  } catch {
    return false;
  }
}

export function randomVerifier() {
  return randomBytes(32).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function signOAuthState(input: {
  redirectUri: string;
  state: string;
  resource?: string;
  codeChallenge: string;
}) {
  return new SignJWT(input)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(MCP_AUTHORIZATION_SERVER)
    .setAudience("oauth-state")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret("MCP_AUTH_CODE_SECRET"));
}

export async function verifyOAuthState(token: string) {
  const { payload } = await jwtVerify(token, secret("MCP_AUTH_CODE_SECRET"), {
    issuer: MCP_AUTHORIZATION_SERVER,
    audience: "oauth-state",
  });
  if (
    typeof payload.redirectUri !== "string" ||
    typeof payload.state !== "string" ||
    typeof payload.codeChallenge !== "string" ||
    !allowedRedirectUri(payload.redirectUri)
  ) throw new Error("Invalid OAuth state");
  return payload as {
    redirectUri: string;
    state: string;
    resource?: string;
    codeChallenge: string;
  };
}

export async function issueAccessToken(subject: string, login?: string) {
  return new SignJWT({ scope: MCP_SCOPE, ...(login ? { github_login: login } : {}) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(MCP_AUTHORIZATION_SERVER)
    .setAudience(MCP_RESOURCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret("MCP_JWT_SECRET"));
}

export async function verifyAccessToken(token: string) {
  return jwtVerify(token, secret("MCP_JWT_SECRET"), {
    issuer: MCP_AUTHORIZATION_SERVER,
    audience: MCP_RESOURCE,
  });
}
