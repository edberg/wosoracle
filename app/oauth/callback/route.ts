import { NextRequest, NextResponse } from "next/server";
import { MCP_PUBLIC_URL, verifyOAuthState } from "../../lib/oauth";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  if (!state) return new Response("Missing OAuth state", { status: 400 });
  try {
    const oauthState = await verifyOAuthState(state);
    const redirect = new URL(oauthState.redirectUri);
    const error = request.nextUrl.searchParams.get("error");
    if (error) {
      redirect.searchParams.set("error", error);
      const description = request.nextUrl.searchParams.get("error_description");
      if (description) redirect.searchParams.set("error_description", description);
    } else {
      const code = request.nextUrl.searchParams.get("code");
      if (!code) return new Response("Missing GitHub code", { status: 400 });
      redirect.searchParams.set("code", code);
    }
    redirect.searchParams.set("state", oauthState.state);
    redirect.searchParams.set("iss", MCP_PUBLIC_URL);
    return NextResponse.redirect(redirect);
  } catch {
    return new Response("Invalid OAuth state", { status: 400 });
  }
}
