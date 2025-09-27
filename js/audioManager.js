export class AudioManager {
    constructor() {
        this.sounds = {
            'pickup': new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, release: 0.1 } }).toDestination(),
            'fail': new Tone.MembraneSynth({ envelope: { attack: 0.02, decay: 0.5, sustain: 0 } }).toDestination(),
            'woosh': new Tone.NoiseSynth({ envelope: { attack: 0.01, decay: 0.2, sustain: 0 } }).toDestination(),
        };
        this.isMuted = false;
        Tone.Destination.mute = this.isMuted;
    }
    toggleMute() {
        this.isMuted = !this.isMuted;
        Tone.Destination.mute = this.isMuted;
        return this.isMuted;
    }
    play(sound, note, duration) {
        if (this.sounds[sound] && Tone.context.state === 'running') {
            if (note && duration) { this.sounds[sound].triggerAttackRelease(note, duration); } 
            else { this.sounds[sound].triggerAttackRelease('8n'); }
        }
    }
    async startContext() { await Tone.start(); console.log("Audio context started."); }
}
