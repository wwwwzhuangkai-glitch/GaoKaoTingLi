#!/usr/bin/env node
/**
 * Step 2: Generate TTS audio for all segments
 * 
 * Reads JSON segments from output/segments/
 * Calls Gemini TTS API for each segment
 * Saves raw audio WAV to output/raw_audio/<exam_name>/
 * 
 * Features:
 * - Resume support: skips segments with existing WAV files
 * - Exponential backoff retry (3 attempts)
 * - Rate limiting (1s delay between calls)
 * 
 * Usage: GEMINI_API_KEY=xxx node scripts/generate_tts.js
 *        GEMINI_API_KEY=xxx TTS_MODEL=gemini-2.5-pro-preview-tts node scripts/generate_tts.js
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEGMENTS_DIR = path.join(ROOT, 'output', 'segments');
const RAW_AUDIO_DIR = path.join(ROOT, 'output', 'raw_audio');
const DING_PATH = path.join(ROOT, 'public', 'ding.mp3');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const SAMPLE_RATE = 24000;

if (!API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY environment variable');
    console.error('Usage: GEMINI_API_KEY=xxx node scripts/generate_tts.js');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// ── Prompt Templates ──

function buildPrompt(type, text) {
    const safeText = text.trim().length < 15
        ? `Read this transcript aloud exactly as written:\n\n${text}`
        : text;

    switch (type) {
        case 'narrator':
            return `Read this transcript aloud exactly as written:\n\n${safeText}`;
        case 'dialogue':
            return `# AUDIO PROFILE: Exam Narrator Duo
## "Standardized English Listening Test"

## THE SCENE: Professional Recording Studio
A quiet, soundproofed studio used to record standardized English listening exams for Chinese high school students (Gaokao). The atmosphere is calm and professional. Two narrators sit at microphones, reading a scripted dialogue with precise, measured delivery.

### DIRECTOR'S NOTES
Style:
* Neutral, professional, and clinical. No dramatic emotion or conversational casualness.
* Clear enunciation of every word, especially numbers, currencies, room numbers, and proper nouns.
* Each speaker maintains a consistent, steady vocal quality throughout.

Pacing:
* Extremely steady and uniform throughout. Every sentence at the exact same moderate pace.
* No acceleration on any sentence. No rushing. No slowing down dramatically either.
* Brief, consistent pauses between sentences.
* This is a standardized exam recording — treat every sentence with equal weight and timing.

Accent: Standard neutral English.

#### TRANSCRIPT
${safeText}`;
        case 'monologue':
            return `# AUDIO PROFILE: Exam Narrator
## "Standardized English Listening Test"

## THE SCENE: Professional Recording Studio
A quiet, soundproofed studio used to record standardized English listening exams. The narrator reads an announcement with precise, measured delivery.

### DIRECTOR'S NOTES
Style:
* Neutral, professional, and clinical. Clear enunciation of every word.
* Special attention to numbers, dates, prices, and proper nouns.

Pacing:
* Extremely steady and uniform. Every sentence at the same moderate pace.
* No acceleration. No rushing. Brief, consistent pauses between sentences.

Accent: Standard neutral English.

#### TRANSCRIPT
${safeText}`;
        default:
            return `Read this transcript aloud exactly as written:\n\n${safeText}`;
    }
}

// ── PCM conversion ──

function pcmBytesToFloat32(base64Data) {
    const buf = Buffer.from(base64Data, 'base64');
    const int16 = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
    }
    return float32;
}

function float32ToWavBuffer(float32, sampleRate = SAMPLE_RATE) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataLength = float32.length * (bitsPerSample / 8);
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const buffer = Buffer.alloc(totalLength);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(totalLength - 8, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    let offset = 44;
    for (let i = 0; i < float32.length; i++) {
        const sample = Math.max(-1, Math.min(1, float32[i]));
        const int16Val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        buffer.writeInt16LE(Math.round(int16Val), offset);
        offset += 2;
    }

    return buffer;
}

// ── Retry with backoff ──

async function withRetry(fn, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt < retries - 1) {
                const wait = Math.pow(2, attempt + 1) * 1000;
                console.warn(`   ⚠️ Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                throw err;
            }
        }
    }
}

// ── TTS Generation ──

async function generateSingle(text, voiceName, segmentType) {
    const prompt = buildPrompt(segmentType, text);

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: MODEL,
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

async function generateMulti(text, speakers) {
    const speakerEntries = Object.entries(speakers);

    if (speakerEntries.length < 2) {
        const voice = speakerEntries[0]?.[1] || 'Zephyr';
        return generateSingle(text, voice, 'monologue');
    }

    const prompt = buildPrompt('dialogue', text);

    return withRetry(async () => {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: speakerEntries.slice(0, 2).map(([speaker, voiceName]) => ({
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

// ── Ding handling (local file, no API) ──

function loadDingAsFloat32() {
    // We'll just copy the ding.mp3 as-is for the assemble step to handle
    // For raw_audio, we store a placeholder marker
    return null;
}

// ── Main ──

async function main() {
    const jsonFiles = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith('.json')).sort();
    if (jsonFiles.length === 0) {
        console.error('❌ No segment JSON files found. Run parse_all.js first.');
        process.exit(1);
    }

    console.log(`🎤 TTS Generation — Model: ${MODEL}`);
    console.log(`📁 Found ${jsonFiles.length} segment files\n`);

    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const jsonFile of jsonFiles) {
        const baseName = path.basename(jsonFile, '.json');
        const segments = JSON.parse(fs.readFileSync(path.join(SEGMENTS_DIR, jsonFile), 'utf-8'));
        const examDir = path.join(RAW_AUDIO_DIR, baseName);
        fs.mkdirSync(examDir, { recursive: true });

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📄 ${baseName}`);
        console.log(`${'─'.repeat(60)}`);

        for (const seg of segments) {
            const wavPath = path.join(examDir, `${seg.id}_${seg.type}.wav`);

            // Skip ding — handled locally in assemble step
            if (seg.type === 'ding') {
                console.log(`   🔔 ${seg.id} ding → skip (local file)`);
                totalSkipped++;
                continue;
            }

            // Resume: skip if WAV already exists
            if (fs.existsSync(wavPath)) {
                console.log(`   ⏭️  ${seg.id} ${seg.type} → exists, skipping`);
                totalSkipped++;
                continue;
            }

            // Generate TTS
            try {
                const icon = { narrator: '🎙️', dialogue: '💬', monologue: '📢' }[seg.type] || '🔊';
                const textPreview = seg.text.substring(0, 50).replace(/\n/g, ' ');
                console.log(`   ${icon} ${seg.id} ${seg.type} → generating... "${textPreview}"`);

                let float32;

                if (seg.type === 'dialogue' && seg.speakerConfig.mode === 'multi') {
                    float32 = await generateMulti(seg.text, seg.speakerConfig.voices);
                } else {
                    const voiceName = seg.speakerConfig.voices?.narrator
                        || Object.values(seg.speakerConfig.voices)[0]
                        || 'Zephyr';
                    float32 = await generateSingle(seg.text, voiceName, seg.type);
                }

                // Save as WAV
                const wavBuf = float32ToWavBuffer(float32);
                fs.writeFileSync(wavPath, wavBuf);

                const duration = (float32.length / SAMPLE_RATE).toFixed(1);
                console.log(`   ✅ ${seg.id} → ${duration}s saved`);
                totalGenerated++;

                // Rate limit: 1s between API calls
                await new Promise(r => setTimeout(r, 1000));

            } catch (err) {
                console.error(`   ❌ ${seg.id} ${seg.type} FAILED: ${err.message}`);
                totalErrors++;
            }
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ Generated: ${totalGenerated}`);
    console.log(`⏭️  Skipped: ${totalSkipped}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log(`📁 Output: ${RAW_AUDIO_DIR}`);

    if (totalErrors > 0) {
        console.log('\n⚠️  Some segments failed. Re-run this script to retry (resume support).');
        process.exit(1);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
