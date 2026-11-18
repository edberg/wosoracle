import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { withMcpAuth } from "mcp-handler";
import { MCP_RESOURCE, MCP_SCOPE, verifyAccessToken } from "../../lib/oauth";

const id = z.string().regex(/^\d+$/).describe("Chief ID, digits only");
const integer = z.number().int().nonnegative();
const sid = integer.describe("State ID");
const cached = z.boolean().optional().describe("Use stored data; still counts against the API quota");
const image = z.string().regex(/^[a-zA-Z0-9_-]+\.png$/).describe("PNG filename returned by the API");
const specs = [
  ["player", "Player profile", "/players/{id}", {id, cached}],
  ["player_standings", "Player standings (Premium)", "/players/{id}/standings", {id, cached}],
  ["player_chief_gear", "Player hero roster and gear (Premium)", "/players/{id}/chief-gear", {id}],
  ["alliance", "Alliance profile and roster", "/alliances/{aid}", {aid: integer, kid: sid.optional()}],
  ["state", "State summary", "/states/{sid}", {sid}],
  ["state_leaderboard", "State ranking board (Premium); types 3, 4, 20–26", "/states/{sid}/leaderboards/{type}", {sid, type: z.union([z.literal(3),z.literal(4),z.literal(20),z.literal(21),z.literal(22),z.literal(23),z.literal(24),z.literal(25),z.literal(26)]), cached}],
  ["player_prep", "Player prep rating and history (Premium)", "/players/{id}/prep", {id, season: integer.optional()}],
  ["player_events", "Player event scores (Premium)", "/players/{id}/events", {id, kid: sid.optional(), event_id: integer.optional(), start: integer.optional(), limit: integer.min(1).max(200).optional(), offset: integer.optional()}],
  ["state_svs_prep", "State seasonal prep race (Premium)", "/states/{sid}/svs/prep", {sid, season: integer.optional(), board: integer.max(5).optional()}],
  ["state_calendar", "State event calendar", "/states/{sid}/calendar", {sid, from: integer.optional(), cached}],
  ["state_events", "State special event leaderboards", "/states/{sid}/events", {sid}],
  ["state_event", "Snapshots for a special event", "/states/{sid}/events/{event_id}", {sid, event_id: integer, start: integer.optional()}],
  ["state_svs", "State SvS record", "/states/{sid}/svs", {sid}],
  ["transfer_groups", "Transfer event groups", "/transfers/groups", {event: integer.optional()}],
  ["svs_matchups", "SvS matchups", "/svs/matchups", {season: integer.optional(), kid: sid.optional()}],
  ["svs_forecast", "Forecast possible SvS opponents", "/states/{sid}/svs/forecast", {sid, members: z.boolean().optional()}],
  ["island", "Player island details", "/players/{id}/island", {id}],
  ["island_likes", "Player island likes", "/players/{id}/island/likes", {id}],
  ["island_stats", "Player island stats", "/players/{id}/island/stats", {id}],
  ["island_render", "Island render status", "/players/{id}/island/render", {id}],
  ["request_island_render", "Request an island render (Premium)", "/players/{id}/island/render", {id, refresh: z.boolean().optional()}, "POST"],
  ["island_image", "Fetch a finished island PNG", "/players/{id}/island/{image}", {id, image}],
  ["island_card", "Island card status", "/players/{id}/island/card", {id, key: z.string().optional()}],
  ["request_island_card", "Request an island card; consumes card quota", "/players/{id}/island/card", {id}, "POST"],
  ["island_card_image", "Fetch a finished island card PNG", "/players/{id}/island/card/{image}", {id, image}],
  ["islands_leaderboard", "Observed islands ranked by likes or prosperity", "/islands/leaderboard", {by: z.enum(["likes","prosperity"]).optional(), kid: sid.optional(), limit: integer.min(1).max(500).optional()}],
  ["battle_sim_catalog", "Battle simulator catalog (Premium)", "/battle-sim/catalog", {}],
  ["battle_simulate", "Simulate a battle (Premium); read catalog first", "/battle-sim/simulate", {report: z.string().optional(), battle: z.union([z.string(),integer]).optional(), runs: integer.min(1).max(1000).optional(), rally: z.boolean().optional(), include: z.array(z.enum(["rows","run_list","request"])).optional(), attacker: z.record(z.string(), z.unknown()).optional(), defender: z.record(z.string(), z.unknown()).optional()}, "POST"],
] as const;

const handler = createMcpHandler((server) => {
  for (const [name, description, template, shape, method = "GET"] of specs) {
    server.registerTool(name, {description, inputSchema: z.object(shape)}, async (input) => {
      const token = process.env.API_TOKEN;
      if (!token) return {isError:true, content:[{type:"text", text:"Server API_TOKEN is not configured."}]};
      let path: string = template;
      const remaining = {...input};
      path = path.replace(/\{(\w+)\}/g, (_, key: string) => { const value = remaining[key]; delete remaining[key]; return encodeURIComponent(String(value)); });
      const url = new URL(`https://wosoracle.com/api/v1${path}`);
      if (method === "GET") for (const [key, value] of Object.entries(remaining)) if (value !== undefined && value !== false) url.searchParams.set(key, value === true ? "1" : String(value));
      try {
        const response = await fetch(url, {method, headers:{Authorization:`Bearer ${token}`, "User-Agent":"wosoracle-mcp/1.0", ...(method === "POST" ? {"Content-Type":"application/json"} : {})}, ...(method === "POST" ? {body:JSON.stringify(remaining)} : {}), signal:AbortSignal.timeout(25000)});
        if (!response.ok) {
          const retry = response.headers.get("retry-after");
          const detail = (await response.text()).slice(0, 2000);
          return {isError:true, content:[{type:"text", text:`WoS Oracle returned HTTP ${response.status}${retry ? `; Retry-After: ${retry} seconds` : ""}. ${response.status === 402 && detail.includes("premium_required") ? "This operation requires Oracle+ Premium. " : ""}${detail}`}]};
        }
        if (response.headers.get("content-type")?.startsWith("image/png")) return {content:[{type:"image", mimeType:"image/png", data:Buffer.from(await response.arrayBuffer()).toString("base64")}]};
        return {content:[{type:"text", text:await response.text()}]};
      } catch { return {isError:true, content:[{type:"text", text:"WoS Oracle request failed or timed out."}]}; }
    });
  }
});

const endpoint = withMcpAuth(async (request) => handler(request), async (_request, bearerToken) => {
  if (!bearerToken) return undefined;
  try {
    const { payload } = await verifyAccessToken(bearerToken);
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return undefined;
    const scopes = typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
    return { token: bearerToken, clientId: payload.sub, scopes, expiresAt: payload.exp };
  } catch {
    return undefined;
  }
}, { required: true, requiredScopes: [MCP_SCOPE], resourceUrl: MCP_RESOURCE });
export {endpoint as GET, endpoint as POST, endpoint as DELETE};


