import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { purgeTrash } from "./server/items";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401).
export default {
  ...everyApp<Env>(async (request) => tanstackEntry.fetch(request)),
  // The daily cron (cloudflare.config.ts): empties 30-day-old trash.
  async scheduled(
    _event: ScheduledController,
    _env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(purgeTrash());
  },
};
