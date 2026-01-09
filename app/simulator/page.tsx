import { Suspense } from 'react';
import GameContainer from '@/components/game/GameContainer';

export default function SimulatorPage() {
    return (
        <main className="min-h-screen bg-black">
            <Suspense fallback={<div className="text-white p-10">Loading Simulator...</div>}>
                <GameContainer />
            </Suspense>
        </main>
    );
}
