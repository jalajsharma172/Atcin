'use client';

import { useRef, useEffect, useState } from 'react';

interface HeadingCompassProps {
    onHeadingSelect?: (heading: number) => void;
    selectedAircraftId?: string | null;
}

export default function HeadingCompass({ onHeadingSelect, selectedAircraftId }: HeadingCompassProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredHeading, setHoveredHeading] = useState<number | null>(null);
    const compassSize = 180;
    const center = compassSize / 2;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, compassSize, compassSize);

        // Draw outer circle
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center, center, center - 10, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner circle
        ctx.strokeStyle = '#0a0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center, center, center - 25, 0, Math.PI * 2);
        ctx.stroke();

        // Draw degree markings and labels
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let deg = 0; deg < 360; deg += 10) {
            const rad = (deg - 90) * Math.PI / 180;
            const isMajor = deg % 30 === 0;

            // Outer point
            const outerRadius = center - 10;
            const x2 = center + Math.cos(rad) * outerRadius;
            const y2 = center + Math.sin(rad) * outerRadius;

            // Inner point for tick marks
            const tickLength = isMajor ? 15 : 8;
            const innerRadius = outerRadius - tickLength;
            const x1 = center + Math.cos(rad) * innerRadius;
            const y1 = center + Math.sin(rad) * innerRadius;

            // Draw tick mark
            ctx.strokeStyle = isMajor ? '#0f0' : '#0a0';
            ctx.lineWidth = isMajor ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw labels for cardinal and major directions
            if (deg % 30 === 0) {
                let label = '';
                if (deg === 0) label = 'N';
                else if (deg === 90) label = 'E';
                else if (deg === 180) label = 'S';
                else if (deg === 270) label = 'W';
                else label = deg.toString();

                const labelRadius = center - 35;
                const lx = center + Math.cos(rad) * labelRadius;
                const ly = center + Math.sin(rad) * labelRadius;

                ctx.fillStyle = '#0f0';
                ctx.font = label.length === 1 ? 'bold 12px monospace' : '9px monospace';
                ctx.fillText(label, lx, ly);
            }
        }

        // Draw hover indicator
        if (hoveredHeading !== null) {
            const rad = (hoveredHeading - 90) * Math.PI / 180;
            const innerR = center - 25;
            const outerR = center - 10;

            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(center + Math.cos(rad) * innerR, center + Math.sin(rad) * innerR);
            ctx.lineTo(center + Math.cos(rad) * outerR, center + Math.sin(rad) * outerR);
            ctx.stroke();

            // Draw heading value
            ctx.fillStyle = '#ff0';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(hoveredHeading.toString().padStart(3, '0') + '°', center, center);
        } else {
            // Draw center indicator
            ctx.fillStyle = '#0f0';
            ctx.font = '10px monospace';
            ctx.fillText('HDG', center, center);
        }

    }, [hoveredHeading]);

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - center;
        const y = e.clientY - rect.top - center;

        // Calculate distance from center
        const distance = Math.sqrt(x * x + y * y);

        // Only show hover when mouse is over the compass ring
        if (distance >= center - 25 && distance <= center - 10) {
            let angle = Math.atan2(y, x) * 180 / Math.PI;
            angle = 90 - angle;
            if (angle < 0) angle += 360;

            // Round to nearest 5 degrees
            const heading = Math.round(angle / 5) * 5;
            setHoveredHeading(heading === 360 ? 0 : heading);
        } else {
            setHoveredHeading(null);
        }
    };

    const handleMouseLeave = () => {
        setHoveredHeading(null);
    };

    const handleClick = () => {
        if (hoveredHeading !== null && onHeadingSelect) {
            onHeadingSelect(hoveredHeading);
        }
    };

    return (
        <div className="absolute bottom-4 right-4 bg-black/80 border-2 border-green-500 p-2 rounded-lg pointer-events-auto">
            <canvas
                ref={canvasRef}
                width={compassSize}
                height={compassSize}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                className="cursor-crosshair"
            />
            {selectedAircraftId && (
                <div className="text-center text-green-500 text-xs font-mono mt-1">
                    {selectedAircraftId}
                </div>
            )}
        </div>
    );
}
