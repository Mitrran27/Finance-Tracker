# Finance Tracker — Node.js + Neon PostgreSQL Backend

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create your Neon database
1. Go to https://console.neon.tech and sign up (free)
2. Create a new project
3. Copy your **Connection String** from the dashboard

### 3. Configure environment
```bash
cp .env.example .env
```
Then edit `.env` and paste your Neon connection string:
```
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=some_long_random_string_here
PORT=3000
CLIENT_URL=http://localhost:5173
```

### 4. Run migrations (creates all tables)
```bash
npm run db:migrate
```

### 5. Start the dev server
```bash
npm run dev
```
API is now running at **http://localhost:3000**

---

## API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

### Auth
| Method | Endpoint            | Body                        | Description        |
|--------|---------------------|-----------------------------|--------------------|
| POST   | /api/auth/register  | name, email, password       | Create account     |
| POST   | /api/auth/login     | email, password             | Login → get token  |
| GET    | /api/auth/me        | —                           | Get current user   |

### Overview
| Method | Endpoint       | Description                          |
|--------|----------------|--------------------------------------|
| GET    | /api/overview  | Aggregated dashboard data            |

### Bank Accounts
| Method | Endpoint        | Body              | Description      |
|--------|-----------------|-------------------|------------------|
| GET    | /api/banks      | —                 | List all banks   |
| POST   | /api/banks      | name, balance     | Add bank         |
| PATCH  | /api/banks/:id  | name?, balance?   | Update bank      |
| DELETE | /api/banks/:id  | —                 | Delete bank      |

### Transactions
| Method | Endpoint              | Query Params                          | Body                                                     |
|--------|-----------------------|---------------------------------------|----------------------------------------------------------|
| GET    | /api/transactions     | bank_id, type, category, month, search, sort | —                                               |
| POST   | /api/transactions     | —                                     | bank_id, type, amount, description, category, date, is_savings |
| PATCH  | /api/transactions/:id | —                                     | any fields                                               |
| DELETE | /api/transactions/:id | —                                     | —                                                        |

### Credit Cards
| Method | Endpoint                       | Body                                   |
|--------|--------------------------------|----------------------------------------|
| GET    | /api/credit/cards              | —                                      |
| POST   | /api/credit/cards              | name, credit_limit, outstanding        |
| PATCH  | /api/credit/cards/:id          | name?, credit_limit?, outstanding?     |
| DELETE | /api/credit/cards/:id          | —                                      |
| GET    | /api/credit/transactions       | card_id, month, search, sort           |
| POST   | /api/credit/transactions       | card_id, amount, description, category, date |
| DELETE | /api/credit/transactions/:id   | —                                      |
| GET    | /api/credit/history            | —                                      |
| DELETE | /api/credit/history/:id        | —                                      |

### Drive
| Method | Endpoint               | Body / Query                    |
|--------|------------------------|---------------------------------|
| GET    | /api/drive/folders     | —                               |
| POST   | /api/drive/folders     | name                            |
| DELETE | /api/drive/folders/:id | —                               |
| GET    | /api/drive/files       | folder_id, search, month, sort  |
| POST   | /api/drive/files       | name, type, size, folder_id, date |
| DELETE | /api/drive/files/:id   | —                               |

### Events
| Method | Endpoint        | Body                            |
|--------|-----------------|---------------------------------|
| GET    | /api/events     | month                           |
| POST   | /api/events     | title, date, reminder_email?    |
| DELETE | /api/events/:id | —                               |

### Notes
| Method | Endpoint       | Body / Query               |
|--------|----------------|----------------------------|
| GET    | /api/notes     | search, sort               |
| POST   | /api/notes     | text, date?                |
| PATCH  | /api/notes/:id | text?, date?, completed?   |
| DELETE | /api/notes/:id | —                          |

### Notifications
| Method | Endpoint                        | Description           |
|--------|---------------------------------|-----------------------|
| GET    | /api/notifications              | List all              |
| PATCH  | /api/notifications/:id/read     | Mark one as read      |
| PATCH  | /api/notifications/read-all     | Mark all as read      |
| DELETE | /api/notifications/:id          | Delete                |

### Settings
| Method | Endpoint                 | Body            |
|--------|--------------------------|-----------------|
| GET    | /api/settings            | Get all as map  |
| PUT    | /api/settings/:key       | value           |
| PATCH  | /api/settings/profile    | name            |

---

## Connecting to the SvelteKit Frontend

In your SvelteKit project, create `src/lib/api.js`:

```js
const BASE = 'http://localhost:3000/api';

function headers() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function get(path)         { return fetch(`${BASE}${path}`, { headers: headers() }).then(r => r.json()); }
export async function post(path, body)  { return fetch(`${BASE}${path}`, { method: 'POST',   headers: headers(), body: JSON.stringify(body) }).then(r => r.json()); }
export async function patch(path, body) { return fetch(`${BASE}${path}`, { method: 'PATCH',  headers: headers(), body: JSON.stringify(body) }).then(r => r.json()); }
export async function put(path, body)   { return fetch(`${BASE}${path}`, { method: 'PUT',    headers: headers(), body: JSON.stringify(body) }).then(r => r.json()); }
export async function del(path)         { return fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() }).then(r => r.json()); }
```

Then in any Svelte page:
```js
import { get, post } from '$lib/api.js';

// Login
const { token, user } = await post('/auth/login', { email, password });
localStorage.setItem('token', token);

// Load overview
const data = await get('/overview');
```
