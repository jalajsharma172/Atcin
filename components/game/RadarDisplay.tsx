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

            animationId = requestAnimationFrame(loop);
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

        canvas.addEventListener('click', handleClick);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
            canvas.removeEventListener('click', handleClick);
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
