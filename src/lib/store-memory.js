import { CasConflictError, HttpError } from "./errors.js";

function clone(value) {
  return structuredClone(value);
}

export function createMemoryStore() {
  const state = {
    languages: new Map(),
    songs: new Map(),
    draftRevision: 0,
    publishedRevision: 0,
    snapshots: new Map(),
    identities: new Map(),
    audit: [],
    failReads: 0,
  };

  function touch() {
    if (state.failReads > 0) {
      state.failReads -= 1;
      throw new Error("D1 unavailable");
    }
  }

  return {
    failNextReads(n = 1) {
      state.failReads = n;
    },
    async getState() {
      touch();
      return { draft_revision: state.draftRevision, published_revision: state.publishedRevision };
    },
    async listLanguages() {
      touch();
      return [...state.languages.values()].sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
    },
    async getLanguage(code) {
      touch();
      return state.languages.get(code) || null;
    },
    async upsertLanguage(row) {
      state.languages.set(row.code, { ...row });
      state.draftRevision += 1;
      return { draft_revision: state.draftRevision };
    },
    async deleteLanguage(code) {
      if (state.identities.has(`language:${code}`)) {
        throw new HttpError(409, "immutable", "Published language cannot be deleted; deactivate it instead");
      }
      if ([...state.songs.values()].some((song) => song.language_code === code)) {
        throw new HttpError(409, "has_songs", "Delete songs first");
      }
      if (!state.languages.delete(code)) throw new HttpError(404, "not_found", "Language not found");
      state.draftRevision += 1;
      return { draft_revision: state.draftRevision };
    },
    async listSongs() {
      touch();
      return [...state.songs.values()].sort((a, b) => a.sort_order - b.sort_order || a.song_id.localeCompare(b.song_id));
    },
    async getSong(id) {
      touch();
      return state.songs.get(id) || null;
    },
    async upsertSong(row) {
      if (!state.languages.has(row.language_code)) {
        throw new HttpError(400, "missing_language", "targetLanguage does not exist");
      }
      const existing = [...state.songs.values()].find((song) => song.manifest_url === row.manifest_url && song.song_id !== row.song_id);
      if (existing) throw new HttpError(409, "duplicate_url", "manifestUrl must be unique");
      state.songs.set(row.song_id, { ...row });
      state.draftRevision += 1;
      return { draft_revision: state.draftRevision };
    },
    async deleteSong(id) {
      if (state.identities.has(`song:${id}`)) {
        throw new HttpError(409, "immutable", "Published song cannot be deleted; hide it instead");
      }
      if (!state.songs.delete(id)) throw new HttpError(404, "not_found", "Song not found");
      state.draftRevision += 1;
      return { draft_revision: state.draftRevision };
    },
    async getSnapshot(scope) {
      touch();
      return state.snapshots.get(scope) || null;
    },
    async listSnapshots() {
      touch();
      return [...state.snapshots.values()];
    },
    async getIdentity(kind, id) {
      return state.identities.get(`${kind}:${id}`) || null;
    },
    async listIdentities() {
      return [...state.identities.values()];
    },
    async logAudit(action, detail) {
      state.audit.push({ at: new Date().toISOString(), action, detail });
    },
    async publishAtomic({ expectedDraft, expectedPublished, nextRevision, snapshots, deleteScopes, identities }) {
      if (state.draftRevision !== expectedDraft || state.publishedRevision !== expectedPublished) {
        throw new CasConflictError();
      }
      const previous = {
        publishedRevision: state.publishedRevision,
        snapshots: clone(state.snapshots),
        identities: clone(state.identities),
      };
      try {
        state.publishedRevision = nextRevision;
        for (const snapshot of snapshots) state.snapshots.set(snapshot.scope, snapshot);
        for (const scope of deleteScopes) state.snapshots.delete(scope);
        for (const identity of identities) {
          const key = `${identity.kind}:${identity.id}`;
          if (!state.identities.has(key)) state.identities.set(key, identity);
        }
      } catch (error) {
        state.publishedRevision = previous.publishedRevision;
        state.snapshots = previous.snapshots;
        state.identities = previous.identities;
        throw error;
      }
    },
  };
}
