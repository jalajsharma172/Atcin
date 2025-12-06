import { Aircraft } from '@/lib/game/Aircraft';

interface FlightStripProps {
    aircraft: Aircraft;
    onClick: (id: string) => void;
}

export default function FlightStrip({ aircraft, onClick }: FlightStripProps) {
    const isArrival = aircraft.isArrival;

    // Arrow for altitude trend
    let altArrow = '=';
    if (aircraft.targetAltitude > aircraft.altitude + 1) altArrow = '↑';
    if (aircraft.targetAltitude < aircraft.altitude - 1) altArrow = '↓';

    return (
        <div
            className={`p-2 mb-1 border border-gray-600 cursor-pointer text-sm font-mono
        ${isArrival ? 'bg-[#d2b48c] text-black' : 'bg-[#add8e6] text-black'}
      `}
            onClick={() => onClick(aircraft.id)}
        >
            <div className="flex justify-between">
                <strong>{aircraft.id}</strong>
                <span>{aircraft.type}</span>
            </div>
            <div className="flex justify-between">
                <span>{Math.round(aircraft.heading)}°</span>
                <span>{altArrow} {Math.round(aircraft.altitude)}</span>
                <span>{Math.round(aircraft.speed)}kt</span>
            </div>
            <div className="flex justify-between mt-1 text-xs">
                <span>
                    {aircraft.navFix ? aircraft.navFix.name : (aircraft.landingRunway ? 'L ' + aircraft.landingRunway.name : '')}
                </span>
            </div>
        </div>
    );
}
