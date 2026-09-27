import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';

let activeSession = null;

const DESTINATIONS = [
  { name: 'ZaWordle', type: 'GAME', href: 'ZaWordle/', x: -9, z: -7, hue: 0x9bbc0f },
  { name: 'LogicLock', type: 'PUZZLE', href: 'logiclock/', x: 0, z: -11, hue: 0x8bac0f },
  { name: 'Azan Plus', type: 'APP', href: 'azanplus/', x: 9, z: -7, hue: 0x9bbc0f },
  { name: 'Aura HxH', type: 'QUIZ', href: 'hxh/', x: -8, z: 7, hue: 0x8bac0f },
  { name: 'OUTZOO BLOG', type: 'PORTAL', href: 'https://blog.ameer.dev/', x: 7, z: 8, hue: 0xc8d86a, portal: true }
];

export async function launchWorld(root) {
  if (!root) throw new Error('World root not found');
  if (activeSession) {
    activeSession.resume();
    return;
  }
  const session = createSession(root);
  activeSession = session;
  await session.start();
}

function createSession(root) {
  const stage = root.querySelector('#oz-world-stage');
  const prompt = root.querySelector('#world-prompt');
  const exitBtn = root.querySelector('#world-exit');
  const touch = root.querySelector('#touch-controls');
  const stick = root.querySelector('#touch-stick');
  const lookArea = root.querySelector('.touch-look');
  const actionBtn = root.querySelector('#touch-action');

  let scene, camera, renderer, clock, frame = 0, running = false, currentTarget = null;
  let yaw = 0, pitch = -0.04, bob = 0;
  const keys = new Set();
  const velocity = new THREE.Vector3();
  const colliders = [];
  const destinations = [];
  const listeners = [];
  const touchMove = { x: 0, y: 0 };
  let lookPointer = null, lookLastX = 0, lookLastY = 0, stickPointer = null;

  const on = (target, name, fn, opts) => {
    target.addEventListener(name, fn, opts);
    listeners.push(() => target.removeEventListener(name, fn, opts));
  };

  function labelTexture(title, subtitle, accent = '#9bbc0f') {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffef7'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, c.width, 86);
    ctx.fillStyle = '#10110f'; ctx.fillRect(28, 110, c.width - 56, c.height - 140);
    ctx.fillStyle = '#9bbc0f'; ctx.fillRect(47, 132, c.width - 94, c.height - 184);
    ctx.fillStyle = '#0f380f'; ctx.font = '900 34px monospace'; ctx.textAlign = 'left'; ctx.fillText('OZ // ' + subtitle, 42, 58);
    ctx.font = '900 78px Arial Black, sans-serif';
    const words = title.split(' '); let y = 245;
    words.forEach(word => { ctx.fillText(word.toUpperCase(), 75, y); y += 82; });
    ctx.font = '900 26px monospace'; ctx.fillText('PRESS E / CLICK TO OPEN', 75, 440);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }

  function addCartridge(info) {
    const group = new THREE.Group();
    group.position.set(info.x, 0, info.z);
    group.userData = info;

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.8, 1.15),
      new THREE.MeshStandardMaterial({ color: 0xc7c8bc, roughness: .78, metalness: .04 })
    );
    shell.position.y = 2.55; shell.castShadow = true; shell.receiveShadow = true; group.add(shell);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3.55, 3.15),
      new THREE.MeshBasicMaterial({ map: labelTexture(info.name, info.type), toneMapped: false })
    );
    label.position.set(0, 2.72, .586); group.add(label);

    const notch = new THREE.Mesh(new THREE.BoxGeometry(1.4, .18, 1.23), new THREE.MeshStandardMaterial({ color: 0xa9aa9f }));
    notch.position.set(0, 4.87, 0); group.add(notch);

    const baseGlow = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.72, 42),
      new THREE.MeshBasicMaterial({ color: info.hue, side: THREE.DoubleSide, transparent: true, opacity: .72 })
    );
    baseGlow.rotation.x = -Math.PI / 2; baseGlow.position.y = .035; group.add(baseGlow);
    group.userData.glow = baseGlow;

    scene.add(group);
    destinations.push(group);
    colliders.push({ x: info.x, z: info.z, rx: 2.65, rz: 1.7 });
  }

  function addPortal(info) {
    const group = new THREE.Group(); group.position.set(info.x, 0, info.z); group.userData = info;
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b221b, roughness: .72 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(.8, 5.6, 1.2), mat); left.position.set(-2.4, 2.8, 0);
    const right = left.clone(); right.position.x = 2.4;
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.6, .8, 1.2), mat); top.position.set(0, 5.25, 0);
    [left,right,top].forEach(m => {m.castShadow=true;group.add(m)});
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: labelTexture('OUTZOO', 'BLOG PORTAL', '#c8d86a'), toneMapped: false }));
    screen.position.set(0, 2.8, .62); group.add(screen);
    const glow = new THREE.PointLight(0x9bbc0f, 24, 9, 1.8); glow.position.set(0, 2.8, 1.2); group.add(glow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.22, 48), new THREE.MeshBasicMaterial({ color: 0x9bbc0f, side: THREE.DoubleSide, transparent:true,opacity:.85 })); ring.rotation.x=-Math.PI/2; ring.position.y=.035; group.add(ring); group.userData.glow=ring;
    scene.add(group); destinations.push(group); colliders.push({ x: info.x, z: info.z, rx: 3.2, rz: 1.55 });
  }

  function addEnvironment() {
    const hemi = new THREE.HemisphereLight(0xe8ffd1, 0x283020, 2.4); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 3.4); sun.position.set(7, 14, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshStandardMaterial({ color: 0xf1f0e6, roughness: 1 }));
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(44, 44, 0x0f380f, 0x8bac0f); grid.position.y = .012; const mats=Array.isArray(grid.material)?grid.material:[grid.material];mats.forEach(m=>{m.opacity=.32;m.transparent=true});scene.add(grid);

    // Manga-panel walls keep the world bounded and visually related to the blog.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfffef7, roughness: .95 });
    [[0,2,-21,44,4,.5],[0,2,21,44,4,.5],[-21,2,0,.5,4,44],[21,2,0,.5,4,44]].forEach(v=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(v[3],v[4],v[5]),wallMat);m.position.set(v[0],v[1],v[2]);m.receiveShadow=true;scene.add(m);
    });
    for (let i=0;i<18;i++) {
      const h = .45 + (i%4)*.12;
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.1,h,1.1),new THREE.MeshStandardMaterial({color:i%2?0x306230:0x9bbc0f,roughness:.8}));
      const angle=(i/18)*Math.PI*2, radius=16.7;block.position.set(Math.cos(angle)*radius,h/2,Math.sin(angle)*radius);block.rotation.y=-angle;scene.add(block);
    }
  }

  function blocked(x, z) {
    if (Math.abs(x) > 19.4 || Math.abs(z) > 19.4) return true;
    return colliders.some(c => Math.abs(x-c.x) < c.rx && Math.abs(z-c.z) < c.rz);
  }

  function updateTarget() {
    const p = camera.position;
    const forward = new THREE.Vector3(0,0,-1).applyEuler(camera.rotation).setY(0).normalize();
    let best = null, bestScore = -Infinity;
    destinations.forEach(group => {
      const delta = new THREE.Vector3(group.position.x-p.x,0,group.position.z-p.z);
      const dist = delta.length(); if (dist > 7.2) return;
      const facing = forward.dot(delta.normalize());
      const score = facing * 3 - dist * .12;
      if (facing > .48 && score > bestScore) { best = group; bestScore = score; }
    });
    if (best !== currentTarget) {
      if (currentTarget?.userData.glow) currentTarget.userData.glow.scale.setScalar(1);
      currentTarget = best;
      if (currentTarget?.userData.glow) currentTarget.userData.glow.scale.setScalar(1.18);
    }
    if (currentTarget) {
      const d = Math.hypot(currentTarget.position.x-p.x,currentTarget.position.z-p.z);
      prompt.classList.toggle('ready', d < 5.6);
      prompt.innerHTML = `<small>${currentTarget.userData.type}</small><strong>${escapeHtml(currentTarget.userData.name)}</strong><span>${d < 5.6 ? 'E / CLICK TO OPEN' : 'MOVE CLOSER'}</span>`;
    } else {
      prompt.classList.remove('ready');
      prompt.innerHTML = '<small>INTERACT</small><strong>تحرك نحو إحدى الخراطيش</strong><span>WASD / MOUSE · E TO OPEN</span>';
    }
  }

  function interact() {
    if (!currentTarget) return;
    const d = Math.hypot(currentTarget.position.x-camera.position.x,currentTarget.position.z-camera.position.z);
    if (d > 5.6) return;
    const href = currentTarget.userData.href;
    if (/^https?:/i.test(href)) location.href = href; else location.href = new URL(href, location.href).href;
  }

  function animate() {
    if (!running) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), .05);
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 8.2 : 4.7;
    let mx = (keys.has('KeyD')?1:0) - (keys.has('KeyA')?1:0) + touchMove.x;
    let mz = (keys.has('KeyS')?1:0) - (keys.has('KeyW')?1:0) + touchMove.y;
    const len = Math.hypot(mx,mz); if (len>1) {mx/=len;mz/=len;}
    const forward = new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const desired = forward.multiplyScalar(-mz).add(right.multiplyScalar(mx)).multiplyScalar(speed);
    velocity.lerp(desired,1-Math.exp(-dt*10));
    const nx=camera.position.x+velocity.x*dt,nz=camera.position.z+velocity.z*dt;
    if(!blocked(nx,camera.position.z))camera.position.x=nx;
    if(!blocked(camera.position.x,nz))camera.position.z=nz;
    const moving=Math.abs(mx)+Math.abs(mz)>.08;bob += dt*(moving?8:2);camera.position.y=1.72+(moving?Math.sin(bob)*.035:0);
    camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
    destinations.forEach((g,i)=>{if(g.userData.glow)g.userData.glow.rotation.z += dt*(i%2?.25:-.25)});
    updateTarget();
    renderer.render(scene,camera);
  }

  function resize() {
    if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);
  }

  function close() {
    running=false; cancelAnimationFrame(frame); frame=0;
    if(document.pointerLockElement===renderer?.domElement) document.exitPointerLock();
    root.classList.remove('open','ready');root.setAttribute('aria-hidden','true');document.body.classList.remove('world-open');
    renderer?.setAnimationLoop?.(null);
  }

  function resume() {
    root.classList.add('open','ready');root.setAttribute('aria-hidden','false');document.body.classList.add('world-open');running=true;clock.getDelta();animate();
  }

  async function start() {
    root.classList.add('open');root.setAttribute('aria-hidden','false');document.body.classList.add('world-open');
    scene=new THREE.Scene();scene.background=new THREE.Color(0x122012);scene.fog=new THREE.Fog(0x122012,14,34);
    camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,80);camera.position.set(0,1.72,15.2);
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setSize(innerWidth,innerHeight,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;stage.replaceChildren(renderer.domElement);
    clock=new THREE.Clock();addEnvironment();DESTINATIONS.forEach(info=>info.portal?addPortal(info):addCartridge(info));

    on(window,'resize',resize);
    on(document,'keydown',e=>{if(root.classList.contains('open')){keys.add(e.code);if(e.code==='KeyE'){e.preventDefault();interact()}if(e.code==='Escape')close();}});
    on(document,'keyup',e=>keys.delete(e.code));
    on(renderer.domElement,'click',()=>{if(matchMedia('(pointer:fine)').matches){if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();else interact();}else interact();});
    on(document,'mousemove',e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0022;pitch-=e.movementY*.0019;pitch=Math.max(-1.08,Math.min(1.02,pitch));}});
    on(exitBtn,'click',close);
    on(actionBtn,'click',interact);
    on(document,'visibilitychange',()=>{if(document.hidden){running=false;cancelAnimationFrame(frame)}else if(root.classList.contains('open')){running=true;clock.getDelta();animate();}});

    // Mobile: virtual left stick + drag-to-look area.
    const stickOrigin={x:56,y:56};
    const updateStick=(x,y)=>{const dx=x-stickOrigin.x,dy=y-stickOrigin.y,max=34,l=Math.hypot(dx,dy)||1,s=Math.min(1,max/l);const sx=dx*s,sy=dy*s;stick.querySelector('i').style.transform=`translate(${sx}px,${sy}px)`;touchMove.x=sx/max;touchMove.y=sy/max;};
    on(stick,'pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);const r=stick.getBoundingClientRect();stickOrigin.x=e.clientX-r.left;stickOrigin.y=e.clientY-r.top;updateStick(stickOrigin.x,stickOrigin.y)});
    on(stick,'pointermove',e=>{if(e.pointerId!==stickPointer)return;const r=stick.getBoundingClientRect();updateStick(e.clientX-r.left,e.clientY-r.top)});
    const endStick=e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;touchMove.x=touchMove.y=0;stick.querySelector('i').style.transform='translate(0,0)'};on(stick,'pointerup',endStick);on(stick,'pointercancel',endStick);
    on(lookArea,'pointerdown',e=>{lookPointer=e.pointerId;lookArea.setPointerCapture(e.pointerId);lookLastX=e.clientX;lookLastY=e.clientY});
    on(lookArea,'pointermove',e=>{if(e.pointerId!==lookPointer)return;const dx=e.clientX-lookLastX,dy=e.clientY-lookLastY;lookLastX=e.clientX;lookLastY=e.clientY;yaw-=dx*.006;pitch-=dy*.0045;pitch=Math.max(-1.05,Math.min(1.02,pitch))});
    const endLook=e=>{if(e.pointerId===lookPointer)lookPointer=null};on(lookArea,'pointerup',endLook);on(lookArea,'pointercancel',endLook);

    running=true;setTimeout(()=>root.classList.add('ready'),450);animate();
  }

  return { start, close, resume, destroy(){close();listeners.splice(0).forEach(off=>off());renderer?.dispose();stage.replaceChildren();activeSession=null;} };
}

function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
