'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';

// Types
interface Point {
    x: number;
    y: number;
}

interface Runway {
    name: string;
    heading: number;
    length: number;
    rectangle: Point[];
    // Legacy/Game compatibility
    threshold?: Point;
    x?: number;
    y?: number;
    endX?: number;
    endY?: number;
}

interface Terminal {
    id: string;
    name: string;
    position: Point;
    polygon: Point[];
    gates: string[];
    // Legacy/Game compatibility
    apron?: {
        polygon: Point[];
    };
}

interface Taxiway {
    name: string;
    type: 'LineString';
    points: Point[];
    // Legacy/Game compatibility
    from?: string;
    to?: string;
}

interface BackgroundSettings {
    opacity: number;
    scale: number;
    x: number;
    y: number;
}

interface AirportData {
    code: string;
    name: string;
    elevation: number;
    runways: Runway[];
    terminals: Terminal[];
    taxiways: Taxiway[];
    // Legacy/Game compatibility
    taxiwayNodes?: Record<string, Point>;
    fixes?: Record<string, Point>;
    groundRules: {
        maxTaxiSpeed: number;
        apronSpeed: number;
        holdShortDistance: number;
        runwayCrossingRequiresClearance: boolean;
    };
}

type Tool = 'rectangle' | 'polygon' | 'line' | 'select';

interface Selection {
    type: 'runway' | 'terminal' | 'taxiway';
    index: number;
}

export default function AirportEditorPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<Tool>('select');
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const [startPoint, setStartPoint] = useState<Point | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [redrawingIndex, setRedrawingIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Point | null>(null);
    const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);

    // Background Image State
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
    const [showBgControls, setShowBgControls] = useState(false);
    const [bgSettings, setBgSettings] = useState<BackgroundSettings>({
        opacity: 0.5,
        scale: 1,
        x: 0,
        y: 0,
    });

    const [isRotating, setIsRotating] = useState(false);
    const [dragStartAngle, setDragStartAngle] = useState(0);
    const [initialHeading, setInitialHeading] = useState(0);
    const [isHoveringRotationHandle, setIsHoveringRotationHandle] = useState(false);

    // Undo history
    const [history, setHistory] = useState<AirportData[]>([]);
    const maxHistorySize = 50;

    // Airport data
    const [airportData, setAirportData] = useState<AirportData>({
        code: 'NEW',
        name: 'New Airport',
        elevation: 0,
        runways: [],
        terminals: [],
        taxiways: [],
        groundRules: {
            maxTaxiSpeed: 25,
            apronSpeed: 10,
            holdShortDistance: 0.04,
            runwayCrossingRequiresClearance: true,
        },
    });

    // Canvas settings - 1 NM = 120 pixels
    const PIXELS_PER_NM = 120;
    const [scale, setScale] = useState(PIXELS_PER_NM); // pixels per nautical mile
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Counters for naming
    const [runwayCount, setRunwayCount] = useState(1);
    const [terminalCount, setTerminalCount] = useState(1);
    const [taxiwayCount, setTaxiwayCount] = useState(1);

    // JSON Editor state
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [isJsonEditing, setIsJsonEditing] = useState(false);

    // Sync airportData change to jsonText
    useEffect(() => {
        // Only update if we are not currently editing the JSON
        if (!isJsonEditing) {
            // Ensure derived fields are not lost during sync
            setJsonText(JSON.stringify(airportData, null, 2));
            setJsonError(null);
        }
    }, [airportData, isJsonEditing]);

    // Sanitize airportData effect removed to prevent race conditions.
    // Safety is handled in handleJsonChange and initial state.

    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setJsonText(newText);

        try {
            const parsed = JSON.parse(newText);
            // Basic validation
            if (typeof parsed === 'object' && parsed !== null) {
                // Ensure properly typed arrays to prevent undefined errors later
                const safeData = {
                    ...parsed,
                    code: parsed.code || 'NEW',
                    name: parsed.name || 'New Airport',
                    elevation: parsed.elevation || 0,
                    runways: Array.isArray(parsed.runways) ? parsed.runways : [],
                    terminals: Array.isArray(parsed.terminals) ? parsed.terminals : [],
                    taxiways: Array.isArray(parsed.taxiways) ? parsed.taxiways : [],
                    groundRules: parsed.groundRules || {
                        maxTaxiSpeed: 25,
                        apronSpeed: 10,
                        holdShortDistance: 0.04,
                        runwayCrossingRequiresClearance: true,
                    },
                } as AirportData;

                setAirportData(safeData);
                setJsonError(null);
            }
        } catch (err) {
            setJsonError((err as Error).message);
        }
    };

    // Save state to history before making changes
    const saveToHistory = useCallback(() => {
        setHistory(prev => {
            const newHistory = [...prev, JSON.parse(JSON.stringify(airportData))];
            if (newHistory.length > maxHistorySize) {
                return newHistory.slice(-maxHistorySize);
            }
            return newHistory;
        });
    }, [airportData]);

    // Undo function
    const undo = useCallback(() => {
        if (history.length > 0) {
            const previousState = history[history.length - 1];
            setHistory(prev => prev.slice(0, -1));
            setAirportData(previousState);
            setSelection(null);
        }
    }, [history]);

    // Convert canvas coords to world coords (in nautical miles)
    const canvasToWorld = useCallback((canvasX: number, canvasY: number): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const centerX = canvas.width / 2 + offset.x;
        const centerY = canvas.height / 2 + offset.y;
        return {
            x: ((canvasX - centerX) / scale),
            y: ((centerY - canvasY) / scale), // Flip Y axis
        };
    }, [offset.x, offset.y, scale]);

    // Convert world coords to canvas coords
    const worldToCanvas = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const centerX = canvas.width / 2 + offset.x;
        const centerY = canvas.height / 2 + offset.y;
        return {
            x: centerX + worldX * scale,
            y: centerY - worldY * scale, // Flip Y axis
        };
    }, [offset.x, offset.y, scale]);

    // Rotate a point around a center
    const rotatePoint = (point: Point, center: Point, angleDegrees: number): Point => {
        const angleRad = (angleDegrees * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return {
            x: center.x + dx * cos - dy * sin,
            y: center.y + dx * sin + dy * cos,
        };
    };

    // Rotate selected runway
    const rotateSelectedRunway = (angleDegrees: number) => {
        if (!selection || selection.type !== 'runway') return;

        saveToHistory();

        setAirportData(prev => {
            const runway = prev.runways[selection.index];
            if (!runway) return prev;

            const centerX = runway.rectangle.slice(0, 4).reduce((sum, p) => sum + p.x, 0) / 4;
            const centerY = runway.rectangle.slice(0, 4).reduce((sum, p) => sum + p.y, 0) / 4;
            const center = { x: centerX, y: centerY };

            const rotatedRectangle = runway.rectangle.map(p => rotatePoint(p, center, angleDegrees));
            const newHeading = (runway.heading + angleDegrees + 360) % 360;

            const updatedRunways = [...prev.runways];
            updatedRunways[selection.index] = {
                ...runway,
                rectangle: rotatedRectangle,
                heading: Math.round(newHeading),
            };

            return {
                ...prev,
                runways: updatedRunways,
            };
        });
    };

    // Delete selected shape
    const deleteSelected = () => {
        if (!selection) return;

        saveToHistory();

        setAirportData(prev => {
            if (selection.type === 'runway') {
                return {
                    ...prev,
                    runways: prev.runways.filter((_, i) => i !== selection.index),
                };
            } else if (selection.type === 'terminal') {
                return {
                    ...prev,
                    terminals: prev.terminals.filter((_, i) => i !== selection.index),
                };
            } else if (selection.type === 'taxiway') {
                return {
                    ...prev,
                    taxiways: prev.taxiways.filter((_, i) => i !== selection.index),
                };
            }
            return prev;
        });
        setSelection(null);
    };

    // Check if a point is inside a polygon
    const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    };

    // Check if a point is near a line
    const isPointNearLine = (point: Point, linePoints: Point[], threshold: number): boolean => {
        for (let i = 0; i < linePoints.length - 1; i++) {
            const p1 = linePoints[i];
            const p2 = linePoints[i + 1];
            const d = distanceToLineSegment(point, p1, p2);
            if (d < threshold) return true;
        }
        return false;
    };

    const distanceToLineSegment = (point: Point, p1: Point, p2: Point): number => {
        const A = point.x - p1.x;
        const B = point.y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        let xx, yy;
        if (param < 0) { xx = p1.x; yy = p1.y; }
        else if (param > 1) { xx = p2.x; yy = p2.y; }
        else { xx = p1.x + param * C; yy = p1.y + param * D; }
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Find shape at point
    const findShapeAtPoint = (worldPoint: Point): Selection | null => {
        // Check runways (rectangles)
        for (let i = airportData.runways.length - 1; i >= 0; i--) {
            if (isPointInPolygon(worldPoint, airportData.runways[i].rectangle)) {
                return { type: 'runway', index: i };
            }
        }
        // Check terminals (polygons)
        for (let i = airportData.terminals.length - 1; i >= 0; i--) {
            if (isPointInPolygon(worldPoint, airportData.terminals[i].polygon)) {
                return { type: 'terminal', index: i };
            }
        }
        // Check taxiways (lines) - with threshold
        const threshold = 0.3; // nautical miles
        for (let i = airportData.taxiways.length - 1; i >= 0; i--) {
            if (isPointNearLine(worldPoint, airportData.taxiways[i].points, threshold)) {
                return { type: 'taxiway', index: i };
            }
        }
        return null;
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setBgImage(img);
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    // Draw the canvas
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = '#0a1929';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2 + offset.x;
        const centerY = canvas.height / 2 + offset.y;

        // Draw Background Image
        if (bgImage) {
            ctx.save();
            ctx.globalAlpha = bgSettings.opacity;

            const imgCenter = worldToCanvas(bgSettings.x, bgSettings.y);
            // Zoom factor logic: scale is pixels/NM.
            // visual scale = bgSettings.scale (multiplier) * (scale / PIXELS_PER_NM)
            const zoomFactor = scale / PIXELS_PER_NM;
            const destW = bgImage.width * bgSettings.scale * zoomFactor;
            const destH = bgImage.height * bgSettings.scale * zoomFactor;

            ctx.translate(imgCenter.x, imgCenter.y);
            ctx.drawImage(bgImage, -destW / 2, -destH / 2, destW, destH);

            ctx.restore();
        }

        // Draw grid, axes, etc (omitted for brevity, assume standard grid code structure here or reuse)
        // Since we are replacing the whole function block, I will include the grid drawing code again to be safe.

        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 0.5;
        for (let x = centerX % scale; x < canvas.width; x += scale) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = centerY % scale; y < canvas.height; y += scale) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
        ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(canvas.width, centerY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, canvas.height); ctx.stroke();
        ctx.fillStyle = '#4fc3f7'; ctx.font = '12px monospace';
        ctx.fillText('X', canvas.width - 20, centerY - 10); ctx.fillText('Y', centerX + 10, 20);

        // Draw runways
        airportData.runways.forEach((runway, index) => {
            const isSelected = selection?.type === 'runway' && selection.index === index;
            ctx.fillStyle = isSelected ? 'rgba(255, 152, 0, 0.5)' : 'rgba(100, 100, 100, 0.7)';
            ctx.strokeStyle = isSelected ? '#ff5722' : '#ff9800';
            ctx.lineWidth = isSelected ? 3 : 2;

            if (runway.rectangle && runway.rectangle.length >= 4) {
                // New Format
                ctx.beginPath();
                const start = worldToCanvas(runway.rectangle[0].x, runway.rectangle[0].y);
                ctx.moveTo(start.x, start.y);
                for (let i = 1; i < runway.rectangle.length; i++) {
                    const pt = worldToCanvas(runway.rectangle[i].x, runway.rectangle[i].y);
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Draw vertices if selected
                if (isSelected) {
                    ctx.fillStyle = '#fff';
                    runway.rectangle.forEach(p => {
                        const pt = worldToCanvas(p.x, p.y);
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    });
                }

                // Draw rotation handle if selected
                if (isSelected) {
                    const center = {
                        x: runway.rectangle.reduce((s, p) => s + p.x, 0) / runway.rectangle.length,
                        y: runway.rectangle.reduce((s, p) => s + p.y, 0) / runway.rectangle.length
                    };

                    const rad = (runway.heading - 90) * (Math.PI / 180);
                    const handleDist = (runway.length / 2) + 1.5;
                    const handleWorld = {
                        x: center.x + handleDist * Math.cos(rad),
                        y: center.y - handleDist * Math.sin(rad) // World Y
                    };

                    const handleCanvas = worldToCanvas(handleWorld.x, handleWorld.y);
                    const centerCanvas = worldToCanvas(center.x, center.y);

                    // Draw line to handle
                    ctx.beginPath();
                    ctx.moveTo(centerCanvas.x, centerCanvas.y);
                    ctx.lineTo(handleCanvas.x, handleCanvas.y);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([2, 2]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw handle circle
                    ctx.beginPath();
                    ctx.arc(handleCanvas.x, handleCanvas.y, 6, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.strokeStyle = '#ff5722';
                    ctx.stroke();
                }

                // Label
                const labelPos = worldToCanvas(runway.rectangle[0].x, runway.rectangle[0].y);
                ctx.fillStyle = '#ff9800';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText(`${runway.name} (${runway.heading}°)`, labelPos.x + 5, labelPos.y - 5);
            } else if (runway.x !== undefined && runway.y !== undefined && runway.endX !== undefined && runway.endY !== undefined) {
                // Legacy Format - Line
                const start = worldToCanvas(runway.x, runway.y);
                const end = worldToCanvas(runway.endX, runway.endY);

                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.lineWidth = isSelected ? 10 : 8; // Simulate width
                ctx.stroke();

                const labelPos = start;
                ctx.fillStyle = '#ff9800';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText(`${runway.name} (${runway.heading}°)`, labelPos.x + 5, labelPos.y - 5);
            }
        });

        // Draw terminals
        airportData.terminals.forEach((terminal, index) => {
            const polygon = terminal.polygon || terminal.apron?.polygon;

            if (polygon && polygon.length >= 3) {
                const isSelected = selection?.type === 'terminal' && selection.index === index;
                ctx.fillStyle = isSelected ? 'rgba(33, 150, 243, 0.7)' : 'rgba(33, 150, 243, 0.5)';
                ctx.strokeStyle = isSelected ? '#1565c0' : '#2196f3';
                ctx.lineWidth = isSelected ? 3 : 2;
                ctx.beginPath();
                const start = worldToCanvas(polygon[0].x, polygon[0].y);
                ctx.moveTo(start.x, start.y);
                for (let i = 1; i < polygon.length; i++) {
                    const pt = worldToCanvas(polygon[i].x, polygon[i].y);
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Draw vertices if selected
                if (isSelected) {
                    ctx.fillStyle = '#fff';
                    polygon.forEach(p => {
                        const pt = worldToCanvas(p.x, p.y);
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    });
                }

                const labelPos = worldToCanvas(terminal.position.x, terminal.position.y);
                ctx.fillStyle = '#2196f3';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText(terminal.name, labelPos.x - 20, labelPos.y);
            }
        });

        // Draw taxiways
        airportData.taxiways.forEach((taxiway, index) => {
            const isSelected = selection?.type === 'taxiway' && selection.index === index;
            ctx.strokeStyle = isSelected ? '#ffc107' : '#ffeb3b';
            ctx.lineWidth = isSelected ? 5 : 3;

            if (taxiway.points && taxiway.points.length >= 2) {
                // New Format
                ctx.beginPath();
                const start = worldToCanvas(taxiway.points[0].x, taxiway.points[0].y);
                ctx.moveTo(start.x, start.y);
                for (let i = 1; i < taxiway.points.length; i++) {
                    const pt = worldToCanvas(taxiway.points[i].x, taxiway.points[i].y);
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();

                // Draw vertices if selected
                if (isSelected) {
                    ctx.fillStyle = '#fff';
                    taxiway.points.forEach(p => {
                        const pt = worldToCanvas(p.x, p.y);
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    });
                }

                const labelPos = worldToCanvas(taxiway.points[0].x, taxiway.points[0].y);
                ctx.fillStyle = '#ffeb3b';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(taxiway.name, labelPos.x + 5, labelPos.y - 5);
            } else if (taxiway.from && taxiway.to && airportData.taxiwayNodes) {
                // Legacy Format
                const nodeA = airportData.taxiwayNodes[taxiway.from];
                const nodeB = airportData.taxiwayNodes[taxiway.to];
                if (nodeA && nodeB) {
                    const start = worldToCanvas(nodeA.x, nodeA.y);
                    const end = worldToCanvas(nodeB.x, nodeB.y);
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    ctx.lineTo(end.x, end.y);
                    ctx.stroke();
                }
            }
        });

        // Draw current drawing
        if (currentPoints.length > 0) {
            ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
            ctx.beginPath();
            const start = worldToCanvas(currentPoints[0].x, currentPoints[0].y);
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i < currentPoints.length; i++) {
                const pt = worldToCanvas(currentPoints[i].x, currentPoints[i].y);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            currentPoints.forEach((pt) => {
                const canvasPt = worldToCanvas(pt.x, pt.y);
                ctx.beginPath(); ctx.arc(canvasPt.x, canvasPt.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#4caf50'; ctx.fill();
            });
            ctx.setLineDash([]);
        }
    }, [airportData, currentPoints, offset, scale, selection, worldToCanvas, bgImage, bgSettings]);

    // Resize canvas to fit container
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const container = canvas.parentElement;
            if (!container) return;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            draw();
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [draw]);

    // Redraw when data changes
    useEffect(() => {
        draw();
    }, [draw]);

    // Mouse handlers
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPoint = canvasToWorld(x, y);

        // Handle moving (dragging)
        if (isDragging && selection && dragStart) {
            const dx = worldPoint.x - dragStart.x;
            const dy = worldPoint.y - dragStart.y;

            setAirportData(prev => {
                if (selection.type === 'runway') {
                    const updatedRunways = [...prev.runways];
                    const r = updatedRunways[selection.index];
                    if (!r) return prev;

                    updatedRunways[selection.index] = {
                        ...r,
                        rectangle: r.rectangle.map(p => ({ x: p.x + dx, y: p.y + dy })),
                    };
                    return { ...prev, runways: updatedRunways };
                } else if (selection.type === 'terminal') {
                    const updatedTerminals = [...prev.terminals];
                    const t = updatedTerminals[selection.index];
                    if (!t) return prev;

                    updatedTerminals[selection.index] = {
                        ...t,
                        position: { x: t.position.x + dx, y: t.position.y + dy },
                        polygon: t.polygon.map(p => ({ x: p.x + dx, y: p.y + dy })),
                    };
                    return { ...prev, terminals: updatedTerminals };
                } else if (selection.type === 'taxiway') {
                    const updatedTaxiways = [...prev.taxiways];
                    const t = updatedTaxiways[selection.index];
                    if (!t) return prev;

                    updatedTaxiways[selection.index] = {
                        ...t,
                        points: t.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
                    };
                    return { ...prev, taxiways: updatedTaxiways };
                }
                return prev;
            });
            setDragStart(worldPoint);
            return;
        }

        // Handle vertex dragging
        if (dragVertexIndex !== null && selection) {
            setAirportData(prev => {
                if (selection.type === 'runway') {
                    const updatedRunways = [...prev.runways];
                    const r = updatedRunways[selection.index];
                    if (!r) return prev;
                    if (r.rectangle && r.rectangle[dragVertexIndex]) {
                        const newRect = [...r.rectangle];
                        newRect[dragVertexIndex] = worldPoint;
                        updatedRunways[selection.index] = { ...r, rectangle: newRect };
                    }
                    return { ...prev, runways: updatedRunways };
                } else if (selection.type === 'terminal') {
                    const updatedTerminals = [...prev.terminals];
                    const t = updatedTerminals[selection.index];
                    if (!t) return prev;
                    // Check main polygon
                    if (t.polygon && t.polygon[dragVertexIndex]) {
                        const newPoly = [...t.polygon];
                        newPoly[dragVertexIndex] = worldPoint;
                        updatedTerminals[selection.index] = { ...t, polygon: newPoly };
                    }
                    return { ...prev, terminals: updatedTerminals };
                } else if (selection.type === 'taxiway') {
                    const updatedTaxiways = [...prev.taxiways];
                    const t = updatedTaxiways[selection.index];
                    if (!t) return prev;
                    if (t.points && t.points[dragVertexIndex]) {
                        const newPoints = [...t.points];
                        newPoints[dragVertexIndex] = worldPoint;
                        updatedTaxiways[selection.index] = { ...t, points: newPoints };
                    }
                    return { ...prev, taxiways: updatedTaxiways };
                }
                return prev;
            });
            return;
        }

        // Handle rotation drag
        if (isRotating && selection?.type === 'runway') {
            const runway = airportData.runways[selection.index];
            if (!runway) return;

            const center = {
                x: runway.rectangle.reduce((s, p) => s + p.x, 0) / runway.rectangle.length,
                y: runway.rectangle.reduce((s, p) => s + p.y, 0) / runway.rectangle.length
            };

            const dx = worldPoint.x - center.x;
            const dy = worldPoint.y - center.y;
            // Angle in degrees standard math (0 is East, 90 is North)
            const currentAngleMath = Math.atan2(dy, dx) * (180 / Math.PI);

            // Calculate delta rotation
            const deltaAngle = currentAngleMath - dragStartAngle;

            // Apply delta to initial heading
            // Aviation heading is CW from North (Y+). Math angle is CCW from East (X+).
            // If math angle increases (CCW), aviation heading should decrease (CCW).
            // So, newHeading = initialHeading - deltaAngle.
            let newHeading = (initialHeading - deltaAngle + 360) % 360;
            if (newHeading < 0) newHeading += 360; // Ensure positive

            // Only update if changed visually enough or throttle? React is fast enough.
            const currentRunwayHeading = runway.heading;
            const angleDiff = newHeading - currentRunwayHeading;

            if (Math.abs(angleDiff) > 0.1) { // Threshold to prevent excessive updates
                setAirportData(prev => {
                    const updatedRunways = [...prev.runways];
                    const currentRunway = updatedRunways[selection.index];
                    if (!currentRunway) return prev;

                    // Rotate points by the difference from current heading to new heading
                    // rotatePoint is CCW, so for a CW heading change, we need -angleDiff
                    const rotatedRectangle = currentRunway.rectangle.map(p => rotatePoint(p, center, -angleDiff));

                    updatedRunways[selection.index] = {
                        ...currentRunway,
                        rectangle: rotatedRectangle,
                        heading: Math.round(newHeading),
                    };

                    return {
                        ...prev,
                        runways: updatedRunways
                    };
                });
            }
        }

        // Check hover over rotation handle
        if (!isRotating && selection?.type === 'runway') {
            const runway = airportData.runways[selection.index];
            if (runway) {
                const center = {
                    x: runway.rectangle.reduce((s, p) => s + p.x, 0) / runway.rectangle.length,
                    y: runway.rectangle.reduce((s, p) => s + p.y, 0) / runway.rectangle.length
                };
                const rad = (runway.heading - 90) * (Math.PI / 180);
                const handleDist = (runway.length / 2) + 1.5;
                const handleWorld = {
                    x: center.x + handleDist * Math.cos(rad),
                    y: center.y - handleDist * Math.sin(rad)
                };
                const dist = Math.sqrt(Math.pow(worldPoint.x - handleWorld.x, 2) + Math.pow(worldPoint.y - handleWorld.y, 2));

                if (dist < 0.5) {
                    setIsHoveringRotationHandle(true);
                } else {
                    setIsHoveringRotationHandle(false);
                }
            }
        } else {
            setIsHoveringRotationHandle(false);
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPoint = canvasToWorld(x, y);

        // Check for rotation handle click
        if (selection?.type === 'runway') {
            const runway = airportData.runways[selection.index];
            if (runway) {
                const center = {
                    x: runway.rectangle.reduce((s, p) => s + p.x, 0) / runway.rectangle.length,
                    y: runway.rectangle.reduce((s, p) => s + p.y, 0) / runway.rectangle.length
                };
                const rad = (runway.heading - 90) * (Math.PI / 180);
                const handleDist = (runway.length / 2) + 1.5;
                const handleWorld = {
                    x: center.x + handleDist * Math.cos(rad),
                    y: center.y - handleDist * Math.sin(rad)
                };

                // Check if clicked near handle (0.5 NM radius tolerance)
                const dist = Math.sqrt(Math.pow(worldPoint.x - handleWorld.x, 2) + Math.pow(worldPoint.y - handleWorld.y, 2));

                if (dist < 0.5) {
                    setIsRotating(true);
                    setInitialHeading(runway.heading);
                    // Angle from center to mouse (math angle: CCW from East)
                    setDragStartAngle(Math.atan2(worldPoint.y - center.y, worldPoint.x - center.x) * (180 / Math.PI));
                    saveToHistory();
                    return;
                }
            }
        }

        if (tool === 'select') {
            // Check for vertex click first
            if (selection) {
                let points: Point[] = [];
                if (selection.type === 'runway' && airportData.runways[selection.index]?.rectangle) {
                    points = airportData.runways[selection.index].rectangle;
                } else if (selection.type === 'terminal' && airportData.terminals[selection.index]?.polygon) {
                    points = airportData.terminals[selection.index].polygon;
                } else if (selection.type === 'taxiway' && airportData.taxiways[selection.index]?.points) {
                    points = airportData.taxiways[selection.index].points;
                }

                for (let i = 0; i < points.length; i++) {
                    const dist = Math.sqrt(Math.pow(worldPoint.x - points[i].x, 2) + Math.pow(worldPoint.y - points[i].y, 2));
                    if (dist < 0.2) { // Tolerance for vertex click
                        setDragVertexIndex(i);
                        saveToHistory();
                        return;
                    }
                }
            }

            const found = findShapeAtPoint(worldPoint);
            setSelection(found);
            if (found) {
                setIsDragging(true);
                setDragStart(worldPoint);
                saveToHistory(); // Save state before starting drag edit
            }
        } else if (tool === 'rectangle') {
            setIsDrawing(true);
            setStartPoint(worldPoint);
        } else if (tool === 'polygon' || tool === 'line') {
            // Check for closing polygon (click on start point)
            if (tool === 'polygon' && currentPoints.length >= 3) {
                const start = currentPoints[0];
                const dist = Math.sqrt(Math.pow(worldPoint.x - start.x, 2) + Math.pow(worldPoint.y - start.y, 2));
                // Tolerance 0.5 NM (approx 60px)
                if (dist < 0.5) {
                    finishTerminal();
                    return;
                }
            }
            setCurrentPoints([...currentPoints, worldPoint]);
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isRotating) {
            setIsRotating(false);
            return;
        }

        if (dragVertexIndex !== null) {
            setDragVertexIndex(null);
            return;
        }

        if (isDragging) {
            setIsDragging(false);
            setDragStart(null);
            return;
        }

        if (tool === 'rectangle' && isDrawing && startPoint) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const endPoint = canvasToWorld(x, y);

            const dist = Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2));
            if (dist < 0.1) {
                // Ignore drags smaller than 0.1 NM (prevent accidental clicks)
                setIsDrawing(false);
                setStartPoint(null);
                return;
            }

            saveToHistory();

            // Create a closed loop (5 points) so the start and end connect
            const rectangle: Point[] = [
                { x: startPoint.x, y: startPoint.y },
                { x: endPoint.x, y: startPoint.y },
                { x: endPoint.x, y: endPoint.y },
                { x: startPoint.x, y: endPoint.y },
                { x: startPoint.x, y: startPoint.y }, // Closing point (same as start)
            ];

            if (redrawingIndex !== null) {
                setAirportData(prev => {
                    const updated = [...prev.runways];
                    if (updated[redrawingIndex]) {
                        updated[redrawingIndex] = {
                            ...updated[redrawingIndex],
                            heading: 0,
                            length: Math.abs(endPoint.x - startPoint.x),
                            rectangle,
                        };
                    }
                    return { ...prev, runways: updated };
                });
                setSelection({ type: 'runway', index: redrawingIndex });
                setRedrawingIndex(null);
            } else {
                const newRunway: Runway = {
                    name: `RWY_${runwayCount}`,
                    heading: 0,
                    length: Math.abs(endPoint.x - startPoint.x),
                    rectangle,
                };

                setAirportData(prev => ({
                    ...prev,
                    runways: [...prev.runways, newRunway],
                }));
                setRunwayCount(prev => prev + 1);
            }

            setIsDrawing(false);
            setStartPoint(null);
        }
    };

    const finishTerminal = () => {
        if (currentPoints.length >= 3) {
            saveToHistory();
            const closedPolygon = [...currentPoints, currentPoints[0]];
            const centerX = currentPoints.reduce((sum, p) => sum + p.x, 0) / currentPoints.length;
            const centerY = currentPoints.reduce((sum, p) => sum + p.y, 0) / currentPoints.length;

            const newTerminal: Terminal = {
                id: `T${terminalCount}`,
                name: `Terminal ${terminalCount}`,
                position: { x: Math.round(centerX * 10) / 10, y: Math.round(centerY * 10) / 10 },
                polygon: closedPolygon,
                gates: [],
            };
            console.log('Creating Terminal:', newTerminal);

            setAirportData(prev => ({
                ...prev,
                terminals: [...(prev.terminals || []), newTerminal],
            }));
            setTerminalCount(prev => prev + 1);
            setCurrentPoints([]);
        }
    };

    const finishTaxiway = () => {
        if (currentPoints.length >= 2) {
            saveToHistory();
            const newTaxiway: Taxiway = {
                name: `TWY_${String.fromCharCode(64 + taxiwayCount)}`,
                type: 'LineString',
                points: currentPoints,
            };
            console.log('Creating Taxiway:', newTaxiway);

            setAirportData(prev => ({
                ...prev,
                taxiways: [...(prev.taxiways || []), newTaxiway],
            }));
            setTaxiwayCount(prev => prev + 1);
            setCurrentPoints([]);
        }
    };

    const handleDoubleClick = () => {
        if (tool === 'polygon') {
            finishTerminal();
        } else if (tool === 'line') {
            finishTaxiway();
        }
    };

    // Keyboard handler for escape and undo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore shortcuts if typing in input or textarea
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'Escape') {
                setCurrentPoints([]);
                setIsDrawing(false);
                setStartPoint(null);
                setSelection(null);
                setRedrawingIndex(null);
            }
            // Ctrl+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            // Delete key to delete selected
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selection) {
                    e.preventDefault();
                    deleteSelected();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, selection, deleteSelected]);

    // Copy JSON to clipboard
    const copyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(airportData, null, 2));
    };

    // Save JSON to file
    const saveJson = async () => {
        setIsSaving(true);
        try {
            // Prepare data: Ensure derived fields (like threshold) are present
            const dataToSave = {
                ...airportData,
                runways: (airportData.runways || []).map(r => {
                    // If we have a rectangle but no threshold, calculate it
                    if (r.rectangle && r.rectangle.length >= 4 && !r.threshold) {
                        const center = {
                            x: r.rectangle.reduce((s, p) => s + p.x, 0) / r.rectangle.length,
                            y: r.rectangle.reduce((s, p) => s + p.y, 0) / r.rectangle.length
                        };

                        // Calculate threshold position
                        // Threshold is: Center - (Length/2) * DirectionVector
                        // DirectionVector from Heading: (sin(h), cos(h))
                        const rad = (r.heading) * (Math.PI / 180);
                        const dx = Math.sin(rad);
                        const dy = Math.cos(rad);

                        const threshold = {
                            x: center.x - (r.length / 2) * dx,
                            y: center.y - (r.length / 2) * dy
                        };

                        // Calculate end for legacy support
                        const end = {
                            x: center.x + (r.length / 2) * dx,
                            y: center.y + (r.length / 2) * dy
                        };

                        return {
                            ...r,
                            threshold: { x: Number(threshold.x.toFixed(4)), y: Number(threshold.y.toFixed(4)) },
                            // Add legacy fields for compatibility
                            x: Number(threshold.x.toFixed(4)),
                            y: Number(threshold.y.toFixed(4)),
                            endX: Number(end.x.toFixed(4)),
                            endY: Number(end.y.toFixed(4))
                        };
                    }
                    return r;
                }),
                terminals: (airportData.terminals || []).map(t => {
                    // Ensure legacy apron format exists if we have a polygon
                    if (t.polygon && t.polygon.length > 0 && !t.apron) {
                        return {
                            ...t,
                            gates: t.gates || [],
                            apron: {
                                polygon: t.polygon
                            }
                        };
                    }
                    return { ...t, gates: t.gates || [] };
                }),
                taxiways: (airportData.taxiways || []).map(t => {
                    return t;
                })
            };

            const response = await fetch('/api/save-airport', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave),
            });

            const result = await response.json();

            if (result.success) {
                // Update local state to reflect the simplified/computed fields
                setAirportData(dataToSave);
                alert(`Successfully saved ${airportData.code}.json!`);
            } else {
                alert(`Failed to save: ${result.error}`);
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    // Clear all
    const clearAll = () => {
        saveToHistory();
        setAirportData({
            ...airportData,
            runways: [],
            terminals: [],
            taxiways: [],
        });
        setRunwayCount(1);
        setTerminalCount(1);
        setTaxiwayCount(1);
        setSelection(null);
    };

    // Get selected shape info
    const getSelectedInfo = (): string => {
        if (!selection) return '';
        if (selection.type === 'runway') {
            const r = airportData.runways[selection.index];
            return r ? `Runway: ${r.name} (Heading: ${r.heading}°)` : '';
        }
        if (selection.type === 'terminal') {
            const t = airportData.terminals[selection.index];
            return t ? `Terminal: ${t.name}` : '';
        }
        if (selection.type === 'taxiway') {
            const t = airportData.taxiways[selection.index];
            return t ? `Taxiway: ${t.name}` : '';
        }
        return '';
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
            {/* Navbar */}
            <nav className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-orange-500 font-bold text-xl hover:text-orange-400">
                        ← ATC-SIM
                    </Link>
                    <h1 className="text-lg font-semibold">Airport JSON Editor</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={airportData.code}
                            onChange={(e) => setAirportData({ ...airportData, code: e.target.value })}
                            className="bg-slate-700 px-3 py-1 rounded text-sm w-24"
                            placeholder="Code"
                        />
                        <input
                            type="text"
                            value={airportData.name}
                            onChange={(e) => setAirportData({ ...airportData, name: e.target.value })}
                            className="bg-slate-700 px-3 py-1 rounded text-sm w-48"
                            placeholder="Airport Name"
                        />
                    </div>
                </div>
            </nav>

            {/* Toolbar */}
            <div className="bg-slate-800 p-3 flex items-center gap-4 border-b border-slate-700 flex-wrap">
                <span className="text-sm text-slate-400">Tools:</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setTool('select'); setCurrentPoints([]); }}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${tool === 'select' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                    >
                        🖱️ Select
                    </button>
                    <button
                        onClick={() => { setTool('rectangle'); setCurrentPoints([]); setSelection(null); }}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${tool === 'rectangle' ? 'bg-orange-600' : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                    >
                        ⬛ Runway (Rect)
                    </button>
                    <button
                        onClick={() => { setTool('polygon'); setCurrentPoints([]); setSelection(null); }}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${tool === 'polygon' ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                    >
                        🔷 Terminal (Poly)
                    </button>
                    <button
                        onClick={() => { setTool('line'); setCurrentPoints([]); setSelection(null); }}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${tool === 'line' ? 'bg-yellow-600' : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                    >
                        📏 Taxiway (Line)
                    </button>
                </div>
                <div className="border-l border-slate-600 h-6 mx-2"></div>
                <button
                    onClick={() => setShowBgControls(!showBgControls)}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${showBgControls ? 'bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                >
                    🖼️ Background
                </button>
                <div className="border-l border-slate-600 h-6 mx-2"></div>
                <button
                    onClick={undo}
                    disabled={history.length === 0}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${history.length === 0 ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                    title="Undo (Ctrl+Z)"
                >
                    ↩️ Undo
                </button>
                <button
                    onClick={clearAll}
                    className="px-4 py-2 rounded text-sm font-medium bg-red-700 hover:bg-red-600 transition-colors"
                >
                    🗑️ Clear All
                </button>
                <div className="flex-1"></div>
                <div className="text-sm text-slate-400">
                    {tool === 'rectangle' && 'Click and drag to draw runway'}
                    {tool === 'polygon' && 'Click to add points, double-click to finish terminal'}
                    {tool === 'line' && 'Click to add points, double-click to finish taxiway'}
                    {tool === 'select' && 'Click on shapes to select • Delete/Backspace to remove'}
                </div>
            </div>

            {/* Background Controls Toolbar */}
            {showBgControls && (
                <div className="bg-slate-800 p-3 flex items-center gap-4 border-b border-slate-600 bg-slate-800/50">
                    <span className="text-sm font-medium text-slate-300">Background:</span>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-600 file:text-white hover:file:bg-slate-500"
                    />

                    {bgImage && (
                        <>
                            <div className="border-l border-slate-600 h-6 mx-2"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Opacity:</span>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.1"
                                    value={bgSettings.opacity}
                                    onChange={(e) => setBgSettings({ ...bgSettings, opacity: parseFloat(e.target.value) })}
                                    className="w-24"
                                />
                            </div>

                            <div className="border-l border-slate-600 h-6 mx-2"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Scale:</span>
                                <button
                                    onClick={() => setBgSettings(s => ({ ...s, scale: s.scale * 0.9 }))}
                                    className="px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500"
                                >-</button>
                                <span className="text-xs w-10 text-center">{bgSettings.scale.toFixed(2)}</span>
                                <button
                                    onClick={() => setBgSettings(s => ({ ...s, scale: s.scale * 1.1 }))}
                                    className="px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500"
                                >+</button>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">X:</span>
                                <input
                                    type="number"
                                    value={bgSettings.x}
                                    onChange={(e) => setBgSettings({ ...bgSettings, x: parseFloat(e.target.value) })}
                                    className="w-16 bg-slate-700 px-2 py-1 rounded text-xs"
                                    step="0.1"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Y:</span>
                                <input
                                    type="number"
                                    value={bgSettings.y}
                                    onChange={(e) => setBgSettings({ ...bgSettings, y: parseFloat(e.target.value) })}
                                    className="w-16 bg-slate-700 px-2 py-1 rounded text-xs"
                                    step="0.1"
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Selection toolbar */}
            {selection && (
                <div className="bg-slate-700 p-3 flex items-center gap-4 border-b border-slate-600">
                    <span className="text-sm font-medium text-white">{getSelectedInfo()}</span>
                    <div className="border-l border-slate-500 h-6 mx-2"></div>
                    {selection.type === 'runway' && (
                        <>
                            <button
                                onClick={() => {
                                    setRedrawingIndex(selection.index);
                                    setTool('rectangle');
                                    setSelection(null);
                                    setCurrentPoints([]);
                                }}
                                className="px-3 py-1 rounded text-sm bg-orange-700 hover:bg-orange-600 transition-colors"
                            >
                                ✏️ Redraw Shape
                            </button>
                            <div className="border-l border-slate-500 h-6 mx-2"></div>
                            <span className="text-sm text-slate-300">Rotate:</span>
                            <button
                                onClick={() => rotateSelectedRunway(-15)}
                                className="px-3 py-1 rounded text-sm bg-purple-700 hover:bg-purple-600 transition-colors"
                            >
                                ↺ -15°
                            </button>
                            <button
                                onClick={() => rotateSelectedRunway(-5)}
                                className="px-3 py-1 rounded text-sm bg-purple-700 hover:bg-purple-600 transition-colors"
                            >
                                ↺ -5°
                            </button>
                            <button
                                onClick={() => rotateSelectedRunway(5)}
                                className="px-3 py-1 rounded text-sm bg-purple-700 hover:bg-purple-600 transition-colors"
                            >
                                ↻ +5°
                            </button>
                            <button
                                onClick={() => rotateSelectedRunway(15)}
                                className="px-3 py-1 rounded text-sm bg-purple-700 hover:bg-purple-600 transition-colors"
                            >
                                ↻ +15°
                            </button>
                            <input
                                type="number"
                                placeholder="Custom°"
                                className="bg-slate-600 px-2 py-1 rounded text-sm w-20"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = parseInt((e.target as HTMLInputElement).value);
                                        if (!isNaN(val)) {
                                            rotateSelectedRunway(val);
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }
                                }}
                            />
                        </>
                    )}
                    <div className="flex-1"></div>
                    <button
                        onClick={deleteSelected}
                        className="px-4 py-1 rounded text-sm font-medium bg-red-700 hover:bg-red-600 transition-colors"
                    >
                        🗑️ Delete Selected
                    </button>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex">
                {/* Canvas area */}
                <div className="flex-1 relative">
                    <canvas
                        ref={canvasRef}
                        className={`absolute inset-0 ${isRotating ? 'cursor-grabbing' :
                            isHoveringRotationHandle ? 'cursor-grab' :
                                tool === 'select' ? 'cursor-pointer' : 'cursor-crosshair'
                            }`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onDoubleClick={handleDoubleClick}
                    />
                    {/* Zoom controls */}
                    <div className="absolute bottom-4 left-4 flex gap-2">
                        <button
                            onClick={() => setScale(Math.min(scale + 20, 300))}
                            className="bg-slate-700 hover:bg-slate-600 w-10 h-10 rounded text-xl"
                        >
                            +
                        </button>
                        <button
                            onClick={() => setScale(Math.max(scale - 20, 40))}
                            className="bg-slate-700 hover:bg-slate-600 w-10 h-10 rounded text-xl"
                        >
                            −
                        </button>
                        <span className="bg-slate-700 px-3 py-2 rounded text-sm">
                            1 NM = {scale}px
                        </span>
                    </div>
                    {/* Keyboard shortcuts hint */}
                    <div className="absolute top-4 left-4 bg-slate-800/80 px-3 py-2 rounded text-xs text-slate-400">
                        <div>Ctrl+Z: Undo</div>
                        <div>Del: Delete selected</div>
                        <div>Esc: Cancel/Deselect</div>
                    </div>
                </div>

                {/* JSON Preview Panel */}
                <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col">
                    <div className="p-3 bg-slate-700 flex justify-between items-center">
                        <h2 className="font-semibold">JSON Output</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={saveJson}
                                disabled={isSaving}
                                className={`px-3 py-1 rounded text-sm transition-colors ${isSaving ? 'bg-slate-600 cursor-wait' : 'bg-blue-600 hover:bg-blue-500'}`}
                            >
                                {isSaving ? 'Saving...' : '💾 Save'}
                            </button>
                            <button
                                onClick={copyJson}
                                className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-sm transition-colors"
                            >
                                📋 Copy
                            </button>
                        </div>
                    </div>
                    <div className="relative flex-1 flex flex-col min-h-0">
                        <textarea
                            ref={textareaRef}
                            value={jsonText}
                            onChange={handleJsonChange}
                            onFocus={() => { setIsJsonEditing(true); saveToHistory(); }}
                            onBlur={() => setIsJsonEditing(false)}
                            spellCheck={false}
                            className={`flex-1 bg-slate-900 p-4 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 ${jsonError ? 'text-red-400' : 'text-green-400'
                                }`}
                        />
                        {jsonError && (
                            <div className="absolute bottom-0 left-0 right-0 bg-red-900/90 text-red-200 text-xs p-2 border-t border-red-700">
                                {jsonError}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
