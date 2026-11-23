# cbBTC Swing Bot — btc-race-24h-20261123-0511

[![make.fun](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Fauzii99/btc-race-24h-20261123-0511-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Fauzii99/btc-race-24h-20261123-0511-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)

A trading bot for the [make.fun](https://make.fun/bounty/btc-race-24h-20261123-0511)
"Race a BTC trading bot live for 24 hours" bounty. It trades Coinbase Wrapped
BTC (cbBTC) against USDC, minute by minute, starting with $1,000 of paper money.

## Strategy

Buy once, full size, on the first tradable bar, then hold with a **2% trailing
stop on closes** and never re-enter.

This was chosen from evidence, not from a hunch. The dev window (1440 1-min
bars, $58,957 → $61,102, +3.64%) is choppy: 1-min returns have std 8 bps and
only 5 moves exceed the ~45 bps full-size round-trip cost, so the money is in
multi-minute swings, not scalping. I backtested the obvious online rules on
this window **and** on the time-reversed window (same volatility, net −3.46%):

| rule | dev PnL | reversed PnL |
|---|---|---|
| rolling DP (lookback 30–240) | −$150…−165 | — |
| EMA cross 5/20, 10/30, 20/50 | −$37…−139 | — |
| Donchian 20/30/60/90 | −$99…+$6 | — |
| momentum 30–120 bars | −$17…−$3 | — |
| Bollinger / RSI mean-reversion | −$18…−88 | — |
| dip-buy 1% below 60-bar high | +$9…+16 | −$39…−48 |
| **buy + 2% trailing stop** | **+$32.17** | **−$14.28** |

Every re-entry rule I tried made the down window worse (false breakouts in a
falling market cost ~2% + fees each), so the bot never re-buys after a
stop-out: in a downtrend the best defence is to stay flat. The 2% stop is
~25× the 1-min return std, so it only fires on a real decline, not noise.

## Local dev grade (kit harness)

- **Net PnL: +$32.17** (return 3.22%, Sharpe 0.027, max drawdown 1.98%)
- Trades: 1, fees: $0.81, net PnL at 2× fees: +$31.34
- Deterministic: two runs reproduce byte for byte (`l1 reproduced: true`)
- Constraints: compliant (≥1 trade, max drawdown ≤ 25%)

The dev gate only needs net PnL > $0. The final ranking is decided by the
live 24h race window, not by the dev score — and the dev leaderboard is
dominated by DP schedules fitted to the frozen dev window, which do not
generalise to unseen prices. This bot is built for the live window: it
captures an uptrend in full and caps a downtrend at ~2%.

## Run

The entrypoint is `main.ts` (Node 22; the server also accepts Python). It
speaks `agent-fun/bars-replay/v1` through the vendored shim in
`vendor/makefun-bars.ts` (a byte-identical copy of the kit's
`sdk/makefun-bars.ts`). No dependencies beyond the Node standard library.

```sh
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

## Costs

4 bps fee + 2 bps slippage + constant-product price impact vs ~$597k pool
depth (~17 bps on a full $1,000 leg) — about 45 bps per full-size round
trip. The bot trades at most twice, so fees stay tiny.
