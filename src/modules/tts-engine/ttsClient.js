/**
 * Gemini TTS API client.
 * Wraps @google/genai for single-speaker and multi-speaker generation.
 *
 * Adaptive strategy:
 *  - Auto-detects whether to use single or multi speaker mode
 *  - Handles edge cases (short text, 1-speaker dialogue fallback)
 *  - Exponential backoff retry for API resilience
 */
import { GoogleGenAI } from '@google/genai';
import { buildPrompt } from './ttsPrompts';

const SAMPLE_RATE = 24000;

/**
 * Use Vite dev server proxy to bypass region restrictions.
 * Browser → localhost/gemini-api → Vite server (Node.js) → Google API
 */
function getProxyBaseUrl() {
    return `${window.location.origin}/gemini-api`;
}

function createClient(apiKey) {
    return new GoogleGenAI({
        apiKey,
        httpOptions: { baseUrl: getProxyBaseUrl() },
    });
}

/**
 * Convert base64 PCM bytes to Float32Array.
 */
function pcmBytesToFloat32(base64Data) {
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    // 16-bit signed PCM → Float32
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
    }
    return float32;
}

/**
 * Retry wrapper with exponential backoff.
 */
async function withRetry(fn, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt < retries - 1) {
                const wait = Math.pow(2, attempt + 1) * 1000;
                console.warn(`TTS attempt ${attempt + 1} failed, retrying in ${wait}ms...`, err.message);
                await new Promise((r) => setTimeout(r, wait));
            } else {
                throw err;
            }
        }
    }
}

/**
 * Generate single-speaker audio.
 * @returns Float32Array of audio samples at 24kHz
 */
export async function generateSingle(apiKey, text, voiceName = 'Zephyr', model = 'gemini-2.5-flash-preview-tts', segmentType = 'narrator') {
    const ai = createClient(apiKey);
    const prompt = buildPrompt(segmentType, text);

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });

        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) throw new Error('No audio data in response');
        return pcmBytesToFloat32(data);
    });
}

/**
 * Generate multi-speaker (dialogue) audio.
 *
 * ADAPTIVE LOGIC:
 *  - 0 speakers detected → fallback to single speaker
 *  - 1 speaker detected → fallback to single speaker with that voice
 *  - 2 speakers         → normal multi_speaker call
 *  - >2 speakers        → keep first 2, remap others
 *
 * @param speakers - { speakerName: voiceName } mapping
 * @returns Float32Array of audio samples at 24kHz
 */
export async function generateMulti(apiKey, text, speakers, model = 'gemini-2.5-flash-preview-tts') {
    const ai = createClient(apiKey);
    const speakerEntries = Object.entries(speakers);

    // ── Adaptive: fallback to single speaker if needed ──
    if (speakerEntries.length === 0) {
        console.warn('No speakers detected, falling back to single-speaker mode');
        return generateSingle(apiKey, text, 'Zephyr', model, 'dialogue');
    }

    if (speakerEntries.length === 1) {
        console.warn('Only 1 speaker detected, falling back to single-speaker mode');
        return generateSingle(apiKey, text, speakerEntries[0][1], model, 'monologue');
    }

    // ── Trim to max 2 speakers (API limit) ──
    const activeSpeakers = speakerEntries.slice(0, 2);
    let processedText = text;

    if (speakerEntries.length > 2) {
        console.warn(`${speakerEntries.length} speakers detected, remapping extras to first 2`);
        // Remap extra speakers to the closest of the first 2
        const [first, second] = activeSpeakers;
        for (let i = 2; i < speakerEntries.length; i++) {
            const extraName = speakerEntries[i][0];
            // Alternate assignment to keep balance
            const target = i % 2 === 0 ? first[0] : second[0];
            processedText = processedText.replace(
                new RegExp(`^${extraName}:`, 'gm'),
                `${target}:`
            );
        }
    }

    const prompt = buildPrompt('dialogue', processedText);

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: activeSpeakers.map(([speaker, voiceName]) => ({
                            speaker,
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName },
                            },
                        })),
                    },
                },
            },
        });

        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) throw new Error('No audio data in response');
        return pcmBytesToFloat32(data);
    });
}

/**
 * Generate a voice preview sample (short text).
 */
export async function previewVoice(apiKey, voiceName, text = 'Hello, this is a voice preview for the English listening exam.', model = 'gemini-2.5-flash-preview-tts') {
    return generateSingle(apiKey, text, voiceName, model, 'narrator');
}

export { SAMPLE_RATE };
