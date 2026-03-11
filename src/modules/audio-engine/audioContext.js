/**
 * Web Audio API audio context singleton.
 */

const SAMPLE_RATE = 24000;

let audioCtx = null;

export function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE,
        });
    }
    return audioCtx;
}

/**
 * Play a Float32Array buffer through the audio context.
 * @returns {{ source, stop }} Controller for the playback.
 */
export function playFloat32(data, onEnded) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const audioBuffer = ctx.createBuffer(1, data.length, SAMPLE_RATE);
    audioBuffer.copyToChannel(data, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    if (onEnded) source.onended = onEnded;
    source.start();

    return {
        source,
        stop: () => {
            try { source.stop(); } catch (e) { /* already stopped */ }
        },
    };
}

/**
 * Decode an uploaded audio file (wav/mp3) to Float32Array at target rate.
 */
export async function decodeAudioFile(file) {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // Extract channel 0
    const channelData = audioBuffer.getChannelData(0);

    // If sample rate differs, the browser already decoded at ctx.sampleRate
    return {
        data: new Float32Array(channelData),
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
    };
}
