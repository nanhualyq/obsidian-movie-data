// jsdom's URL.createObjectURL cannot consume the global Node Blob (it expects
// jsdom's own File/Blob internals), and revokeObjectURL is a no-op stub that
// throws on unknown URLs in some versions. The store creates object URLs for
// cover previews/caches, so replace both with deterministic fakes: URLs are
// unique-per-call strings tests can assert on, and revoke never throws.
// (In real Obsidian, genuine blob URLs are used.)
let counter = 0;
URL.createObjectURL = () => `blob:movie-data/${++counter}`;
URL.revokeObjectURL = () => {};
