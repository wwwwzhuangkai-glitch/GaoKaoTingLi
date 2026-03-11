/**
 * Gemini TTS API client.
 * Wraps @google/genai for single-speaker and multi-speaker generation.
 */
import { GoogleGenAI } from '@google/genai';
import { buildPrompt } from './ttsPrompts';

const SAMPLE_RATE = 24000;

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
 * Raw bytes (ArrayBuffer) PCM to Float32Array.
 */
function rawPcmToFloat32(rawData) {
    const int16 = new Int16Array(rawData);
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
    const ai = new GoogleGenAI({ apiKey });
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
 * @param speakers - { speakerName: voiceName } mapping (max 2)
 * @returns Float32Array of audio samples at 24kHz
 */
export async function generateMulti(apiKey, text, speakers, model = 'gemini-2.5-flash-preview-tts') {
    const ai = new GoogleGenAI({ apiKey });
    const speakerEntries = Object.entries(speakers);

    if (speakerEntries.length < 1 || speakerEntries.length > 2) {
        throw new Error(`Multi-speaker requires exactly 2 speakers, got ${speakerEntries.length}`);
    }

    const prompt = buildPrompt('dialogue', text);

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: speakerEntries.map(([speaker, voiceName]) => ({
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
