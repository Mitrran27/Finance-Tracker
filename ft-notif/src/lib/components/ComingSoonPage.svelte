<script>
  export let title = "Feature";
  export let description = "This feature is currently under construction.";
</script>

<div class="coming-soon">
  <div class="card">
    <div class="icon">🚧</div>
    <h1>{title}</h1>
    <p>{description}</p>
    <span class="badge">Coming Soon</span>
  </div>
</div>

<style>
  .coming-soon {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card {
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 40px;
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
  }

  @media (max-width: 600px) {
    .coming-soon { padding: 16px 0; }
    .card { padding: 28px 20px; }
    .icon { font-size: 40px; }
    h1 { font-size: 19px; }
    p { font-size: 14px; overflow-wrap: anywhere; }
  }

  .icon {
    font-size: 48px;
    margin-bottom: 10px;
  }

  h1 {
    margin: 10px 0;
    font-size: 22px;
  }

  p {
    color: var(--text2);
    margin-bottom: 20px;
  }

  .badge {
    background: linear-gradient(135deg, #ff7a7a, #ffb86b);
    color: white;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: bold;
  }
</style>