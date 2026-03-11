/**
 * Built-in sound generators (ding, silence, etc.)
 * All output 24kHz mono Float32Array [-1.0, 1.0]
 */

const SAMPLE_RATE = 24000;

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
 * Generate a double ding (two tones with gap).
 */
export function generateDoubleDing(freq = 880, toneDuration = 0.3, gap = 0.15, volume = 0.4) {
    const tone = generateDing(freq, toneDuration, volume);
    const silence = generateSilence(gap);
    const result = new Float32Array(tone.length * 2 + silence.length);
    result.set(tone, 0);
    result.set(silence, tone.length);
    result.set(tone, tone.length + silence.length);
    return result;
}

/**
 * Generate a triple ding (three tones).
 */
export function generateTripleDing(freq = 880, toneDuration = 0.2, gap = 0.1, volume = 0.4) {
    const tone = generateDing(freq, toneDuration, volume);
    const silence = generateSilence(gap);
    const parts = [tone, silence, tone, silence, tone];
    const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Float32Array(totalLen);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

/**
 * Generate silence.
 */
export function generateSilence(durationSec) {
    return new Float32Array(Math.floor(SAMPLE_RATE * durationSec));
}

/**
 * Get all built-in sounds as an array.
 */
export function getBuiltinSounds() {
    return [
        {
            id: 'builtin_ding_single',
            name: '叮 (单声)',
            data: generateDing(880, 0.5, 0.4),
            duration: 0.5,
            builtin: true,
        },
        {
            id: 'builtin_ding_double',
            name: '叮叮 (双声)',
            data: generateDoubleDing(880, 0.3, 0.15, 0.4),
            duration: 0.75,
            builtin: true,
        },
        {
            id: 'builtin_ding_triple',
            name: '叮叮叮 (三声)',
            data: generateTripleDing(880, 0.2, 0.1, 0.4),
            duration: 0.8,
            builtin: true,
        },
        {
            id: 'builtin_ding_low',
            name: '叮 (低沉)',
            data: generateDing(523, 0.6, 0.35),
            duration: 0.6,
            builtin: true,
        },
    ];
}

export { SAMPLE_RATE };
