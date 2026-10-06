# QBFT

QBFT (Istanbul BFT, with the quorum and round-change fixes from QBFT) is Besu's recommended consensus for a permissioned network that wants immediate finality. A block is final when a quorum of validators commits it. There is no probabilistic "wait for N confirmations" the way there is on proof of work or Gasper. The API still waits for two blocks on top of a receipt before it reports `CONFIRMED`, as an application-level buffer, not because QBFT needs it.

## Fault tolerance

```text
N = 3f + 1
4 = 3(1) + 1
f = 1
```

The network can lose one validator and keep producing blocks. Two validators down is below the quorum of `2f + 1 = 3`, and block production stops. That is the BFT assumption: at most `f` validators are Byzantine or unavailable, and messages between the honest ones eventually arrive.

What "Byzantine" means here: a validator can crash, refuse to vote, or vote for two different blocks. It cannot invent a block the other honest validators will commit, because a commit needs a quorum those honest validators will not give.

## What was measured

`scripts/failure-test.sh` on the local Docker network:

| Step | Height | Peers seen by validator-1 |
| --- | --- | --- |
| All four up | 485 | 3 |
| validator-4 stopped, 8s later | 488 | |
| 6s after that | 491 | 2 |
| validator-4 restarted | 493 | 3 |

Peers dropped from 3 to 2, which is the other two validators still connected. Height kept increasing the whole time validator-4 was down. After restart the peer count returned to 3, so the node rejoined and was receiving the chain. Full write-up: `docs/failure-testing.md`.

## Round timing

`blockperiodseconds = 2` is the target time between blocks. `requesttimeoutseconds = 4` is how long a round waits before a round change. With one validator down, the remaining three still form a quorum, so rounds complete on the block period. That is what the test showed: blocks continued at the same cadence.

## Validator set changes

The validator set is the one encoded in genesis `extraData`. Adding or removing a validator is a QBFT voting operation (`qbft_proposeValidatorVote`) and is intentionally not exposed. Epoch length is 30,000 blocks, about 16 hours at a 2 second block time, because this project does not vote the set.
