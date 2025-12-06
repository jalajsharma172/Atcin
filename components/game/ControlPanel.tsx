'use client';

import { useEffect, useState, useRef } from 'react';
import { GameEngine } from '@/lib/game/GameEngine';

interface ControlPanelProps {
    game: GameEngine;
}

export default function ControlPanel({ game }: ControlPanelProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        game.onLog = (msg) => {
            setLogs(prev => {
                const newLogs = [...prev, msg];
                if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
                return newLogs;
            });
        };

        return () => {
            game.onLog = undefined;
        };
    }, [game]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const val = e.currentTarget.value;
            if (val.trim()) {
                game.parseAndExecute(val);
                e.currentTarget.value = '';
            }
        }
    };

    return (
        <div className="h-48 border-t-2 border-green-500 flex flex-col bg-[#111] p-2">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto font-mono text-xs text-gray-400 mb-2 whitespace-pre-wrap"
            >
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>
            <input
                id="command-input"
                ref={inputRef}
                type="text"
                placeholder="Enter command (e.g. AAL123 C 090)"
                className="w-full bg-black border border-green-500 text-green-500 p-2 font-mono uppercase focus:outline-none focus:border-white"
                autoComplete="off"
                onKeyDown={handleKeyDown}
            />
        </div>
    );
}
