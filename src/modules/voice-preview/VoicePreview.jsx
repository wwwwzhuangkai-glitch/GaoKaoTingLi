import { useState, useCallback } from 'react';
import useAppStore from '../../store/appStore';
import { VOICES } from './voiceList';
import { previewVoice } from '../tts-engine/ttsClient';
import { playFloat32 } from '../audio-engine/audioContext';
import './VoicePreview.css';

export default function VoicePreview() {
    const { apiKey, showVoicePreview, setShowVoicePreview, ttsModel, addToast } = useAppStore();
    const [previewText, setPreviewText] = useState('Hello, this is a sample for the English listening exam. The weather is beautiful today.');
    const [loadingVoice, setLoadingVoice] = useState(null);

    const handlePreview = useCallback(async (voiceName) => {
        if (!apiKey) {
            addToast({ type: 'error', message: '请先在设置中填写 API Key' });
            return;
        }

        setLoadingVoice(voiceName);
        try {
            const audioData = await previewVoice(apiKey, voiceName, previewText, ttsModel);
            playFloat32(audioData);
        } catch (err) {
            addToast({ type: 'error', message: `音色预览失败: ${err.message}` });
        } finally {
            setLoadingVoice(null);
        }
    }, [apiKey, previewText, ttsModel, addToast]);

    if (!showVoicePreview) return null;

    return (
        <div className="modal-overlay" onClick={() => setShowVoicePreview(false)}>
            <div className="modal-content voice-preview" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🎤 音色试听</h2>
                    <button className="btn-icon" onClick={() => setShowVoicePreview(false)}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="voice-preview__text-input">
                        <label className="label">试听文本</label>
                        <textarea
                            className="input"
                            value={previewText}
                            onChange={(e) => setPreviewText(e.target.value)}
                            rows={2}
                            placeholder="输入想要试听的文本..."
                        />
                    </div>

                    {/* Female voices */}
                    <div className="voice-preview__section">
                        <h3 className="voice-preview__section-title">♀ 女声</h3>
                        <div className="voice-preview__grid">
                            {VOICES.filter((v) => v.gender === 'female').map((voice) => (
                                <button
                                    key={voice.name}
                                    className={`voice-preview__card ${loadingVoice === voice.name ? 'voice-preview__card--loading' : ''}`}
                                    onClick={() => handlePreview(voice.name)}
                                    disabled={loadingVoice !== null}
                                >
                                    {loadingVoice === voice.name ? (
                                        <div className="spinner" />
                                    ) : (
                                        <span className="voice-preview__card-icon">▶</span>
                                    )}
                                    <span className="voice-preview__card-name">{voice.name}</span>
                                    <span className="voice-preview__card-style">{voice.style}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Male voices */}
                    <div className="voice-preview__section">
                        <h3 className="voice-preview__section-title">♂ 男声</h3>
                        <div className="voice-preview__grid">
                            {VOICES.filter((v) => v.gender === 'male').map((voice) => (
                                <button
                                    key={voice.name}
                                    className={`voice-preview__card ${loadingVoice === voice.name ? 'voice-preview__card--loading' : ''}`}
                                    onClick={() => handlePreview(voice.name)}
                                    disabled={loadingVoice !== null}
                                >
                                    {loadingVoice === voice.name ? (
                                        <div className="spinner" />
                                    ) : (
                                        <span className="voice-preview__card-icon">▶</span>
                                    )}
                                    <span className="voice-preview__card-name">{voice.name}</span>
                                    <span className="voice-preview__card-style">{voice.style}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
