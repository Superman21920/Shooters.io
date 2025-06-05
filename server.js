const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game state
const players = new Map();
const bullets = new Map();
const food = new Map();
const gameConfig = {
  worldWidth: 2000,
  worldHeight: 2000,
  maxFood: 100,
  foodRespawnRate: 0.02
};

// Generate initial food
function generateFood() {
  for (let i = 0; i < gameConfig.maxFood; i++) {
    const foodId = 'food_' + Math.random().toString(36).substr(2, 9);
    food.set(foodId, {
      id: foodId,
      x: Math.random() * gameConfig.worldWidth,
      y: Math.random() * gameConfig.worldHeight,
      size: Math.random() * 8 + 4,
      color: ['#FFD700', '#FF6347', '#32CD32', '#1E90FF'][Math.floor(Math.random() * 4)],
      exp: Math.floor(Math.random() * 5) + 1
    });
  }
}

function calculateLevel(exp) {
  return Math.floor(Math.sqrt(exp / 100)) + 1;
}

function calculateMaxHealth(level) {
  return 100 + (level - 1) * 20;
}

function checkCollision(a, b, aRadius, bRadius) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (aRadius + bRadius);
}

// Initialize food
generateFood();

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Create new player
  const newPlayer = {
    id: socket.id,
    x: Math.random() * gameConfig.worldWidth,
    y: Math.random() * gameConfig.worldHeight,
    angle: 0,
    size: 25,
    health: 100,
    maxHealth: 100,
    exp: 0,
    level: 1,
    score: 0,
    speed: 3,
    color: '#' + Math.floor(Math.random()*16777215).toString(16),
    lastShot: 0,
    name: `Tank${Math.floor(Math.random() * 1000)}`
  };

  players.set(socket.id, newPlayer);

  // Send initial game state to new player
  socket.emit('init', {
    player: newPlayer,
    players: Array.from(players.values()),
    food: Array.from(food.values()),
    gameConfig
  });

  // Broadcast new player to others
  socket.broadcast.emit('playerJoined', newPlayer);

  // Handle player movement
  socket.on('move', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    // Validate and update position
    const newX = Math.max(player.size, Math.min(gameConfig.worldWidth - player.size, data.x));
    const newY = Math.max(player.size, Math.min(gameConfig.worldHeight - player.size, data.y));
    
    player.x = newX;
    player.y = newY;
    player.angle = data.angle;

    // Broadcast position update
    io.emit('playerMoved', {
      id: socket.id,
      x: player.x,
      y: player.y,
      angle: player.angle
    });
  });

  // Handle shooting
  socket.on('shoot', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    const now = Date.now();
    if (now - player.lastShot < 200) return; // Rate limiting

    player.lastShot = now;

    const bulletId = 'bullet_' + Math.random().toString(36).substr(2, 9);
    const bullet = {
      id: bulletId,
      x: player.x + Math.cos(player.angle) * (player.size + 10),
      y: player.y + Math.sin(player.angle) * (player.size + 10),
      vx: Math.cos(player.angle) * 8,
      vy: Math.sin(player.angle) * 8,
      ownerId: socket.id,
      damage: 10 + player.level * 2,
      size: 4,
      life: 100
    };

    bullets.set(bulletId, bullet);
    io.emit('bulletFired', bullet);
  });

  // Handle player name change
  socket.on('changeName', (name) => {
    const player = players.get(socket.id);
    if (player && name && name.length <= 20) {
      player.name = name.substring(0, 20);
      io.emit('playerUpdated', player);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    players.delete(socket.id);
    io.emit('playerLeft', socket.id);
  });
});

// Game loop
setInterval(() => {
  // Update bullets
  for (const [bulletId, bullet] of bullets) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.life--;

    // Remove bullets that are out of bounds or expired
    if (bullet.x < 0 || bullet.x > gameConfig.worldWidth || 
        bullet.y < 0 || bullet.y > gameConfig.worldHeight || 
        bullet.life <= 0) {
      bullets.delete(bulletId);
      io.emit('bulletDestroyed', bulletId);
      continue;
    }

    // Check bullet collision with food
    for (const [foodId, foodItem] of food) {
      if (checkCollision(bullet, foodItem, bullet.size, foodItem.size)) {
        bullets.delete(bulletId);
        food.delete(foodId);
        
        const shooter = players.get(bullet.ownerId);
        if (shooter) {
          shooter.exp += foodItem.exp;
          shooter.score += foodItem.exp * 10;
          
          const newLevel = calculateLevel(shooter.exp);
          if (newLevel > shooter.level) {
            shooter.level = newLevel;
            shooter.maxHealth = calculateMaxHealth(newLevel);
            shooter.health = shooter.maxHealth;
            shooter.size = Math.min(35, 25 + newLevel * 2);
            io.emit('levelUp', { playerId: shooter.id, level: newLevel });
          }
        }

        io.emit('bulletDestroyed', bulletId);
        io.emit('foodDestroyed', foodId);
        break;
      }
    }

    // Check bullet collision with players
    for (const [playerId, player] of players) {
      if (playerId === bullet.ownerId) continue;
      
      if (checkCollision(bullet, player, bullet.size, player.size)) {
        bullets.delete(bulletId);
        player.health -= bullet.damage;
        
        if (player.health <= 0) {
          // Player died
          const shooter = players.get(bullet.ownerId);
          if (shooter) {
            shooter.exp += player.level * 25;
            shooter.score += player.level * 100;
            
            const newLevel = calculateLevel(shooter.exp);
            if (newLevel > shooter.level) {
              shooter.level = newLevel;
              shooter.maxHealth = calculateMaxHealth(newLevel);
              shooter.health = shooter.maxHealth;
              shooter.size = Math.min(35, 25 + newLevel * 2);
              io.emit('levelUp', { playerId: shooter.id, level: newLevel });
            }
          }
          
          // Respawn player
          player.health = player.maxHealth;
          player.x = Math.random() * gameConfig.worldWidth;
          player.y = Math.random() * gameConfig.worldHeight;
          player.exp = Math.max(0, player.exp - Math.floor(player.exp * 0.1));
          player.level = calculateLevel(player.exp);
          player.size = Math.min(35, 25 + player.level * 2);
          
          io.emit('playerDied', { 
            playerId: playerId, 
            killerId: bullet.ownerId,
            newPos: { x: player.x, y: player.y }
          });
        }
        
        io.emit('bulletDestroyed', bulletId);
        io.emit('playerHit', { playerId: playerId, health: player.health });
        break;
      }
    }
  }

  // Respawn food
  if (food.size < gameConfig.maxFood && Math.random() < gameConfig.foodRespawnRate) {
    const foodId = 'food_' + Math.random().toString(36).substr(2, 9);
    const newFood = {
      id: foodId,
      x: Math.random() * gameConfig.worldWidth,
      y: Math.random() * gameConfig.worldHeight,
      size: Math.random() * 8 + 4,
      color: ['#FFD700', '#FF6347', '#32CD32', '#1E90FF'][Math.floor(Math.random() * 4)],
      exp: Math.floor(Math.random() * 5) + 1
    };
    food.set(foodId, newFood);
    io.emit('foodSpawned', newFood);
  }

  // Send game state update
  io.emit('gameUpdate', {
    players: Array.from(players.values()),
    bullets: Array.from(bullets.values())
  });

}, 1000 / 60); // 60 FPS

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Diep.io RPG server running on port ${PORT}`);
  console.log('Install dependencies: npm install express socket.io');
});

module.exports = app;