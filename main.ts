// Dip-reversion bot for agent-fun/bars-replay/v1 (btc-race-24h-20261111-0801).
//
// Strategy: hourly dip reversion, long only, full size, few trades.
//   - Entry: the close has fallen at least 40 bps over the last 60 one-minute
//     bars (close[k] / close[k-60] - 1 <= -0.0040) and we hold nothing.
//   - Exit: the close is at least 35 bps above the entry fill price (take profit),
//     or at least 150 bps under its cost (stop loss). Otherwise hold to the
//     end of the window, where the replay flattens the position itself.
//   - One order per reply at most; max_slippage_bps 100 (1%).
//
// Why this shape: on the frozen dev window BTC fell 1.07% overall, so every
// baseline that rides the trend loses (buy-and-hold -13.44 USDC, momentum
// -12.03, rsi-bollinger -29.65, adx-momentum -59.40, ema-cross -89.29, all
// measured locally with the kit's own grader). A full-size round trip costs
// about 26 bps in fee (4 bps) + slippage (2 bps) + pool impact (~7-8 bps
// each way at the frozen depth), so a trade must catch a move larger than
// that. Conditional returns on the dev window show hourly mean reversion:
// after a 60-minute fall of more than 30 bps the next 60 minutes average
// +18.5 bps (median +21.7), and after a 60-minute rise of more than 30 bps
// the next 60 minutes average -31.5 bps. Buying the hourly dip and selling
// the bounce clears the ~26 bps round-trip cost. The chosen thresholds sit
// inside a broad plateau of profitable settings (40% of the 480 grid points
// in a local sweep were profitable), not on a single knife-edge point, and
// the stop loss never fired on the dev window -- it exists only to cap a
// bad hold on the unseen race window.
//
// Deterministic: no wall clock, no network, no randomness, no environment
// reads. All decisions come from the bars the harness sends and the account
// it reports. The 60-bar lookback counts bars seen, so missing minutes
// simply mean fewer bars; a batch with no CBBTC bar produces no orders.
//
// NOTE: this bot is TypeScript (not the Python twin) because the kit's
// local grader runs Python bots only inside Docker, which is not installed
// on this machine; Node 22 grade-local --driver process grades this file
// directly, and the server runs it the same way (node /bot/main.ts).

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK_BARS = 60; // 60 one-minute bars = one hour
const ENTRY_DIP_BPS = 40n; // buy when the 60-bar return is at or below -40 bps
const TAKE_PROFIT_BPS = 35n; // sell when the close is >= 35 bps above the entry fill price
const STOP_LOSS_BPS = 150n; // sell when position value is <= cost * (1 - 150 bps)
const MAX_SLIPPAGE_BPS = 100; // 1% past the latest close; fills cost ~26 bps total
const BPS = 10000n;

// Closes seen so far, newest last (bigints, the bar's "c" field as sent).
const closes: bigint[] = [];
// Actual fill price of the open position's buy (from the batch's fills),
// or null when flat / unknown. Take-profit and stop-loss are measured
// against this price, not against cost: cost includes the buy fee and the
// fill's own slippage and impact, so a value/cost threshold would silently
// demand ~14 bps more move than intended and exits would come late.
let entryPrice: bigint | null = null;

await runBars({
  onBatch(state: BarsState, batch) {
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      if (fill.side === 'buy') entryPrice = BigInt(fill.price);
      if (fill.side === 'sell') entryPrice = null;
    }
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(BigInt(bar.c));
    }

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      const close = state.close(SYMBOL);
      if (close !== null && entryPrice !== null && entryPrice > 0n) {
        // Take profit: close at least 35 bps above the entry fill price.
        if (close * BPS >= entryPrice * (BPS + TAKE_PROFIT_BPS)) {
          const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
          return [sell];
        }
        // Stop loss: close at least 150 bps below the entry fill price.
        if (close * BPS <= entryPrice * (BPS - STOP_LOSS_BPS)) {
          const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
          return [sell];
        }
      }
      return [];
    }

    // Flat: buy the hourly dip, full cash, only when we have a full lookback.
    if (closes.length > LOOKBACK_BARS) {
      const now = closes[closes.length - 1];
      const then = closes[closes.length - 1 - LOOKBACK_BARS];
      // dip in bps, truncated toward zero (both values are positive).
      const dipBps = ((now - then) * BPS) / then;
      if (dipBps <= -ENTRY_DIP_BPS) {
        const cash = state.cash;
        const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
        if (cash >= minNotional) {
          const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
          return [buy];
        }
      }
    }
    return [];
  },
});
