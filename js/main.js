import { Config } from './config.js';
import { AudioManager } from './audioManager.js';
import { UIManager } from './uiManager.js';
import { InputManager } from './inputManager.js';
import { Renderer } from './renderer.js';
import { Player } from './player.js';
import { PowerupManager } from './powerupManager.js';
import { EntityManager } from './entityManager.js';

// Simple Asset Loader
function loadAssets(assetPaths) {
    const promises = Object.entries(assetPaths).map(([key, path]) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ key, img });
            img.onerror = reject;
            img.src = path;
        });
    });

    return Promise.all(promises).then(results => {
        return results.reduce((assets, { key, img }) => {
            assets[key] = img;
            return assets;
        }, {});
    });
}


class Game {
    constructor(assets) {
        this.canvas = document.getElementById('gameCanvas');
        this.assets = assets; // Store loaded assets
        this.gameState = 'start';
        this.score = 0;
        this.lives = Config.MAX_LIVES;
        this.gameSpeed = Config.INITIAL_GAME_SPEED;
        
        this.audioManager = new AudioManager();
        this.uiManager = new UIManager();
        this.inputManager = new InputManager(this.canvas);
        // Pass the loaded assets to the renderer
        this.renderer = new Renderer(this.canvas, this.assets);
        this.player = new Player(this.audioManager);
        this.powerupManager = new PowerupManager();
        this.entityManager = new EntityManager();

        this.setupEventHandlers();
        this.uiManager.showStartMenu();
    }
    
    setupEventHandlers() {
        this.uiManager.onStart = this.startGame.bind(this);
        this.uiManager.onRestart = this.startGame.bind(this);
        this.uiManager.onMuteToggle = () => {
            const isMuted = this.audioManager.toggleMute();
            document.getElementById('mute-btn').innerHTML = isMuted ? '&#128263;' : '&#128266;';
        };
        
        this.inputManager.addEventListener('moveLeft', () => { if(this.gameState === 'playing') this.player.moveLeft(); });
        this.inputManager.addEventListener('moveRight', () => { if(this.gameState === 'playing') this.player.moveRight(); });
        this.inputManager.addEventListener('jump', () => { if(this.gameState === 'playing') this.player.jump(); });
        
        this.uiManager.leftBtn.onclick = () => { if(this.gameState === 'playing') this.player.moveLeft(); };
        this.uiManager.rightBtn.onclick = () => { if(this.gameState === 'playing') this.player.moveRight(); };
        this.uiManager.jumpBtn.onclick = () => { if(this.gameState === 'playing') this.player.jump(); };
    }

    startGame() {
        this.audioManager.startContext();
        this.reset();
        this.gameState = 'playing';
        this.startTime = performance.now();
        this.lastTime = this.startTime;
        this.uiManager.hideMenus();
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    reset() {
        this.score = 0;
        this.lives = Config.MAX_LIVES;
        this.gameSpeed = Config.INITIAL_GAME_SPEED;
        this.player.reset();
        this.powerupManager.reset();
        this.entityManager.reset();
        this.uiManager.updateScore(0);
        this.uiManager.updateLives(this.lives, Config.MAX_LIVES);
    }
    
    gameLoop(currentTime) {
        if (this.gameState !== 'playing') return;
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(deltaTime, currentTime);
        this.renderer.draw({ player: this.player, entityManager: this.entityManager });
        this.uiManager.layoutUI(this.renderer.view.scale, this.renderer.view.offsetX, this.renderer.view.offsetY);

        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    update(deltaTime, currentTime) {
        const elapsed = currentTime - this.startTime;
        const speedProgress = Math.min(1, elapsed / Config.SPEED_RAMP_DURATION);
        let currentSpeed = Config.INITIAL_GAME_SPEED + (Config.MAX_GAME_SPEED - Config.INITIAL_GAME_SPEED) * speedProgress;
        if (this.powerupManager.isActive('speed-boost')) currentSpeed *= 1.5;
        this.gameSpeed = currentSpeed;
        
        this.player.update(deltaTime, this.renderer.perspective, this.gameSpeed);
        this.powerupManager.update(deltaTime);
        this.entityManager.update(deltaTime, this.gameSpeed, this.player, this.powerupManager, this.renderer.perspective);
        
        const collisionEvents = this.entityManager.checkCollisions(this.player, this.powerupManager, this.renderer.perspective);
        this.handleCollisions(collisionEvents);
        
        this.uiManager.updateScore(this.score);
        this.uiManager.updatePowerups(this.powerupManager.getActivePowerups());
        this.uiManager.updateLives(this.lives, Config.MAX_LIVES);
    }
    
    handleCollisions(events) {
        events.forEach(event => {
            switch(event.type) {
                case 'obstacle-hit':
                    this.audioManager.play('fail', 'C3', '2n');
                    this.uiManager.triggerHitEffect();
                    this.lives--;
                    if (this.lives <= 0) this.endGame();
                    break;
                case 'collect':
                    this.audioManager.play('pickup', 'C5', '8n');
                    if (event.collectibleType === 'chilli') {
                        const multiplier = this.powerupManager.isActive('chillies-x2') ? 2 : 1;
                        this.score += Config.CHILLI_SCORE * multiplier;
                    } else {
                        this.powerupManager.activate(event.collectibleType);
                    }
                    break;
            }
        });
    }

    endGame() {
        this.gameState = 'gameOver';
        this.uiManager.showGameOverMenu(this.score);
    }
}

// =================================================================================
// E N T R Y   P O I N T
// =================================================================================
window.onload = () => {
    const assetPaths = {
        playerFrame1: './assets/player_frame_1.svg',
        playerFrame2: './assets/player_frame_2.svg'
    };

    // Show a loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.textContent = 'Loading...';
    loadingMessage.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 2rem; color: white;';
    document.getElementById('game-container').appendChild(loadingMessage);

    loadAssets(assetPaths)
        .then(assets => {
            // Hide loading message and start the game
            loadingMessage.remove();
            new Game(assets);
        })
        .catch(error => {
            console.error("Error loading assets:", error);
            loadingMessage.textContent = 'Error loading assets. Please try refreshing.';
        });
};

