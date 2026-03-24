<script>
  import { goto } from '$app/navigation';
  import { user, showToast } from '$lib/stores.js';
  import { api } from '$lib/api.js';

  let mode = 'login';
  let name = '', email = '', password = '';
  let loading = false;
  let error = '';

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      if (mode === 'signup') {
        await api.post('/auth/register', { name, email, password });
        showToast('Account created! Please login.');
        mode = 'login'; name = '';
      } else {
        const data = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        user.set(data.user);
        goto('/');
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-screen">
  <div class="glass auth-card fade-in">
    <div class="auth-logo">
      <div class="logo-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a0e17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
      </div>
      <h1>Finance Tracker</h1>
      <p>Take control of your money</p>
    </div>

    <div class="tab-row">
      <button class="tab" class:active={mode==='login'}    on:click={() => { mode='login';  error=''; }}>Login</button>
      <button class="tab" class:active={mode==='signup'}   on:click={() => { mode='signup'; error=''; }}>Sign Up</button>
    </div>

    <form on:submit|preventDefault={handleSubmit}>
      {#if mode === 'signup'}
        <div class="field">
          <label for="name">Full Name</label>
          <input id="name" class="input-field" type="text" placeholder="John Doe" bind:value={name} required>
        </div>
      {/if}
      <div class="field">
        <label for="email">Email</label>
        <input id="email" class="input-field" type="email" placeholder="you@example.com" bind:value={email} required>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" class="input-field" type="password" placeholder="••••••••" bind:value={password} required>
      </div>
      {#if error}<p class="error">{error}</p>{/if}
      <button class="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Sign Up'}
      </button>
    </form>
  </div>
</div>

<style>
  .auth-screen {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 30% 20%, rgba(0,229,160,.08), transparent 50%),
                radial-gradient(ellipse at 70% 80%, rgba(124,92,252,.08), transparent 50%),
                var(--bg);
  }
  .auth-card { padding: 32px; width: 100%; max-width: 420px; }
  .auth-logo { text-align: center; margin-bottom: 28px; }
  .logo-icon {
    width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 12px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center;
  }
  .auth-logo h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .auth-logo p  { font-size: 13px; color: var(--text2); }

  .tab-row {
    display: flex; background: var(--surface2);
    border-radius: 10px; overflow: hidden; margin-bottom: 24px;
  }
  .tab {
    flex: 1; padding: 10px; font-size: 14px; font-weight: 600;
    background: none; border: none; cursor: pointer;
    color: var(--text2); border-radius: 8px; transition: all .2s;
  }
  .tab.active { background: var(--accent); color: #0a0e17; }

  .field { margin-bottom: 16px; }
  .w-full { width: 100%; justify-content: center; margin-top: 4px; }
  .error { color: var(--danger); font-size: 12px; margin-bottom: 10px; text-align: center; }
</style>
