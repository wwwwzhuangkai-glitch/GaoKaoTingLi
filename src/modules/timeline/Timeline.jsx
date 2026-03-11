import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import useAppStore from '../../store/appStore';
import { playFloat32 } from '../audio-engine/audioContext';
import { concatenate, repeat as repeatBuf, makeSilence, getDuration } from '../audio-engine/pcmUtils';
import { generateDing, getBuiltinSounds } from '../audio-library/builtinSounds';
import { encodeWav, downloadWav } from '../audio-engine/wavEncoder';
import './Timeline.css';

const TYPE_COLORS = {
    narrator: '#9AA0A6',
    dialogue: '#4285F4',
    monologue: '#34A853',
    ding: '#FBBC04',
    silence: '#E8EAED',
};

export default function Timeline() {
    const { segments, audioBuffers, addToast } = useAppStore();
    const [zoom, setZoom] = useState(50);    // pixels per second
    const [isPlaying, setIsPlaying] = useState(false);
    const [playProgress, setPlayProgress] = useState(0);
    const playControllerRef = useRef(null);
    const animFrameRef = useRef(null);
    const playStartRef = useRef(0);
    const scrollRef = useRef(null);

    // Build merged audio data for exported timeline
    const timelineData = useMemo(() => {
        const clips = [];
        let offset = 0;

        for (const seg of segments) {
            let duration = 0;
            let hasAudio = false;

            if (seg.type === 'ding') {
                const dingData = generateDing(880, 0.5, 0.4);
                duration = getDuration(dingData);
                hasAudio = true;
            } else if (seg.type === 'silence') {
                duration = seg.gapAfter || 5;
            } else if (audioBuffers[seg.id]) {
                const buf = audioBuffers[seg.id];
                const baseDuration = getDuration(buf);
                duration = baseDuration * (seg.repeat || 1);
                if (seg.repeat > 1) {
                    // Add small gaps between repeats
                    duration += (seg.repeat - 1) * 1;
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
    }, [segments, audioBuffers]);

    // Build full audio buffer for playback/export
    const buildFullAudio = useCallback(() => {
        const parts = [];

        for (const seg of segments) {
            let segAudio;

            if (seg.type === 'ding') {
                segAudio = generateDing(880, 0.5, 0.4);
            } else if (seg.type === 'silence') {
                segAudio = makeSilence(seg.gapAfter || 5);
            } else if (audioBuffers[seg.id]) {
                segAudio = audioBuffers[seg.id];
                if (seg.repeat > 1) {
                    const repeated = [];
                    for (let i = 0; i < seg.repeat; i++) {
                        if (i > 0) repeated.push(makeSilence(1));
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
    }, [segments, audioBuffers]);

    const handlePlay = useCallback(() => {
        const fullAudio = buildFullAudio();
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

    const handleExport = useCallback(() => {
        const fullAudio = buildFullAudio();
        if (!fullAudio) {
            addToast({ type: 'error', message: '没有可导出的音频' });
            return;
        }
        const blob = encodeWav(fullAudio);
        downloadWav(blob, `gaokao_listening_${Date.now()}.wav`);
        addToast({ type: 'success', message: '导出成功！' });
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

                <button className="btn btn-primary btn-sm" onClick={handleExport}>
                    📥 导出 WAV
                </button>
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
