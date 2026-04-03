import sql from './client.js';

async function migrate() {
  console.log('Running migrations...');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      email       VARCHAR(255) NOT NULL UNIQUE,
      password    VARCHAR(255) NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        VARCHAR(100) NOT NULL,
      balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bank_id     INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
      type        VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
      amount      NUMERIC(12,2) NOT NULL,
      description VARCHAR(255),
      category    VARCHAR(50),
      date        DATE NOT NULL,
      is_savings  BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS credit_cards (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        VARCHAR(100) NOT NULL,
      credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
      outstanding  NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cc_transactions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id     INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL,
      amount      NUMERIC(12,2) NOT NULL,
      description VARCHAR(255),
      category    VARCHAR(50),
      date        DATE NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cc_payment_history (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id             INTEGER REFERENCES credit_cards(id) ON DELETE SET NULL,
      card_name           VARCHAR(100),
      outstanding_amount  NUMERIC(12,2) NOT NULL,
      amount_paid         NUMERIC(12,2) NOT NULL,
      outstanding_date    DATE NOT NULL,
      payment_date        DATE NOT NULL,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS folders (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        VARCHAR(100) NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS files (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
      name        VARCHAR(255) NOT NULL,
      type        VARCHAR(50),
      size        VARCHAR(50),
      date        DATE NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title           VARCHAR(255) NOT NULL,
      date            DATE NOT NULL,
      reminder_email  VARCHAR(255),
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text        TEXT NOT NULL,
      date        DATE,
      completed   BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text        TEXT NOT NULL,
      date        DATE,
      is_read     BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key         VARCHAR(100) NOT NULL,
      value       TEXT,
      UNIQUE(user_id, key)
    )
  `;

    await sql`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_id     INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
        name        VARCHAR(255) NOT NULL,
        target      NUMERIC(12,2) NOT NULL DEFAULT 0,
        current     NUMERIC(12,2) NOT NULL DEFAULT 0,
        deadline    DATE,
        color       VARCHAR(20) DEFAULT '#00e5a0',
        has_shortage BOOLEAN DEFAULT FALSE,
        shortage_amount NUMERIC(12,2) DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS goal_transactions (
        id          SERIAL PRIMARY KEY,
        goal_id     INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tx_id       INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
        amount      NUMERIC(12,2) NOT NULL,
        note        VARCHAR(255),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    
      // Safely add new columns if upgrading existing DB
    try {
      await sql`ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS bank_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL`;
    } catch (e) {}
    
    try {
      await sql`ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS has_shortage BOOLEAN DEFAULT FALSE`;
    } catch (e) {}
    
    try {
      await sql`ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS shortage_amount NUMERIC(12,2) DEFAULT 0`;
    } catch (e) {}
    
    try {
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS goal_id INTEGER REFERENCES savings_goals(id) ON DELETE SET NULL`;
    } catch (e) {}

  console.log('✅ All tables created successfully.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
