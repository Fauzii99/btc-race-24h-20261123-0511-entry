// cbBTC swing bot for btc-race-24h-20261123-0511.
//
// Strategy (chosen from evidence, not from a hunch): buy once, full size, on the
// first tradable bar, then hold with a 2% trailing stop on closes and never
// re-enter. The dev window (1440 1-min bars, $58,957 -> $61,102, +3.64%) is
// choppy: 1-min returns have std 8 bps and only 5 moves exceed the ~45 bps
// full-size round-trip cost, so the money is in multi-minute swings, not
// scalping. I backtested the obvious online rules on this window AND on the
// time-reversed window (same volatility, net -3.46%) before picking this one:
//
//   rolling DP (lookback 30-240)   dev -$150..-165, 112-124 trades (whipsaw)
//   EMA cross 5/20, 10/30, 20/50   dev -$37..-139 (whipsaw + fees)
//   Donchian 20/30/60/90           dev -$99..+$6
//   momentum 30-120 bars           dev -$17..-$3
//   Bollinger / RSI mean-reversion dev -$18..-88 (overtrades)
//   dip-buy 1% below 60-bar high   dev +$9..+16, reversed -$39..-48
//   buy + 2% trailing stop         dev +$32.17, reversed -$14.28, max DD ~2%
//
// Every re-entry rule I tried made the down window worse (false breakouts in a
// falling market cost ~2% + fees each), so the bot never re-buys after a
// stop-out: in a downtrend the best defence is to stay flat. The 2% stop is
// ~25x the 1-min return std, so it only fires on a real decline, not noise.
// The trailing stop is the active risk control: it is what keeps the bot from
// "just holding through a falling window" -- on the reversed window it exits
// early and caps the loss at ~$14 instead of the -$38 buy-and-hold loses.
//
// Costs, for reference: 4 bps fee + 2 bps slippage + constant-product impact
// vs ~$597k pool depth (~17 bps on a full $1,000 leg), so a full round trip is
// ~45 bps. The bot trades at most twice (one buy, one stop sell, plus the
// harness's final flatten), so fees stay tiny.
//
// Deterministic: no clock, no environment, no unseeded random. State is only
// the peak close since entry and whether a position was ever held.
//
// Note: this entry is TypeScript (not the Python twin) because the kit's local
// grader runs node only -- the process driver cannot run Python and this
// machine has no Docker, so a Python entry could not be graded locally. The
// strategy is identical to the Python version written first; the server
// accepts either language.

import { BPS, runBars, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
// Trailing stop: sell when the close falls this far below the peak close
// since entry (200 bps = 2%).
const TRAIL_BPS = 200n;
// Generous slippage bound: the fill is at the next bar's open, normally a
// few bps from the latest close, plus 2 bps modelled slippage and ~17 bps
// impact on a full-size leg -- far inside 100 bps.
const MAX_SLIPPAGE_BPS = 100;

let everHeld = false;
let peak: bigint | null = null;

await runBars({
  onBatch(state: BarsState): OrderInput[] {
    if (state.warmingUp) return [];
    const price = state.close(SYMBOL);
    if (price === null) return [];
    const holding = state.positions.get(SYMBOL);
    if (holding !== undefined) {
      everHeld = true;
      if (peak === null || price > peak) peak = price;
      // Trailing stop: 2% below the peak close since entry.
      if (price * BPS < peak * (BPS - TRAIL_BPS)) {
        return [{ side: 'sell', symbol: SYMBOL, qty: holding.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }
    // Flat. After a stop-out we never re-enter (see the header comment).
    if (everHeld) return [];
    // Never held: buy full size on the first tradable bar. The peak starts
    // at this bar's close: the fill lands at the next bar's open, a minute
    // later, and the two prices are within a few bps of each other, so the
    // entry bar's close is the right anchor for the trailing stop.
    const room = state.weightRoom(SYMBOL);
    const amount = state.cash < room ? state.cash : room;
    if (amount < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    peak = price;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: amount, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
