-- Read-only checks of the money and stock invariants. Every row must report 0;
-- anything else names the invariant that broke, without showing customer data.
-- Run it before and after production migrations and after each deploy.
WITH checks(invariant, violations) AS (
  SELECT 'stock_ledger.quantity is never negative', count(*)
  FROM stock_ledger WHERE quantity < 0
  UNION ALL
  SELECT 'payment.amount is positive', count(*)
  FROM payment WHERE amount <= 0
  UNION ALL
  SELECT 'account_receivable.balance is never negative', count(*)
  FROM account_receivable WHERE balance < 0
  UNION ALL
  SELECT 'receivable balance + paid never exceeds its total', count(*)
  FROM account_receivable
  WHERE balance + paid_amount > total_amount + 0.01
    AND status <> 'written_off'
  UNION ALL
  SELECT 'a paid receivable has no balance', count(*)
  FROM account_receivable WHERE status = 'paid' AND balance > 0.005
  UNION ALL
  SELECT 'customer.balance equals its open receivables', count(*)
  FROM customer c
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(ar.balance), 0) AS open_balance
    FROM account_receivable ar
    WHERE ar.customer_id = c.id
      AND ar.workspace_id = c.workspace_id
      AND ar.status IN ('pending', 'partial', 'overdue')
  ) open_ar ON true
  WHERE abs(coalesce(c.balance, 0) - open_ar.open_balance) > 0.01
  UNION ALL
  SELECT 'one payment reference per order', count(*)
  FROM (
    SELECT 1 FROM payment
    WHERE reference IS NOT NULL
    GROUP BY workspace_id, order_id, reference
    HAVING count(*) > 1
  ) repeated
  UNION ALL
  SELECT 'order number assigned and unique', count(*)
  FROM (
    SELECT 1 FROM sales_order
    GROUP BY workspace_id, order_number
    HAVING count(*) > 1 OR order_number = ''
  ) repeated
)
SELECT invariant, violations FROM checks ORDER BY violations DESC, invariant;
