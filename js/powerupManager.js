import { Config } from './config.js';

export class PowerupManager {
    constructor() { this.reset(); }
    reset() {
        this.powerups = {};
        for (const key in Config.POWERUPS) {
            this.powerups[key] = { ...Config.POWERUPS[key], key, active: false, cooldown: 0 };
        }
    }
    update(deltaTime) {
        for (const key in this.powerups) {
            const p = this.powerups[key];
            if (p.active) {
                p.cooldown -= deltaTime;
                if (p.cooldown <= 0) p.active = false;
            }
        }
    }
    activate(type) {
        if (this.powerups[type]) {
            this.powerups[type].active = true;
            this.powerups[type].cooldown = this.powerups[type].duration;
        }
    }
    isActive(type) { return this.powerups[type] && this.powerups[type].active; }
    getActivePowerups() { return Object.values(this.powerups).filter(p => p.active); }
}
