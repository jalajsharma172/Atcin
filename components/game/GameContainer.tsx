'use client';

import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/lib/game/GameEngine';
import RadarDisplay from './RadarDisplay';
import FlightStripList from './FlightStripList';
import ControlPanel from './ControlPanel';

export default function GameContainer() {
    // GameEngine is a class instance, not reactive state.
    // We use useState to initialize it lazily and once.
    const [game] = useState(() => new GameEngine());

    return (
        <div className="flex w-screen h-screen bg-black text-green-500 overflow-hidden font-mono">
            <div className="flex-1 h-full relative">
                <RadarDisplay game={game} />
            </div>
            <div className="w-[300px] flex flex-col bg-[#111] h-full border-l border-green-900">
                <FlightStripList game={game} />
                <ControlPanel game={game} />
            </div>
        </div>
    );
}
