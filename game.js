const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentDistanceEl = document.getElementById("currentDistance");
const bestDistanceEl = document.getElementById("bestDistance");
const speedValueEl = document.getElementById("speedValue");
const startOverlayEl = document.getElementById("startOverlay");
const gameOverOverlayEl = document.getElementById("gameOverOverlay");
const finalDistanceTextEl = document.getElementById("finalDistanceText");
const sceneBadgeEl = document.getElementById("sceneBadge");
const controlBadgeEl = document.getElementById("controlBadge");

const BEST_SCORE_KEY = "dino-runner-best-distance-v1";
const SCENES = [
  { id: "desert", name: "沙漠", start: 0 },
  { id: "city", name: "城市", start: 750 },
  { id: "sea", name: "海上", start: 1500 },
  { id: "air", name: "空中", start: 2250 }
];

const keys = {
  jump: false,
  duck: false,
  boost: false
};

const state = {
  phase: "ready",
  width: 1280,
  height: 720,
  dpr: 1,
  groundY: 0,
  distance: 0,
  bestDistance: Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10) || 0,
  time: 0,
  cameraX: 0,
  speed: 320,
  lastTimestamp: 0,
  nextObstacleAt: 540,
  nextBoatAt: 0,
  obstacles: [],
  boats: [],
  particles: [],
  scene: SCENES[0],
  dayPhase: "白天",
  dino: {
    x: 0,
    y: 0,
    width: 48,
    height: 58,
    velocityY: 0,
    onGround: true,
    ducking: false,
    paddleTimer: 0,
    heliVelocity: 0
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function formatDistance(distance) {
  return String(Math.floor(distance)).padStart(4, "0");
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  state.width = Math.max(320, Math.floor(rect.width));
  state.height = Math.max(380, Math.floor(rect.height));
  state.groundY = Math.floor(state.height * 0.74);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  state.dino.x = Math.floor(state.width * 0.18);
  if (state.phase !== "running") {
    state.dino.y = state.groundY - state.dino.height;
  }
}

function sceneForDistance(distance) {
  let scene = SCENES[0];
  for (const item of SCENES) {
    if (distance >= item.start) {
      scene = item;
    }
  }
  return scene;
}

function updateHud() {
  currentDistanceEl.textContent = formatDistance(state.distance);
  bestDistanceEl.textContent = formatDistance(state.bestDistance);
  const displayedSpeed = state.phase === "running" ? state.speed : 0;
  speedValueEl.textContent = String(Math.round(displayedSpeed * 0.72)).padStart(3, "0");
  sceneBadgeEl.textContent = `${state.scene.name} / ${state.dayPhase}`;

  if (state.scene.id === "air") {
    controlBadgeEl.textContent = "J 上升 · S 下降 · K 加速";
  } else if (state.scene.id === "sea") {
    controlBadgeEl.textContent = "J 跳船 · S 压低 · K 划桨加速";
  } else {
    controlBadgeEl.textContent = "J 跳跃 · S 蹲下 · K 加速";
  }
}

function setOverlayVisibility(element, visible) {
  element.classList.toggle("overlay-visible", visible);
}

function resetGame() {
  state.phase = "running";
  state.distance = 0;
  state.time = 0;
  state.cameraX = 0;
  state.speed = 320;
  state.nextObstacleAt = 560;
  state.nextBoatAt = 0;
  state.obstacles = [];
  state.boats = [];
  state.particles = [];
  state.scene = SCENES[0];
  state.dayPhase = "白天";
  state.dino.y = state.groundY - state.dino.height;
  state.dino.velocityY = 0;
  state.dino.heliVelocity = 0;
  state.dino.onGround = true;
  state.dino.ducking = false;
  state.dino.paddleTimer = 0;
  setOverlayVisibility(startOverlayEl, false);
  setOverlayVisibility(gameOverOverlayEl, false);
  seedBoats();
  updateHud();
}

function endRun() {
  if (state.phase !== "running") {
    return;
  }

  state.phase = "gameover";
  const score = Math.floor(state.distance);
  state.bestDistance = Math.max(state.bestDistance, score);
  localStorage.setItem(BEST_SCORE_KEY, String(state.bestDistance));
  finalDistanceTextEl.textContent = `本局前进 ${score} m`;
  setOverlayVisibility(gameOverOverlayEl, true);
  spawnParticles(state.dino.x + 24, state.dino.y + 28, 24);
  updateHud();
}

function seedBoats() {
  state.boats = [];
  state.nextBoatAt = state.cameraX - 80;
  while (state.nextBoatAt < state.cameraX + state.width * 2) {
    addBoat();
  }
}

function addBoat() {
  const width = random(94, 150);
  const gap = random(70, 135);
  state.boats.push({
    x: state.nextBoatAt,
    y: state.groundY - 16,
    width,
    height: 22
  });
  state.nextBoatAt += width + gap;
}

function spawnParticles(x, y, count) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-180, 130),
      vy: random(-260, -60),
      age: 0,
      life: random(0.35, 0.8),
      size: random(2, 4)
    });
  }
}

function obstacleTypeForScene() {
  if (state.scene.id === "sea") {
    return "whale";
  }
  if (state.scene.id === "air") {
    return Math.random() < 0.56 ? "balloon" : "cloud-rock";
  }
  if (Math.random() < 0.34) {
    return "bird";
  }
  if (Math.random() < 0.2) {
    return "overhead";
  }
  return "cactus";
}

function addObstacle() {
  const type = obstacleTypeForScene();
  const obstacle = { type, x: state.cameraX + state.width + random(20, 160) };

  if (type === "cactus") {
    obstacle.width = random(28, 52);
    obstacle.height = random(46, 76);
    obstacle.y = state.groundY - obstacle.height;
  } else if (type === "bird") {
    obstacle.width = 46;
    obstacle.height = 28;
    obstacle.y = state.groundY - random(120, 182);
  } else if (type === "overhead") {
    obstacle.width = random(54, 82);
    obstacle.height = 34;
    obstacle.y = state.groundY - 92;
  } else if (type === "whale") {
    obstacle.width = random(82, 112);
    obstacle.height = random(44, 58);
    obstacle.y = state.groundY - obstacle.height - 6;
  } else if (type === "balloon") {
    obstacle.width = 48;
    obstacle.height = 68;
    obstacle.y = random(state.height * 0.22, state.height * 0.58);
  } else {
    obstacle.width = random(72, 118);
    obstacle.height = random(42, 64);
    obstacle.y = random(state.height * 0.18, state.height * 0.64);
  }

  state.obstacles.push(obstacle);
  state.nextObstacleAt = state.cameraX + random(330, 560) - Math.min(120, state.distance * 0.02);
}

function updateScene() {
  state.scene = sceneForDistance(state.distance);
  state.dayPhase = Math.floor(state.distance / 520) % 2 === 0 ? "白天" : "黑夜";
  if (state.scene.id === "sea" && state.boats.length < 2) {
    seedBoats();
  }
}

function jump() {
  if (state.scene.id === "air") {
    state.dino.heliVelocity = -360;
    return;
  }

  if (state.dino.onGround) {
    state.dino.velocityY = -700;
    state.dino.onGround = false;
  }
}

function updateDino(dt) {
  const dino = state.dino;
  dino.ducking = keys.duck && state.scene.id !== "air";
  dino.paddleTimer = Math.max(0, dino.paddleTimer - dt);

  if (state.scene.id === "air") {
    const desired = keys.jump ? -420 : keys.duck ? 380 : 65;
    dino.heliVelocity += (desired - dino.heliVelocity) * Math.min(1, dt * 5.2);
    dino.y += dino.heliVelocity * dt;
    dino.y = clamp(dino.y, state.height * 0.14, state.height * 0.68);
    dino.onGround = false;
    return;
  }

  dino.velocityY += 2100 * dt;
  dino.velocityY = clamp(dino.velocityY, -760, 900);
  dino.y += dino.velocityY * dt;

  const floorY = state.scene.id === "sea" ? getBoatFloorY() : state.groundY;
  if (dino.y + dino.height >= floorY) {
    dino.y = floorY - dino.height;
    dino.velocityY = 0;
    dino.onGround = true;
  } else {
    dino.onGround = false;
  }

  if (state.scene.id === "sea" && !dino.onGround && dino.y > state.groundY + 20) {
    endRun();
  }
}

function getBoatFloorY() {
  const feetX = state.cameraX + state.dino.x + state.dino.width * 0.5;
  for (const boat of state.boats) {
    if (feetX >= boat.x - 8 && feetX <= boat.x + boat.width + 8) {
      return boat.y;
    }
  }
  return state.groundY + 120;
}

function getDinoBounds() {
  const dino = state.dino;
  if (state.scene.id === "air") {
    return {
      x: dino.x - 10,
      y: dino.y - 18,
      width: 94,
      height: 48
    };
  }

  if (dino.ducking) {
    return {
      x: dino.x + 6,
      y: dino.y + 24,
      width: 54,
      height: 34
    };
  }

  return {
    x: dino.x + 4,
    y: dino.y + 5,
    width: 52,
    height: 53
  };
}

function intersects(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function checkCollision() {
  const dinoBounds = getDinoBounds();

  for (const obstacle of state.obstacles) {
    const screenBounds = {
      x: obstacle.x - state.cameraX,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height
    };
    if (intersects(dinoBounds, screenBounds)) {
      return true;
    }
  }

  return false;
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 700 * dt;
    return particle.age < particle.life;
  });
}

function updateRunning(dt) {
  state.time += dt;
  updateScene();

  const boost = keys.boost ? 130 : 0;
  if (keys.boost && state.scene.id === "sea") {
    state.dino.paddleTimer = 0.18;
  }
  state.speed = Math.min(690, 320 + state.time * 7.5 + state.distance * 0.026 + boost);
  state.cameraX += state.speed * dt;
  state.distance += state.speed * dt * 0.062;

  if (state.cameraX > state.nextObstacleAt) {
    addObstacle();
  }

  while (state.scene.id === "sea" && state.nextBoatAt < state.cameraX + state.width * 1.8) {
    addBoat();
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > state.cameraX - 120);
  state.boats = state.boats.filter((boat) => boat.x + boat.width > state.cameraX - 160);

  updateDino(dt);
  updateParticles(dt);

  if (checkCollision()) {
    endRun();
  }

  updateHud();
}

function drawBackground() {
  const night = state.dayPhase === "黑夜";
  const sceneId = state.scene.id;
  ctx.fillStyle = night ? "#111111" : "#ffffff";
  ctx.fillRect(0, 0, state.width, state.height);

  if (sceneId === "sea") {
    ctx.fillStyle = night ? "#102433" : "#dff5ff";
    ctx.fillRect(0, state.groundY - 34, state.width, state.height - state.groundY + 34);
  } else if (sceneId === "air") {
    ctx.fillStyle = night ? "#171a28" : "#eef9ff";
    ctx.fillRect(0, 0, state.width, state.height);
  }

  drawSkyMarker(night);
  drawParallax(sceneId, night);
}

function drawSkyMarker(night) {
  const x = state.width - 112;
  const y = 78;
  ctx.strokeStyle = night ? "#ffffff" : "#222222";
  ctx.fillStyle = night ? "#ffffff" : "#222222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  if (night) {
    ctx.stroke();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(x + 11, y - 7, 22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 34, y + Math.sin(angle) * 34);
      ctx.lineTo(x + Math.cos(angle) * 46, y + Math.sin(angle) * 46);
      ctx.stroke();
    }
  }
}

function drawParallax(sceneId, night) {
  ctx.strokeStyle = night ? "rgba(255,255,255,0.38)" : "rgba(34,34,34,0.28)";
  ctx.lineWidth = 2;

  if (sceneId === "city") {
    const baseY = state.groundY;
    for (let i = 0; i < 12; i += 1) {
      const x = ((i * 118 - state.cameraX * 0.32) % (state.width + 180)) - 90;
      const h = 62 + (i % 4) * 24;
      ctx.strokeRect(x, baseY - h, 72, h);
      for (let w = 0; w < 3; w += 1) {
        ctx.strokeRect(x + 12 + w * 18, baseY - h + 16, 8, 10);
      }
    }
  } else if (sceneId === "desert") {
    for (let i = 0; i < 7; i += 1) {
      const x = ((i * 210 - state.cameraX * 0.16) % (state.width + 240)) - 100;
      const y = state.groundY - 80 - (i % 2) * 18;
      ctx.beginPath();
      ctx.moveTo(x, y + 50);
      ctx.lineTo(x + 58, y);
      ctx.lineTo(x + 124, y + 50);
      ctx.stroke();
    }
  } else if (sceneId === "air") {
    for (let i = 0; i < 6; i += 1) {
      const x = ((i * 230 - state.cameraX * 0.18) % (state.width + 260)) - 120;
      const y = 90 + (i % 3) * 70;
      drawCloud(x, y, night ? "rgba(255,255,255,0.3)" : "rgba(34,34,34,0.18)");
    }
  }
}

function drawGround() {
  const night = state.dayPhase === "黑夜";
  ctx.strokeStyle = night ? "#ffffff" : "#222222";
  ctx.lineWidth = 3;

  if (state.scene.id === "air") {
    return;
  }

  if (state.scene.id === "sea") {
    for (let x = -40; x < state.width + 60; x += 42) {
      const waveX = x - (state.cameraX % 42);
      ctx.beginPath();
      ctx.arc(waveX, state.groundY + 8, 22, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  ctx.beginPath();
  ctx.moveTo(0, state.groundY);
  ctx.lineTo(state.width, state.groundY);
  ctx.stroke();

  for (let x = -30; x < state.width + 30; x += 34) {
    const pebbleX = x - (state.cameraX % 34);
    ctx.beginPath();
    ctx.moveTo(pebbleX, state.groundY + 18);
    ctx.lineTo(pebbleX + 12, state.groundY + 18);
    ctx.stroke();
  }
}

function drawBoats() {
  if (state.scene.id !== "sea") {
    return;
  }

  const ink = state.dayPhase === "黑夜" ? "#ffffff" : "#222222";
  ctx.strokeStyle = ink;
  ctx.fillStyle = state.dayPhase === "黑夜" ? "#111111" : "#ffffff";
  ctx.lineWidth = 3;

  for (const boat of state.boats) {
    const x = boat.x - state.cameraX;
    ctx.beginPath();
    ctx.moveTo(x, boat.y);
    ctx.lineTo(x + boat.width, boat.y);
    ctx.lineTo(x + boat.width - 22, boat.y + boat.height);
    ctx.lineTo(x + 18, boat.y + boat.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawObstacles() {
  const ink = state.dayPhase === "黑夜" ? "#ffffff" : "#222222";
  ctx.strokeStyle = ink;
  ctx.fillStyle = state.dayPhase === "黑夜" ? "#111111" : "#ffffff";
  ctx.lineWidth = 3;

  for (const obstacle of state.obstacles) {
    const x = obstacle.x - state.cameraX;
    if (obstacle.type === "cactus") {
      drawCactus(x, obstacle.y, obstacle.width, obstacle.height);
    } else if (obstacle.type === "bird") {
      drawBird(x, obstacle.y, obstacle.width, obstacle.height);
    } else if (obstacle.type === "overhead") {
      ctx.strokeRect(x, obstacle.y, obstacle.width, obstacle.height);
      ctx.beginPath();
      ctx.moveTo(x + 9, obstacle.y + obstacle.height);
      ctx.lineTo(x + 22, obstacle.y + obstacle.height + 18);
      ctx.moveTo(x + obstacle.width - 9, obstacle.y + obstacle.height);
      ctx.lineTo(x + obstacle.width - 22, obstacle.y + obstacle.height + 18);
      ctx.stroke();
    } else if (obstacle.type === "whale") {
      drawWhale(x, obstacle.y, obstacle.width, obstacle.height);
    } else if (obstacle.type === "balloon") {
      ctx.beginPath();
      ctx.ellipse(x + obstacle.width / 2, obstacle.y + 22, 22, 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(x + 14, obstacle.y + 54, 20, 12);
      ctx.beginPath();
      ctx.moveTo(x + 18, obstacle.y + 48);
      ctx.lineTo(x + 14, obstacle.y + 54);
      ctx.moveTo(x + 30, obstacle.y + 48);
      ctx.lineTo(x + 34, obstacle.y + 54);
      ctx.stroke();
    } else {
      drawCloud(x, obstacle.y + 20, ink);
    }
  }
}

function drawCactus(x, y, width, height) {
  ctx.strokeRect(x + width * 0.38, y, width * 0.26, height);
  ctx.strokeRect(x + width * 0.05, y + height * 0.38, width * 0.34, height * 0.18);
  ctx.strokeRect(x + width * 0.62, y + height * 0.25, width * 0.32, height * 0.18);
}

function drawBird(x, y, width, height) {
  const flap = Math.sin(state.time * 12 + x * 0.03) * 8;
  ctx.beginPath();
  ctx.moveTo(x, y + height / 2);
  ctx.quadraticCurveTo(x + width * 0.25, y - flap, x + width * 0.5, y + height / 2);
  ctx.quadraticCurveTo(x + width * 0.75, y + flap, x + width, y + height / 2);
  ctx.stroke();
}

function drawWhale(x, y, width, height) {
  ctx.beginPath();
  ctx.ellipse(x + width * 0.48, y + height * 0.55, width * 0.43, height * 0.45, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(x + width * 0.94, y + height * 0.66);
  ctx.lineTo(x + width, y + height * 0.45);
  ctx.moveTo(x + width * 0.18, y + height * 0.5);
  ctx.lineTo(x + width * 0.05, y + height * 0.28);
  ctx.moveTo(x + width * 0.18, y + height * 0.5);
  ctx.lineTo(x + width * 0.03, y + height * 0.74);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + width * 0.64, y + height * 0.36, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(x, y, color) {
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 22, Math.PI, Math.PI * 1.9);
  ctx.arc(x + 24, y - 10, 24, Math.PI * 1.1, Math.PI * 1.95);
  ctx.arc(x + 54, y, 22, Math.PI * 1.15, Math.PI * 2);
  ctx.moveTo(x, y + 1);
  ctx.lineTo(x + 56, y + 1);
  ctx.stroke();
}

function drawDino() {
  if (state.scene.id === "air") {
    drawHeliDino();
    return;
  }

  const dino = state.dino;
  const ink = state.dayPhase === "黑夜" ? "#ffffff" : "#222222";
  ctx.save();
  ctx.translate(dino.x, dino.y);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;

  if (dino.ducking) {
    ctx.fillRect(2, 28, 62, 24);
    ctx.fillRect(48, 16, 25, 24);
    ctx.fillRect(9, 50, 12, 20);
    ctx.fillRect(39, 50, 12, 20);
    ctx.fillRect(-12, 32, 18, 9);
    ctx.fillStyle = state.dayPhase === "黑夜" ? "#111111" : "#ffffff";
    ctx.fillRect(62, 23, 4, 4);
  } else {
    ctx.fillRect(10, 18, 34, 38);
    ctx.fillRect(36, 4, 26, 24);
    ctx.fillRect(0, 28, 14, 10);
    ctx.fillRect(18, 54, 10, 22);
    ctx.fillRect(38, 54, 10, 18);
    ctx.fillRect(30, 33, 20, 7);
    ctx.fillStyle = state.dayPhase === "黑夜" ? "#111111" : "#ffffff";
    ctx.fillRect(53, 10, 4, 4);
  }

  if (state.scene.id === "sea") {
    ctx.strokeStyle = ink;
    ctx.beginPath();
    if (dino.paddleTimer > 0) {
      ctx.moveTo(57, 45);
      ctx.lineTo(82, 68);
      ctx.lineTo(94, 68);
    } else {
      ctx.moveTo(54, 44);
      ctx.lineTo(78, 43);
      ctx.lineTo(88, 50);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawHeliDino() {
  const dino = state.dino;
  const ink = state.dayPhase === "黑夜" ? "#ffffff" : "#222222";
  ctx.save();
  ctx.translate(dino.x + 28, dino.y);
  ctx.strokeStyle = ink;
  ctx.fillStyle = state.dayPhase === "黑夜" ? "#111111" : "#ffffff";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.ellipse(18, 0, 42, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeRect(0, 16, 36, 9);
  ctx.beginPath();
  ctx.moveTo(48, -2);
  ctx.lineTo(78, -15);
  ctx.lineTo(80, 8);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8, -20);
  ctx.lineTo(-8, -36);
  ctx.moveTo(-52, -38);
  ctx.lineTo(36, -38);
  ctx.moveTo(-8, -48);
  ctx.lineTo(-8, -28);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.fillRect(6, -5, 13, 15);
  ctx.fillRect(17, -12, 14, 13);
  ctx.fillStyle = state.dayPhase === "黑夜" ? "#111111" : "#ffffff";
  ctx.fillRect(26, -8, 3, 3);
  ctx.restore();
}

function drawParticles() {
  const ink = state.dayPhase === "黑夜" ? "#ffffff" : "#222222";
  ctx.fillStyle = ink;
  for (const particle of state.particles) {
    const alpha = 1 - particle.age / particle.life;
    ctx.globalAlpha = alpha;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, state.width, state.height);
  drawBackground();
  drawGround();
  drawBoats();
  drawObstacles();
  drawDino();
  drawParticles();
}

function loop(timestamp) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }

  const dt = Math.min(0.032, (timestamp - state.lastTimestamp) / 1000);
  state.lastTimestamp = timestamp;

  if (state.phase === "running") {
    updateRunning(dt);
  } else {
    updateParticles(dt);
  }

  render();
  window.requestAnimationFrame(loop);
}

function handleKeyDown(event) {
  if (event.repeat) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (state.phase === "ready" || state.phase === "gameover") {
      resetGame();
    }
    return;
  }

  if (event.code === "KeyJ" || event.code === "ArrowUp") {
    event.preventDefault();
    keys.jump = true;
    if (state.phase === "running") {
      jump();
    }
  } else if (event.code === "KeyS" || event.code === "ArrowDown") {
    event.preventDefault();
    keys.duck = true;
  } else if (event.code === "KeyK" || event.code === "ArrowRight") {
    event.preventDefault();
    keys.boost = true;
    if (state.scene.id === "sea") {
      state.dino.paddleTimer = 0.18;
    }
  }
}

function handleKeyUp(event) {
  if (event.code === "KeyJ" || event.code === "ArrowUp") {
    keys.jump = false;
  } else if (event.code === "KeyS" || event.code === "ArrowDown") {
    keys.duck = false;
  } else if (event.code === "KeyK" || event.code === "ArrowRight") {
    keys.boost = false;
  } else if (event.code === "Space") {
    event.preventDefault();
  }
}

function boot() {
  resizeCanvas();
  state.scene = SCENES[0];
  state.dayPhase = "白天";
  updateHud();
  setOverlayVisibility(startOverlayEl, true);
  setOverlayVisibility(gameOverOverlayEl, false);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.__dinoRunner = {
    start: resetGame,
    jump,
    setDuck(value) {
      keys.duck = Boolean(value);
    },
    setBoost(value) {
      keys.boost = Boolean(value);
    },
    snapshot() {
      return {
        phase: state.phase,
        distance: Math.floor(state.distance),
        speed: Math.round(state.speed),
        scene: state.scene.id,
        dayPhase: state.dayPhase,
        obstacleCount: state.obstacles.length,
        boatCount: state.boats.length,
        dinoY: Math.round(state.dino.y),
        onGround: state.dino.onGround
      };
    }
  };
  window.requestAnimationFrame(loop);
}

boot();
