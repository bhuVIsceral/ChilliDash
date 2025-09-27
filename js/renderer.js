import { Config } from './config.js';

export class Renderer {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assets = assets; // Store the loaded images

        this.view = { scale: 1, offsetX: 0, offsetY: 0 };
        this.perspective = {
            laneScaleAtY: this.laneScaleAtY.bind(this),
            laneCenterXAtY: this.laneCenterXAtY.bind(this),
            sizeScaleAtY: this.sizeScaleAtY.bind(this),
        };
        this.powerupIcons = {};
        this.createPowerupIcons();

        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
    }
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = Math.min(container.clientWidth, Config.GAME_BASE_WIDTH);
        this.canvas.height = Math.min(container.clientHeight, Config.GAME_BASE_HEIGHT);
        const scaleX = this.canvas.width / Config.GAME_BASE_WIDTH;
        const scaleY = this.canvas.height / Config.GAME_BASE_HEIGHT;
        this.view.scale = Math.min(scaleX, scaleY);
        this.view.offsetX = (this.canvas.width - Config.GAME_BASE_WIDTH * this.view.scale) / 2;
        this.view.offsetY = (this.canvas.height - Config.GAME_BASE_HEIGHT * this.view.scale) / 2;
    }
    laneScaleAtY(y) {
        const t = Math.min(1, Math.max(0, y / Config.GAME_BASE_HEIGHT));
        const k = Math.pow(t, Config.PERSPECTIVE.LANE_SCALE_EXP);
        return Config.PERSPECTIVE.LANE_SCALE_TOP + (Config.PERSPECTIVE.LANE_SCALE_BOTTOM - Config.PERSPECTIVE.LANE_SCALE_TOP) * k;
    }
    laneCenterXAtY(laneIndex, y) { return Config.GAME_BASE_WIDTH / 2 + Config.LANES[laneIndex] * this.laneScaleAtY(y); }
    sizeScaleAtY(y) { return this.laneScaleAtY(y); }
    
    draw(gameState) {
        const { player, entityManager } = gameState;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(this.view.scale, 0, 0, this.view.scale, this.view.offsetX, this.view.offsetY);
        
        this.drawRoadBackground();
        const entities = [...entityManager.collectibles, ...entityManager.obstacles].sort((a,b) => a.y - b.y);
        this.drawEntities(entities);
        this.drawPlayer(player);
        this.drawEffects(entityManager.collisionEffects);
    }
    
    drawRoadBackground() {
        this.ctx.fillStyle = '#79bb4a';
        this.ctx.fillRect(0, 0, Config.GAME_BASE_WIDTH, Config.GAME_BASE_HEIGHT);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.lineWidth = 10;
        
        const drawCurvedLine = (lane1, lane2) => {
            this.ctx.beginPath();
            let first = true;
            for (let y = 0; y <= Config.GAME_BASE_HEIGHT; y += 10) {
                const x1 = this.laneCenterXAtY(lane1, y);
                const x2 = this.laneCenterXAtY(lane2, y);
                const midX = x1 + (x2 - x1) / 2;
                if (first) { this.ctx.moveTo(midX, y); first = false; }
                else { this.ctx.lineTo(midX, y); }
            }
            this.ctx.stroke();
        };
        drawCurvedLine(0,1);
        drawCurvedLine(1,2);
    }
    
    drawEntities(entities) {
        entities.forEach(entity => {
            const s = this.sizeScaleAtY(entity.y);
            if (s <= 0) return;
            this.ctx.save();
            this.ctx.translate(entity.x, entity.y);
            this.ctx.scale(s, s);
            if (entity.type === 'chilli') this.drawChilli();
            else if (Config.POWERUPS[entity.type]) this.drawPowerupCan(entity.type);
            else this.drawObstacle(entity);
            this.ctx.restore();
        });
    }

    drawPlayer(player) {
        this.ctx.save();
        this.ctx.translate(player.x, player.y - player.yOffset);
        const s = this.sizeScaleAtY(player.y);
        
        // Use the correct frame from the loaded assets
        const frame = player.animationFrame === 0 ? this.assets.playerFrame1 : this.assets.playerFrame2;
        
        if (frame && frame.complete) {
            // Adjust scaling and positioning for the image
            const aspectRatio = frame.width / frame.height;
            const drawHeight = 200; // Base height for the character
            const drawWidth = drawHeight * aspectRatio;
            
            this.ctx.scale(s, s);
            this.ctx.drawImage(frame, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
        }

        this.ctx.restore();
    }
    
    drawObstacle(obs) {
        switch (obs.type) {
            case 'crate':
                this.ctx.fillStyle = '#a0522d'; this.ctx.strokeStyle = '#5e2f0f';
                this.ctx.lineWidth = 4;
                this.ctx.fillRect(-35, -35, 70, 35); this.ctx.strokeRect(-35, -35, 70, 35);
                this.ctx.font = '12px "Arial Black"'; this.ctx.fillStyle = '#5e2f0f'; this.ctx.textAlign='center';
                this.ctx.fillText('HUNTER', 0, -22); this.ctx.fillText('FOODS', 0, -10);
                break;
            case 'grass':
                this.ctx.fillStyle = '#6b8e23';
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 40, 15, 0, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            case 'flower':
                this.ctx.fillStyle = '#ff69b4';
                for(let i=0; i<5; i++) {
                    this.ctx.beginPath();
                    this.ctx.ellipse(Math.cos(i*Math.PI*2/5)*10, Math.sin(i*Math.PI*2/5)*10, 5, 10, i*Math.PI*2/5, 0, Math.PI*2);
                    this.ctx.fill();
                }
                this.ctx.fillStyle = '#ffd700'; this.ctx.beginPath(); this.ctx.arc(0,0,5,0,Math.PI*2); this.ctx.fill();
                break;
        }
    }
    
    drawChilli() {
        this.ctx.fillStyle = '#d92b28';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -15); this.ctx.quadraticCurveTo(15, 0, 0, 15); this.ctx.quadraticCurveTo(-15, 0, 0, -15);
        this.ctx.fill();
        this.ctx.fillStyle = '#68a43c'; this.ctx.beginPath(); this.ctx.moveTo(0, -14); this.ctx.quadraticCurveTo(5, -19, 8, -15); this.ctx.quadraticCurveTo(3, -16, 0, -14);
        this.ctx.fill();
    }
    
    drawPowerupCan(type) {
        const colors = { 'chillies-x2': '#d92b28', 'speed-boost': '#5994d5', 'magnet': '#f4b41b' };
        this.ctx.fillStyle = '#ccc'; this.ctx.fillRect(-20, -30, 40, 5); this.ctx.fillRect(-20, 0, 40, 5);
        this.ctx.fillStyle = colors[type] || '#888'; this.ctx.fillRect(-20, -25, 40, 25);
        this.ctx.fillStyle = 'white'; this.ctx.textAlign = 'center'; this.ctx.font = '10px "Arial Black"';
        this.ctx.fillText(Config.POWERUPS[type].name.split(' ')[0], 0, -15);
        this.ctx.fillText(Config.POWERUPS[type].name.split(' ')[1], 0, -5);
    }
    
    drawEffects(effects) {
        effects.forEach(e => {
            this.ctx.save();
            this.ctx.translate(e.x, e.y);
            const s = this.sizeScaleAtY(e.y);
            this.ctx.scale(s, s);
            this.ctx.fillStyle = `rgba(255, 235, 59, ${e.life})`;
            this.ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const radius = (1 - e.life) * 50;
                this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    createPowerupIcons() {
        ['chillies-x2', 'speed-boost', 'magnet'].forEach(type => {
            const iconCanvas = document.createElement('canvas');
            iconCanvas.width = 100; iconCanvas.height = 100;
            const iconCtx = iconCanvas.getContext('2d');
            iconCtx.translate(50, 50);
            
            const colors = { 'chillies-x2': '#d92b28', 'speed-boost': '#5994d5', 'magnet': '#f4b41b' };
            iconCtx.fillStyle = '#ccc'; iconCtx.fillRect(-25, -35, 50, 5); iconCtx.fillRect(-25, 5, 50, 5);
            iconCtx.fillStyle = colors[type] || '#888'; iconCtx.fillRect(-25, -30, 50, 35);
            iconCtx.fillStyle = 'white'; iconCtx.textAlign = 'center'; iconCtx.font = '12px "Arial Black"';
            const name = Config.POWERUPS[type].name.split(' ');
            iconCtx.fillText(name[0], 0, -18);
            iconCtx.fillText(name[1], 0, -5);
            
            const iconContainer = document.getElementById(`powerup-icon-${type}`);
            if(iconContainer) {
                const img = document.createElement('img');
                img.src = iconCanvas.toDataURL();
                img.style.width = '100%';
                img.style.height = '100%';
                iconContainer.appendChild(img);
            }
        });
    }
}

