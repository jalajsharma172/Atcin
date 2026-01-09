'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameEngine } from '@/lib/game/GameEngine';
import RadarDisplay from './RadarDisplay';
import FlightStripList from './FlightStripList';
import ControlPanel from './ControlPanel';

export default function GameContainer() {
    const searchParams = useSearchParams();
    const airportCode = searchParams?.get('airport') || 'IGIA';

    // GameEngine is a class instance, not reactive state.
    // We use useState to initialize it lazily and once.
    const [game] = useState(() => new GameEngine());

    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        game.init(airportCode);
    }, [game, airportCode]);

    const toggleDetails = () => {
        if (game) {
            const newState = game.toggleDetails();
            setShowDetails(newState);
        }
    };

    return (
        <div className="flex w-screen h-screen bg-black text-green-500 overflow-hidden font-mono">
            <div className="flex-1 h-full relative">
                <RadarDisplay game={game} />
            </div>
            <div className="w-[300px] flex flex-col bg-[#111] h-full border-l border-green-900">
                <div className="mt-4 px-4">
                    <button
                        onClick={toggleDetails}
                        className={`w-full py-2 px-4 rounded border ${showDetails ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
                    >
                        {showDetails ? 'Hide Detailed View' : 'Show Detailed View'}
                    </button>
                </div>

                <FlightStripList game={game} />
                <ControlPanel game={game} />
            </div>
        </div>
    );
}
