(function(){
  const doc=document,navToggle=doc.querySelector('.nav-toggle'),nav=doc.querySelector('.nav');
  if(navToggle&&nav){navToggle.addEventListener('click',()=>{const o=nav.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(o));});nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');navToggle.setAttribute('aria-expanded','false');}});}
  const reveals=[...doc.querySelectorAll('.reveal')];if('IntersectionObserver'in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}}),{threshold:.1});reveals.forEach(x=>io.observe(x));}else reveals.forEach(x=>x.classList.add('on'));
  doc.querySelectorAll('[data-open-world]').forEach(b=>b.addEventListener('click',()=>window.OZWorld?.open()));
  if(new URLSearchParams(location.search).get('world')==='1')window.OZWorld?.open();
})();
