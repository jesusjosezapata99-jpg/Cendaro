# Releases and migrations

How a change that touches the database reaches production. The rules in `AGENTS.md` and the `supabase-write` skill still apply to every write.

## Rules

1. **Expand, then contract.** A compatible migration ships before the code that needs it. What the old code still uses is removed only after the new code is live.
2. **Rehearse first.** Build a disposable database from the production baseline and apply the migrations in production order:

   ```
   node scripts/db/apply-migrations.mjs --url <local-url> --order 024,025,026,027,028,029,023
   ```

   The `DB Integration` CI job does the same on every pull request. The script refuses any host other than localhost.

3. **One step at a time.** Each migration is a separate operation with its SQL, whether it can be reversed, and a check of the catalog right after it.
4. **Record it.** `supabase_migrations.schema_migrations` must list what was applied. A migration applied outside the ledger counts as drift.

## Before applying

- A backup newer than 24 hours, confirmed in the Supabase dashboard, with a known restore window.
- A window in which nobody is operating the system.
- `scripts/checks/prod/financial-invariants.sql` reports 0 in every row. It only reads, and shows no customer data.

## After applying

- The same invariants report 0.
- `integration.schema-drift.test.ts` passes against a rehearsal of the same order.
- Security and performance advisors show nothing new.
- Postgres logs show no `does not exist`, `42703` or `42P10` during smoke tests.

## Rolling back

Every `NNN_name.sql` has an `NNN_name.rollback.sql`. Roll back in reverse order, and redeploy the previous code first when the migration was already required by it. Two things do not revert by script:

- A value added to an enum stays in the type. It is harmless once nothing writes it.
- Rows written while the migration was live stay in place. Decide what to do with them before rolling back.

## Who writes what

Each of these values has one writer. Application code never updates them directly:

| Value                                          | Writer                                                 |
| ---------------------------------------------- | ------------------------------------------------------ |
| `account_receivable.paid_amount` and `balance` | `trg_ar_payment`, when a payment is validated          |
| `customer.balance`                             | `trg_sync_customer_balance`                            |
| `audit_log.seq`, `prev_hash` and `chain_hash`  | `audit_log_chain`                                      |
| Order, quote and credit note numbers           | `next_document_number`, through triggers or the server |

A receivable without an order has no payment row to fire the trigger, so `executeRecordArPayment` adjusts it directly.
