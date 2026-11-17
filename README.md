# WoS Oracle MCP server

A stateless Streamable HTTP MCP server for the WoS Oracle v1 API, designed for Vercel. It exposes the documented Plus and Premium routes as tools, including PNG images. Premium tools require a Premium upstream subscription.

## Setup

1. Install Node.js 20 or newer and run `npm install`.
2. Set `API_TOKEN` to your WoS Oracle API token and `MCP_ACCESS_TOKEN` to a separate, long random secret. Set both as sensitive Vercel environment variables; never commit them.
3. Run `npm run dev`, or import this repository as a Vercel project and deploy it.
4. Connect an MCP client to `https://<your-domain>/api/mcp`, sending `Authorization: Bearer <MCP_ACCESS_TOKEN>` as an HTTP header. Locally use `http://localhost:3000/api/mcp`.

Anyone with the MCP access token can use the configured WoS Oracle account and its quota, including operations that request renders or cards. Keep the endpoint secret and rotate the access token if exposed. This simple bearer-token access control does not provide OAuth or per-user accounts; clients must support custom headers.

Every upstream request counts toward the account's daily quota. Reuse results and avoid polling; the server does not coordinate rate limits or cache across Vercel instances. On HTTP 429, it reports `Retry-After` so clients can wait before retrying. It never automatically retries, including 401, 402 and 404. Card and render status responses may include their own retry intervals. The `cached` options request stored upstream data but still consume quota.

`API_TOKEN` is used only on the server and is never passed as a tool argument or placed in a URL. Do not use the same value for both secrets. The MCP server does not log upstream requests or credentials.
