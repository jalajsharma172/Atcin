'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { GameEngine } from '@/lib/game/GameEngine';

interface ControlPanelProps {
    game: GameEngine;
}

// Define specific types for the Web Speech API
interface SpeechRecognitionEvent {
    results: {
        [index: number]: {
            [index: number]: {
                transcript: string;
            };
        };
        length: number;
    };
}

interface SpeechRecognitionErrorEvent {
    error: string;
}

declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

export default function ControlPanel({ game }: ControlPanelProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // Function to submit command
    const submitCommand = useCallback((cmd: string) => {
        if (cmd.trim()) {
            game.parseAndExecute(cmd);
            setInputValue('');
        }
    }, [game]);

    // Format Command Logic - Strict Mode
    const formatCommand = (raw: string): string => {
        // 1. Normalize: Remove all spaces, uppercase
        const clean = raw.replace(/\s+/g, '').toUpperCase();
        if (clean.length < 7) return clean; // Not long enough to match pattern 6-1-X

        // Pattern: 6 chars (ID), 1 char (Cmd), Remainder (Arg)
        const part1 = clean.substring(0, 6);
        const part2 = clean.substring(6, 7);
        const part3 = clean.substring(7);

        // Result: Part1[Space]Part2[Space]Part3
        if (part3) {
            return `${part1} ${part2} ${part3}`;
        } else {
            return `${part1} ${part2}`;
        }
    };

    // Load Voices
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const loadVoices = () => {
                const vs = window.speechSynthesis.getVoices();
                setVoices(vs);
                // Set default if not set
                if (vs.length > 0 && !selectedVoiceURI) {
                    setSelectedVoiceURI(vs[0].voiceURI);
                }
            };

            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, [selectedVoiceURI]);

    // Initialize Speech Recognition once
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.lang = 'en-US';

                recognition.onresult = (event: SpeechRecognitionEvent) => {
                    const last = event.results.length - 1;
                    const transcript = event.results[last][0].transcript;
                    setInputValue(prev => {
                        const trimmed = prev.trim();
                        return trimmed ? `${trimmed} ${transcript}` : transcript;
                    });
                };

                recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                    console.error('Speech recognition error', event.error);
                };

                recognitionRef.current = recognition;
            }
        }
    }, []);

    // Manage Start/Stop based on isListening
    useEffect(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;

        // Ensure onend restarts if we are listening
        recognition.onend = () => {
            if (isListening) {
                try {
                    recognition.start();
                } catch (e) {
                    // ignore
                }
            }
        };

        if (isListening) {
            try {
                recognition.start();
            } catch (e) {
                // already started
            }
        } else {
            recognition.stop();
        }
    }, [isListening]);

    const isListeningRef = useRef(isListening);
    const selectedVoiceRef = useRef(selectedVoiceURI);

    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    useEffect(() => {
        selectedVoiceRef.current = selectedVoiceURI;
    }, [selectedVoiceURI]);


    // Update Logs & Speak
    useEffect(() => {
        game.onLog = (msg) => {
            setLogs(prev => {
                const newLogs = [...prev, msg];
                if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
                return newLogs;
            });

            // Text to Speech
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();

                // Only speak if user hasn't explicitly muted? (We don't have mute yet, assuming always on per request)
                // Filter echoes
                if (!msg.startsWith('>')) {
                    const utterance = new SpeechSynthesisUtterance(msg);
                    utterance.lang = 'en-US';
                    utterance.rate = 1.0;

                    // Set selected voice
                    const voices = window.speechSynthesis.getVoices();
                    const voice = voices.find(v => v.voiceURI === selectedVoiceRef.current);
                    if (voice) {
                        utterance.voice = voice;
                    }

                    window.speechSynthesis.speak(utterance);
                }
            }
        };

        return () => {
            game.onLog = undefined;
        };
    }, [game]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Handle Toggle
    const toggleVoice = useCallback(() => {
        setIsListening(prev => !prev);
        if (!isListening) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isListening]);

    // Global KeyDown for Shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Global Hotkeys
            if (e.key === '-') {
                e.preventDefault();
                toggleVoice();
                return;
            }

            // Only process others if listening
            if (!isListening) return;

            if (e.key === '1') {
                e.preventDefault();
                submitCommand(inputValue);
            } else if (e.key === '0') {
                e.preventDefault();
                setInputValue('');
            } else if (e.key === '*') {
                e.preventDefault();
                setInputValue(prev => formatCommand(prev));
            } else if (e.key === '+') {
                // Reset/Flush mic
                e.preventDefault();
                if (recognitionRef.current) {
                    recognitionRef.current.stop();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isListening, inputValue, submitCommand, toggleVoice]);

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            submitCommand(inputValue);
        }
        if (e.key === '*') {
            e.preventDefault();
            setInputValue(formatCommand(inputValue));
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
            <div className="flex gap-2">
                {/* Voice Selection */}
                <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-32 bg-black border border-green-500 text-green-500 text-xs font-mono p-1 focus:outline-none"
                    title="Select Text-to-Speech Voice"
                >
                    {voices.map(v => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name.slice(0, 20)}
                        </option>
                    ))}
                    {voices.length === 0 && <option value="">Default</option>}
                </select>

                <input
                    id="command-input"
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isListening ? "Listening... (+ reset, - toggle, * format)" : "Enter command"}
                    className={`flex-1 bg-black border ${isListening ? 'border-red-500' : 'border-green-500'} ${isListening ? 'text-red-500' : 'text-green-500'} p-2 font-mono uppercase focus:outline-none focus:border-white transition-colors duration-300`}
                    autoComplete="off"
                    onKeyDown={handleInputKeyDown}
                />
                <button
                    onClick={toggleVoice}
                    className={`px-4 py-2 font-mono font-bold transition-all duration-300 ${isListening
                        ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                        : 'bg-green-600 text-black hover:bg-green-500'
                        }`}
                >
                    {isListening ? 'MIC ON' : 'MIC OFF'}
                </button>
            </div>
        </div>
    );
}
