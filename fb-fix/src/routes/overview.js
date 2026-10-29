import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const uid = req.userId;

    const [banks, txSummary, ccSummary, catSpend, monthly, upcomingEvents, recentNotes, fileCount, unreadCount, bills, debts, commitments] =
      await Promise.all([
        sql`SELECT id, name, balance FROM bank_accounts WHERE user_id = ${uid}`,

        sql`SELECT type, SUM(amount)::float AS total FROM transactions WHERE user_id = ${uid} GROUP BY type`,

        sql`SELECT SUM(outstanding)::float AS total FROM credit_cards WHERE user_id = ${uid}`,

        sql`
          SELECT category, SUM(amount)::float AS total FROM (
            SELECT category, amount FROM transactions WHERE user_id = ${uid} AND type = 'expense'
            UNION ALL
            SELECT category, amount FROM cc_transactions WHERE user_id = ${uid}
          ) combined
          GROUP BY category ORDER BY total DESC LIMIT 10
        `,

        sql`
          SELECT TO_CHAR(date,'YYYY-MM') AS month, type, SUM(amount)::float AS total
          FROM transactions
          WHERE user_id = ${uid} AND date >= NOW() - INTERVAL '6 months'
          GROUP BY month, type ORDER BY month ASC
        `,

        sql`
          SELECT id, title, date, reminder_email FROM events
          WHERE user_id = ${uid} AND date >= CURRENT_DATE
          ORDER BY date ASC LIMIT 3
        `,

        sql`SELECT id, text, date, completed FROM notes WHERE user_id = ${uid} ORDER BY created_at DESC LIMIT 3`,

        sql`SELECT COUNT(*)::int AS count FROM files WHERE user_id = ${uid}`,

        sql`SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = ${uid} AND is_read = FALSE`,

        // The newer tables may not be migrated yet; don't let that break the dashboard
        sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total FROM bills WHERE user_id = ${uid} AND settled = FALSE`.catch(() => []),

        sql`
          SELECT COUNT(*)::int AS count, COALESCE(SUM(GREATEST(d.amount - COALESCE(p.paid,0), 0)),0)::float AS total
          FROM debts d
          LEFT JOIN (SELECT debt_id, SUM(amount) AS paid FROM debt_payments GROUP BY debt_id) p ON p.debt_id = d.id
          WHERE d.user_id = ${uid} AND d.cleared = FALSE
        `.catch(() => []),

        sql`SELECT id, amount::float AS amount FROM commitments WHERE user_id = ${uid}`.catch(() => []),
      ]);

    const totalBalance = banks.reduce((s, b) => s + Number(b.balance), 0);
    const highestBank  = [...banks].sort((a, b) => Number(b.balance) - Number(a.balance))[0] ?? null;
    const income  = txSummary.find(r => r.type === 'income')?.total  ?? 0;
    const expense = txSummary.find(r => r.type === 'expense')?.total ?? 0;

    res.json({
      totalBalance, highestBank,
      ccOutstanding: ccSummary[0]?.total ?? 0,
      netSavings: income - expense,
      income, expense,
      categorySpending: catSpend,
      monthlyTrend: monthly,
      upcomingEvents,
      recentNotes,
      fileCount: fileCount[0]?.count ?? 0,
      unreadNotifications: unreadCount[0]?.count ?? 0,
      billsUnsettled: { count: bills[0]?.count ?? 0, total: bills[0]?.total ?? 0 },
      debtRemaining:  { count: debts[0]?.count ?? 0, total: debts[0]?.total ?? 0 },
      commitments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
