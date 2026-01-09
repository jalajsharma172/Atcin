'use client';

import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/lib/game/GameEngine';
import HeadingCompass from './HeadingCompass';

interface RadarDisplayProps {
    game: GameEngine;
}

export default function RadarDisplay({ game }: RadarDisplayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);

    // Interaction state refs to avoid re-renders
    const isDraggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            game.resize(canvas.width, canvas.height);
        };

        window.addEventListener('resize', resize);
        resize();

        let animationId: number;

        const loop = (time: number) => {
            const dt = (time - game.lastTime) / 1000;
            game.lastTime = time;

            const safeDt = Math.min(dt, 0.1);

            game.update(safeDt);
            game.draw(ctx, canvas.width, canvas.height);

            // Update cursor based on mode
            if (game.showDetails) {
                canvas.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
            } else {
                canvas.style.cursor = 'crosshair';
            }

            animationId = requestAnimationFrame(loop);

            // Update cursor style logic
            const updateCursor = () => {
                if (game.showDetails) {
                    if (canvas) canvas.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
                } else {
                    if (canvas) canvas.style.cursor = 'default';
                }
            };
            // Hook into the loop for cursor updates or just verify periodically? 
            // Better to check on toggle. For now, let's keep it simple.
        };

        animationId = requestAnimationFrame(loop);

        const handleHeadingSelect = (heading: number) => {
            if (selectedAircraftId) {
                const input = document.getElementById('command-input') as HTMLInputElement;
                if (input) {
                    input.value = `${selectedAircraftId} C ${heading.toString().padStart(3, '0')}`;
                    input.focus();
                }
            }
        };

        const handleClick = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const id = game.handleClick(e.clientX, e.clientY, rect.left, rect.top);
            if (id) {
                setSelectedAircraftId(id);
                const input = document.getElementById('command-input') as HTMLInputElement;
                if (input) {
                    input.value = id + ' ';
                    input.focus();
                }
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (game.showDetails) {
                e.preventDefault();
                game.handleZoom(e.deltaY);
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (game.showDetails) {
                isDraggingRef.current = true;
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
                if (canvas) canvas.style.cursor = 'grabbing';
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current && game.showDetails) {
                const dx = e.clientX - lastMousePosRef.current.x;
                const dy = e.clientY - lastMousePosRef.current.y;
                game.handlePan(dx, dy);
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            if (canvas && game.showDetails) canvas.style.cursor = 'grab';
        };

        canvas.addEventListener('click', handleClick);
        canvas.addEventListener('wheel', handleWheel);
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
            canvas.removeEventListener('click', handleClick);
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [game]);

    return (
        <div ref={containerRef} className="w-full h-full bg-black relative overflow-hidden border-r-2 border-green-500">
            <canvas ref={canvasRef} className="block w-full h-full" />
            <div className="absolute top-2 left-2 bg-black/70 p-2 border border-green-500 text-green-500 font-mono text-sm pointer-events-none">
                <div>Airport: {game.airport.name}</div>
                <div>Scores are tracked internally</div>
            </div>
            <HeadingCompass
                onHeadingSelect={(heading) => {
                    if (selectedAircraftId) {
                        const input = document.getElementById('command-input') as HTMLInputElement;
                        if (input) {
                            input.value = `${selectedAircraftId} C ${heading.toString().padStart(3, '0')}`;
                            input.focus();
                        }
                    }
                }}
                selectedAircraftId={selectedAircraftId}
            />
        </div>
    );
}
