'use client';

import { useEffect, useState, useRef } from 'react';
import { GameEngine } from '@/lib/game/GameEngine';
import { Aircraft } from '@/lib/game/Aircraft';
import FlightStrip from './FlightStrip';

interface FlightStripListProps {
    game: GameEngine;
}

export default function FlightStripList({ game }: FlightStripListProps) {
    const [stripAircrafts, setStripAircrafts] = useState<Aircraft[]>([]);
    // We use a counter to force re-renders for data updates
    const [tick, setTick] = useState(0);

    useEffect(() => {
        // Initial sync
        setStripAircrafts([...game.aircrafts]);

        const handleAdd = (ac: Aircraft) => {
            setStripAircrafts(prev => [...prev, ac]);
        };

        const handleRemove = (ac: Aircraft) => {
            setStripAircrafts(prev => prev.filter(a => a.id !== ac.id));
        };

        game.onAircraftAdded = handleAdd;
        game.onAircraftRemoved = handleRemove;

        // Polling for data updates (2Hz)
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 500);

        return () => {
            game.onAircraftAdded = undefined;
            game.onAircraftRemoved = undefined;
            clearInterval(interval);
        };
    }, [game]);

    const handleStripClick = (id: string) => {
        const input = document.getElementById('command-input') as HTMLInputElement;
        if (input) {
            input.value = id + ' ';
            input.focus();
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-2 bg-[#111] border-l-2 border-green-500">
            {stripAircrafts.map(ac => (
                <FlightStrip key={ac.id} aircraft={ac} onClick={handleStripClick} />
            ))}
            <div className='hidden'>{tick}</div>
            {/* Hidden tick dependency to ensure re-render? 
          Actually map will re-render if state changes, but if object properties change in place, 
          React might not detect it without a new array or state.
          
          Since we are using the same aircraft objects, we need to force update.
          The `tick` state change triggers a re-render of this component.
          The map iterates over the SAME objects, but since the parent re-renders, 
          the children (FlightStrip) should re-render if they are not memoized, 
          or if we pass the property values explicitly?
          
          FlightStrip takes `aircraft` object. 
          If `FlightStrip` reads `aircraft.altitude` in render, it will show new values.
      */}
        </div>
    );
}
