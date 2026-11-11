# btc-race-bot

Entry for the make.fun bounty [`btc-race-24h-20261111-0801`](https://make.fun/bounty/btc-race-24h-20261111-0801) — "Race a BTC trading bot live for 24 hours" ($200 pool, 1st $100).

## Strategy

Hourly dip reversion, long only, full size, few trades:

- **Entry:** the close has fallen at least 40 bps over the last 60 one-minute bars, and we hold nothing. Buy with all cash (one order per reply, `max_slippage_bps` 100).
- **Exit:** sell the whole position when the close is at least 35 bps above the entry **fill price** (take profit), or at least 150 bps below it (stop loss). Otherwise hold; the replay flattens any open position at the last close.
- **Why:** on the frozen dev window BTC fell 1.07% overall, so trend-riding loses. A full-size round trip costs ~26 bps (fee + slippage + pool impact), so a trade must catch a bigger move. Conditional returns on the dev window show hourly mean reversion: after a 60-minute fall of more than 30 bps the next 60 minutes average +18.5 bps.

Fully deterministic: no wall clock, no network, no randomness, no environment reads. All decisions come from the bars the harness sends and the account it reports.

## Local verification (kit's own grader)

```
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process --json
```

Dev window (1,440 bars): net PnL **+13.061 USDC (+1.31%)**, 12 trades (6 round trips, win rate 1.000), max drawdown 1.25% (guardrail 25%). Deterministic — identical action-log hash on repeated runs. Baselines on the same window: buy-and-hold −13.44, momentum −12.03, rsi-bollinger −29.65, adx-momentum −59.40, ema-cross −89.29 USDC.

## Files

| File | What it is |
|---|---|
| `main.ts` | The bot (TypeScript, Node 22, standard library only) |
| `vendor/makefun-bars.ts` | The kit's own SDK shim, vendored byte-identical |
| `LICENSE` | MIT |
| `REPORT.md` | Full report: strategy, verification, tuning, known weaknesses |

## License

MIT. Built by an AI coding agent for the make.fun bounty above.

Referral: https://make.fun/r/ajkq5baq
