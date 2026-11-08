# CHANGELOG

## [1.2.0] — 2026-11-08

### Added
- DNS-over-HTTPS fallback in `core/http` + `core/http/dns.js` — bypasses system DNS failures (NXDOMAIN) by connecting to DoH resolvers via hardcoded IPs (Cloudflare 1.1.1.1/1.0.0.1, Google 8.8.8.8/8.8.4.4). Affects all outbound requests.
- `render.yaml` — Render.com blueprint (web service, Node 20, 1GB disk).
- `.github/workflows/ci.yml` — GitHub Actions CI: runs `npm install` + `test-commands` + `test-all` on push/PR to main/master.

### Changed
- `/vdgirl` now uses `core/http.getBuffer()` (was raw axios) — respects privacy allowlist + DoH fallback.
- `/lyric` now uses LRCLIB (`lrclib.net`) directly for lyrics; fixed provider name `soundcloud` → `scl`.
- `/stk` preview failure is now NON-FATAL — if ffmpeg cannot extract a preview frame from animated WebP, the sticker is still uploaded and sent (warning logged instead of aborting).
- `core/http/dns.js` rewritten cleanly with Vietnamese comments and bootstrap-by-IP strategy.

### Fixed
- `core/http/index.js` `isDnsError()`: bare identifiers `ENOTFOUND`/`ECONNREFUSED`/`ENAMETOOLONG` were unquoted (would throw ReferenceError on DNS failure) — now string literals.
- `catbox.moe`, `lrclib.net`, `cloudflare-dns.com`, `dns.google` added to `DEFAULTS.privacy.allowed_hosts` (in addition to `config.yml`).

### Removed
- `/phatnguoi` (kiểm tra phạt nguội) command — file deleted, all references removed from config, defaults, tests.
