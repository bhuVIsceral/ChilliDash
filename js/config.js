export const Config = {
    GAME_BASE_WIDTH: 540,
    GAME_BASE_HEIGHT: 960,
    INITIAL_GAME_SPEED: 280,
    MAX_GAME_SPEED: 550,
    SPEED_RAMP_DURATION: 60000,
    LANES: [-120, 0, 120],
    PLAYER_TOP_Y: 180,
    JUMP_HEIGHT: 110,
    JUMP_DURATION: 450,
    MAX_LIVES: 5,
    CHILLI_SCORE: 100,
    POWERUPS: {
        'chillies-x2': { name: '2x Chillies', duration: 8000 },
        'speed-boost': { name: 'Speed Boost', duration: 8000 },
        'magnet': { name: 'Magnet', duration: 8000 },
    },
    PERSPECTIVE: {
        LANE_SCALE_TOP: 0.5,
        LANE_SCALE_BOTTOM: 1.5,
        LANE_SCALE_EXP: 1.2,
    },
    // This is the new setting for animation speed (in milliseconds)
    PLAYER_ANIMATION_INTERVAL: 150
};
