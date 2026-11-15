import { createD1Store } from "../lib/store-d1.js";
import { handlePublicRequest } from "../lib/public-api.js";

export default {
  async fetch(request, env, ctx) {
    const store = createD1Store(env.DB);
    const cache = caches?.default;
    return handlePublicRequest(request, { store, ctx, cache, env });
  },
};
