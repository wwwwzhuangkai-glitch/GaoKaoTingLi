import { useState, useCallback, useRef } from 'react';
import useAppStore from '../../store/appStore';
import { VOICES } from './voiceList';
import { getAudioContext } from '../audio-engine/audioContext';
import './VoicePreview.css';

const SAMPLE_RATE = 24000;

/**
 * Play a pre-generated voice sample WAV file from public/voice-samples/.
 * No API key needed — samples are pre-generated static files.
 */
async function playPreGeneratedSample(voiceName) {
    const url = `/voice-samples/${voiceName}.wav`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sample not found: ${voiceName}`);
    const arrayBuffer = await response.arrayBuffer();

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
    return source;
}

export default function VoicePreview() {
    const { showVoicePreview, setShowVoicePreview, addToast } = useAppStore();
    const [loadingVoice, setLoadingVoice] = useState(null);
    const [playingVoice, setPlayingVoice] = useState(null);
    const sourceRef = useRef(null);

    const handleStop = useCallback(() => {
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch (e) { /* already stopped */ }
            sourceRef.current = null;
        }
        setPlayingVoice(null);
    }, []);

    const handlePreview = useCallback(async (voiceName) => {
        // Stop any currently playing
        handleStop();

        setLoadingVoice(voiceName);
        try {
            const source = await playPreGeneratedSample(voiceName);
            sourceRef.current = source;
            setPlayingVoice(voiceName);
            source.onended = () => {
                setPlayingVoice(null);
                sourceRef.current = null;
            };
        } catch (err) {
            addToast({ type: 'error', message: `音色预览失败: ${err.message}` });
        } finally {
            setLoadingVoice(null);
        }
    }, [addToast, handleStop]);

    if (!showVoicePreview) return null;

    const renderVoiceCard = (voice) => {
        const isLoading = loadingVoice === voice.name;
        const isPlaying = playingVoice === voice.name;
        return (
            <button
                key={voice.name}
                className={`voice-preview__card ${isPlaying ? 'voice-preview__card--playing' : ''} ${isLoading ? 'voice-preview__card--loading' : ''}`}
                onClick={() => isPlaying ? handleStop() : handlePreview(voice.name)}
            >
                {isLoading ? (
                    <div className="spinner" />
                ) : (
                    <span className="voice-preview__card-icon">{isPlaying ? '⏹' : '▶'}</span>
                )}
                <span className="voice-preview__card-name">{voice.name}</span>
                <span className="voice-preview__card-style">{voice.style}</span>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={() => setShowVoicePreview(false)}>
            <div className="modal-content voice-preview" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🎤 音色试听</h2>
                    <button className="btn-icon" onClick={() => { handleStop(); setShowVoicePreview(false); }}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="voice-preview__hint">
                        💡 所有音色均已预生成，点击即可试听，无需 API Key
                    </div>

                    {/* Female voices */}
                    <div className="voice-preview__section">
                        <h3 className="voice-preview__section-title">♀ 女声</h3>
                        <div className="voice-preview__grid">
                            {VOICES.filter((v) => v.gender === 'female').map(renderVoiceCard)}
                        </div>
                    </div>

                    {/* Male voices */}
                    <div className="voice-preview__section">
                        <h3 className="voice-preview__section-title">♂ 男声</h3>
                        <div className="voice-preview__grid">
                            {VOICES.filter((v) => v.gender === 'male').map(renderVoiceCard)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
