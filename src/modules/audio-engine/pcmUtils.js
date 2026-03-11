/**
 * PCM audio data utilities.
 * All operations work with Float32Array at 24kHz mono.
 */

const SAMPLE_RATE = 24000;

/**
 * Concatenate multiple Float32Array buffers.
 */
export function concatenate(buffers) {
    const totalLen = buffers.reduce((sum, b) => sum + b.length, 0);
    const result = new Float32Array(totalLen);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }
    return result;
}

/**
 * Repeat a buffer N times.
 */
export function repeat(buffer, times) {
    if (times <= 1) return buffer;
    const buffers = [];
    for (let i = 0; i < times; i++) {
        buffers.push(buffer);
    }
    return concatenate(buffers);
}

/**
 * Generate silence of given duration.
 */
export function makeSilence(durationSec) {
    return new Float32Array(Math.floor(SAMPLE_RATE * durationSec));
}

/**
 * Get duration in seconds.
 */
export function getDuration(buffer) {
    return buffer.length / SAMPLE_RATE;
}

/**
 * Resample audio from one sample rate to another (simple linear interpolation).
 */
export function resample(buffer, fromRate, toRate = SAMPLE_RATE) {
    if (fromRate === toRate) return buffer;
    const ratio = fromRate / toRate;
    const newLen = Math.floor(buffer.length / ratio);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
        const srcIdx = i * ratio;
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, buffer.length - 1);
        const frac = srcIdx - lo;
        result[i] = buffer[lo] * (1 - frac) + buffer[hi] * frac;
    }
    return result;
}

export { SAMPLE_RATE };
