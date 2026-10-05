# Bot state

`seen.json` is created and updated automatically by the GitHub Action. It holds the
Verhuisdieren IDs of matching dogs that were present at baseline or already alerted on.

- Delete `seen.json` to re-baseline (no alerts for current listings).
- Remove a single ID to get that dog's alert again on the next run.

It contains only public listing IDs — never secrets.
