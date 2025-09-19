window.onload = function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('game-container');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const flavourDisplay = document.getElementById('flavourDisplay');
    const powerupDisplay = document.getElementById('powerupDisplay');
    const startMenu = document.getElementById('startMenu');
    const gameOverMenu = document.getElementById('gameOverMenu');
    const finalScore = document.getElementById('finalScore');

    let gameLoop, lastTime, deltaTime;
    let gameState = 'start';
    let score = 0;
    let gameSpeed = 240;
    const MAX_SPEED = 520;
    const SPEED_RAMP_DURATION = 45000;
    const lanes = [-150, 0, 150];
    const LANE_WIDTH = 150;
    const PLAYER_Y = 150;
    const JUMP_HEIGHT = 150;
    const JUMP_DURATION = 400;

    let collectedFlavours = new Set();
    const chilliTrioBonus = 1000;

    const powerups = {
        'hot-sauce': { name: 'Speed Burst', color: '#FF5733', duration: 7000, active: false, cooldown: 0 },
        'gochujang': { name: 'Shield', color: '#C70039', duration: 7000, active: false, cooldown: 0 },
        'chilli-lime': { name: 'Magnet', color: '#D0E350', duration: 7000, active: false, cooldown: 0 },
    };

    const sfx = {
        'pickup': new Tone.Synth().toDestination(),
        'shield-hit': new Tone.NoiseSynth().toDestination(),
        'fail': new Tone.MembraneSynth().toDestination(),
        'woosh': new Tone.NoiseSynth().toDestination(),
    };
    sfx['pickup'].envelope.attack = 0.01;
    sfx['pickup'].envelope.release = 0.1;
    sfx['pickup'].oscillator.type = 'triangle';

    sfx['shield-hit'].envelope.attack = 0.005;
    sfx['shield-hit'].envelope.decay = 0.1;
    sfx['shield-hit'].envelope.sustain = 0;

    sfx['fail'].envelope.attack = 0.02;
    sfx['fail'].envelope.decay = 0.5;
    sfx['fail'].envelope.sustain = 0;

    sfx['woosh'].envelope.attack = 0.01;
    sfx['woosh'].envelope.decay = 0.2;
    sfx['woosh'].envelope.sustain = 0;

    // Game objects
    let player = {
        x: 0,
        y: PLAYER_Y,
        width: 30,
        height: 50,
        lane: 1,
        isJumping: false,
        jumpStart: 0,
        yOffset: 0,
        targetLaneX: 0
    };

    let obstacles = [];
    let collectibles = [];
    let parallaxLayers = [];
    let particles = [];
    let nextObstacleTime = 0;
    let nextCollectibleTime = 0;
    let screenShake = 0;

    const MIN_OBSTACLE_SPAWN = 1000;
    const MAX_OBSTACLE_SPAWN = 2500;
    const MIN_COLLECTIBLE_SPAWN = 3000;
    const MAX_COLLECTIBLE_SPAWN = 7000;

    // Resize canvas to fit window
    function resizeCanvas() {
        canvas.width = Math.min(container.clientWidth, 600);
        canvas.height = Math.min(container.clientHeight, 800);
        player.x = canvas.width / 2;
        player.y = canvas.height - PLAYER_Y;
        player.targetLaneX = player.x;
        // Parallax layers will be drawn relative to canvas size
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function createParallax() {
        parallaxLayers = [
            { y: canvas.height - 50, height: 50, color: '#3a3a3a', speed: 0.1 }, // Ground
            { y: canvas.height - 150, height: 100, color: '#4a4a4a', speed: 0.15 }, // Back wall
            { y: canvas.height - 250, height: 100, color: '#5a5a5a', speed: 0.2 }, // Top wall
            // Faking kitchen counters/shelves
            { y: canvas.height - 200, height: 20, color: '#6a6a6a', speed: 0.3 },
            { y: canvas.height - 300, height: 20, color: '#6a6a6a', speed: 0.4 },
        ];
    }
    createParallax();

    function resetGame() {
        score = 0;
        gameSpeed = 240;
        player.lane = 1;
        player.isJumping = false;
        player.jumpStart = 0;
        player.yOffset = 0;
        player.x = canvas.width / 2;
        player.targetLaneX = player.x;
        obstacles = [];
        collectibles = [];
        collectedFlavours.clear();
        for (const key in powerups) {
            powerups[key].active = false;
        }
        updatePowerupDisplay();
        updateFlavourDisplay();
        nextObstacleTime = 0;
        nextCollectibleTime = 0;
    }

    window.startGame = function() {
        startMenu.style.display = 'none';
        gameOverMenu.style.display = 'none';
        resetGame();
        gameState = 'playing';
        lastTime = performance.now();
        gameLoop = requestAnimationFrame(animate);
    }

    window.restartGame = function() {
        startMenu.style.display = 'none';
        gameOverMenu.style.display = 'none';
        resetGame();
        gameState = 'playing';
        lastTime = performance.now();
        gameLoop = requestAnimationFrame(animate);
    }

    function generateObstacle() {
        const lane = Math.floor(Math.random() * 3);
        const type = Math.floor(Math.random() * 6);
        const obstacleTypes = ['oil', 'pan', 'knife', 'crate', 'jar', 'steam'];
        const obs = {
            x: canvas.width / 2 + lanes[lane],
            y: -100,
            width: 40,
            height: 40,
            lane: lane,
            type: obstacleTypes[type]
        };
        obstacles.push(obs);
    }

    function generateCollectible() {
        const lane = Math.floor(Math.random() * 3);
        const type = Math.floor(Math.random() * 3);
        const collectibleTypes = ['hot-sauce', 'gochujang', 'chilli-lime'];
        const col = {
            x: canvas.width / 2 + lanes[lane],
            y: -100,
            width: 25,
            height: 25,
            lane: lane,
            type: collectibleTypes[type]
        };
        collectibles.push(col);
    }

    function update() {
        if (gameState !== 'playing') return;

        const currentTime = performance.now();
        deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // Speed ramp up
        gameSpeed = Math.min(MAX_SPEED, 240 + (currentTime / SPEED_RAMP_DURATION) * (MAX_SPEED - 240));

        // Update player jump
        if (player.isJumping) {
            const timeElapsed = currentTime - player.jumpStart;
            const jumpProgress = timeElapsed / JUMP_DURATION;
            if (jumpProgress >= 1) {
                player.isJumping = false;
                player.yOffset = 0;
            } else {
                player.yOffset = JUMP_HEIGHT * Math.sin(jumpProgress * Math.PI);
            }
        }
        
        // Update power-up timers
        for(const key in powerups) {
            if(powerups[key].active) {
                powerups[key].cooldown -= deltaTime;
                if(powerups[key].cooldown <= 0) {
                    powerups[key].active = false;
                }
            }
        }
        updatePowerupDisplay();

        // Update collectibles
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const col = collectibles[i];
            col.y += (gameSpeed / 1000) * deltaTime;
            if (powerups['chilli-lime'].active) {
                const dist = Math.hypot(player.x - col.x, (player.y - player.yOffset) - col.y);
                if (dist < 135) {
                    col.x += (player.x - col.x) / 10;
                    col.y += ((player.y - player.yOffset) - col.y) / 10;
                }
            }
            if (col.y > canvas.height + 50) {
                collectibles.splice(i, 1);
            } else if (checkCollision(player, col)) {
                sfx['pickup'].triggerAttackRelease('C5', '8n');
                score += 250;
                if (col.type === 'hot-sauce') {
                    powerups['hot-sauce'].active = true;
                    powerups['hot-sauce'].cooldown = powerups['hot-sauce'].duration;
                    gameSpeed += 2; // Speed burst
                } else if (col.type === 'gochujang') {
                    powerups['gochujang'].active = true;
                    powerups['gochujang'].cooldown = powerups['gochujang'].duration;
                } else if (col.type === 'chilli-lime') {
                    powerups['chilli-lime'].active = true;
                    powerups['chilli-lime'].cooldown = powerups['chilli-lime'].duration;
                }
                collectedFlavours.add(col.type);
                if (collectedFlavours.size === 3) {
                    score += chilliTrioBonus;
                }
                updateFlavourDisplay();
                collectibles.splice(i, 1);
            }
        }

        // Update obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.y += (gameSpeed / 1000) * deltaTime;
            if (obs.y > canvas.height + 50) {
                obstacles.splice(i, 1);
            } else if (checkCollision(player, obs) && !player.isJumping) {
                if (powerups['gochujang'].active) {
                    sfx['shield-hit'].triggerAttackRelease('8n', 0.5);
                    powerups['gochujang'].active = false;
                    obstacles.splice(i, 1);
                } else {
                    sfx['fail'].triggerAttackRelease('C3', '2n');
                    endGame();
                }
                container.classList.add('hit-pause-fx');
                setTimeout(() => container.classList.remove('hit-pause-fx'), 100);
                container.classList.add('screen-shake-fx');
                setTimeout(() => container.classList.remove('screen-shake-fx'), 120);
            }
        }

        // Generate new obstacles
        nextObstacleTime -= deltaTime;
        if (nextObstacleTime <= 0) {
            generateObstacle();
            nextObstacleTime = Math.random() * (MAX_OBSTACLE_SPAWN - MIN_OBSTACLE_SPAWN) + MIN_OBSTACLE_SPAWN;
        }

        // Generate new collectibles
        nextCollectibleTime -= deltaTime;
        if (nextCollectibleTime <= 0) {
            generateCollectible();
            nextCollectibleTime = Math.random() * (MAX_COLLECTIBLE_SPAWN - MIN_COLLECTIBLE_SPAWN) + MIN_COLLECTIBLE_SPAWN;
        }
    }

    function checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y - obj1.yOffset < obj2.y + obj2.height &&
               obj1.y - obj1.yOffset + obj1.height > obj2.y;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background lanes
        ctx.fillStyle = '#6a6a6a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#7a7a7a';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(canvas.width/2 + lanes[i] - 1.5*LANE_WIDTH, 0, LANE_WIDTH, canvas.height);
        }

        // Draw parallax background (faking it)
        ctx.fillStyle = '#222';
        ctx.fillRect(0, canvas.height-100, canvas.width, 100);
        ctx.fillStyle = '#333';
        ctx.fillRect(0, canvas.height-200, canvas.width, 100);

        // Draw collectibles
        collectibles.forEach(col => {
            const offset = powerups['chilli-lime'].active ? Math.sin(performance.now()/100) * 5 : 0;
            ctx.font = '30px serif';
            ctx.textAlign = 'center';
            if (col.type === 'hot-sauce') { ctx.fillText('🔥', col.x, col.y + offset); }
            if (col.type === 'gochujang') { ctx.fillText('🌶️', col.x, col.y + offset); }
            if (col.type === 'chilli-lime') { ctx.fillText('🍋', col.x, col.y + offset); }
        });

        // Draw obstacles
        obstacles.forEach(obs => {
            ctx.fillStyle = 'brown';
            ctx.fillRect(obs.x - obs.width/2, obs.y, obs.width, obs.height);
        });

        // Draw player
        ctx.font = '50px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌶️', player.x, player.y - player.yOffset);
        
        // Draw shield if active
        if (powerups['gochujang'].active) {
            ctx.beginPath();
            ctx.arc(player.x, player.y - player.yOffset - 10, 35, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }

        // Draw magnet aura
        if (powerups['chilli-lime'].active) {
            const magnetRadius = 135;
            ctx.beginPath();
            ctx.arc(player.x, player.y - player.yOffset - 10, magnetRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(208, 227, 80, 0.5)';
            ctx.lineWidth = 5;
            ctx.stroke();
        }

        updateScoreDisplay();
    }

    function updateScoreDisplay() {
        scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
    }

    function updateFlavourDisplay() {
        document.getElementById('flavour1').style.color = collectedFlavours.has('hot-sauce') ? 'var(--brand-orange)' : 'gray';
        document.getElementById('flavour2').style.color = collectedFlavours.has('gochujang') ? 'var(--brand-red)' : 'gray';
        document.getElementById('flavour3').style.color = collectedFlavours.has('chilli-lime') ? 'var(--brand-lime)' : 'gray';
    }

    function updatePowerupDisplay() {
        powerupDisplay.innerHTML = '';
        for(const key in powerups) {
            if(powerups[key].active) {
                const indicator = document.createElement('div');
                indicator.className = `powerup-indicator ${key} active`;
                indicator.textContent = `${powerups[key].name} (${Math.ceil(powerups[key].cooldown/1000)}s)`;
                powerupDisplay.appendChild(indicator);
            }
        }
    }

    function endGame() {
        gameState = 'gameOver';
        cancelAnimationFrame(gameLoop);
        finalScore.textContent = Math.floor(score);
        gameOverMenu.style.display = 'block';
    }

    function animate(currentTime) {
        update();
        draw();
        gameLoop = requestAnimationFrame(animate);
    }

    // Input handling
    let touchstartX = 0;
    let touchendX = 0;
    let touchstartY = 0;
    let touchendY = 0;
    
    // Mouse input variables
    let mousedownX = 0;
    let mousedownY = 0;

    function handleGesture(startX, endX, startY, endY) {
        const swipeThreshold = 50;
        const diffX = endX - startX;
        const diffY = endY - startY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > swipeThreshold) {
                moveRight();
            } else if (diffX < -swipeThreshold) {
                moveLeft();
            }
        } else {
            if (diffY < -swipeThreshold) {
                jump();
            }
        }
    }

    // Touch events
    canvas.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY;
    }, false);

    canvas.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        touchendY = e.changedTouches[0].screenY;
        handleGesture(touchstartX, touchendX, touchstartY, touchendY);
    }, false);

    // Mouse events
    canvas.addEventListener('mousedown', e => {
        mousedownX = e.clientX;
        mousedownY = e.clientY;
    });

    canvas.addEventListener('mouseup', e => {
        if (gameState !== 'playing') return;
        handleGesture(mousedownX, e.clientX, mousedownY, e.clientY);
    });

    function moveLeft() {
        if (player.lane > 0) {
            sfx['woosh'].triggerAttackRelease('8n');
            player.lane--;
            player.targetLaneX = canvas.width / 2 + lanes[player.lane];
        }
    }
    function moveRight() {
        if (player.lane < 2) {
            sfx['woosh'].triggerAttackRelease('8n');
            player.lane++;
            player.targetLaneX = canvas.width / 2 + lanes[player.lane];
        }
    }
    function jump() {
        if (!player.isJumping) {
            player.isJumping = true;
            player.jumpStart = performance.now();
        }
    }
    
    // Smooth lane transition
    function updatePlayerPosition() {
        if (Math.abs(player.x - player.targetLaneX) > 1) {
            player.x += (player.targetLaneX - player.x) * 0.1;
        }
        requestAnimationFrame(updatePlayerPosition);
    }
    updatePlayerPosition();
};
