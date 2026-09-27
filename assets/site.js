(() => {
  const doc = document;
  const navToggle = doc.querySelector('.nav-toggle');
  const nav = doc.querySelector('.nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', e => {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const year = doc.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const reveals = [...doc.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('on');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    reveals.forEach(el => io.observe(el));
  } else reveals.forEach(el => el.classList.add('on'));

  let worldModule = null;
  let launching = false;
  async function openWorld() {
    if (launching) return;
    launching = true;
    const buttons = [...doc.querySelectorAll('[data-open-world]')];
    buttons.forEach(btn => { btn.disabled = true; btn.dataset.oldText = btn.innerHTML; btn.innerHTML = 'LOADING 3D…'; });
    try {
      worldModule ||= await import('./oz-world.js');
      await worldModule.launchWorld(doc.getElementById('oz-world'));
    } catch (err) {
      console.error(err);
      alert('تعذر تشغيل الوضع ثلاثي الأبعاد على هذا المتصفح/الجهاز. الواجهة العادية ما زالت متاحة.');
    } finally {
      buttons.forEach(btn => { btn.disabled = false; if (btn.dataset.oldText) btn.innerHTML = btn.dataset.oldText; });
      launching = false;
    }
  }
  doc.querySelectorAll('[data-open-world]').forEach(btn => btn.addEventListener('click', openWorld));

  // Explicit deep-link only. Normal visits always remain in 2D mode.
  if (new URLSearchParams(location.search).get('world') === '1') openWorld();
})();
