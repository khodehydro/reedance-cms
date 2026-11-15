import { createD1Store } from "../lib/store-d1.js";
import { handleAdminRequest } from "../lib/admin-api.js";
import { catalogConfig } from "../lib/config.js";
import { jsonError } from "../lib/errors.js";

export default {
  async fetch(request, env, ctx) {
    const config = catalogConfig(env);
    if (!config.isDev && env.ALLOW_LOCAL_ADMIN === "true") {
      return jsonError(403, "access_denied", "Local admin bypass is forbidden in production");
    }
    const store = createD1Store(env.DB);
    return handleAdminRequest(request, { store, env, ctx });
  },
};
