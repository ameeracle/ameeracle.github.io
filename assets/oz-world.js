(function(){
  const state={root:null,scene:null,viewport:null,prompt:null,exit:null,touchOpen:null,keys:new Set(),x:0,z:260,yaw:0,pitch:-7,target:null,running:false,raf:0,last:0,lookPointer:null,lastX:0,lastY:0,listeners:[]};
  const stations=[];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const on=(t,n,f,o)=>{t.addEventListener(n,f,o);state.listeners.push(()=>t.removeEventListener(n,f,o));};
  const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function init(){
    state.root=document.getElementById('oz-world'); state.scene=document.getElementById('world-scene'); state.viewport=document.getElementById('world-viewport'); state.prompt=document.getElementById('world-prompt'); state.exit=document.getElementById('world-exit'); state.touchOpen=document.getElementById('touch-open');
    document.querySelectorAll('.world-station').forEach(el=>stations.push({el,x:Number(el.dataset.x),z:Number(el.dataset.z),href:el.dataset.worldHref,name:el.querySelector('b')?.textContent||'OPEN'}));
    on(state.exit,'click',close); on(state.touchOpen,'click',interact);
    on(document,'keydown',e=>{if(!state.running)return;state.keys.add(e.code);if(e.code==='KeyE'){e.preventDefault();interact();}if(e.code==='Escape')close();});
    on(document,'keyup',e=>state.keys.delete(e.code));
    on(state.viewport,'click',e=>{if(e.target.closest('.world-station'))return;if(matchMedia('(pointer:fine)').matches&&document.pointerLockElement!==state.viewport)state.viewport.requestPointerLock?.();});
    on(document,'mousemove',e=>{if(state.running&&document.pointerLockElement===state.viewport){state.yaw-=e.movementX*.12;state.pitch=clamp(state.pitch+e.movementY*.08,-24,18);}});
    stations.forEach(s=>on(s.el,'click',()=>location.href=/^https?:/i.test(s.href)?s.href:new URL(s.href,location.href).href));
    const pad=document.getElementById('touch-pad'); if(pad){on(pad,'pointerdown',e=>{const b=e.target.closest('[data-move]');if(b){state.keys.add(b.dataset.move);b.setPointerCapture?.(e.pointerId);}});const end=e=>{const b=e.target.closest('[data-move]');if(b)state.keys.delete(b.dataset.move);};on(pad,'pointerup',end);on(pad,'pointercancel',end);}
    const look=document.getElementById('touch-look'); if(look){on(look,'pointerdown',e=>{state.lookPointer=e.pointerId;look.setPointerCapture?.(e.pointerId);state.lastX=e.clientX;state.lastY=e.clientY;});on(look,'pointermove',e=>{if(e.pointerId!==state.lookPointer)return;state.yaw-=(e.clientX-state.lastX)*.18;state.pitch=clamp(state.pitch+(e.clientY-state.lastY)*.11,-24,18);state.lastX=e.clientX;state.lastY=e.clientY;});const end=e=>{if(e.pointerId===state.lookPointer)state.lookPointer=null;};on(look,'pointerup',end);on(look,'pointercancel',end);}
  }
  function open(){if(!state.root)init();state.root.classList.add('open');state.root.setAttribute('aria-hidden','false');document.body.classList.add('world-open');state.running=true;state.last=performance.now();render();state.raf=requestAnimationFrame(frame);}
  function close(){state.running=false;cancelAnimationFrame(state.raf);state.keys.clear();if(document.pointerLockElement===state.viewport)document.exitPointerLock?.();state.root?.classList.remove('open');state.root?.setAttribute('aria-hidden','true');document.body.classList.remove('world-open');}
  function frame(t){if(!state.running)return;const dt=Math.min((t-state.last)/1000,.05);state.last=t;update(dt);render();state.raf=requestAnimationFrame(frame);}
  function update(dt){
    const yaw=state.yaw*Math.PI/180;let f=(state.keys.has('KeyW')?1:0)-(state.keys.has('KeyS')?1:0),s=(state.keys.has('KeyD')?1:0)-(state.keys.has('KeyA')?1:0);const l=Math.hypot(f,s)||1;f/=l;s/=l;const speed=(state.keys.has('ShiftLeft')||state.keys.has('ShiftRight'))?420:250;
    const fx=Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=Math.sin(yaw);state.x+=((fx*f)+(rx*s))*speed*dt;state.z+=((fz*f)+(rz*s))*speed*dt;state.x=clamp(state.x,-900,900);state.z=clamp(state.z,-1580,420);updateTarget();
  }
  function updateTarget(){
    const yaw=state.yaw*Math.PI/180,fx=Math.sin(yaw),fz=-Math.cos(yaw);let best=null,bestScore=-999;
    stations.forEach(s=>{const dx=s.x-state.x,dz=s.z-state.z,d=Math.hypot(dx,dz);if(d>430)return;const dot=(dx/d)*fx+(dz/d)*fz;const score=dot*3-d*.002;if(dot>.55&&score>bestScore){best=s;bestScore=score;}});
    if(best!==state.target){state.target?.el.classList.remove('target');state.target=best;state.target?.el.classList.add('target');}
    if(best){const d=Math.hypot(best.x-state.x,best.z-state.z),ready=d<310;state.prompt.classList.toggle('ready',ready);state.prompt.innerHTML='<small>STATION</small><strong>'+esc(best.name)+'</strong><span>'+(ready?'E / CLICK TO OPEN':'MOVE CLOSER')+'</span>';}
    else{state.prompt.classList.remove('ready');state.prompt.innerHTML='<small>READY</small><strong>WASD للحركة · حرّك الماوس للنظر</strong><span>اقترب من محطة واضغط E</span>';}
  }
  function interact(){if(!state.target)return;const d=Math.hypot(state.target.x-state.x,state.target.z-state.z);if(d>310)return;const h=state.target.href;location.href=/^https?:/i.test(h)?h:new URL(h,location.href).href;}
  function render(){if(!state.scene)return;state.scene.style.transform='rotateX('+state.pitch+'deg) rotateY('+(-state.yaw)+'deg) translate3d('+(-state.x)+'px,0px,'+(-state.z)+'px)';}
  window.OZWorld={open,close};
})();
