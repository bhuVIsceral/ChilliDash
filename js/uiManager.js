import { Config } from './config.js';

export class UIManager {
    constructor() {
        this.container = document.getElementById('game-container');
        this.canvas = document.getElementById('gameCanvas');
        this.scoreValue = document.getElementById('score-value');
        this.livesContainer = document.getElementById('lives-container');
        this.livesMultiplier = document.getElementById('lives-multiplier');
        this.startMenu = document.getElementById('startMenu');
        this.gameOverMenu = document.getElementById('gameOverMenu');
        this.finalScore = document.getElementById('finalScore');
        this.header = document.getElementById('header');
        this.gameStats = document.getElementById('game-stats');
        this.powerupCards = document.getElementById('powerup-cards');
        this.controlsContainer = document.getElementById('controls-container');
        
        this.leftBtn = document.getElementById('left-btn');
        this.rightBtn = document.getElementById('right-btn');
        this.jumpBtn = document.getElementById('jump-btn');
        
        this.powerupCardElements = {
            'chillies-x2': document.getElementById('powerup-card-chillies-x2'),
            'speed-boost': document.getElementById('powerup-card-speed-boost'),
            'magnet': document.getElementById('powerup-card-magnet'),
        };

        document.getElementById('startButton').onclick = () => this.onStart();
        document.getElementById('restartButton').onclick = () => this.onRestart();
        document.getElementById('mute-btn').onclick = () => this.onMuteToggle();
        
        this.onStart = () => {};
        this.onRestart = () => {};
        this.onMuteToggle = () => {};
    }

    showStartMenu() {
        this.startMenu.style.display = 'block';
        this.gameOverMenu.style.display = 'none';
        this.layoutUI(1.0);
    }

    showGameOverMenu(score) {
        this.finalScore.textContent = Math.floor(score);
        this.startMenu.style.display = 'none';
        this.gameOverMenu.style.display = 'block';
    }

    hideMenus() {
        this.startMenu.style.display = 'none';
        this.gameOverMenu.style.display = 'none';
    }

    updateScore(score) { this.scoreValue.textContent = Math.floor(score); }
    
    updateLives(lives, maxLives) {
        this.livesContainer.innerHTML = '';
        for (let i = 0; i < maxLives; i++) {
            const chilli = document.createElement('div');
            chilli.className = 'life-chilli';
            if (i >= lives) chilli.classList.add('lost');
            chilli.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.04,1.44c-0.4-0.89-1.68-0.89-2.08,0C9.6,3.62,7.72,4.4,6.4,5.92C4.24,8.21,5.33,12,8.4,13.67 c2.1,1.15,4.8,1.3,7.1-0.2c2.61-1.72,3.39-5.18,2-7.58C16.48,4.2,14.71,2.94,13.04,1.44z"/></svg>`;
            this.livesContainer.appendChild(chilli);
        }
    }

    updatePowerups(activePowerups) {
        this.livesMultiplier.style.display = 'none';
        for (const key in this.powerupCardElements) {
            const card = this.powerupCardElements[key];
            const powerup = activePowerups.find(p => p.key === key);
            const progress = card.querySelector('.powerup-progress');
            if (powerup) {
                card.classList.add('active');
                progress.style.width = `${(powerup.cooldown / powerup.duration) * 100}%`;
                if(key === 'chillies-x2') this.livesMultiplier.style.display = 'block';
            } else {
                card.classList.remove('active');
                progress.style.width = '0%';
            }
        }
    }

    triggerHitEffect() {
        this.container.classList.add('hit-pause-fx');
        setTimeout(() => this.container.classList.remove('hit-pause-fx'), 100);
        this.container.classList.add('screen-shake-fx');
        setTimeout(() => this.container.classList.remove('screen-shake-fx'), 120);
    }
    
    layoutUI(viewScale, viewOffsetX = 0, viewOffsetY = 0) {
        const containerRect = this.container.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        const innerLeft = (canvasRect.left - containerRect.left) + viewOffsetX;
        const innerTop = (canvasRect.top - containerRect.top) + viewOffsetY;
        const drawW = Config.GAME_BASE_WIDTH * viewScale;
        const drawH = Config.GAME_BASE_HEIGHT * viewScale;
        const s = Math.min(1.0, Math.max(0.2, viewScale));

        const applyStyle = (el, styles) => Object.assign(el.style, styles);
        
        applyStyle(this.header, {
            position: 'absolute', width: `${drawW}px`, left: `${innerLeft + drawW / 2}px`, top: `${innerTop}px`,
            transform: `translateX(-50%) scale(${s})`, transformOrigin: 'top center',
        });

        applyStyle(this.gameStats, {
            position: 'absolute', width: `${drawW}px`, left: `${innerLeft + drawW / 2}px`, top: `${innerTop + 60 * s}px`,
            transform: `translateX(-50%) scale(${s})`, transformOrigin: 'top center',
        });
        
        const bottomOffset = (containerRect.bottom - canvasRect.bottom) + viewOffsetY;
        
        applyStyle(this.powerupCards, {
            position: 'absolute', width: `${drawW}px`, left: `${innerLeft + drawW / 2}px`, 
            bottom: `${bottomOffset + 120 * s}px`,
            transform: `translateX(-50%) scale(${s})`, transformOrigin: 'bottom center',
        });

        applyStyle(this.controlsContainer, {
            position: 'absolute', width: `${drawW}px`, left: `${innerLeft + drawW / 2}px`,
            bottom: `${bottomOffset + 20 * s}px`,
            transform: `translateX(-50%) scale(${s})`, transformOrigin: 'bottom center',
        });
        
        const centerModal = (el) => applyStyle(el, {
            position: 'absolute', left: `${innerLeft + drawW / 2}px`, top: `${innerTop + drawH / 2}px`,
            transform: `translate(-50%, -50%) scale(${s})`, transformOrigin: 'center',
        });
        
        centerModal(this.startMenu);
        centerModal(this.gameOverMenu);
    }
}
