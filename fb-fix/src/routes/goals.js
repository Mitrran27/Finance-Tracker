import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, buildReminderEmail } from '../mailer.js';

const router = Router();
router.use(authenticate);

// ── GET all goals ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const goals = await sql`
      SELECT g.*,
        b.name AS bank_name,
        COALESCE((SELECT SUM(gt.amount) FROM goal_transactions gt WHERE gt.goal_id = g.id), 0) AS contributed
      FROM savings_goals g
      LEFT JOIN bank_accounts b ON b.id = g.bank_id
      WHERE g.user_id = ${req.userId}
      ORDER BY g.created_at DESC
    `;
    res.json(goals);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET contributions for a goal ──────────────────────────────────────────────
router.get('/:id/contributions', async (req, res) => {
  try {
    const contribs = await sql`
      SELECT gt.*, t.description AS tx_description, t.date AS tx_date,
             t.category AS tx_category, t.bank_id AS tx_bank_id, b.name AS bank_name
      FROM goal_transactions gt
      LEFT JOIN transactions t ON t.id = gt.tx_id
      LEFT JOIN bank_accounts b ON b.id = t.bank_id
      WHERE gt.goal_id = ${req.params.id} AND gt.user_id = ${req.userId}
      ORDER BY gt.created_at DESC
    `;
    res.json(contribs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST create goal ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, target, current = 0, deadline, color = '#00e5a0', bank_id } = req.body;
    if (!name || !target) return res.status(400).json({ error: 'name and target required' });
    // Convert "YYYY-MM" (month picker) to "YYYY-MM-01" for PostgreSQL DATE type
    const deadlineDate = deadline ? (deadline.length === 7 ? deadline + '-01' : deadline) : null;
    const [goal] = await sql`
      INSERT INTO savings_goals (user_id, name, target, current, deadline, color, bank_id)
      VALUES (${req.userId}, ${name}, ${target}, ${current}, ${deadlineDate}, ${color}, ${bank_id ?? null})
      RETURNING *
    `;
    res.status(201).json(goal);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH update goal ─────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { name, target, current, deadline, color, bank_id } = req.body;
    const deadlineDate = deadline ? (deadline.length === 7 ? deadline + '-01' : deadline) : null;
    const [goal] = await sql`
      UPDATE savings_goals SET
        name      = COALESCE(${name     ?? null}, name),
        target    = COALESCE(${target   ?? null}, target),
        current   = COALESCE(${current  ?? null}, current),
        deadline  = COALESCE(${deadlineDate ?? null}::date, deadline),
        color     = COALESCE(${color    ?? null}, color),
        bank_id   = COALESCE(${bank_id  ?? null}, bank_id)
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE goal ───────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await sql`DELETE FROM savings_goals WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST contribute to a goal ─────────────────────────────────────────────────
router.post('/:id/contribute', async (req, res) => {
  try {
    const { amount, tx_id, note } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const [goal] = await sql`SELECT * FROM savings_goals WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    let resolvedTxId = tx_id ?? null;

    // If no existing transaction is linked, create one so it shows in Transactions page
    if (!tx_id) {
      const today = new Date().toISOString().slice(0, 10);
      const desc  = note || `Savings: ${goal.name}`;
      const [newTx] = await sql`
        INSERT INTO transactions (user_id, bank_id, type, amount, description, category, date, is_savings, goal_id)
        VALUES (
          ${req.userId},
          ${goal.bank_id ?? null},
          'income',
          ${amount},
          ${desc},
          'Savings',
          ${today},
          true,
          ${req.params.id}
        )
        RETURNING *
      `;
      resolvedTxId = newTx.id;

      // Also update the bank balance if a bank is linked to the goal
      if (goal.bank_id) {
        await sql`UPDATE bank_accounts SET balance = balance + ${amount} WHERE id = ${goal.bank_id} AND user_id = ${req.userId}`;
      }
    }

    await sql`
      INSERT INTO goal_transactions (goal_id, user_id, tx_id, amount, note)
      VALUES (${req.params.id}, ${req.userId}, ${resolvedTxId}, ${amount}, ${note ?? null})
    `;

    const [updated] = await sql`
      UPDATE savings_goals SET current = current + ${amount}
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;

    // If linking an existing transaction, mark it with this goal
    if (tx_id) {
      await sql`UPDATE transactions SET goal_id = ${req.params.id}, is_savings = true WHERE id = ${tx_id} AND user_id = ${req.userId}`;
    }

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE contribution ───────────────────────────────────────────────────────
router.delete('/:id/contributions/:cid', async (req, res) => {
  try {
    const [row] = await sql`
      DELETE FROM goal_transactions
      WHERE id = ${req.params.cid} AND goal_id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!row) return res.status(404).json({ error: 'Not found' });
    // Reduce goal current
    await sql`
      UPDATE savings_goals SET current = GREATEST(0, current - ${row.amount})
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
    `;
    // If the tx was auto-created by a goal contribution (is_savings=true, no manual link), delete it too
    if (row.tx_id) {
      const [tx] = await sql`SELECT * FROM transactions WHERE id = ${row.tx_id} AND user_id = ${req.userId}`;
      if (tx && tx.is_savings && tx.goal_id == req.params.id) {
        // Reverse bank balance if needed
        if (tx.bank_id) {
          await sql`UPDATE bank_accounts SET balance = balance - ${tx.amount} WHERE id = ${tx.bank_id} AND user_id = ${req.userId}`;
        }
        await sql`DELETE FROM transactions WHERE id = ${row.tx_id} AND user_id = ${req.userId}`;
      } else {
        // Just unlink
        await sql`UPDATE transactions SET goal_id = NULL, is_savings = false WHERE id = ${row.tx_id} AND user_id = ${req.userId}`;
      }
    }
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST check shortage (called when an expense risks dipping into savings) ───
// Logic: if bank balance - expenses < total saved amount → shortage
router.post('/check-shortage', async (req, res) => {
  try {
    const uid = req.userId;
    const goals = await sql`SELECT * FROM savings_goals WHERE user_id = ${uid} AND current > 0`;
    const banks = await sql`SELECT * FROM bank_accounts WHERE user_id = ${uid}`;
    const [user] = await sql`SELECT id, name, email FROM users WHERE id = ${uid}`;
    const [setting] = await sql`SELECT value FROM settings WHERE user_id = ${uid} AND key = 'reminder_email'`;
    const toEmail = user.email;

    let shortages = [];

    for (const goal of goals) {
      if (!goal.bank_id) continue;
      const bank = banks.find(b => b.id === goal.bank_id);
      if (!bank) continue;

      const bankBal = Number(bank.balance);
      const saved   = Number(goal.current);

      if (bankBal < saved) {
        const shortage = saved - bankBal;
        shortages.push({ goal, bank, shortage });

        // Update shortage flag on goal
        await sql`
          UPDATE savings_goals SET has_shortage = true, shortage_amount = ${shortage}
          WHERE id = ${goal.id} AND user_id = ${uid}
        `;

        // Create in-app notification
        const notifText = `⚠️ Savings shortage: "${goal.name}" needs RM ${shortage.toFixed(2)} to be topped up. Bank balance (${bank.name}: RM ${bankBal.toFixed(2)}) is below your savings goal.`;
        // Check if we already have a recent shortage notification for this goal
        const existing = await sql`
          SELECT id FROM notifications WHERE user_id = ${uid} AND text ILIKE ${'%' + goal.name + '%shortage%'}
          LIMIT 1
        `;
        if (existing.length === 0) {
          await sql`INSERT INTO notifications (user_id, text) VALUES (${uid}, ${notifText})`;

          // Send email
          sendEmail(toEmail,
            `⚠️ Savings Shortage Alert: ${goal.name}`,
            `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fff;border-radius:8px;padding:28px;border-left:4px solid #ff5c7c">
              <h2 style="color:#ff5c7c;margin:0 0 12px">⚠️ Savings Shortage Alert</h2>
              <p style="color:#333;font-size:14px">Hi ${user.name},</p>
              <p style="color:#333;font-size:14px">Your bank balance in <strong>${bank.name}</strong> has dropped below your savings goal <strong>"${goal.name}"</strong>.</p>
              <div style="background:#fff5f5;border-radius:6px;padding:16px;margin:16px 0">
                <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #ffe0e0"><span>Goal savings:</span><span style="font-weight:700">RM ${saved.toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #ffe0e0"><span>Bank balance:</span><span style="font-weight:700;color:#ff5c7c">RM ${bankBal.toFixed(2)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0;font-weight:700"><span>Shortage:</span><span style="color:#ff5c7c">RM ${shortage.toFixed(2)}</span></div>
              </div>
              <p style="color:#555;font-size:13px">Please top up your savings to cover the shortage of <strong>RM ${shortage.toFixed(2)}</strong>.</p>
            </div>`
          ).catch(console.error);
        }
      } else {
        // Clear shortage flag if resolved
        await sql`
          UPDATE savings_goals SET has_shortage = false, shortage_amount = 0
          WHERE id = ${goal.id} AND user_id = ${uid} AND has_shortage = true
        `;
      }
    }

    res.json({ shortages: shortages.map(s => ({ goalName: s.goal.name, shortage: s.shortage })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
