import { useState } from 'react';
import useAppStore from '../../store/appStore';
import { VOICES } from '../voice-preview/voiceList';
import { playFloat32 } from '../audio-engine/audioContext';
import './SegmentCard.css';

const TYPE_CONFIG = {
    narrator: { emoji: '🎙', label: '旁白', badgeClass: 'badge-narrator' },
    dialogue: { emoji: '💬', label: '对话', badgeClass: 'badge-dialogue' },
    monologue: { emoji: '📖', label: '独白', badgeClass: 'badge-monologue' },
    ding: { emoji: '🔔', label: '叮声', badgeClass: 'badge-ding' },
    silence: { emoji: '⏸', label: '静音', badgeClass: 'badge-silence' },
};

export default function SegmentCard({ segment, index, dragHandleProps }) {
    const { updateSegment, removeSegment, audioBuffers, generationStatus } = useAppStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(segment.text);
    const [playbackController, setPlaybackController] = useState(null);

    const config = TYPE_CONFIG[segment.type] || TYPE_CONFIG.narrator;
    const status = generationStatus[segment.id] || 'idle';
    const hasAudio = !!audioBuffers[segment.id];

    const handleSaveEdit = () => {
        updateSegment(segment.id, { text: editText });
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditText(segment.text);
        setIsEditing(false);
    };

    const handleTypeChange = (e) => {
        updateSegment(segment.id, { type: e.target.value });
    };

    const handleVoiceChange = (role, voiceName) => {
        const newVoices = { ...segment.speakerConfig.voices, [role]: voiceName };
        updateSegment(segment.id, {
            speakerConfig: { ...segment.speakerConfig, voices: newVoices },
        });
    };

    const handleRepeatChange = (e) => {
        updateSegment(segment.id, { repeat: parseInt(e.target.value, 10) || 1 });
    };

    const handleGapChange = (e) => {
        updateSegment(segment.id, { gapAfter: parseFloat(e.target.value) || 0 });
    };

    const handlePlay = () => {
        const buffer = audioBuffers[segment.id];
        if (!buffer) return;
        if (playbackController) playbackController.stop();
        const ctrl = playFloat32(buffer, () => setPlaybackController(null));
        setPlaybackController(ctrl);
    };

    const handleStopPlay = () => {
        if (playbackController) {
            playbackController.stop();
            setPlaybackController(null);
        }
    };

    return (
        <div className={`segment-card card ${status === 'generating' ? 'segment-card--generating' : ''}`}>
            <div className="segment-card__header">
                <span className="segment-card__drag" {...(dragHandleProps || {})}>⠿</span>
                <span className="segment-card__index">{index + 1}</span>
                <span className={`badge ${config.badgeClass}`}>
                    {config.emoji} {config.label}
                </span>

                {segment.repeat > 1 && (
                    <span className="segment-card__repeat-badge">×{segment.repeat}</span>
                )}

                <div className="segment-card__spacer" />

                <div className={`status-dot status-dot-${status}`} title={status} />

                {hasAudio && (
                    playbackController ? (
                        <button className="btn-icon" onClick={handleStopPlay} title="停止">⏹</button>
                    ) : (
                        <button className="btn-icon" onClick={handlePlay} title="试听">▶</button>
                    )
                )}

                <button className="btn-icon" onClick={() => removeSegment(segment.id)} title="删除">✕</button>
            </div>

            {/* Text content */}
            {(segment.type !== 'ding' && segment.type !== 'silence') && (
                <div className="segment-card__body">
                    {isEditing ? (
                        <div className="segment-card__edit">
                            <textarea
                                className="input segment-card__textarea"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={4}
                            />
                            <div className="flex gap-2">
                                <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>保存</button>
                                <button className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>取消</button>
                            </div>
                        </div>
                    ) : (
                        <div className="segment-card__text" onClick={() => { setEditText(segment.text); setIsEditing(true); }}>
                            {segment.text}
                        </div>
                    )}
                </div>
            )}

            {/* Controls row */}
            <div className="segment-card__controls">
                {/* Type selector */}
                <div className="segment-card__control">
                    <label className="label">类型</label>
                    <select className="select" value={segment.type} onChange={handleTypeChange}>
                        <option value="narrator">旁白</option>
                        <option value="dialogue">对话</option>
                        <option value="monologue">独白</option>
                        <option value="ding">叮声</option>
                        <option value="silence">静音</option>
                    </select>
                </div>

                {/* Voice selector(s) */}
                {segment.type !== 'ding' && segment.type !== 'silence' && (
                    <>
                        {segment.speakerConfig?.mode === 'multi' ? (
                            Object.entries(segment.speakerConfig.voices).map(([role, voice]) => (
                                <div className="segment-card__control" key={role}>
                                    <label className="label">{role}</label>
                                    <select
                                        className="select"
                                        value={voice}
                                        onChange={(e) => handleVoiceChange(role, e.target.value)}
                                    >
                                        {VOICES.map((v) => (
                                            <option key={v.name} value={v.name}>
                                                {v.name} ({v.gender === 'female' ? '♀' : '♂'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))
                        ) : (
                            <div className="segment-card__control">
                                <label className="label">音色</label>
                                <select
                                    className="select"
                                    value={segment.speakerConfig?.voices?.narrator || 'Zephyr'}
                                    onChange={(e) => handleVoiceChange('narrator', e.target.value)}
                                >
                                    {VOICES.map((v) => (
                                        <option key={v.name} value={v.name}>
                                            {v.name} ({v.gender === 'female' ? '♀' : '♂'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </>
                )}

                {/* Repeat */}
                <div className="segment-card__control">
                    <label className="label">重复</label>
                    <select className="select" value={segment.repeat} onChange={handleRepeatChange}>
                        {[1, 2, 3].map((n) => (
                            <option key={n} value={n}>{n}x</option>
                        ))}
                    </select>
                </div>

                {/* Gap after */}
                <div className="segment-card__control">
                    <label className="label">后间隔(秒)</label>
                    <input
                        className="input"
                        type="number"
                        min="0"
                        max="60"
                        step="1"
                        value={segment.gapAfter}
                        onChange={handleGapChange}
                    />
                </div>
            </div>
        </div>
    );
}
