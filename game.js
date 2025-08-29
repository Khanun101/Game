// Shoot Blitz - Canvas shooter
// เขียนด้วย JavaScript ล้วน ๆ ไม่มีไลบรารี ใช้ได้ทั้งคอมและมือถือ

// ===== Utils =====
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const chance = p => Math.random() < p;
const dist2 = (x1,y1,x2,y2)=>{const dx=x2-x1, dy=y2-y1; return dx*dx+dy*dy;};

// ===== Setup Canvas =====
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = 0, H = 0;
function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resize);
resize();
// ===== Mobile helpers =====
function isMobile(){
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

// Prevent scrolling/zooming during gameplay on mobile
['touchstart','touchmove','wheel'].forEach(evt=>{
  window.addEventListener(evt, (e)=>{
    if (running) e.preventDefault();
  }, { passive:false });
});

// Pause when tab hidden
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && running){
    running = false;
  }
});

// Haptics on hit/kill
function vibrate(ms){
  if (navigator.vibrate) navigator.vibrate(ms);
}


// ===== Input =====
const keys = new Set();
window.addEventListener("keydown", e=>{
  if (["ArrowLeft","ArrowRight"," ","Space","KeyA","KeyD"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener("keyup", e=> keys.delete(e.code));

// Touch controls
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnShoot = document.getElementById("btn-shoot");

function bindHold(btn, on, off){
  let holding = false;
  const start = (e)=>{e.preventDefault(); holding = true; on();};
  const end = (e)=>{e.preventDefault(); holding = false; off();};
  btn.addEventListener("pointerdown", start);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  window.addEventListener("pointerleave", end);
  return ()=>holding;
}

let holdLeft=false, holdRight=false, holdShoot=false;
bindHold(btnLeft, ()=> holdLeft=true, ()=> holdLeft=false);
bindHold(btnRight, ()=> holdRight=true, ()=> holdRight=false);
bindHold(btnShoot, ()=> holdShoot=true, ()=> holdShoot=false);

// ===== Entities =====
class Bullet{
  constructor(x,y,vy= -700, radius=4, color="#9fe8ff"){
    this.x=x; this.y=y; this.vy=vy; this.r=radius; this.color=color; this.alive=true;
  }
  update(dt){ this.y += this.vy * dt; if (this.y < -20 || this.y > H+20) this.alive=false; }
  draw(){
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

class Particle{
  constructor(x,y, vx, vy, life, color){
    this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.t=0; this.color=color;
  }
  update(dt){ this.t+=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=80*dt; }
  draw(){
    const a = Math.max(0, 1 - this.t/this.life);
    if (a <= 0) return;
    ctx.fillStyle = this.color + Math.floor(a*255).toString(16).padStart(2,"0");
    ctx.fillRect(this.x, this.y, 2, 2);
  }
  get alive(){ return this.t < this.life; }
}

class Enemy{
  constructor(x,y, speed, hp=1, radius=16, color="#ff4d6d"){
    this.x=x; this.y=y; this.speed=speed; this.hp=hp; this.r=radius; this.color=color; this.alive=true;
    this.vx = rand(-60,60);
  }
  hit(dmg=1){
    this.hp -= dmg;
    if (this.hp<=0){ this.alive=false; spawnExplosion(this.x,this.y,this.color); }
  }
  update(dt){
    this.y += this.speed * dt;
    this.x += this.vx * dt;
    if (this.x < this.r || this.x > W - this.r) this.vx *= -1;
    if (this.y > H + this.r) this.alive=false;
  }
  draw(){
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    const grd = ctx.createRadialGradient(this.x-6, this.y-6, 4, this.x, this.y, this.r);
    grd.addColorStop(0, "#fff1");
    grd.addColorStop(1, this.color);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.restore();
  }
}

class Player{
  constructor(){
    this.x = W/2; this.y = H - 80;
    this.r = 16;
    this.speed = 380;
    this.reload = 0;
    this.reloadTime = 0.18;
    this.lives = 3;
    this.invul=0;
    this.score = 0;
    this.multi = 1;
  }
  update(dt){
    let dir = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA") || holdLeft) dir -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD") || holdRight) dir += 1;
    this.x += dir * this.speed * dt;
    this.x = clamp(this.x, this.r+6, W-this.r-6);

    this.reload -= dt;
    if ((keys.has("Space") || keys.has(" ") || holdShoot) && this.reload<=0){
      this.reload = this.reloadTime / this.multi;
      bullets.push(new Bullet(this.x, this.y - 18, -700, 4, "#9fe8ff"));
      bullets.push(new Bullet(this.x, this.y - 18, -700, 2.5, "#c2f7ff"));
    }

    if (this.invul>0) this.invul -= dt;
  }
  draw(){
    ctx.save();
    ctx.translate(this.x, this.y);
    // เรือสามเหลี่ยม
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 14);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    const grd = ctx.createLinearGradient(0,-18,0,18);
    grd.addColorStop(0, "#9fe8ff");
    grd.addColorStop(1, "#2f6cf5");
    ctx.fillStyle = grd;
    ctx.shadowColor = "#6cf";
    ctx.shadowBlur = 12;
    ctx.fill();

    // วงกลมโล่ตอนอมตะ
    if (this.invul>0){
      ctx.beginPath();
      ctx.arc(0, -2, this.r+6, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(159,232,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
  kill(){
    if (this.invul>0) return;
    this.lives--; vibrate(35);
    spawnExplosion(this.x, this.y, "#9fe8ff");
    this.invul = 2; // 2 วินาทีอมตะ
    if (this.lives<0){ gameOver(); }
  }
}

// ===== Game State =====
let player;
let bullets = [];
let enemies = [];
let particles = [];
let wave = 1;
let running = false;
let lastTime = 0;

function reset(){
  player = new Player();
  bullets = [];
  enemies = [];
  particles = [];
  wave = 1;
  spawnWave();
  document.getElementById("score").textContent = "คะแนน: 0";
  document.getElementById("lives").textContent = "พลังชีวิต: 3";
  document.getElementById("wave").textContent = "ระลอก: 1";
}

function spawnWave(){
  const n = 6 + Math.floor(wave * 1.2);
  for (let i=0;i<n;i++){
    const x = rand(30, W-30);
    const y = rand(-200, -20);
    const speed = rand(40, 80) + wave*6;
    const hp = chance(Math.min(0.15 + wave*0.01, 0.45)) ? 2 : 1;
    const r = hp===2 ? 20 : 16;
    const color = hp===2 ? "#ff7b54" : "#ff4d6d";
    enemies.push(new Enemy(x,y,speed,hp,r,color));
  }
}

function spawnExplosion(x,y, color){
  for (let i=0;i<18;i++){
    const a = rand(0, Math.PI*2);
    const sp = rand(60, 220);
    particles.push(new Particle(x,y, Math.cos(a)*sp, Math.sin(a)*sp, rand(0.4, 0.9), color.replace("#","#") ));
  }
}

// ===== Collisions =====
function checkCollisions(){
  // bullet vs enemy
  for (const b of bullets){
    if (!b.alive) continue;
    for (const e of enemies){
      if (!e.alive) continue;
      const r = b.r + e.r;
      if (dist2(b.x,b.y,e.x,e.y) <= r*r){
        e.hit(1);
        b.alive = false;
        if (!e.alive){ vibrate(10);
          player.score += 100;
          if (chance(0.1)) player.multi = Math.min(3, player.multi+0.2); // powerup ยิงไวขึ้นหน่อย
        }
        break;
      }
    }
  }
  // enemy vs player
  for (const e of enemies){
    if (!e.alive) continue;
    const r = e.r + player.r;
    if (dist2(e.x,e.y,player.x,player.y) <= r*r){
      e.alive = false;
      player.kill();
      break;
    }
  }
}

// ===== Loop =====
function update(dt){
  player.update(dt);
  bullets.forEach(b=>b.update(dt));
  enemies.forEach(e=>e.update(dt));
  particles.forEach(p=>p.update(dt));

  checkCollisions();

  bullets = bullets.filter(b=>b.alive);
  enemies = enemies.filter(e=>e.alive);
  particles = particles.filter(p=>p.alive);

  // ผ่านด่าน
  if (enemies.length===0){
    wave++;
    document.getElementById("wave").textContent = "ระลอก: " + wave;
    // เติมพลังเล็กน้อยทุกด่าน
    if (player.lives < 3) { player.lives++; document.getElementById("lives").textContent = "พลังชีวิต: " + player.lives; }
    spawnWave();
  }
  document.getElementById("score").textContent = "คะแนน: " + player.score;
  document.getElementById("lives").textContent = "พลังชีวิต: " + player.lives;
}

function draw(){
  // พื้นหลัง
  ctx.clearRect(0,0,W,H);
  // ดวงดาว
  ctx.save();
  for (let i=0;i<60;i++){
    const x = (i*83 % W);
    const y = ((i*197 + performance.now()*0.04) % H);
    ctx.fillStyle = i%5===0 ? "#ffffff" : "#9fb8ff22";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  particles.forEach(p=>p.draw());
  enemies.forEach(e=>e.draw());
  bullets.forEach(b=>b.draw());
  player.draw();
}

function frame(t){
  if (!running) return;
  const dt = Math.min(0.033, (t - lastTime)/1000);
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function start(){
  reset();
  running = true;
  lastTime = performance.now();
  document.getElementById("start-screen").classList.remove("visible");
  document.getElementById("game-over").classList.remove("visible");
  requestAnimationFrame(frame);
}

function gameOver(){
  running = false;
  document.getElementById("final-score").textContent = "คุณทำคะแนนได้ " + player.score;
  document.getElementById("game-over").classList.add("visible");
}

document.getElementById("start-btn").addEventListener("click", start);
document.getElementById("restart-btn").addEventListener("click", start);

// เริ่มด้วยหน้าสตาร์ท
document.getElementById("start-screen").classList.add("visible"); if(isMobile()){ document.querySelector(".hint").textContent="แตะปุ่ม ◀ ● ▶ เพื่อเล่นบนมือถือ"; }
