# Proof Protocol · PROOF

Simple Solana mainnet research. Enter a project website, name, ticker or Solana mint address. Choose the exact token, get a Proof score out of 100, inspect the evidence, save the report, and keep a watchlist.

## Proof Bundles

The companion bundle-research app is in [apps/proof-bundles](apps/proof-bundles/README.md). Basic transaction-pattern scans are free. Verified Pro holders unlock deeper native launch-window scans and CSV/JSON launch exports. The official holder mint and minimum balance must be configured before Pro access can be activated.

Run it separately with Node 22:

```sh
cd apps/proof-bundles
npm ci --ignore-scripts
npm start
```

Use that folder as the deployment root or Docker build context. The root Vercel deployment serves Proof Protocol at `/` and Proof Bundles at `/bundles/`, with a Node API function. `vercel.json` selects a build that does not require a Sites hosting manifest. For a standalone bundle service, configure its own HTTPS origin. See the companion README for RPC coverage limits and server settings. Pro on Vercel also needs shared Redis REST storage so verification and exports survive cold starts.

## Vercel

Connect this repository with its root directory set to the repository root. The included `vercel.json` selects `node scripts/build-vercel.mjs`, the `vercel-output` static directory and one catch-all Node API function. No `.openai/hosting.json` is needed for Vercel. Both apps use the same origin; API keys stay in server environment settings.

Basic scans work without a wallet or holder policy. For Pro, configure `HOLDER_TOKEN_MINT`, `HOLDER_MIN_TOKENS`, `STATE_REDIS_REST_URL` and `STATE_REDIS_REST_TOKEN` in Vercel's server environment. `SOLANA_RPC_URL` is recommended for reliable historical access. No services or subscriptions are purchased automatically.

## Start locally

Node.js 22 or newer. No packages, API keys or build step are required.

```sh
npm start
```

Open http://127.0.0.1:3000. Use `PORT=4000 npm start` for another port.

```sh
npm run check
npm test
```

The production application is a self-contained Cloudflare Worker in `dist/server/index.js`. Run `npm run build` before packaging; it embeds the original UI and a read-only server RPC gateway. Hash routes make bookmarked report links work without server-side routing.

## What works

- One search field for Solana mint addresses, project names, tickers, project websites, Solscan links, Solana Explorer links and DEX Screener Solana pair links. Website lookup matches indexed project links; users confirm the candidate token before scanning.
- Live prices and indexed pools, ordered by reported liquidity.
- Mint-authority and freeze-authority checks from Solana mainnet, with a public RPC fallback.
- Explicit liquidity and pool-age review signals, timestamped evidence and links to primary sources.
- A versioned 0–100 Proof score with seven expandable categories, exact source links, evidence coverage, disclosed thresholds and zero points for missing data.
- Raw top-ten token-account concentration where available, using exact integer comparisons for threshold decisions. Pool, vault and treasury accounts are not identified holders.
- Public report links rerun the scan for the recipient; JSON exports preserve the evidence snapshot, score and model version.
- Up to 100 saved reports and 90 watchlist projects, stored in the current browser, with JSON export.
- Optional read-only Phantom or Solflare connection and mainnet SOL balance. No message signing, token approvals or transaction calls.
- Desktop and mobile navigation, keyboard shortcuts, modal focus handling, light/dark themes and compact tables.
- Clear unavailable-data states, source timeouts, exact 32-byte address validation, escaped external data and a Content Security Policy.

Existing Proofline browser data is read as a migration fallback. Updated records use the `proofprotocol.` localStorage prefix. Wallet connection is optional and does not sync records across devices.

## PROOF ticker

The product name is **Proof Protocol** and the project ticker is **PROOF**. No official token mint address has been supplied or configured. No price, token supply, tokenomics, purchase link or token deployment is claimed. Research features work independently of a token.

## Data and methodology

Public endpoints:

- `https://api.dexscreener.com`
- `https://api.mainnet-beta.solana.com`
- `https://solana-rpc.publicnode.com`

Market requests originate in the visitor's browser. On-chain requests use the same-origin `/api/rpc` server gateway. It verifies the mainnet genesis, uses finalized reads, validates mint ownership and response shapes, caches for 15 seconds, coalesces duplicate requests and applies a best-effort per-isolate IP limit. Optional `SOLANA_RPC_URL` stays server-only. No wallet connection, sign-in or token holding is needed to scan. Public APIs can apply per-IP quotas. DEX data describes the selected largest indexed base-token pool, not the aggregate market. Liquidity below USD 100,000 and a pool younger than seven days are research flags. They are not a scam diagnosis. Missing evidence is marked unknown; no flags is not a safety verdict.

Reports are deterministic checks, not AI audits. Team identities, product claims, unique holder identities, liquidity locks, Token-2022 extensions and contract source code require additional review. Public APIs can be rate limited, unavailable or delayed. Use a dedicated RPC/indexer and capacity monitoring for a commercial launch with significant traffic.

Website matching only uses indexed links. It does not fetch or execute project sites, verify ownership, or test products. No backend authentication, paid plans, trading, social bots or smart-contract deployment is included. The app never holds funds. No secret is required in the frontend.

## Source layout

- `public/index.html`: brand, navigation and document metadata
- `public/app.js`: UI, wallet connection and browser library
- `public/core.js`: project/address parsing, evidence rules and source requests
- `public/score.js`: score model v1 and raw-account concentration arithmetic
- `public/styles.css`: responsive interface
- `scripts/serve.mjs`: local preview server
- `tests/core.test.mjs`: meaningful evidence and input checks
- `.github/workflows/check.yml`: automatic syntax and logic checks

## Proof score v1

| Category | Maximum | Rule |
| --- | ---: | --- |
| Mint permission | 20 | Revoked = 20; active = 0 |
| Freeze permission | 15 | Revoked = 15; active = 0 |
| Largest-pool liquidity | 25 | ≥$1m: 25; ≥$100k: 20; ≥$25k: 10; ≥$10k: 5; below: 0 |
| Pool history | 15 | ≥180 days: 15; ≥30: 12; ≥7: 8; ≥1: 3; below: 0 |
| Trading presence | 10 | 24h pool transactions ≥1,000: 10; ≥100: 7; ≥10: 4; >0: 1 |
| Top-account spread | 10 | Top ten accounts ≤20% of mint supply: 10; ≤40%: 6; ≤60%: 3; above: 0 |
| Indexed project links | 5 | Website: 3; social: 2. Indexed presence only. |

Unknown categories earn zero points and remain in the 100-point denominator. Coverage is the combined weight of categories with usable data. Below 70% coverage, the label is **Incomplete evidence**. At sufficient coverage, ≥80 points is **More supporting signals**, ≥50 is **Mixed signals**, and below 50 is **Limited supporting signals**. These are checklist labels, not safety, legitimacy, or investment ratings.

The score uses each report's captured timestamp, so old snapshots do not improve merely by being reopened later. All formulas are disclosed in the app's methodology. Tests cover outage handling, unknown inputs, exact boundaries, source-link filtering, domain lookalikes and integer-safe balance arithmetic.

## October 29 release

40 tests pass, including wrong-cluster rejection, malformed mint evidence, write-method rejection, bounded input, request coalescing and provider outage handling. The app can scan without a wallet or token. Public RPC services can still omit largest-account evidence; an unavailable category remains unknown and earns no points. A dedicated production provider can be set server-side for sustained traffic. No development proxy, signing method or project wallet secret is used.
