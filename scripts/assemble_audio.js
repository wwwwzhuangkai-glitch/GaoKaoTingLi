#!/usr/bin/env node
/**
 * Step 3: Assemble final audio from raw TTS segments
 * 
 * Reads segment JSON + raw WAV files
 * Applies repeat (×2 with 2s gap), gapAfter silence
 * Exports 3 speed versions: 1.0x, 0.95x, 0.9x
 * 
 * Usage: node scripts/assemble_audio.js
 */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEGMENTS_DIR = path.join(ROOT, 'output', 'segments');
const RAW_AUDIO_DIR = path.join(ROOT, 'output', 'raw_audio');
const FINAL_DIR = path.join(ROOT, 'output', 'final');
const DING_PATH = path.join(ROOT, 'public', 'ding.mp3');

const SAMPLE_RATE = 24000;

const SPEED_PRESETS = [
    { label: '1.0x', value: 1.0 },
    { label: '0.95x', value: 0.95 },
    { label: '0.9x', value: 0.9 },
];

// ── WAV I/O ──

function readWavFloat32(wavPath) {
    const buf = fs.readFileSync(wavPath);
    // Find 'data' chunk
    let offset = 12;
    while (offset < buf.length - 8) {
        const chunkId = buf.toString('ascii', offset, offset + 4);
        const chunkSize = buf.readUInt32LE(offset + 4);
        if (chunkId === 'data') {
            const dataStart = offset + 8;
            const dataEnd = dataStart + chunkSize;
            const pcmBuf = buf.slice(dataStart, Math.min(dataEnd, buf.length));
            // Detect bit depth from fmt chunk
            // Assume 16-bit (standard from our generation)
            const int16 = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, Math.floor(pcmBuf.length / 2));
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768;
            }
            return float32;
        }
        offset += 8 + chunkSize;
    }
    throw new Error(`No data chunk found in WAV: ${wavPath}`);
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
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(totalLength - 8, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
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

// ── Audio utils ──

function makeSilence(durationSec) {
    return new Float32Array(Math.floor(SAMPLE_RATE * durationSec));
}

function concatenate(buffers) {
    const totalLen = buffers.reduce((sum, b) => sum + b.length, 0);
    const result = new Float32Array(totalLen);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }
    return result;
}

function changeSpeed(buffer, speed) {
    if (speed === 1.0) return buffer;
    const newLen = Math.floor(buffer.length / speed);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
        const srcIdx = i * speed;
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, buffer.length - 1);
        const frac = srcIdx - lo;
        result[i] = buffer[lo] * (1 - frac) + buffer[hi] * frac;
    }
    return result;
}

// ── Ding loading ──
// Try to decode ding.mp3 by using a simple raw copy fallback.
// Since we're in Node.js without AudioContext, we generate a synthetic ding.

function generateSyntheticDing(freq = 880, duration = 0.5, volume = 0.4) {
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

let _dingBuffer = null;

function getDingBuffer() {
    if (_dingBuffer) return _dingBuffer;

    // Check if a ding WAV was pre-converted
    const dingWavPath = path.join(ROOT, 'public', 'ding.wav');
    if (fs.existsSync(dingWavPath)) {
        try {
            _dingBuffer = readWavFloat32(dingWavPath);
            console.log(`   🔔 Loaded ding.wav (${(_dingBuffer.length / SAMPLE_RATE).toFixed(1)}s)`);
            return _dingBuffer;
        } catch (e) {
            console.warn(`   ⚠️ Failed to load ding.wav: ${e.message}`);
        }
    }

    // Try decoding mp3 with ffmpeg if available
    if (fs.existsSync(DING_PATH)) {
        try {
            const tmpWav = path.join(ROOT, 'output', '_ding_tmp.wav');
            execSync(`ffmpeg -y -i "${DING_PATH}" -ar ${SAMPLE_RATE} -ac 1 -f wav "${tmpWav}" 2>/dev/null`);
            _dingBuffer = readWavFloat32(tmpWav);
            fs.unlinkSync(tmpWav);
            console.log(`   🔔 Decoded ding.mp3 via ffmpeg (${(_dingBuffer.length / SAMPLE_RATE).toFixed(1)}s)`);
            return _dingBuffer;
        } catch (e) {
            // ffmpeg not available
        }
    }

    console.log('   🔔 Using synthetic ding (ffmpeg not available for mp3 decode)');
    _dingBuffer = generateSyntheticDing();
    return _dingBuffer;
}

// ── Main assembly ──

function assembleExam(segments, rawAudioDir, speed = 1.0) {
    const parts = [];
    const ding = getDingBuffer();

    for (const seg of segments) {
        if (seg.type === 'ding') {
            parts.push(ding);
            if (seg.gapAfter > 0) {
                parts.push(makeSilence(seg.gapAfter));
            }
            continue;
        }

        // Load raw audio
        const wavPath = path.join(rawAudioDir, `${seg.id}_${seg.type}.wav`);
        if (!fs.existsSync(wavPath)) {
            console.warn(`   ⚠️ Missing audio: ${wavPath}`);
            continue;
        }

        let audio = readWavFloat32(wavPath);

        // Apply speed change only to English content
        if (speed !== 1.0 && (seg.type === 'dialogue' || seg.type === 'monologue')) {
            audio = changeSpeed(audio, speed);
        }

        // Handle repeat (×2 with 2s gap between)
        if (seg.repeat > 1) {
            const repeated = [];
            for (let i = 0; i < seg.repeat; i++) {
                if (i > 0) repeated.push(makeSilence(2)); // 2s gap between repeats
                repeated.push(audio);
            }
            audio = concatenate(repeated);
        }

        parts.push(audio);

        // gapAfter
        if (seg.gapAfter > 0) {
            parts.push(makeSilence(seg.gapAfter));
        }
    }

    return parts.length > 0 ? concatenate(parts) : null;
}

async function main() {
    fs.mkdirSync(FINAL_DIR, { recursive: true });

    const jsonFiles = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith('.json')).sort();
    if (jsonFiles.length === 0) {
        console.error('❌ No segment JSON files found. Run parse_all.js first.');
        process.exit(1);
    }

    console.log(`🔧 Audio Assembly`);
    console.log(`📁 Found ${jsonFiles.length} segment files\n`);

    for (const jsonFile of jsonFiles) {
        const baseName = path.basename(jsonFile, '.json');
        const segments = JSON.parse(fs.readFileSync(path.join(SEGMENTS_DIR, jsonFile), 'utf-8'));
        const rawDir = path.join(RAW_AUDIO_DIR, baseName);

        if (!fs.existsSync(rawDir)) {
            console.warn(`⚠️ No raw audio directory for ${baseName}, skipping`);
            continue;
        }

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📄 ${baseName}`);

        for (const preset of SPEED_PRESETS) {
            const outPath = path.join(FINAL_DIR, `${baseName}_${preset.label}.wav`);

            console.log(`   ⚡ Assembling ${preset.label}...`);
            const fullAudio = assembleExam(segments, rawDir, preset.value);

            if (!fullAudio) {
                console.warn(`   ⚠️ No audio produced for ${preset.label}`);
                continue;
            }

            const wavBuf = float32ToWavBuffer(fullAudio);
            fs.writeFileSync(outPath, wavBuf);

            const duration = (fullAudio.length / SAMPLE_RATE).toFixed(1);
            const sizeMB = (wavBuf.length / 1024 / 1024).toFixed(1);
            console.log(`   ✅ ${preset.label} → ${duration}s (${sizeMB} MB)`);
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ Assembly complete!`);
    console.log(`📁 Output: ${FINAL_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
