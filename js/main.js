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
    const PLAYER_TOP_Y = 140; // Player anchored near the top for inverted flow (slightly lower to keep on-screen)
    const JUMP_HEIGHT = 90; // Reduced to prevent leaving the viewport during jump
    const JUMP_DURATION = 400;

    // Virtual canvas dimensions for consistent gameplay scaling
    const BASE_WIDTH = 960;
    const BASE_HEIGHT = 540;

    // Perspective parameters (fisheye-ish)
    const LANE_SCALE_TOP = 0.6;   // lanes tighter near the top
    const LANE_SCALE_BOTTOM = 1.6; // lanes wider near the bottom
    const LANE_SCALE_EXP = 1.2;   // curvature exponent

    function laneScaleAtY(y) {
        // Anchor perspective to the screen (camera-relative) so the road top always matches
        const screenY = y + (camera ? camera.y : 0);
        const t = Math.min(1, Math.max(0, screenY / BASE_HEIGHT));
        const k = Math.pow(t, LANE_SCALE_EXP);
        return LANE_SCALE_TOP + (LANE_SCALE_BOTTOM - LANE_SCALE_TOP) * k;
    }
    function laneCenterXAtY(laneIndex, y) {
        return BASE_WIDTH / 2 + lanes[laneIndex] * laneScaleAtY(y);
    }
    function sizeScaleAtY(y) {
        // Use same scale as lanes for simple depth cue
        return laneScaleAtY(y);
    }

    // Road edges computed to remain parallel to lane curves at any y
    function roadEdgesAtY(y) {
        const s = laneScaleAtY(y);
        const leftCenter = laneCenterXAtY(0, y);
        const rightCenter = laneCenterXAtY(2, y);
        const halfSpanCenters = (rightCenter - leftCenter) / 2; // ~150*s
        const outerHalfLane = (LANE_WIDTH * s) / 2; // ~75*s
        const shoulder = (LANE_WIDTH * 0.25) * s; // ~37.5*s for a small shoulder
        const halfTotal = halfSpanCenters + outerHalfLane + shoulder; // ~262.5*s
        const mid = BASE_WIDTH / 2;
        return { left: mid - halfTotal, right: mid + halfTotal };
    }



    // View transform state (computed from actual canvas size)
    let view = { scale: 1, offsetX: 0, offsetY: 0 };
    // Camera for vertical following (base units)
    let camera = { y: 0 };

    function updateViewTransform() {
        const scaleX = canvas.width / BASE_WIDTH;
        const scaleY = canvas.height / BASE_HEIGHT;
        // Fit entire game into canvas with letterboxing
        view.scale = Math.min(scaleX, scaleY);
        const drawW = BASE_WIDTH * view.scale;
        const drawH = BASE_HEIGHT * view.scale;
        view.offsetX = (canvas.width - drawW) / 2;
        view.offsetY = (canvas.height - drawH) / 2;
    }

    function layoutUI() {
        // Place and scale UI overlays to match the inner (letterboxed) draw area
        const containerRect = container.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const innerLeft = (canvasRect.left - containerRect.left) + view.offsetX;
        const innerTop = (canvasRect.top - containerRect.top) + view.offsetY;
        const drawW = BASE_WIDTH * view.scale;
        const drawH = BASE_HEIGHT * view.scale;
        // UI scale should track the canvas view scale directly so it always matches the playfield size
        const s = Math.min(1.0, Math.max(0.2, view.scale));

        // Score at top center of draw area
        scoreDisplay.style.position = 'absolute';
        scoreDisplay.style.left = `${innerLeft + drawW / 2}px`;
        scoreDisplay.style.top = `${innerTop + 8 * s}px`;
        scoreDisplay.style.transform = `translateX(-50%) scale(${s})`;
        scoreDisplay.style.transformOrigin = 'top center';

        // Flavours at top-left of draw area
        flavourDisplay.style.position = 'absolute';
        flavourDisplay.style.left = `${innerLeft + 8 * s}px`;
        flavourDisplay.style.top = `${innerTop + 56 * s}px`;
        flavourDisplay.style.transform = `scale(${s})`;
        flavourDisplay.style.transformOrigin = 'top left';

        // Powerups at top-right of draw area (responsive)
        powerupDisplay.style.position = 'absolute';
        powerupDisplay.style.left = `${innerLeft + drawW - 8 * s}px`;
        powerupDisplay.style.top = `${innerTop + 56 * s}px`;
        powerupDisplay.style.transform = `translateX(-100%) scale(${s})`;
        powerupDisplay.style.transformOrigin = 'top right';
        powerupDisplay.style.display = 'flex';
        powerupDisplay.style.flexDirection = 'column';
        powerupDisplay.style.gap = `${6 * s}px`;
        powerupDisplay.style.maxWidth = `${240 * s}px`;
        powerupDisplay.style.alignItems = 'flex-end';

        // Center modals within draw area
        const centerModal = (el) => {
            el.style.position = 'absolute';
            el.style.left = `${innerLeft + drawW / 2}px`;
            el.style.top = `${innerTop + drawH / 2}px`;
            el.style.transform = `translate(-50%, -50%) scale(${s})`;
            el.style.transformOrigin = 'center';
        };
        centerModal(startMenu);
        centerModal(gameOverMenu);
    }

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
        y: PLAYER_TOP_Y,
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
    const MIN_COLLECTIBLE_SPAWN = 1800; // faster spawn to enable trio
    const MAX_COLLECTIBLE_SPAWN = 3500;

    // Road animation offset for dashed lines (in base px along path)
    let roadDashOffset = 0;

    // Resize canvas to target default size (960x540) and scale to fit smaller containers
    function resizeCanvas() {
        const availableW = container.clientWidth;
        const availableH = container.clientHeight;
        // Default to 960x540 unless the container is smaller
        canvas.width = Math.min(availableW, 960);
        canvas.height = Math.min(availableH, 540);
        // Keep gameplay coordinates in BASE space; only drawing is scaled
        player.y = PLAYER_TOP_Y;
        player.x = laneCenterXAtY(player.lane, player.y);
        player.targetLaneX = player.x;
        updateViewTransform();
        layoutUI();
    }
    window.addEventListener('resize', () => { resizeCanvas(); });
    resizeCanvas();

    function createParallax() {
        // No longer used; background drawn procedurally in drawRoadBackground(). Keeping placeholder.
        parallaxLayers = [];
    }
    createParallax();

    function resetGame() {
        score = 0;
        gameSpeed = 240;
        player.lane = 1;
        player.isJumping = false;
        player.jumpStart = 0;
        player.yOffset = 0;
        player.y = PLAYER_TOP_Y;
        player.x = laneCenterXAtY(player.lane, player.y);
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
        layoutUI();
        gameLoop = requestAnimationFrame(animate);
    }

    window.restartGame = function() {
        startMenu.style.display = 'none';
        gameOverMenu.style.display = 'none';
        resetGame();
        gameState = 'playing';
        lastTime = performance.now();
        layoutUI();
        gameLoop = requestAnimationFrame(animate);
    }

    function generateObstacle() {
        const lane = Math.floor(Math.random() * 3);
        const type = Math.floor(Math.random() * 6);
        const obstacleTypes = ['pothole', 'hurdle', 'cone', 'crate', 'barrel', 'manhole'];
        const obs = {
            lane: lane,
            y: BASE_HEIGHT + 100,
            width: 40,
            height: 40,
            type: obstacleTypes[type]
        };
        // x is derived each frame from lane & y (perspective)
        obstacles.push(obs);
    }

    function generateCollectible() {
        // Bias towards missing flavours to help achieve the trio
        const all = ['hot-sauce', 'gochujang', 'chilli-lime'];
        const missing = all.filter(t => !collectedFlavours.has(t));
        const pool = missing.length > 0 ? missing : all;
        const lane = Math.floor(Math.random() * 3);
        const type = pool[Math.floor(Math.random() * pool.length)];
        const col = {
            lane: lane,
            y: BASE_HEIGHT + 100,
            width: 25,
            height: 25,
            type: type
        };
        // x is derived each frame from lane & y (perspective)
        collectibles.push(col);
    }

    function update() {
        if (gameState !== 'playing') return;

        const currentTime = performance.now();
        deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // Speed ramp up
        gameSpeed = Math.min(MAX_SPEED, 240 + (currentTime / SPEED_RAMP_DURATION) * (MAX_SPEED - 240));
        // Animate road dashes to match world flow (downwards toward bottom)
        roadDashOffset += (gameSpeed / 1000) * deltaTime;

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

        // Camera follow (moved here so timing is consistent with world updates)
        const playerScreenY = player.y - player.yOffset;
        const marginTop = 30;
        const desiredCam = Math.max(0, PLAYER_TOP_Y - playerScreenY + marginTop);
        const prevCamY = camera.y;
        camera.y += (desiredCam - camera.y) * 0.15;
        // Keep ground flowing even if camera follows the player (avoid pause illusion)
        roadDashOffset += (camera.y - prevCamY);
        
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
            col.y -= (gameSpeed / 1000) * deltaTime; // move upward
            // derive x from lane/y for perspective
            col.x = laneCenterXAtY(col.lane, col.y);
            if (powerups['chilli-lime'].active) {
                const dist = Math.hypot(player.x - col.x, (player.y - player.yOffset) - col.y);
                const mr = powerups['chilli-lime'].radius || 135;
                if (dist < mr) {
                    // Pull toward player primarily along the lane direction (y axis)
                    col.y += ((player.y - player.yOffset) - col.y) / 10;
                }
                // Re-stick to lane center every frame so it never drifts off the road curve
                col.x = laneCenterXAtY(col.lane, col.y);
            }
            if (col.y < -50) {
                collectibles.splice(i, 1);
            } else if (checkCollision(player, col)) {
                sfx['pickup'].triggerAttackRelease('C5', '8n');
                score += 250;
                if (col.type === 'hot-sauce') {
                    powerups['hot-sauce'].active = true;
                    powerups['hot-sauce'].cooldown = powerups['hot-sauce'].duration;
                    gameSpeed += 2; // Tangy Hot Sauce → Speed Burst (+2, 7s)
                } else if (col.type === 'gochujang') {
                    powerups['gochujang'].active = true;
                    powerups['gochujang'].cooldown = powerups['gochujang'].duration; // Shield 1 hit
                } else if (col.type === 'chilli-lime') {
                    powerups['chilli-lime'].active = true;
                    powerups['chilli-lime'].cooldown = powerups['chilli-lime'].duration;
                    // Randomize magnet radius within 120–135 px
                    powerups['chilli-lime'].radius = 120 + Math.random()*15;
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
            obs.y -= (gameSpeed / 1000) * deltaTime; // move upward
            // derive x from lane/y for perspective
            obs.x = laneCenterXAtY(obs.lane, obs.y);
            if (obs.y < -50) {
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
        // Update player lane x based on perspective at current y
        player.targetLaneX = laneCenterXAtY(player.lane, player.y);
    }

    function checkCollision(obj1, obj2) {
        // Circle-vs-circle collision with perspective-scaled radii
        const pY = obj1.y - obj1.yOffset;
        const pScale = sizeScaleAtY(pY) || 1;
        const pRadius = 18 * pScale; // approx for chilli emoji

        const oScale = sizeScaleAtY(obj2.y) || 1;
        const baseSize = Math.max(obj2.width || 30, obj2.height || 30);
        const oRadius = (baseSize * 0.5) * oScale;

        const dx = (obj1.x) - (obj2.x);
        const dy = pY - (obj2.y);
        const r = pRadius + oRadius;
        return (dx*dx + dy*dy) <= (r*r);
    }

    function draw() {
        // Reset transform and clear actual canvas pixels
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Apply view transform to draw in BASE coordinate space
        ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
        // Viewport mask anchored to the canvas (pre-camera) so content never bleeds outside
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        ctx.clip();
        // Fill viewport background before camera translation to avoid any visible bar at the top
        ctx.fillStyle = '#0f1012';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
        // Apply camera vertical follow AFTER masking so road beyond the top/bottom is hidden
        ctx.translate(0, camera.y);
        
        drawRoadBackground();

        // Draw collectibles with perspective scale
        collectibles.forEach(col => {
            const offset = powerups['chilli-lime'].active ? Math.sin(performance.now()/100) * 5 : 0;
            const s = sizeScaleAtY(col.y);
            ctx.save();
            const cx = laneCenterXAtY(col.lane, col.y);
            ctx.translate(cx, col.y + offset);
            ctx.scale(s, s);
            ctx.font = '30px serif';
            ctx.textAlign = 'center';
            if (col.type === 'hot-sauce') { ctx.fillText('🔥', 0, 0); }
            if (col.type === 'gochujang') { ctx.fillText('🌶️', 0, 0); }
            if (col.type === 'chilli-lime') { ctx.fillText('🍋', 0, 0); }
            ctx.restore();
        });

        // Draw obstacles with perspective scale
        obstacles.forEach(obs => {
            const s = sizeScaleAtY(obs.y);
            ctx.save();
            const ox = laneCenterXAtY(obs.lane, obs.y);
            ctx.translate(ox, obs.y);
            ctx.scale(s, s);
            ctx.fillStyle = '#554433';
            // Hurdle/barrier vs pothole rendering
            if (obs.type === 'pothole' || obs.type === 'manhole') {
                ctx.beginPath();
                ctx.ellipse(0, 0, obs.width/2, obs.height/3, 0, 0, Math.PI*2);
                ctx.fillStyle = '#2a2a2a';
                ctx.fill();
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                // Scale barrier to lane width at this y for aesthetics
                const lw = (obs.lane === 2) ? (laneCenterXAtY(2, obs.y) - laneCenterXAtY(1, obs.y))
                                            : (laneCenterXAtY(1, obs.y) - laneCenterXAtY(0, obs.y));
                const postScaleWidth = lw * 0.9; // 90% of lane width
                const drawWidth = postScaleWidth / s; // convert to pre-scale width
                const drawHeight = 32 / s; // taller barrier appearance
                ctx.fillStyle = '#7a5a3a';
                ctx.fillRect(-drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
                ctx.fillStyle = '#9b7b52';
                ctx.fillRect(-drawWidth/2, -drawHeight/2 - 8/s, drawWidth, 8/s); // top lip
            }
            ctx.restore();
        });

        // Draw player at top (running towards camera)
        ctx.save();
        ctx.translate(player.x, player.y - player.yOffset);
        const ps = sizeScaleAtY(player.y);
        ctx.scale(ps, ps);
        ctx.font = '50px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌶️', 0, 0);
        ctx.restore();
        
        // Draw shield if active
        if (powerups['gochujang'].active) {
            ctx.save();
            ctx.translate(player.x, player.y - player.yOffset - 10);
            const ps = sizeScaleAtY(player.y);
            ctx.scale(ps, ps);
            ctx.beginPath();
            ctx.arc(0, 0, 35, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.restore();
        }

        // Draw magnet aura
        if (powerups['chilli-lime'].active) {
            const magnetRadius = 135;
            ctx.save();
            ctx.translate(player.x, player.y - player.yOffset - 10);
            const ps = sizeScaleAtY(player.y);
            ctx.scale(ps, ps);
            ctx.beginPath();
            ctx.arc(0, 0, magnetRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(208, 227, 80, 0.5)';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.restore();
        }

        updateScoreDisplay();
        // Update UI every frame to respond to scale/camera smoothly
        layoutUI();
        // Restore viewport clip
        ctx.restore();
    }

    function drawRoadBackground() {
        // Background outside the road (dark)
        ctx.fillStyle = '#0f1012';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Road edges sampled from lane-parallel edges so the road stays parallel to lanes
        const bottomY = BASE_HEIGHT * 2; // extend far below
        const topY = -BASE_HEIGHT;      // extend far above
        const midX = BASE_WIDTH / 2;

        ctx.save();
        ctx.beginPath();
        let first = true;
        for (let y = topY; y <= bottomY; y += 20) {
            const e = roadEdgesAtY(y);
            if (first) { ctx.moveTo(e.left, y); first = false; } else { ctx.lineTo(e.left, y); }
        }
        for (let y = bottomY; y >= topY; y -= 20) {
            const e = roadEdgesAtY(y);
            ctx.lineTo(e.right, y);
        }
        ctx.closePath();
        const roadGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
        roadGrad.addColorStop(0, '#5c6063');
        roadGrad.addColorStop(1, '#2f3336');
        ctx.fillStyle = roadGrad;
        ctx.fill();

        // Clip to road for shadows and lane markings
        ctx.clip();

        // Subtle vignette to add depth
        const vignette = ctx.createRadialGradient(midX, BASE_HEIGHT * 0.7, BASE_WIDTH * 0.2, midX, BASE_HEIGHT * 0.7, BASE_WIDTH * 0.8);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        // Dashed lane separators (between lanes, not mid-lane)
        // Dashed lane separators (between lanes, not mid-lane)
        ctx.setLineDash([50, 30]); // 50px dash, 30px gap
        ctx.lineDashOffset = roadDashOffset; // animate
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 2; i++) { // separators: between lane 0-1 and 1-2
            ctx.beginPath();
            let first = true;
            for (let y = topY; y <= bottomY; y += 10) {
                const xL = laneCenterXAtY(i, y);
                const xR = laneCenterXAtY(i + 1, y);
                const x = (xL + xR) / 2; // separator between lanes
                if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
            }
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Side scenery along the road edges, parallel to the lanes, evenly spaced
        const period = 180;
        const offset = roadDashOffset % period;
        for (let y = topY - period; y <= bottomY + period; y += period) {
            const yy = y - offset; // upward flow like obstacles/lanes
            const edges = roadEdgesAtY(yy);
            const s = sizeScaleAtY(yy);
            const insideInset = 10 * s; // draw just inside the road so it isn't clipped

            // Left-side building hugging the edge
            ctx.save();
            ctx.translate(edges.left + insideInset, yy);
            ctx.scale(s, s);
            ctx.fillStyle = '#3b3f46';
            ctx.fillRect(-40, -80, 80, 120);
            ctx.fillStyle = '#70757d';
            for (let wy = 0; wy < 4; wy++) {
                for (let wx = 0; wx < 3; wx++) {
                    ctx.fillRect(-30 + wx*20, -70 + wy*24, 12, 16);
                }
            }
            ctx.restore();

            // Right-side building hugging the edge
            ctx.save();
            ctx.translate(edges.right - insideInset, yy);
            ctx.scale(s, s);
            ctx.fillStyle = '#444953';
            ctx.fillRect(-45, -100, 90, 140);
            ctx.fillStyle = '#7a808a';
            for (let wy = 0; wy < 5; wy++) {
                for (let wx = 0; wx < 2; wx++) {
                    ctx.fillRect(-35 + wx*30, -85 + wy*24, 14, 16);
                }
            }
            ctx.restore();

            // Trees placed just inside edges
            ctx.save();
            ctx.translate(edges.left + insideInset + 20*s, yy);
            ctx.scale(s, s);
            ctx.fillStyle = '#2e5b2a';
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.translate(edges.right - insideInset - 20*s, yy + 10*s);
            ctx.scale(s, s);
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI*2);
            ctx.fillStyle = '#2e5b2a';
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
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
        layoutUI();
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
    let touchStartTime = 0;
    
    // Mouse input variables
    let mousedownX = 0;
    let mousedownY = 0;
    let mouseDownTime = 0;

    function gestureThresholdPx() {
        // Dynamic threshold scaled to the current on-screen size
        const t = Math.max(8, Math.min(50, 35 * view.scale));
        return t;
    }

    function handleGesture(startX, endX, startY, endY, durationMs) {
        const swipeThreshold = gestureThresholdPx();
        const diffX = endX - startX;
        const diffY = endY - startY;

        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);

        // Quick tap/jab to jump (short, mostly vertical gesture)
        const quickTap = durationMs !== undefined && durationMs < 220 && absX < swipeThreshold * 0.6 && absY < swipeThreshold * 0.6;

        if (quickTap) {
            jump();
            return;
        }

        if (absX > absY) {
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
        const t = e.changedTouches[0];
        touchstartX = t.clientX;
        touchstartY = t.clientY;
        touchStartTime = performance.now();
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        const t = e.changedTouches[0];
        touchendX = t.clientX;
        touchendY = t.clientY;
        const dur = performance.now() - touchStartTime;
        handleGesture(touchstartX, touchendX, touchstartY, touchendY, dur);
        e.preventDefault();
    }, { passive: false });

    // Mouse events
    canvas.addEventListener('mousedown', e => {
        mousedownX = e.clientX;
        mousedownY = e.clientY;
        mouseDownTime = performance.now();
    });

    canvas.addEventListener('mouseup', e => {
        if (gameState !== 'playing') return;
        const dur = performance.now() - mouseDownTime;
        handleGesture(mousedownX, e.clientX, mousedownY, e.clientY, dur);
    });

    // Keyboard support for desktop
    window.addEventListener('keydown', (e) => {
        if (gameState !== 'playing') return;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            e.preventDefault();
            jump();
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            moveLeft();
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            moveRight();
        }
    });

    function moveLeft() {
        if (player.lane > 0) {
            sfx['woosh'].triggerAttackRelease('8n');
            player.lane--;
            player.targetLaneX = laneCenterXAtY(player.lane, player.y);
        }
    }
    function moveRight() {
        if (player.lane < 2) {
            sfx['woosh'].triggerAttackRelease('8n');
            player.lane++;
            player.targetLaneX = laneCenterXAtY(player.lane, player.y);
        }
    }
    function jump() {
        if (!player.isJumping) {
            player.isJumping = true;
            player.jumpStart = performance.now();
        }
    }
    
    // Smooth lane transition (recompute target for current y curvature)
    function updatePlayerPosition() {
        const desired = laneCenterXAtY(player.lane, player.y);
        if (Math.abs(player.targetLaneX - desired) > 0.1) {
            player.targetLaneX = desired;
        }
        if (Math.abs(player.x - player.targetLaneX) > 1) {
            player.x += (player.targetLaneX - player.x) * 0.1;
        }
        // Camera follow handled in update() for stable timing
        requestAnimationFrame(updatePlayerPosition);
    }
    updatePlayerPosition();
};
