import { languagePublic, songPublic } from "./validate.js";
import { decodeEnvelopeJson } from "./publish.js";

function byCode(list) {
  return new Map(list.map((item) => [item.code || item.songId, item]));
}

function diffMaps(before, after) {
  const added = [];
  const removed = [];
  const edited = [];
  for (const [id, item] of after) {
    if (!before.has(id)) added.push(item);
    else if (JSON.stringify(before.get(id)) !== JSON.stringify(item)) {
      edited.push({ id, before: before.get(id), after: item });
    }
  }
  for (const [id, item] of before) {
    if (!after.has(id)) removed.push(item);
  }
  return { added, removed, edited };
}

export async function previewCatalog(store) {
  const state = await store.getState();
  const languages = (await store.listLanguages()).filter((row) => row.active === 1);
  const songs = (await store.listSongs()).filter((row) => row.visible === 1);
  const languagesSnap = await store.getSnapshot("languages");
  let publishedLanguages = [];
  const publishedSongs = [];
  if (languagesSnap) {
    publishedLanguages = decodeEnvelopeJson(languagesSnap.envelope_json).payload.languages || [];
    for (const language of publishedLanguages) {
      const snap = await store.getSnapshot(`songs/${language.code}`);
      if (snap) publishedSongs.push(...(decodeEnvelopeJson(snap.envelope_json).payload.songs || []));
    }
  }
  return {
    draftRevision: state.draft_revision,
    publishedRevision: state.published_revision,
    languages: diffMaps(byCode(publishedLanguages), byCode(languages.map(languagePublic))),
    songs: diffMaps(byCode(publishedSongs), byCode(songs.map(songPublic))),
  };
}
