let active = null;

const DESTINATIONS = [
  {name:'ZaWordle', type:'GAME', href:'ZaWordle/', x:-6.2, z:4.0, w:3.6, h:4.2, d:1.0, color:[0.62,0.74,0.10,1]},
  {name:'LogicLock', type:'PUZZLE', href:'logiclock/', x:0, z:2.0, w:3.6, h:4.2, d:1.0, color:[0.55,0.67,0.08,1]},
  {name:'Azan Plus', type:'APP', href:'azanplus/', x:6.2, z:4.0, w:3.6, h:4.2, d:1.0, color:[0.62,0.74,0.10,1]},
  {name:'Aura HxH', type:'QUIZ', href:'hxh/', x:-5.6, z:-5.2, w:3.6, h:4.2, d:1.0, color:[0.38,0.53,0.18,1]},
  {name:'OUTZOO BLOG', type:'PORTAL', href:'https://blog.ameer.dev/', x:5.6, z:-5.2, w:4.8, h:5.2, d:1.1, color:[0.18,0.38,0.18,1], portal:true}
];

export async function launchWorld(root){
  if(!root) throw new Error('World root missing');
  if(active){ active.resume(); return; }
  active = createWorld(root);
  active.start();
}

function createWorld(root){
  const canvas = root.querySelector('#world-canvas');
  const prompt = root.querySelector('#world-prompt');
  const exitBtn = root.querySelector('#world-exit');
  const touchOpen = root.querySelector('#touch-open');
  const touchPad = root.querySelector('#touch-pad');
  const touchLook = root.querySelector('#touch-look');
  const errorPanel = root.querySelector('#world-error');
  const gl = canvas.getContext('webgl', {antialias:true, alpha:false, depth:true, powerPreference:'high-performance'}) || canvas.getContext('experimental-webgl');
  if(!gl) throw new Error('WebGL unavailable');

  const listeners=[];
  const on=(t,n,f,o)=>{t.addEventListener(n,f,o);listeners.push(()=>t.removeEventListener(n,f,o));};
  const keys=new Set();
  let raf=0, running=false, last=0, yaw=0, pitch=-0.09, target=null, lookPointer=null, lastX=0, lastY=0;
  const camera={x:0,y:1.72,z:12.5};
  const velocity={x:0,z:0};
  const textures=[];

  const vs=`
    attribute vec3 aPosition;
    attribute vec2 aUV;
    uniform mat4 uMVP;
    varying vec2 vUV;
    void main(){ vUV=aUV; gl_Position=uMVP*vec4(aPosition,1.0); }
  `;
  const fs=`
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTexture;
    uniform vec4 uColor;
    uniform float uUseTexture;
    uniform float uShade;
    void main(){
      vec4 tex=texture2D(uTexture,vUV);
      vec4 base=mix(uColor, tex*uColor, uUseTexture);
      gl_FragColor=vec4(base.rgb*uShade, base.a);
    }
  `;
  const program=createProgram(gl,vs,fs);
  gl.useProgram(program);
  const loc={
    pos:gl.getAttribLocation(program,'aPosition'), uv:gl.getAttribLocation(program,'aUV'),
    mvp:gl.getUniformLocation(program,'uMVP'), tex:gl.getUniformLocation(program,'uTexture'),
    color:gl.getUniformLocation(program,'uColor'), useTex:gl.getUniformLocation(program,'uUseTexture'), shade:gl.getUniformLocation(program,'uShade')
  };
  gl.enableVertexAttribArray(loc.pos); gl.enableVertexAttribArray(loc.uv);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE0); gl.uniform1i(loc.tex,0);

  const cube=createMesh(gl,cubeData());
  const quad=createMesh(gl,quadData());
  const ground=createMesh(gl,groundData());
  const whiteTex=createSolidTexture(gl,[255,255,255,255]); textures.push(whiteTex);
  const labelTextures=new Map();
  DESTINATIONS.forEach(d=>{const t=createLabelTexture(gl,d.name,d.type,d.portal); labelTextures.set(d.name,t); textures.push(t);});
  const titleTex=createBannerTexture(gl); textures.push(titleTex);

  function start(){
    errorPanel.hidden=true;
    root.classList.add('open'); root.setAttribute('aria-hidden','false'); document.body.classList.add('world-open');
    resize();
    on(window,'resize',resize);
    on(document,'keydown',e=>{if(!root.classList.contains('open'))return; keys.add(e.code); if(e.code==='KeyE'){e.preventDefault();interact();} if(e.code==='Escape')close();});
    on(document,'keyup',e=>keys.delete(e.code));
    on(canvas,'click',()=>{if(matchMedia('(pointer:fine)').matches){if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.(); else interact();}else interact();});
    on(document,'mousemove',e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*0.0024;pitch-=e.movementY*0.0020;pitch=clamp(pitch,-1.1,1.0);}});
    on(exitBtn,'click',close);
    on(touchOpen,'click',interact);
    on(touchPad,'pointerdown',e=>{const b=e.target.closest('[data-move]');if(!b)return;keys.add(b.dataset.move);b.setPointerCapture?.(e.pointerId);});
    on(touchPad,'pointerup',e=>{const b=e.target.closest('[data-move]');if(b)keys.delete(b.dataset.move);});
    on(touchPad,'pointercancel',e=>{const b=e.target.closest('[data-move]');if(b)keys.delete(b.dataset.move);});
    on(touchLook,'pointerdown',e=>{lookPointer=e.pointerId;touchLook.setPointerCapture?.(e.pointerId);lastX=e.clientX;lastY=e.clientY;});
    on(touchLook,'pointermove',e=>{if(e.pointerId!==lookPointer)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*0.006;pitch-=dy*0.0045;pitch=clamp(pitch,-1.1,1.0);});
    const endLook=e=>{if(e.pointerId===lookPointer)lookPointer=null;}; on(touchLook,'pointerup',endLook); on(touchLook,'pointercancel',endLook);
    running=true; last=performance.now(); frame(last);
  }

  function resume(){
    root.classList.add('open');root.setAttribute('aria-hidden','false');document.body.classList.add('world-open');
    running=true;last=performance.now();frame(last);
  }

  function close(){
    running=false; cancelAnimationFrame(raf); raf=0; keys.clear();
    if(document.pointerLockElement===canvas) document.exitPointerLock?.();
    root.classList.remove('open');root.setAttribute('aria-hidden','true');document.body.classList.remove('world-open');
  }

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,1.7); const w=Math.max(1,Math.floor(innerWidth*dpr)),h=Math.max(1,Math.floor(innerHeight*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;} canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';gl.viewport(0,0,w,h);
  }

  function frame(now){
    if(!running)return; raf=requestAnimationFrame(frame); const dt=Math.min((now-last)/1000,0.05); last=now; update(dt); render();
  }

  function update(dt){
    let f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0), s=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0); const len=Math.hypot(f,s)||1;f/=len;s/=len;
    const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?7.4:4.4;
    const fx=-Math.sin(yaw), fz=-Math.cos(yaw), rx=Math.cos(yaw), rz=-Math.sin(yaw);
    const tx=(fx*f+rx*s)*speed,tz=(fz*f+rz*s)*speed;
    velocity.x=lerp(velocity.x,tx,1-Math.exp(-dt*12));velocity.z=lerp(velocity.z,tz,1-Math.exp(-dt*12));
    const nx=camera.x+velocity.x*dt,nz=camera.z+velocity.z*dt;
    if(!blocked(nx,camera.z))camera.x=nx; if(!blocked(camera.x,nz))camera.z=nz;
    updateTarget();
  }

  function blocked(x,z){
    if(Math.abs(x)>18.5||Math.abs(z)>18.5)return true;
    return DESTINATIONS.some(d=>Math.abs(x-d.x)<d.w*.62&&Math.abs(z-d.z)<d.d*.9+0.8);
  }

  function updateTarget(){
    const fx=-Math.sin(yaw),fz=-Math.cos(yaw);let best=null,bestScore=-999;
    DESTINATIONS.forEach(d=>{const dx=d.x-camera.x,dz=d.z-camera.z,dist=Math.hypot(dx,dz);if(dist>6.2)return;const dot=(dx/dist)*fx+(dz/dist)*fz;const score=dot*3-dist*.12;if(dot>.6&&score>bestScore){best=d;bestScore=score;}});
    target=best;
    if(best){const dist=Math.hypot(best.x-camera.x,best.z-camera.z);prompt.classList.toggle('ready',dist<4.8);prompt.innerHTML=`<small>${escapeHtml(best.type)}</small><strong>${escapeHtml(best.name)}</strong><span>${dist<4.8?'E / CLICK TO OPEN':'MOVE CLOSER'}</span>`;}
    else{prompt.classList.remove('ready');prompt.innerHTML='<small>READY</small><strong>تحرك نحو إحدى المحطات</strong><span>WASD · MOUSE · E TO OPEN</span>';}
  }

  function interact(){if(!target)return;const dist=Math.hypot(target.x-camera.x,target.z-camera.z);if(dist>4.8)return;location.href=/^https?:/i.test(target.href)?target.href:new URL(target.href,location.href).href;}

  function render(){
    gl.clearColor(0.86,0.90,0.69,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const aspect=canvas.width/canvas.height;const proj=perspective(Math.PI/3,aspect,0.1,80);const view=viewMatrix(camera,yaw,pitch);const pv=mul4(proj,view);

    drawMesh(ground, mul4(pv,identity4()), [0.94,0.94,0.88,1], whiteTex,0,1);

    // outer walls
    drawCube(pv,0,1.45,-20,40,2.9,.45,[0.98,0.98,0.94,1],1); drawCube(pv,0,1.45,20,40,2.9,.45,[0.98,0.98,0.94,1],1);
    drawCube(pv,-20,1.45,0,.45,2.9,40,[0.98,0.98,0.94,1],.96); drawCube(pv,20,1.45,0,.45,2.9,40,[0.98,0.98,0.94,1],.96);

    // central path
    for(let i=0;i<10;i++) drawCube(pv,0,.04,10-i*2.2,3.0,.08,1.3,i%2?[0.55,0.67,0.08,1]:[0.62,0.74,0.10,1],1);

    // skyline/decorative blocks
    for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=15.2,h=.7+(i%4)*.45;drawCube(pv,Math.cos(a)*r,h/2,Math.sin(a)*r,1.2,h,1.2,i%2?[0.19,0.38,0.19,1]:[0.55,0.67,0.08,1],.94);}

    DESTINATIONS.forEach(d=>drawDestination(pv,d));

    // floating sign at the far end
    drawQuad(pv,0,5.9,-13.5,8.2,2.0,titleTex,[1,1,1,1]);
  }

  function drawDestination(pv,d){
    if(d.portal){
      const c=[0.10,0.13,0.10,1];drawCube(pv,d.x-2.0,2.7,d.z,.7,5.4,1.1,c,.9);drawCube(pv,d.x+2.0,2.7,d.z,.7,5.4,1.1,c,.9);drawCube(pv,d.x,5.05,d.z,4.7,.7,1.1,c,.9);drawQuad(pv,d.x,2.7,d.z+.57,3.2,3.8,labelTextures.get(d.name),[1,1,1,1]);
      drawCube(pv,d.x,.04,d.z+1.5,5.6,.08,3.2,[0.62,0.74,0.10,1],1);
    }else{
      drawCube(pv,d.x,d.h/2,d.z,d.w,d.h,d.d,[0.72,0.73,0.67,1],.96);drawCube(pv,d.x,d.h+.10,d.z,1.25,.20,d.d+0.08,[0.58,0.59,0.54,1],.92);drawQuad(pv,d.x,d.h*.54,d.z+d.d/2+.012,d.w*.82,d.h*.62,labelTextures.get(d.name),[1,1,1,1]);
      drawCube(pv,d.x,.04,d.z+1.15,d.w+1.2,.08,2.1,d.color,1);
    }
  }

  function drawCube(pv,x,y,z,sx,sy,sz,color,shade){const model=compose(x,y,z,sx,sy,sz);drawMesh(cube,mul4(pv,model),color,whiteTex,0,shade);}
  function drawQuad(pv,x,y,z,sx,sy,tex,color){const model=compose(x,y,z,sx,sy,1);drawMesh(quad,mul4(pv,model),color,tex,1,1);}
  function drawMesh(mesh,mvp,color,tex,useTex,shade){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,20,0);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,20,12);gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniform4fv(loc.color,color);gl.uniform1f(loc.useTex,useTex);gl.uniform1f(loc.shade,shade);gl.bindTexture(gl.TEXTURE_2D,tex);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}

  return {start,resume,close,destroy(){close();listeners.splice(0).forEach(f=>f());textures.forEach(t=>gl.deleteTexture(t));gl.deleteProgram(program);active=null;}};
}

function createProgram(gl,vsSource,fsSource){const vs=compile(gl,gl.VERTEX_SHADER,vsSource),fs=compile(gl,gl.FRAGMENT_SHADER,fsSource),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Program link failed');gl.deleteShader(vs);gl.deleteShader(fs);return p;}
function compile(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader compile failed');return s;}
function createMesh(gl,data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return{buffer:b,count:data.length/5};}
function cubeData(){const out=[];const f=(a,b,c,d)=>{const uv=[[0,0],[1,0],[1,1],[0,1]],p=[a,b,c,d],idx=[0,1,2,0,2,3];idx.forEach(i=>out.push(...p[i],...uv[i]));};f([-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]);f([.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]);f([-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]);f([.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]);f([-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]);f([-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]);return out;}
function quadData(){return[-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,-.5,0,0,0,.5,.5,0,1,1,-.5,.5,0,0,1];}
function groundData(){return[-20,0,-20,0,0,20,0,-20,1,0,20,0,20,1,1,-20,0,-20,0,0,20,0,20,1,1,-20,0,20,0,1];}
function createSolidTexture(gl,rgba){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(rgba));setTex(gl);return t;}
function createLabelTexture(gl,title,type,portal=false){const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');x.fillStyle='#fffef7';x.fillRect(0,0,512,512);x.fillStyle=portal?'#306230':'#9bbc0f';x.fillRect(0,0,512,74);x.fillStyle='#10110f';x.fillRect(22,96,468,380);x.fillStyle=portal?'#9bbc0f':'#fffef7';x.fillRect(38,112,436,348);x.fillStyle='#0f380f';x.font='700 24px monospace';x.fillText('OZ // '+type,24,48);x.font='900 55px Arial Black, sans-serif';wrapText(x,title.toUpperCase(),64,205,385,62);x.font='700 20px monospace';x.fillText('APP STATION',64,410);return canvasTexture(gl,c);}
function createBannerTexture(gl){const c=document.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d');x.fillStyle='#10110f';x.fillRect(0,0,1024,256);x.fillStyle='#9bbc0f';x.fillRect(14,14,996,228);x.fillStyle='#0f380f';x.font='900 82px Arial Black, sans-serif';x.textAlign='center';x.fillText('OZ WORLD',512,118);x.font='700 28px monospace';x.fillText('APPS  ·  EXPERIMENTS  ·  OUTZOO',512,178);return canvasTexture(gl,c);}
function canvasTexture(gl,c){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);setTex(gl);return t;}
function setTex(gl){gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);}
function wrapText(ctx,text,x,y,maxWidth,lineHeight){const words=text.split(' ');let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y);line=word;y+=lineHeight;}else line=test;}ctx.fillText(line,x,y);}
function identity4(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function mul4(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];return o;}
function compose(x,y,z,sx,sy,sz){return new Float32Array([sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1]);}
function viewMatrix(cam,yaw,pitch){const cy=Math.cos(-yaw),sy=Math.sin(-yaw),cp=Math.cos(-pitch),sp=Math.sin(-pitch);const ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);const rx=new Float32Array([1,0,0,0,0,cp,sp,0,0,-sp,cp,0,0,0,0,1]);const t=new Float32Array([1,0,0,0,0,1,0,0,0,1,0,0,-cam.x,-cam.y,-cam.z,1]);return mul4(rx,mul4(ry,t));}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}function lerp(a,b,t){return a+(b-a)*t;}function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
