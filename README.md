# WoS Oracle MCP server

A stateless Streamable HTTP MCP server for the WoS Oracle v1 API, designed for Vercel. It exposes the documented Plus and Premium routes as tools, including PNG images. Premium tools require a Premium upstream subscription.

## Setup

1. Install Node.js 20 or newer and run `npm install`.
2. Create a GitHub OAuth App. Set its callback URL to `https://wosoracle-mcp.vercel.app/oauth/callback` and request the `read:user` and `user:email` scopes.
3. Set these sensitive Vercel environment variables; never commit them:
   - `API_TOKEN`: your WoS Oracle API token.
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: the GitHub OAuth App credentials.
   - `MCP_JWT_SECRET` and `MCP_AUTH_CODE_SECRET`: separate random secrets, each at least 32 bytes.
   - `MCP_PUBLIC_URL`: the canonical MCP origin, normally `https://wosoracle-mcp.vercel.app`.
4. Run `npm run dev`, or import this repository as a Vercel project and deploy it. Disable Vercel Deployment Protection on the public deployment so ChatGPT can reach the OAuth metadata and MCP endpoints.
5. Connect an MCP client to `https://<your-domain>/api/mcp` and select OAuth when prompted. Locally use `http://localhost:3000/api/mcp` with a local GitHub callback URL.

GitHub authenticates the user, and this server then issues a short-lived MCP access token with the MCP resource as its audience. The server currently uses one configured WoS Oracle API token, so all authenticated users share that upstream account and quota.

Every upstream request counts toward the account's daily quota. Reuse results and avoid polling; the server does not coordinate rate limits or cache across Vercel instances. On HTTP 429, it reports `Retry-After` so clients can wait before retrying. It never automatically retries, including 401, 402 and 404. Card and render status responses may include their own retry intervals. The `cached` options request stored upstream data but still consume quota.

`API_TOKEN` is used only on the server and is never passed as a tool argument or placed in a URL. Do not use the same value for both secrets. The MCP server does not log upstream requests or credentials.
