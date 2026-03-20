import { useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useAppStore from '../../store/appStore';
import SegmentCard from './SegmentCard';
import './SegmentList.css';

function SortableSegment({ segment, index }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: segment.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <SegmentCard segment={segment} index={index} dragHandleProps={listeners} />
        </div>
    );
}

export default function SegmentList() {
    const { segments, reorderSegments, addSegment, defaultVoices } = useAppStore();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = segments.findIndex((s) => s.id === active.id);
        const newIndex = segments.findIndex((s) => s.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            reorderSegments(oldIndex, newIndex);
        }
    }, [segments, reorderSegments]);

    const handleAddSegment = (type) => {
        const id = `seg_${Date.now()}`;
        const newSeg = {
            id,
            type,
            text: type === 'ding' ? '' : type === 'silence' ? '' : '',
            speakerConfig: {
                mode: type === 'dialogue' ? 'multi' : 'single',
                voices: type === 'dialogue'
                    ? { Sarah: defaultVoices.female, James: defaultVoices.male }
                    : { narrator: defaultVoices.narrator },
            },
            repeat: 1,
            gapAfter: type === 'silence' ? 10 : type === 'ding' ? 0 : 2,
        };
        addSegment(newSeg);
    };

    return (
        <div className="segment-list">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="segment-list__items">
                        {segments.map((seg, idx) => (
                            <SortableSegment key={seg.id} segment={seg} index={idx} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Add segment buttons */}
            <div className="segment-list__actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleAddSegment('narrator')}>
                    + 🎙 旁白
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleAddSegment('dialogue')}>
                    + 💬 对话
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleAddSegment('monologue')}>
                    + 📖 独白
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleAddSegment('ding')}>
                    + 🔔 叮声
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleAddSegment('silence')}>
                    + ⏸ 静音
                </button>
            </div>
        </div>
    );
}
