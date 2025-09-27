import { Config } from './config.js';

export class Player {
    constructor(audioManager) {
        this.audioManager = audioManager;
        
        // Properties for animation
        this.animationFrame = 0; // To track which SVG to draw (0 or 1)
        this.animationTimer = 0; // Timer to control frame swapping speed

        this.reset();
    }
    reset() {
        this.y = Config.PLAYER_TOP_Y;
        this.lane = 1;
        this.x = 0;
        this.isJumping = false;
        this.jumpStart = 0;
        this.yOffset = 0;

        // Reset animation state
        this.animationFrame = 0;
        this.animationTimer = 0;
    }
    update(deltaTime, perspective, gameSpeed) {
        const targetLaneX = perspective.laneCenterXAtY(this.lane, this.y);
        this.x += (targetLaneX - this.x) * 0.2;

        if (this.isJumping) {
            // While jumping, hold the first frame for a consistent "jump pose"
            this.animationFrame = 0;
            this.animationTimer = 0; // Reset timer during jump

            const timeElapsed = performance.now() - this.jumpStart;
            if (timeElapsed >= Config.JUMP_DURATION) {
                this.isJumping = false;
                this.yOffset = 0;
            } else {
                this.yOffset = Config.JUMP_HEIGHT * Math.sin((timeElapsed / Config.JUMP_DURATION) * Math.PI);
            }
        } else {
            // When not jumping, run the animation timer
            this.animationTimer += deltaTime;

            // Check if the timer has exceeded the interval from the config
            if (this.animationTimer > Config.PLAYER_ANIMATION_INTERVAL) {
                this.animationTimer = 0; // Reset the timer
                this.animationFrame = 1 - this.animationFrame; // This toggles the frame between 0 and 1
            }
        }
    }
    moveLeft() { if (this.lane > 0) { this.lane--; this.audioManager.play('woosh'); } }
    moveRight() { if (this.lane < Config.LANES.length - 1) { this.lane++; this.audioManager.play('woosh'); } }
    jump() { if (!this.isJumping) { this.isJumping = true; this.jumpStart = performance.now(); } }
}

