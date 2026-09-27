(() => {
  const doc = document;
  const year = doc.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  let modulePromise = null;
  let busy = false;
  async function openWorld() {
    if (busy) return;
    busy = true;
    const buttons = [...doc.querySelectorAll('[data-open-world]')];
    buttons.forEach(b => { b.disabled = true; b.dataset.label = b.innerHTML; b.textContent = 'LOADING…'; });
    try {
      modulePromise ||= import('./oz-world.js');
      const world = await modulePromise;
      await world.launchWorld(doc.getElementById('oz-world'));
    } catch (err) {
      console.error('[OZ WORLD]', err);
      const root = doc.getElementById('oz-world');
      const panel = doc.getElementById('world-error');
      if (root && panel) { root.classList.add('open'); root.setAttribute('aria-hidden','false'); panel.hidden = false; doc.body.classList.add('world-open'); }
    } finally {
      buttons.forEach(b => { b.disabled = false; if (b.dataset.label) b.innerHTML = b.dataset.label; });
      busy = false;
    }
  }
  doc.querySelectorAll('[data-open-world]').forEach(b => b.addEventListener('click', openWorld));
  doc.getElementById('world-error-exit')?.addEventListener('click', () => {
    doc.getElementById('oz-world')?.classList.remove('open');
    doc.getElementById('world-error').hidden = true;
    doc.body.classList.remove('world-open');
  });
  if (new URLSearchParams(location.search).get('world') === '1') openWorld();
})();
