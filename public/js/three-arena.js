/* CHRONO SURGE — PHASE 6 CINEMATIC ARENA
   WebGL environment only. Gameplay remains authoritative in Canvas2D. */
(() => {
  const canvas = document.getElementById('three-arena');
  if (!canvas || !window.THREE) return;

  const T = window.THREE;
  const scene = new T.Scene();
  scene.background = new T.Color(0x030712);
  scene.fog = new T.FogExp2(0x061020, 0.00105);

  const camera = new T.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 2200);
  camera.position.set(0, 820, 520);
  camera.lookAt(0, -30, 30);

  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: isTouch ? 'low-power' : 'high-performance' });
  } catch (e) {
    console.warn('WebGL arena unavailable, using 2D background only:', e.message);
    return;
  }
  // Phones get a lower internal resolution so gameplay keeps its frame budget.
  renderer.setPixelRatio(isTouch ? 1 : Math.min(devicePixelRatio || 1, 1.35));
  renderer.setSize(innerWidth, innerHeight);
  if ('outputColorSpace' in renderer && T.SRGBColorSpace) renderer.outputColorSpace = T.SRGBColorSpace;
  else if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const world = new T.Group();
  scene.add(world);

  // Lighting: cyan gameplay side, magenta/red enemy side, gold objective accents.
  scene.add(new T.AmbientLight(0x102040, 1.8));
  const cyan = new T.PointLight(0x00eaff, 18, 900); cyan.position.set(-420, 120, 80); scene.add(cyan);
  const mag = new T.PointLight(0xff145f, 22, 1000); mag.position.set(430, 160, -40); scene.add(mag);
  const violet = new T.PointLight(0x8d36ff, 14, 850); violet.position.set(260, 260, -400); scene.add(violet);
  const gold = new T.PointLight(0xffc928, 13, 650); gold.position.set(0, 180, 180); scene.add(gold);

  // Floor: dark combat slab + luminous grid.
  const floor = new T.Mesh(
    new T.PlaneGeometry(1500, 1500),
    new T.MeshStandardMaterial({ color: 0x081525, roughness: 0.62, metalness: 0.72, emissive: 0x041a2c, emissiveIntensity: 0.32, transparent: true, opacity: 0.99 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -34;
  world.add(floor);

  const grid = new T.GridHelper(1800, 72, 0x00d9ff, 0x0b3d5c);
  grid.position.y = -31;
  grid.material.transparent = true;
  grid.material.opacity = 0.48;
  world.add(grid);

  // Arena rim: four segmented rails create the deep perspective seen in the reference.
  function rail(a, b, color) {
    const g = new T.BufferGeometry().setFromPoints([new T.Vector3(...a), new T.Vector3(...b)]);
    const m = new T.LineBasicMaterial({ color, transparent: true, opacity: 0.92 });
    const l = new T.Line(g, m); world.add(l); return l;
  }
  rail([-700,-28,-650], [700,-28,-650], 0x00d9ff);
  rail([-700,-28,650], [700,-28,650], 0xff145f);
  rail([-700,-28,-650], [-700,-28,650], 0x1a79ff);
  rail([700,-28,-650], [700,-28,650], 0xff2f79);

  // Fractured geometric environment blocks.
  const blocks = [];
  function makeBlock(x,y,z,sx,sy,sz,color,rot=0) {
    const g = new T.BoxGeometry(sx,sy,sz);
    const e = new T.EdgesGeometry(g);
    const mat = new T.MeshStandardMaterial({ color:0x07101d, roughness:0.45, metalness:0.72, emissive:color, emissiveIntensity:0.08 });
    const mesh = new T.Mesh(g,mat);
    mesh.position.set(x,y,z); mesh.rotation.set(rot*0.35,rot,rot*0.2);
    const line = new T.LineSegments(e,new T.LineBasicMaterial({color,transparent:true,opacity:0.82}));
    line.position.copy(mesh.position); line.rotation.copy(mesh.rotation);
    world.add(mesh,line); blocks.push({mesh,line,seed:Math.random()*10});
  }
  [
    [-560,90,-360,170,150,150,0x087dff,0.28],[-420,45,430,230,100,190,0xff165f,0.4],
    [510,80,-360,180,160,160,0xff145f,0.55],[610,30,390,210,100,220,0x7f35ff,0.3],
    [-40,15,-520,260,60,90,0x00d9ff,0.18],[80,50,500,290,80,100,0x0a76ff,0.3]
  ].forEach(v=>makeBlock(...v));

  // Dense perimeter architecture: the reference has large, solid fractured structures
  // framing the combat area rather than isolated wireframe cubes.
  const slabs = [];
  function makeSlab(x,y,z,sx,sy,sz,color,ry=0,rz=0){
    const g=new T.BoxGeometry(sx,sy,sz);
    const m=new T.MeshStandardMaterial({color:0x07111f,roughness:0.38,metalness:0.86,emissive:color,emissiveIntensity:0.16});
    const mesh=new T.Mesh(g,m); mesh.position.set(x,y,z); mesh.rotation.set(0,ry,rz); world.add(mesh);
    const e=new T.EdgesGeometry(g); const line=new T.LineSegments(e,new T.LineBasicMaterial({color,transparent:true,opacity:0.95}));
    line.position.copy(mesh.position); line.rotation.copy(mesh.rotation); world.add(line);
    slabs.push({mesh,line,base:y,phase:Math.random()*6.28});
  }
  [
    [-760,55,-500,360,150,240,0x00bfff,-0.16,0.08],[-620,35,-260,280,90,180,0xff155f,0.24,-0.06],
    [-730,65,20,330,190,220,0x075dff,-0.18,0.12],[-620,40,330,300,110,240,0xff155f,0.20,-0.08],
    [-760,80,590,390,190,260,0x8b38ff,0.18,0.05],
    [760,60,-510,390,170,250,0xff155f,0.18,-0.08],[620,35,-250,290,100,180,0x00bfff,-0.22,0.06],
    [720,75,40,350,210,230,0xff155f,0.22,-0.10],[620,40,330,300,120,250,0x7d36ff,-0.16,0.06],
    [760,85,580,400,200,270,0x00aaff,0.15,-0.05]
  ].forEach(v=>makeSlab(...v));

  // Suspended broken platforms and illuminated beams above the battlefield.
  const platforms=[];
  for(let i=0;i<16;i++){
    const side=i%2?-1:1, z=-470+(i%8)*135, x=side*(430+Math.random()*260);
    const g=new T.BoxGeometry(120+Math.random()*150,16+Math.random()*30,60+Math.random()*100);
    const c= i%4===0?0x00d9ff:(i%4===1?0xff155f:(i%4===2?0x873cff:0xffc928));
    const m=new T.MeshStandardMaterial({color:0x08111e,metalness:.85,roughness:.35,emissive:c,emissiveIntensity:.14});
    const q=new T.Mesh(g,m); q.position.set(x,120+Math.random()*230,z); q.rotation.set(Math.random()*.25,Math.random()*Math.PI,Math.random()*.25); world.add(q);
    const edge=new T.LineSegments(new T.EdgesGeometry(g),new T.LineBasicMaterial({color:c,transparent:true,opacity:.9})); edge.position.copy(q.position);edge.rotation.copy(q.rotation);world.add(edge);
    platforms.push(q);
  }

  // Neon vertical light blades, a key visual element from the gameplay reference.
  const blades=[];
  for(let i=0;i<18;i++){
    const side=i%2?-1:1, z=-560+(i/17)*1120;
    const g=new T.BoxGeometry(4,250+Math.random()*170,7);
    const c=side<0?0x00d9ff:0xff145f;
    const m=new T.MeshBasicMaterial({color:c,transparent:true,opacity:.78});
    const b=new T.Mesh(g,m); b.position.set(side*(610+Math.random()*150),90,z); b.rotation.z=(Math.random()-.5)*.22; world.add(b); blades.push(b);
  }

  // Vertical neon pylons.
  for (let i=0;i<12;i++) {
    const side = i%2===0 ? -1 : 1;
    const z = -520 + (i/11)*1040;
    const g = new T.CylinderGeometry(3.5,7,170+Math.random()*100,6);
    const m = new T.MeshBasicMaterial({color: side<0 ? 0x00d9ff : 0xff145f, transparent:true, opacity:0.72});
    const p = new T.Mesh(g,m); p.position.set(side*(650+Math.random()*70),70,z); world.add(p);
  }

  // Floating shard field.
  const shards = [];
  for (let i=0;i<70;i++) {
    const g = new T.TetrahedronGeometry(5+Math.random()*13,0);
    const c = [0x00d9ff,0xff145f,0x873cff,0xffc928][i%4];
    const m = new T.MeshBasicMaterial({color:c,transparent:true,opacity:0.22+Math.random()*0.35,wireframe:true});
    const s = new T.Mesh(g,m);
    s.position.set((Math.random()-0.5)*1250,30+Math.random()*430,(Math.random()-0.5)*1150);
    s.userData = {phase:Math.random()*Math.PI*2, speed:0.15+Math.random()*0.45};
    world.add(s); shards.push(s);
  }


  // Inner combat architecture: luminous fractured pillars framing the playable space.
  const innerPillars = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const radius = 520 + (i % 3) * 55;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const h = 120 + (i % 4) * 55;
    const color = [0x00d9ff, 0xff145f, 0x873cff, 0xffc928][i % 4];
    const g = new T.OctahedronGeometry(42 + (i % 3) * 12, 0);
    const m = new T.MeshStandardMaterial({ color: 0x07111e, metalness: .9, roughness: .28, emissive: color, emissiveIntensity: .22 });
    const crystal = new T.Mesh(g, m);
    crystal.position.set(x, h * .55, z);
    crystal.scale.set(1, h / 85, 1);
    crystal.rotation.set(Math.random(), a + Math.PI / 2, Math.random() * .4);
    world.add(crystal);
    const edge = new T.LineSegments(new T.EdgesGeometry(g), new T.LineBasicMaterial({ color, transparent: true, opacity: .95 }));
    edge.position.copy(crystal.position); edge.rotation.copy(crystal.rotation); edge.scale.copy(crystal.scale); world.add(edge);
    innerPillars.push({ crystal, edge, phase: Math.random() * 6.28 });
  }

  // Bright combat-lane strips create the luminous depth seen in the reference.
  for (let i = 0; i < 10; i++) {
    const z = -470 + i * 105;
    const g = new T.BoxGeometry(1500, 2.5, 3);
    const c = i % 3 === 0 ? 0xff145f : (i % 3 === 1 ? 0x00d9ff : 0x7f35ff);
    const m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: .34 });
    const lane = new T.Mesh(g, m); lane.position.set(0, -27 + (i % 2) * 1.2, z); world.add(lane);
  }

  let t=0;
  function resize(){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); }
  addEventListener('resize',resize);

  let frame = 0;
  function animate(){
    requestAnimationFrame(animate);
    if (document.hidden) return;

    // Check if performance mode or mobile
    const isPerf = window.chronoGame && (window.chronoGame.performanceMode || window.progression?.profile?.settings?.performanceMode);
    if (isTouch && isPerf && window.chronoGame && window.chronoGame.state === 'PLAYING') {
      return; // Dedicate 100% GPU to 60fps canvas combat
    }

    frame++;
    // Background scenery only: render at 1/3 rate on touch devices to conserve battery & GPU
    if (isTouch && frame % 3 !== 0) return;
    const reduced = window.progression?.profile?.settings?.reducedMotion;
    t += reduced ? 0.002 : 0.008;
    grid.material.opacity = 0.42 + Math.sin(t*1.8)*0.055;
    blocks.forEach((b,i)=>{ b.mesh.rotation.y += 0.0007*(i%2?1:-1); b.line.rotation.y=b.mesh.rotation.y; });
    slabs.forEach((b,i)=>{ b.mesh.position.y=b.base+Math.sin(t*0.45+b.phase)*2.2; b.line.position.copy(b.mesh.position); });
    platforms.forEach((q,i)=>{ q.rotation.y += (i%2?1:-1)*0.0015; });
    blades.forEach((b,i)=>{ b.material.opacity=0.55+0.25*Math.sin(t*1.8+i); });
    innerPillars.forEach((p,i)=>{ p.crystal.rotation.y += 0.0015*(i%2?1:-1); p.crystal.position.y += Math.sin(t*0.8+p.phase)*0.18; p.edge.position.copy(p.crystal.position); });
    shards.forEach((s,i)=>{ s.rotation.x += 0.002*s.userData.speed; s.rotation.y += 0.003*s.userData.speed; s.position.y += Math.sin(t+s.userData.phase)*0.025; });
    // Slight cinematic camera drift; gameplay stays in screen-space.
    camera.position.x = Math.sin(t*0.24)*24;
    camera.position.y = 820 + Math.sin(t*0.45)*10;
    camera.position.z = 520 + Math.cos(t*0.22)*18;
    camera.lookAt(0,-30,30);
    renderer.render(scene,camera);
  }
  animate();
})();
