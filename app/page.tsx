'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [selectedAirport, setSelectedAirport] = useState('IGIA');
  const [airports, setAirports] = useState([
    { code: 'IGIA', name: "Indira Gandhi International" }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/airports')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setAirports(data);
          setSelectedAirport(data[0].code);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load airports:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-orange-500">ATC-SIM</h1>
          <div className="space-x-4">
            <Link href="/airport-editor">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                AIRPORT EDITOR
              </button>
            </Link>
            <Link href={`/simulator?airport=${selectedAirport}`}>
              <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded">
                START SIMULATOR
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content Area - Scrollable */}
      <main className="container mx-auto p-4 md:p-8 space-y-8">

        {/* Welcome Section */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold mb-4">Welcome to ATC Simulator</h2>
          <p className="mb-4">
            This is a web-based Air Traffic Control simulation. Guide aircraft safely to their destinations.
          </p>
        </section>

        {/* Game Setup Section */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* Left Column: Settings */}
          <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-xl font-semibold mb-4 text-orange-600 border-b pb-2">Game Setup</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Airport</label>
              <select
                value={selectedAirport}
                onChange={(e) => setSelectedAirport(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              >
                {airports.map((ap) => (
                  <option key={ap.code} value={ap.code}>{ap.name} ({ap.code})</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <span className="block text-sm font-medium text-slate-700 mb-2">Difficulty</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="diff" defaultChecked /> Normal
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="diff" /> Hard
                </label>
              </div>
            </div>

            <Link href={`/simulator?airport=${selectedAirport}`}>
              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded text-lg transition-colors">
                PLAY NOW &rarr;
              </button>
            </Link>
          </section>

          {/* Right Column: Instructions */}
          <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 h-fit">
            <h3 className="text-lg font-semibold mb-3">Quick Instructions</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
              <li>Use the radar to track aircraft.</li>
              <li>Maintain separation of 3 miles or 1000 feet.</li>
              <li>Issue commands via text or voice.</li>
              <li><strong>Example:</strong> "AFR123 Climb 5000"</li>
            </ul>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <strong>Tip:</strong> Ensure your microphone is allowed for voice commands.
            </div>
          </section>
        </div>

        {/* Dummy Content to Force Scroll (if screen is tall) */}
        <section className="mt-12 pt-12 border-t text-slate-400 text-center">
          <p>ATC Simulator Project &copy; 2026</p>
          <div className="h-24"></div>
        </section>

      </main>
    </div>
  );
}
