# Proof Protocol · PROOF

Simple Solana mainnet research. Paste a token address or project name, inspect the evidence, save the report, and keep a watchlist.

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

- One search field for Solana mint addresses, project names, Solscan links, Solana Explorer links and DEX Screener Solana pair links.
- Live prices and indexed pools, ordered by reported liquidity.
- Mint-authority and freeze-authority checks from Solana mainnet, with a public RPC fallback.
- Explicit liquidity and pool-age review signals, timestamped evidence and links to primary sources.
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

Requests originate in the visitor's browser. DEX data describes the selected largest indexed base-token pool, not the aggregate market. Liquidity below USD 100,000 and a pool younger than seven days are research flags. They are not a scam diagnosis. Missing evidence is marked unknown; no flags is not a safety verdict.

Reports are deterministic checks, not AI audits. Team identities, product claims, holder concentration, liquidity locks, Token-2022 extensions and contract source code require additional review. Public APIs can be rate limited, unavailable or delayed. Use a dedicated RPC/indexer and capacity monitoring for a commercial launch with significant traffic.

No backend authentication, paid plans, trading, social bots or smart-contract deployment is included. The app never holds funds. No secret is required in the frontend.

## Source layout

- `dist/index.html`: brand, navigation and document metadata
- `dist/app.js`: UI, wallet connection and browser library
- `dist/core.js`: address parsing, evidence rules and source requests
- `dist/styles.css`: responsive interface
- `scripts/serve.mjs`: local preview server
- `tests/core.test.mjs`: meaningful evidence and input checks
- `.github/workflows/check.yml`: automatic syntax and logic checks
