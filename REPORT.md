# BTC Race 24h — Entry Report

Competition: `btc-race-24h-20261111-0801` — "Race a BTC trading bot live for 24 hours"
($200 total prizes; 1st $100). Deadline: 2026-11-11T12:01:00Z.
Workdir: `~/workspace/makefun-werewolf/btc-race/` (intended repo: `kadocay/btc-race-bot`,
**not** created here — repo creation/submission is the parent's step).

## Verdict: FEASIBLE and BUILT — dev gate PASSED

No live infrastructure is needed from the entrant: the bot is a stateless
stdin/stdout program; make.fun runs it live on the race window in its own
sandbox. The only work was writing the bot and grading it on the frozen dev
window in the kit, which was done locally.

## What was built

`main.ts` (TypeScript, Node 22, standard library only + the kit's own SDK shim
vendored byte-identical under `vendor/makefun-bars.ts`) plus an MIT `LICENSE`.

Strategy — **hourly dip reversion, long only, full size, few trades**:

- **Entry:** the close has fallen ≥ 40 bps over the last 60 one-minute bars
  (`close[k] / close[k-60] - 1 ≤ -0.0040`) and the bot holds nothing. Buy with
  all cash (1 order per reply, `max_slippage_bps` 100).
- **Exit:** sell the whole position when the close is ≥ 35 bps above the
  entry **fill price** (take profit), or ≥ 150 bps below it (stop loss).
  Otherwise hold; the replay flattens any open position at the last close.
- **Why:** the dev window fell 1.07% overall, so trend-riding loses. A
  full-size round trip costs ~26 bps (4 bps fee + 2 bps slippage + ~7–8 bps
  impact each way at the frozen pool depth), so a trade must catch a bigger
  move. Conditional returns on the dev window show hourly mean reversion
  (after a 60-min fall > 30 bps, the next 60 min average +18.5 bps, median
  +21.7; after a 60-min rise > 30 bps, the next 60 min average −31.5 bps).
- The thresholds sit in a broad profitable plateau (136 of 432 grid points
  in a local sweep were profitable; neighbours TP 30 → +$12.53,
  T 50/TP 40 → +$11.50), not on a single knife-edge point. The stop loss
  never fired on the dev window; it exists only to cap a bad hold on the
  unseen race window.
- **Deterministic:** no wall clock, no network, no randomness, no env reads.
  Decisions come only from the bars/account the harness sends. The 60-bar
  lookback counts bars seen, so missing minutes just mean fewer bars.

## Verification (kit's own grader)

Kit: `~/workspace/makefun-werewolf/kits/btc-race-24h-20261111-0801/btc-race-24h-20261111-0801-kit/`

Command (run three times, last run on the exact final files):

```
node cli/makefun.mjs grade-local --kit <kit> --bot ~/workspace/makefun-werewolf/btc-race --driver process --json
```

### Final result (dev window, 1,440 bars)

| Metric | Value |
|---|---|
| Net PnL | **+13.061009 USDC** (+1.31%) — **dev gate passed (PnL > 0)** |
| Trades | 12 (6 round trips, win rate 1.000) |
| Max drawdown | 0.01254 (1.25%, guardrail is 25%) |
| Sharpe (per bar) | 0.0171 |
| Fees paid | 4.835524 USDC |
| Net PnL at 2× fees | +8.231261 USDC (still profitable) |
| Action log sha256 | `29c8410a8f209e18761d0e97b7381e2363971b5921eab7d1d4b3acf4c4cc736a` |
| Determinism | Identical action-log hash on repeated runs; L1 `reproduced: true` |

Order log (bar seq → order): buy 60, sell 420, buy 454, sell 785, buy 871,
sell 1060, buy 1107, sell 1123, buy 1218, sell 1281, buy 1368, sell 1403.

### Baselines on the same dev window (same command, for calibration)

| Bot | Net PnL (USDC) | Trades |
|---|---|---|
| buy-and-hold | −13.44 | 1 |
| momentum | −12.03 | 1 |
| rsi-bollinger | −29.65 | 16 |
| adx-momentum | −59.40 | 35 |
| ema-cross | −89.29 | 65 |

### Two bugs found and fixed during verification (both caught by the grader, not by the backtester)

1. **First version measured take-profit against position cost**, not the fill
   price. Cost includes the buy fee and the fill's slippage/impact, so the
   threshold silently demanded ~14 bps more move than intended; exits came
   late (sell at bar 458 instead of 420) and the grade was **−$10.74**.
   Fixed by reading the entry fill price from the batch's `fills[].price`.
2. **The first backtester measured take-profit against the raw open**, not
   the fill price — same ~14 bps error in the other direction. Fixed the
   backtester, re-swept, and set TP to 35 bps vs the fill price. After the
   fix the independent backtester and the kit grader agree to the cent
   (+$13.061, 12 trades).

## Files

- `main.ts` — 5,276 bytes, the bot (TypeScript).
- `vendor/makefun-bars.ts` — 19,626 bytes, byte-identical copy of the kit's
  `sdk/makefun-bars.ts` (excluded from authorship counts per RULES.txt when
  kept under `vendor/`).
- `LICENSE` — 1,064 bytes, MIT.
- `REPORT.md` — this file.

## Notes for the submission step (not done here)

- **TypeScript, not Python:** the kit's local grader runs Python bots only
  inside Docker, which is not installed on this machine (`grade-local`
  errors: "the process sandbox runs node22 only"). The server runs
  `node /bot/main.ts` the same way, so this is the safer entrypoint.
- **Node version mismatch note:** the grader prints
  `node: the server's harness runs v22.23.4, this one v24.22.1` as a
  mismatch note; it does not affect the score, and the bot uses only
  erasable TypeScript + bigint arithmetic, so v22/v24 behaviour is the same.
  A Docker-based grade was not possible here (no Docker); the parent may
  want one if Docker becomes available, but the process-driver grade is the
  kit's supported local path.
- **Transcripts:** the competition requires the AI sessions' transcripts
  with each submission (transcript gate: ≥30% reproduced lines, ≥5 assistant
  turns, ≥2 writes of some file, etc.). This subagent session's transcript
  must be bundled by the submitting agent (`makefun bundle`); nothing here
  was submitted, no repo was created, no wallet/keypair was created or used.
- **Dev gate ≠ race result:** +$13.06 on the dev window only buys a place
  in the live race. The race window is a different, unseen 24 hours; the
  strategy is fitted to one falling, choppy day and its edge (hourly mean
  reversion of ~20–45 bps bounces) is small relative to the ~26 bps
  round-trip cost. Expected race outcome is genuinely uncertain.

## Honest known weaknesses

- Edge is thin: +$13 on $1,000 over 24h; at 2× fees it is +$8.23, at 3×
  fees it would be near zero. A race window with fewer/later bounces, or
  one sharp downtrend with no bounce (stop loss fires repeatedly), can lose.
- Only 6 round trips on the dev window — a small sample; the "plateau"
  evidence is 432 backtested parameter points on the same single day, so it
  is still one-day overfitting, mitigated but not eliminated.
- Full-size (100% of equity) entries: a −150 bps stop loss costs ~1.5% of
  equity per bad trade; several in a row could approach the 25% drawdown
  guardrail, though the dev max drawdown was only 1.25%.
- The bot never trades in the first 60 bars (needs a full lookback) and
  never re-checks depth beyond the fixed 100 bps slippage cap; if the race
  pool is much shallower than the frozen depth, fills could be rejected on
  `max_slippage` and positions held longer than intended.
