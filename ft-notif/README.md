# Finance Tracker — SvelteKit

A static HTML/CSS Finance Tracker converted to a SvelteKit project.

## Project Structure

```
src/
├── app.css              # Global CSS variables & shared styles
├── app.html             # HTML shell
├── lib/
│   └── components/
│       └── Sidebar.svelte   # Sidebar nav component
└── routes/
    ├── +layout.svelte       # Root layout (sidebar + topbar + slot)
    ├── +page.svelte         # Overview page
    ├── banks/+page.svelte
    ├── transactions/+page.svelte
    ├── credit/+page.svelte
    ├── drive/+page.svelte
    ├── calendar/+page.svelte
    ├── notes/+page.svelte
    ├── settings/+page.svelte
    └── notifications/+page.svelte
```

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173
