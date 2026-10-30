# Merge Bazaar level repair — progress log (round 3 repair, 2026-10-29)

Baseline: review 6.5 (snapshot in .design/best-6.5/).

## Round 1 (structural)
- describe(): every level row now carries its own full legend (board tokens, items + recipes, rules, boosters), generator names/prices, empty-cell count.
- Redesigned: L2 (one chain), L4 (tier-1 lid vs tier-2 lid), L7 (mixed queue: trap crate), L15 (junk pair is the free hit; cloth pair is the decoy), L16 (Needle on the far knot hiding the cloth), L20 (only the Big Merge ring reaches a knot behind bare ground), L23 (Needle a knotted generator), L29 (one key two trunks, read prices), L30 (crate vs Key Smith, match keys to locks), L31 (decoy chilli stall), L34 (free-play lantern-shaped 7x7), L37 (don't deliver the fifth Clay Diya before the Big Merge), L48 (one jar row, no flower), L50 (one sweep row with four blockers), L54 (decoy wrapped trunk), L55 (the fifth-plate crate), L59 (decoy trunk on the chain), L62 (FULL courtyard: deliver beside the jar then tap), L63 (decoy turmeric stall), L64 (7x7 grand finale, chain reward = key).
- Moved the Mela Banner teach from L60 to L57 (before the chain run).
- Budgets: L3 6 (onboarding gate needs >=80%), L6 5, L8 2 (only the Big Merge wins), L10 4, L32 6, L45 4.
- Gates: validate 64/64; playtest L1-3 100/100/89, mid .819, late .649, late skilled .891, rho -.52, no spikes/easy runs, no duplicates.

### Review round 1: 7/10 (0 levels below 6). Snapshot .design/best-7.0/
6/10: L2 (dup of L1), L8 (trap .5 teach), L19/L21 (spikes), L23 (long breather), L26 (43% boss), L34 (4 orders), L48, L53 (3 mechanics teach), L60 (not a breather; Big Merge again).
Themes: Big Merge "wait for five" overused; breathers not lighter; loose budgets (L25 2/9).

## Round 2 changes
L2 decoy basket, L3 compact, L10 one leftover crate, L12 no stray flower chain, L21 obvious spool pair at the knot, L23 Garland-only, L27 two chilli trunks, L34 two orders (no Big Merge), L48 j2, L53 one wrapped trunk, L60 chain breather (no Big Merge), budgets pinned per review.
### Review round 2: 7/10, 5 levels below 6 (L28 4, L17 5, L29 5, L48 5, L59 5). Main finding: intent text vs tuned budget mismatch ("spare Spark" claims the tuner removed), Big Merge overuse, L64 33% wall, no 7x9 board. Round-1 set (best-7.0) stays the best snapshot.

## Round 3 changes
Intent/budget audit (every Spark claim checked against the tuned budget and the stored proof), L64 rebuilt on the full 7x9 board (diya shape), L47 decoy jar row (Sweep aim), L45 knotted Hearth, L29 role twist, L35 second generator, L55 smaller + decoy kitchen, L59 decoy trunk removed, pins per review.
### Review round 3: 7.4/10, 2 below 6 (L20 trap .5, L25 intent/board mismatch). Snapshot .design/best-7.4/

## Round 4 changes
L9 one Spark (practise enforces L8's Big Merge), L10 crates-and-orders story without Big Merge, L12 Lamp Shelf as a second way to make the fifth Brass, L25 redesigned (centre spool ring → Silk Bolt + cloth for two Saris), L49 combine with three generators, L55 twist with Toran from two taps, L58 restored, L59 two spools + Loom, pins: L16 1, L19 8, L20 3, L21 3, L31 3, L39 6, L47 6. Every Spark claim in the intents re-audited against tuned budgets + proofs.
### Review round 4: 8/10, 0 levels below 6 — PASS (level-review exit 0). Snapshot .design/best-8.0/
Remaining reviewer notes (not blocking): Big Merge still the aha of ~13 levels; L9/L10/L22 trap rates; L13/L39 bosses soft; L48 not lighter than L47; late casual 0.648 right at the 0.65 cap.

## Round 6 (2026-10-29, QA review 7.4) — see .design/REPAIR6_DONE
All 25 requested redesigns done by hand (+ L14, L25, L32/L33 and L43/L44 swaps, L57-L59 chain reorder). New tool
scripts/solve-min.ts stores fewest-Spark proofs. Reviews: 7.7, 7.0, 8.0 (one level at 5), 7.5, 7.6, 7.6 — shipped
the last (0 below 6, snapshot .design/best-7.6-r6e). Late-third casual cap (0.65) vs review's slack requests is the
binding conflict.

## Round 7 (2026-10-30, QA review 7.0 with L48/L59 at 5) — snapshot .design/r7-d
Structural: jar teach moved L40→L24 (L40 = practise), Sweep teach L47→L41, swing breather L23→L21, Mela-banner teach
L33↔L35, crate streak L4-7 broken (L5/L6 no crates), true late breathers (L48 kolam, L57 chain teach, L55 two spare).
Fair hardening to hold the late cap: one visible decoy stall + 1 spare (L37, L43, L54, L59), longer L44/L60/L62.
Gates: late .639 (also ≤.65 over L43-64), mid .840, easy 24%, ρ -.56. Reviews: 7.6 (0 below 6), 7.6 (0 below 6),
with contradicting per-level requests between runs.

## Round 9 (2026-10-30, QA review 7.4) — shipped snapshot .design/r9-8.0 (review PASS 8/10, 0 below 6)
Reviews: r9-a 7.4 (0<6), r9-b 7.4 (0<6), r9-c 8.0 PASS. Gates: late L44-64 .642 (L43-64 .646), mid .845, easy 23.7%,
rho -.625, late skilled .911, no spikes/walls/dups. New: L44 "The jar ladder" (chained jars, replaces Ring of lamps BM),
L43 Sweep teach rebuilt (3 jars + decoy row), L48 kolam pair-merges only, L55/L56 swap (Fairground = breather),
L6/L7 and L20/L21 swaps, L57 two-trunk paid-key decision, L49/L45 decoy+1 spare hardening, L51 reward removed
(chain-before-teach), L36 stall removed, L32 no trunk clear. Every intent re-audited vs solve-min proofs.
