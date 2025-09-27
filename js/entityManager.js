import { Config } from './config.js';

export class EntityManager {
    constructor() {
        this.obstaclePoolSize = 10;
        this.reset();
        this._setupObstacles();
    }
    _setupObstacles() {
        this.obstacles = [];
        const types = ['crate', 'grass', 'flower'];
        let currentY = Config.GAME_BASE_HEIGHT + 200;
        for (let i = 0; i < this.obstaclePoolSize; i++) {
            this.obstacles.push({
                type: types[Math.floor(Math.random() * types.length)],
                lane: Math.floor(Math.random() * 3),
                y: currentY,
            });
            currentY += 300 + Math.random() * 400;
        }
    }
    reset() {
        this.collectibles = [];
        this.nextCollectibleTime = 0;
        this.collisionEffects = [];
        if (this.obstacles) this._setupObstacles();
    }
    update(deltaTime, gameSpeed, player, powerupManager, perspective) {
        const worldDelta = (gameSpeed / 1000) * deltaTime;
        this.spawnCollectibles(deltaTime);
        this.updateObstacles(worldDelta, perspective);
        this.updateCollectibles(worldDelta, perspective, player, powerupManager);
        this.updateEffects(deltaTime);
    }
    spawnCollectibles(deltaTime) {
        this.nextCollectibleTime -= deltaTime;
        if (this.nextCollectibleTime <= 0) {
            const isPowerup = Math.random() < 0.2;
            let type = 'chilli';
            if (isPowerup) {
                const powerupTypes = Object.keys(Config.POWERUPS);
                type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
            }
            this.collectibles.push({
                type: type,
                lane: Math.floor(Math.random() * 3),
                y: Config.GAME_BASE_HEIGHT + 100,
            });
            this.nextCollectibleTime = 300 + Math.random() * 500;
        }
    }
    updateObstacles(worldDelta, perspective) {
        const totalTrackLength = this.obstaclePoolSize * 550;
        for (const obs of this.obstacles) {
            obs.y -= worldDelta;
            obs.x = perspective.laneCenterXAtY(obs.lane, obs.y);
            if (obs.y < -100) {
                obs.y += totalTrackLength;
                obs.lane = Math.floor(Math.random() * 3);
            }
        }
    }
    updateCollectibles(worldDelta, perspective, player, powerupManager) {
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const entity = this.collectibles[i];
            entity.y -= worldDelta;
            entity.x = perspective.laneCenterXAtY(entity.lane, entity.y);

            if (powerupManager.isActive('magnet')) {
                const playerY = player.y - player.yOffset;
                const dist = Math.hypot(player.x - entity.x, playerY - entity.y);
                if (dist < 300) {
                    entity.x += (player.x - entity.x) * 0.1;
                    entity.y += (playerY - entity.y) * 0.1;
                }
            }
            if (entity.y < -50) this.collectibles.splice(i, 1);
        }
    }
    addCollisionEffect(x, y) {
        this.collisionEffects.push({ x, y, life: 1.0 });
    }
    updateEffects(deltaTime) {
        for(let i = this.collisionEffects.length - 1; i >= 0; i--) {
            this.collisionEffects[i].life -= deltaTime / 300;
            if (this.collisionEffects[i].life <= 0) {
                this.collisionEffects.splice(i, 1);
            }
        }
    }
    checkCollisions(player, powerupManager, perspective) {
        let collisionEvents = [];
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            if (this.isColliding(player, obs, perspective, false)) {
                collisionEvents.push({ type: 'obstacle-hit' });
                this.addCollisionEffect(obs.x, obs.y);
                const totalTrackLength = this.obstaclePoolSize * 550;
                obs.y += totalTrackLength;
                break;
            }
        }
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const col = this.collectibles[i];
            if (this.isColliding(player, col, perspective, powerupManager.isActive('magnet'))) {
                collisionEvents.push({ type: 'collect', collectibleType: col.type });
                this.collectibles.splice(i, 1);
            }
        }
        return collisionEvents;
    }
    isColliding(player, entity, perspective, isMagnetActive) {
        const pY = player.y - player.yOffset;
        if (entity.y < player.y || player.isJumping) return false;
        
        const pScale = perspective.sizeScaleAtY(pY) || 1;
        const eScale = perspective.sizeScaleAtY(entity.y) || 1;
        const dx = player.x - entity.x;
        const dy = pY - entity.y;
        const distSq = dx * dx + dy * dy;
        
        let pRadius = 25 * pScale;
        let eRadius = (entity.type === 'chilli' || entity.type.includes('-')) ? 20 * eScale : 30 * eScale;
        
        if (isMagnetActive && entity.type !== 'chilli' && !entity.type.includes('-')) {
            pRadius = 40 * pScale;
        }

        const totalRadius = pRadius + eRadius;
        return distSq <= (totalRadius * totalRadius);
    }
}
