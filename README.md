# Proof Protocol · PROOF

Simple Solana mainnet research. Enter a project website, name, ticker or Solana mint address. Choose the exact token, get a Proof score out of 100, inspect the evidence, save the report, and keep a watchlist.

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

The production application is the `dist/` directory. Deploy it to any static HTTPS host. Hash routes make bookmarked report links work without server-side routing.

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

Requests originate in the visitor's browser. No wallet connection, sign-in or token holding is needed to scan. Public APIs can apply per-IP quotas. DEX data describes the selected largest indexed base-token pool, not the aggregate market. Liquidity below USD 100,000 and a pool younger than seven days are research flags. They are not a scam diagnosis. Missing evidence is marked unknown; no flags is not a safety verdict.

Reports are deterministic checks, not AI audits. Team identities, product claims, unique holder identities, liquidity locks, Token-2022 extensions and contract source code require additional review. Public APIs can be rate limited, unavailable or delayed. Use a dedicated RPC/indexer and capacity monitoring for a commercial launch with significant traffic.

Website matching only uses indexed links. It does not fetch or execute project sites, verify ownership, or test products. No backend authentication, paid plans, trading, social bots or smart-contract deployment is included. The app never holds funds. No secret is required in the frontend.

## Source layout

- `dist/index.html`: brand, navigation and document metadata
- `dist/app.js`: UI, wallet connection and browser library
- `dist/core.js`: project/address parsing, evidence rules and source requests
- `dist/score.js`: score model v1 and raw-account concentration arithmetic
- `dist/styles.css`: responsive interface
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
