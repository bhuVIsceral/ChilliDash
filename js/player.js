import { Config } from './config.js';

export class Player {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.legAngle = 0;
        this.animationFrame = 0; // To track which SVG to draw
        this.reset();
    }
    reset() {
        this.y = Config.PLAYER_TOP_Y;
        this.lane = 1;
        this.x = 0;
        this.isJumping = false;
        this.jumpStart = 0;
        this.yOffset = 0;
        this.animationFrame = 0;
    }
    update(deltaTime, perspective, gameSpeed) {
        const targetLaneX = perspective.laneCenterXAtY(this.lane, this.y);
        this.x += (targetLaneX - this.x) * 0.2;

        if (this.isJumping) {
            const timeElapsed = performance.now() - this.jumpStart;
            if (timeElapsed >= Config.JUMP_DURATION) {
                this.isJumping = false;
                this.yOffset = 0;
            } else {
                this.yOffset = Config.JUMP_HEIGHT * Math.sin((timeElapsed / Config.JUMP_DURATION) * Math.PI);
            }
        }
        
        // Update the leg angle for timing the animation
        this.legAngle += (gameSpeed / 1000) * deltaTime * Math.PI;

        // Use the legAngle to toggle the animation frame for a running effect
        if (Math.sin(this.legAngle) > 0) {
            this.animationFrame = 0;
        } else {
            this.animationFrame = 1;
        }
    }
    moveLeft() { if (this.lane > 0) { this.lane--; this.audioManager.play('woosh'); } }
    moveRight() { if (this.lane < Config.LANES.length - 1) { this.lane++; this.audioManager.play('woosh'); } }
    jump() { if (!this.isJumping) { this.isJumping = true; this.jumpStart = performance.now(); } }
}

