import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactGridLayout, { useContainerWidth } from 'react-grid-layout';
import { getCompactor } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import Button from '../Button';
import { useUiStore } from '../../stores/useUiStore';

const GRID_COLS = 12;
const COMPACT_WIDTH = 760;
const PUSHING_COMPACTOR = getCompactor('vertical', false, false);

function cleanLayoutItem(item) {
    return {
        i: item.i,
        x: Number(item.x) || 0,
        y: Number(item.y) || 0,
        w: Math.max(1, Number(item.w) || 1),
        h: Math.max(1, Number(item.h) || 1),
        minW: item.minW,
        minH: item.minH,
        maxW: item.maxW,
        maxH: item.maxH,
    };
}

function mergeLayout(defaultLayout, savedLayout) {
    const savedById = new Map((savedLayout || []).map((item) => [item.i, item]));

    return defaultLayout.map((defaultItem) => {
        const savedItem = savedById.get(defaultItem.i);
        if (!savedItem) return cleanLayoutItem(defaultItem);

        return cleanLayoutItem({
            ...defaultItem,
            x: savedItem.x,
            y: savedItem.y,
            w: savedItem.w,
            h: savedItem.h,
        });
    });
}

function compactLayout(layout) {
    return PUSHING_COMPACTOR.compact(layout.map(cleanLayoutItem), GRID_COLS).map(cleanLayoutItem);
}

function requestLayoutReflow() {
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
    });
}

export default function DashboardLayoutEditor({
    layoutId,
    items,
    rowHeight = 82,
    helperText = 'Drag from the top edge and resize from the right edge, bottom edge, or bottom-right corner.',
}) {
    const savedLayout = useUiStore((state) => state.chartLayouts?.[layoutId]);
    const saveChartLayout = useUiStore((state) => state.setChartLayout);
    const resetChartLayout = useUiStore((state) => state.resetChartLayout);
    const [editing, setEditing] = useState(false);

    const defaultLayout = useMemo(() => (
        compactLayout(items.map((item) => cleanLayoutItem({ i: item.id, ...item.layout })))
    ), [items]);

    const persistedLayout = useMemo(() => (
        compactLayout(mergeLayout(defaultLayout, savedLayout))
    ), [defaultLayout, savedLayout]);

    const [draftLayout, setDraftLayout] = useState(persistedLayout);
    const latestLayoutRef = useRef(persistedLayout);

    const { width, containerRef, mounted } = useContainerWidth({
        initialWidth: 1200,
    });

    const compact = mounted && width < COMPACT_WIDTH;

    useEffect(() => {
        if (!editing) {
            latestLayoutRef.current = persistedLayout;
            setDraftLayout(persistedLayout);
        }
    }, [editing, persistedLayout]);

    const activeLayout = editing ? draftLayout : persistedLayout;

    const startEditing = () => {
        latestLayoutRef.current = persistedLayout;
        setDraftLayout(persistedLayout);
        setEditing(true);
    };

    const cancelEditing = () => {
        latestLayoutRef.current = persistedLayout;
        setDraftLayout(persistedLayout);
        setEditing(false);
    };

    const saveLayout = () => {
        const cleanLayout = compactLayout(latestLayoutRef.current);
        saveChartLayout(layoutId, cleanLayout);
        setDraftLayout(cleanLayout);
        setEditing(false);
        requestLayoutReflow();
    };

    const resetLayout = () => {
        resetChartLayout(layoutId);
        latestLayoutRef.current = defaultLayout;
        setDraftLayout(defaultLayout);
        requestLayoutReflow();
    };

    const updateLatestLayout = (nextLayout) => {
        if (!editing) return;
        latestLayoutRef.current = compactLayout(nextLayout);
    };

    const commitLatestLayout = (nextLayout) => {
        if (!editing) return;
        const cleanLayout = compactLayout(nextLayout);
        latestLayoutRef.current = cleanLayout;
        setDraftLayout(cleanLayout);
        requestLayoutReflow();
    };

    return (
        <section className={`dashboard-layout-editor ${editing ? 'is-editing' : ''}`}>
            <header className="dashboard-layout-editor-head">
                <div>
                    <span className="dashboard-layout-badge">Layout</span>
                    <p>{editing ? helperText : 'Customize this page layout whenever you want.'}</p>
                </div>

                <div className="dashboard-layout-editor-actions">
                    {editing ? (
                        <>
                            <Button
                                variant="gray"
                                text="Cancel"
                                icon="close"
                                iconPosition="left"
                                effects="none"
                                onClick={cancelEditing}
                            />
                            <Button
                                variant="gray-border"
                                text="Reset"
                                icon="restart_alt"
                                iconPosition="left"
                                effects="none"
                                onClick={resetLayout}
                            />
                            <Button
                                variant="primary"
                                text="Save layout"
                                icon="save"
                                iconPosition="left"
                                textEffect="letters"
                                onClick={saveLayout}
                            />
                        </>
                    ) : (
                        <Button
                            variant="gray"
                            text="Customize layout"
                            icon="dashboard_customize"
                            iconPosition="left"
                            textEffect="letters"
                            onClick={startEditing}
                        />
                    )}
                </div>
            </header>

            <div ref={containerRef} className="dashboard-layout-editor-canvas">
                {compact || !mounted ? (
                    <div className="dashboard-layout-editor-stack">
                        {items.map((item) => (
                            <div className="dashboard-layout-card is-static" key={item.id}>
                                <div className="dashboard-layout-card-content">{item.content}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <ReactGridLayout
                        className="dashboard-layout-grid"
                        layout={activeLayout}
                        width={width}
                        autoSize
                        gridConfig={{
                            cols: GRID_COLS,
                            rowHeight,
                            margin: [16, 16],
                            containerPadding: [0, 0],
                        }}
                        compactor={PUSHING_COMPACTOR}
                        dragConfig={{
                            enabled: editing,
                            bounded: true,
                            handle: '.dashboard-layout-card-drag-region',
                            cancel: '.dashboard-layout-card-content',
                        }}
                        resizeConfig={{
                            enabled: editing,
                            handles: ['s', 'e', 'se'],
                        }}
                        onLayoutChange={updateLatestLayout}
                        onDragStop={commitLatestLayout}
                        onResizeStop={commitLatestLayout}
                    >
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className={`dashboard-layout-card ${editing ? 'is-editing' : ''}`}
                            >
                                {editing && (
                                    <div
                                        className="dashboard-layout-card-drag-region"
                                        aria-label={`Move ${item.title}`}
                                        title={`Move ${item.title}`}
                                    >
                                        <span>{item.title}</span>
                                    </div>
                                )}

                                <div className="dashboard-layout-card-content">{item.content}</div>
                            </div>
                        ))}
                    </ReactGridLayout>
                )}
            </div>
        </section>
    );
}
