/**
 * Built-in sound generators and real ding loader.
 * All output 24kHz mono Float32Array [-1.0, 1.0]
 */

const SAMPLE_RATE = 24000;

// ── Real ding from Gaokao exam audio ── //

let _cachedRealDing = null;

/**
 * Load the real ding.mp3 extracted from official exam audio.
 * Returns a Float32Array at 24kHz mono.
 */
export async function loadRealDing() {
    if (_cachedRealDing) return _cachedRealDing;

    try {
        const response = await fetch('/ding.mp3');
        if (!response.ok) throw new Error(`Failed to load ding.mp3: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE,
        });
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        // Take first channel, already at 24kHz due to AudioContext sampleRate
        const float32 = decoded.getChannelData(0);
        // Copy so we can close the context
        _cachedRealDing = new Float32Array(float32);
        audioCtx.close();
        return _cachedRealDing;
    } catch (err) {
        console.warn('Failed to load real ding, falling back to synthetic:', err);
        return generateDing(880, 0.5, 0.4);
    }
}

// ── Synthetic sound generators (fallback) ── //

/**
 * Generate a sine-wave "ding" with fade-in/out envelope.
 */
export function generateDing(freq = 880, duration = 0.5, volume = 0.4) {
    const numSamples = Math.floor(SAMPLE_RATE * duration);
    const data = new Float32Array(numSamples);
    const fadeLen = Math.floor(numSamples * 0.1);

    for (let i = 0; i < numSamples; i++) {
        const t = i / SAMPLE_RATE;
        let envelope = 1.0;
        if (i < fadeLen) envelope = i / fadeLen;
        if (i > numSamples - fadeLen) envelope = (numSamples - i) / fadeLen;
        data[i] = Math.sin(2 * Math.PI * freq * t) * volume * envelope;
    }
    return data;
}

/**
 * Generate silence.
 */
export function generateSilence(durationSec) {
    return new Float32Array(Math.floor(SAMPLE_RATE * durationSec));
}

/**
 * Get all built-in sounds as an array.
 * The real ding is loaded async separately; these are sync fallbacks.
 */
export function getBuiltinSounds() {
    return [
        {
            id: 'builtin_ding_real',
            name: '叮 (真题提取)',
            data: null, // loaded async via loadRealDing()
            duration: 1.5,
            builtin: true,
            isAsync: true,
        },
        {
            id: 'builtin_ding_single',
            name: '叮 (合成-备选)',
            data: generateDing(880, 0.5, 0.4),
            duration: 0.5,
            builtin: true,
        },
    ];
}

export { SAMPLE_RATE };
