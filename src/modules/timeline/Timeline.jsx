import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import useAppStore from '../../store/appStore';
import { playFloat32 } from '../audio-engine/audioContext';
import { concatenate, makeSilence, getDuration, changeSpeed } from '../audio-engine/pcmUtils';
import { loadRealDing, generateDing } from '../audio-library/builtinSounds';
import { encodeWav, downloadWav } from '../audio-engine/wavEncoder';
import './Timeline.css';

const TYPE_COLORS = {
    narrator: '#9AA0A6',
    dialogue: '#4285F4',
    monologue: '#34A853',
    ding: '#FBBC04',
    silence: '#E8EAED',
};

/** Speed presets for multi-speed export */
const SPEED_PRESETS = [
    { label: '1.0x (原速)', value: 1.0 },
    { label: '0.95x (稍慢)', value: 0.95 },
    { label: '0.9x (慢速)', value: 0.9 },
];

export default function Timeline() {
    const { segments, audioBuffers, addToast } = useAppStore();
    const [zoom, setZoom] = useState(50);    // pixels per second
    const [isPlaying, setIsPlaying] = useState(false);
    const [playProgress, setPlayProgress] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [dingBuffer, setDingBuffer] = useState(null);
    const playControllerRef = useRef(null);
    const animFrameRef = useRef(null);
    const playStartRef = useRef(0);
    const scrollRef = useRef(null);

    // Load real ding on mount
    useEffect(() => {
        loadRealDing().then(buf => setDingBuffer(buf));
    }, []);

    // Get the ding audio buffer (real or wait for it)
    const getDingAudio = useCallback(() => {
        if (dingBuffer) return dingBuffer;
        // Fallback: generate synthetic ding if real ding hasn't loaded yet
        return generateDing(880, 0.5, 0.4);
    }, [dingBuffer]);

    // Build merged audio data for timeline visualization
    const timelineData = useMemo(() => {
        const clips = [];
        let offset = 0;

        for (const seg of segments) {
            let duration = 0;
            let hasAudio = false;

            if (seg.type === 'ding') {
                duration = dingBuffer ? getDuration(dingBuffer) : 1.5;
                hasAudio = !!dingBuffer;
            } else if (seg.type === 'silence') {
                duration = seg.gapAfter || 5;
            } else if (audioBuffers[seg.id]) {
                const buf = audioBuffers[seg.id];
                const baseDuration = getDuration(buf);
                duration = baseDuration * (seg.repeat || 1);
                if (seg.repeat > 1) {
                    // Add 2s gap between repeats (standard exam gap)
                    duration += (seg.repeat - 1) * 2;
                }
                hasAudio = true;
            } else {
                // approximate duration from text length (for display only)
                duration = Math.max(2, (seg.text?.length || 0) * 0.08);
            }

            clips.push({
                id: seg.id,
                type: seg.type,
                text: seg.text || '',
                offset,
                duration,
                repeat: seg.repeat || 1,
                gapAfter: seg.gapAfter || 0,
                hasAudio,
            });

            offset += duration + (seg.gapAfter || 0);
        }

        return { clips, totalDuration: offset };
    }, [segments, audioBuffers, dingBuffer]);

    /**
     * Build full audio buffer for playback/export.
     * For dialogue/monologue segments, optionally apply speed change.
     * Ding, silence, and narrator keep original speed per the report strategy.
     *
     * @param {number} speed - playback speed (1.0 = original, 0.9 = slower)
     */
    const buildFullAudio = useCallback((speed = 1.0) => {
        const parts = [];
        const ding = getDingAudio();

        for (const seg of segments) {
            let segAudio;

            if (seg.type === 'ding') {
                segAudio = ding;
            } else if (seg.type === 'silence') {
                segAudio = makeSilence(seg.gapAfter || 5);
            } else if (audioBuffers[seg.id]) {
                segAudio = audioBuffers[seg.id];

                // Apply speed change only to English content (dialogue/monologue)
                // Chinese narrator stays at original speed per the report
                if (speed !== 1.0 && (seg.type === 'dialogue' || seg.type === 'monologue')) {
                    segAudio = changeSpeed(segAudio, speed);
                }

                // Handle repeats: reuse same audio buffer (1 API call, N repeats)
                if (seg.repeat > 1) {
                    const repeated = [];
                    for (let i = 0; i < seg.repeat; i++) {
                        if (i > 0) repeated.push(makeSilence(2)); // 2s gap between repeats
                        repeated.push(segAudio);
                    }
                    segAudio = concatenate(repeated);
                }
            } else {
                // Skip segments without audio
                continue;
            }

            parts.push(segAudio);

            // Add gap after
            if (seg.gapAfter > 0 && seg.type !== 'silence') {
                parts.push(makeSilence(seg.gapAfter));
            }
        }

        if (parts.length === 0) return null;
        return concatenate(parts);
    }, [segments, audioBuffers, getDingAudio]);

    const handlePlay = useCallback(() => {
        const fullAudio = buildFullAudio(1.0);
        if (!fullAudio) {
            addToast({ type: 'error', message: '没有可播放的音频，请先生成' });
            return;
        }

        if (playControllerRef.current) {
            playControllerRef.current.stop();
        }

        setIsPlaying(true);
        playStartRef.current = performance.now();

        const doAnimate = () => {
            const elapsed = (performance.now() - playStartRef.current) / 1000;
            setPlayProgress(elapsed);
            if (elapsed < timelineData.totalDuration) {
                animFrameRef.current = requestAnimationFrame(doAnimate);
            }
        };
        animFrameRef.current = requestAnimationFrame(doAnimate);

        playControllerRef.current = playFloat32(fullAudio, () => {
            setIsPlaying(false);
            setPlayProgress(0);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        });
    }, [buildFullAudio, addToast, timelineData.totalDuration]);

    const handleStop = useCallback(() => {
        if (playControllerRef.current) {
            playControllerRef.current.stop();
            playControllerRef.current = null;
        }
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setIsPlaying(false);
        setPlayProgress(0);
    }, []);

    /** Export a single speed version */
    const handleExportSingle = useCallback((speed = 1.0) => {
        const fullAudio = buildFullAudio(speed);
        if (!fullAudio) {
            addToast({ type: 'error', message: '没有可导出的音频' });
            return;
        }
        const blob = encodeWav(fullAudio);
        const speedLabel = speed === 1.0 ? '1.0x' : `${speed}x`;
        downloadWav(blob, `gaokao_listening_${speedLabel}_${Date.now()}.wav`);
        addToast({ type: 'success', message: `导出 ${speedLabel} 版本成功！` });
    }, [buildFullAudio, addToast]);

    /** Export all 3 speed versions at once */
    const handleExportAll = useCallback(async () => {
        const checkAudio = buildFullAudio(1.0);
        if (!checkAudio) {
            addToast({ type: 'error', message: '没有可导出的音频' });
            return;
        }

        setIsExporting(true);
        const timestamp = Date.now();

        try {
            for (const preset of SPEED_PRESETS) {
                // Small delay to let browser breathe between heavy computations
                await new Promise(r => setTimeout(r, 100));

                const fullAudio = buildFullAudio(preset.value);
                if (fullAudio) {
                    const blob = encodeWav(fullAudio);
                    const speedLabel = preset.value === 1.0 ? '1.0x' : `${preset.value}x`;
                    downloadWav(blob, `gaokao_listening_${speedLabel}_${timestamp}.wav`);
                }
            }
            addToast({ type: 'success', message: '三个倍速版本全部导出成功！' });
        } catch (err) {
            addToast({ type: 'error', message: `导出失败: ${err.message}` });
        } finally {
            setIsExporting(false);
        }
    }, [buildFullAudio, addToast]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    // Generate time ruler marks
    const rulerMarks = useMemo(() => {
        const marks = [];
        const interval = zoom >= 40 ? 5 : zoom >= 20 ? 10 : 30;
        for (let t = 0; t <= timelineData.totalDuration; t += interval) {
            marks.push(t);
        }
        return marks;
    }, [timelineData.totalDuration, zoom]);

    useEffect(() => {
        return () => {
            if (playControllerRef.current) playControllerRef.current.stop();
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    return (
        <div className="timeline">
            {/* Toolbar */}
            <div className="timeline__toolbar">
                <div className="timeline__controls">
                    {isPlaying ? (
                        <button className="btn-icon" onClick={handleStop} title="停止">⏹</button>
                    ) : (
                        <button className="btn-icon" onClick={handlePlay} title="播放">▶</button>
                    )}

                    <span className="timeline__time">
                        {formatTime(playProgress)} / {formatTime(timelineData.totalDuration)}
                    </span>
                </div>

                <div className="timeline__zoom">
                    <span className="timeline__zoom-label">🔍</span>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="timeline__zoom-slider"
                    />
                </div>

                <div className="timeline__export-group">
                    {/* Single-speed exports */}
                    {SPEED_PRESETS.map((preset) => (
                        <button
                            key={preset.value}
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleExportSingle(preset.value)}
                            disabled={isExporting}
                            title={`导出 ${preset.label}`}
                        >
                            📥 {preset.label}
                        </button>
                    ))}
                    {/* Export all 3 at once */}
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleExportAll}
                        disabled={isExporting}
                    >
                        {isExporting ? (
                            <><span className="spinner" /> 导出中...</>
                        ) : (
                            '📦 导出全部倍速'
                        )}
                    </button>
                </div>
            </div>

            {/* Timeline body */}
            <div className="timeline__body" ref={scrollRef}>
                {/* Ruler */}
                <div className="timeline__ruler" style={{ width: timelineData.totalDuration * zoom + 100 }}>
                    {rulerMarks.map((t) => (
                        <div
                            key={t}
                            className="timeline__ruler-mark"
                            style={{ left: t * zoom }}
                        >
                            <span className="timeline__ruler-label">{formatTime(t)}</span>
                        </div>
                    ))}
                </div>

                {/* Playhead */}
                {isPlaying && (
                    <div
                        className="timeline__playhead"
                        style={{ left: playProgress * zoom }}
                    />
                )}

                {/* Track */}
                <div className="timeline__track" style={{ width: timelineData.totalDuration * zoom + 100 }}>
                    {timelineData.clips.map((clip) => (
                        <div
                            key={clip.id}
                            className={`timeline__clip ${clip.hasAudio ? '' : 'timeline__clip--no-audio'}`}
                            style={{
                                left: clip.offset * zoom,
                                width: Math.max(clip.duration * zoom, 20),
                                backgroundColor: TYPE_COLORS[clip.type] || '#9AA0A6',
                            }}
                            title={`${clip.type}: ${clip.text.substring(0, 50)}...`}
                        >
                            <span className="timeline__clip-label">
                                {clip.type === 'ding' ? '🔔' : clip.type === 'silence' ? '⏸' : ''}
                                {clip.text.substring(0, 15)}
                                {clip.repeat > 1 ? ` ×${clip.repeat}` : ''}
                            </span>
                        </div>
                    ))}

                    {/* Gap indicators */}
                    {timelineData.clips.map((clip) => {
                        if (clip.gapAfter > 0 && clip.type !== 'silence') {
                            return (
                                <div
                                    key={`gap_${clip.id}`}
                                    className="timeline__gap"
                                    style={{
                                        left: (clip.offset + clip.duration) * zoom,
                                        width: clip.gapAfter * zoom,
                                    }}
                                >
                                    <span className="timeline__gap-label">{clip.gapAfter}s</span>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
}
