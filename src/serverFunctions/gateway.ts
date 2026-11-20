import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  ConfigurationError,
  getEveryAppUser,
  gatewayUrl,
  isAdmin,
} from "@every-app/sdk/server";

/**
 * The Gateway's origin (the way back to the other apps, and the host the
 * light/dark cookie is set on) and whether the person is an admin. Both null
 * on a view link opened by someone not signed in.
 */
export const getShell = createServerFn().handler(async () => {
  const user = await getEveryAppUser(getRequest(), env);
  if (!user) return { gatewayUrl: null, isAdmin: false };
  try {
    return {
      gatewayUrl: new URL(gatewayUrl(env)).origin,
      isAdmin: isAdmin(user),
    };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return { gatewayUrl: null, isAdmin: isAdmin(user) };
  }
});
