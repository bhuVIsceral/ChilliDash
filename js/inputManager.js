export class InputManager extends EventTarget {
    constructor(canvas) {
        super();
        this.canvas = canvas;
        this.touchstartX = 0;
        this.touchstartY = 0;
        
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    }
    
    handleKeyDown(e) {
        switch (e.code) {
            case 'ArrowLeft': case 'KeyA': this.dispatch('moveLeft'); break;
            case 'ArrowRight': case 'KeyD': this.dispatch('moveRight'); break;
            case 'ArrowUp': case 'KeyW': case 'Space': e.preventDefault(); this.dispatch('jump'); break;
        }
    }
    handleTouchStart(e) {
        if (e.target.classList.contains('control-btn')) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.touchstartX = touch.clientX;
        this.touchstartY = touch.clientY;
    }
    handleTouchEnd(e) {
        if (e.target.classList.contains('control-btn')) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        const diffX = touch.clientX - this.touchstartX;
        const diffY = touch.clientY - this.touchstartY;
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 30) this.dispatch('moveRight');
            else if (diffX < -30) this.dispatch('moveLeft');
        } else {
            if (diffY < -30) this.dispatch('jump');
        }
    }
    dispatch(eventName) { this.dispatchEvent(new Event(eventName)); }
}
