export interface Runway {
    name?: string; // Legacy
    id?: string; // New
    heading: number;
    length?: number;
    // Legacy format
    x?: number;
    y?: number;
    endX?: number;
    endY?: number;
    // New format
    threshold?: { x: number, y: number };
    rectangle?: { x: number, y: number }[];
    // Normalized format (internal use)
    start?: { x: number, y: number };
    end?: { x: number, y: number };
    exits?: string[];
}

export interface TaxiwayNode {
    x: number;
    y: number;
}

export interface Taxiway {
    name?: string;
    id?: string;
    type?: string; // "LineString" for new format
    // Legacy format
    from?: string;
    to?: string;
    // New format
    points?: { x: number, y: number }[];
    width?: number;
    speed?: number;
}

export interface Gate {
    id: string;
    x: number;
    y: number;
}

export interface Terminal {
    id: string;
    name: string;
    position?: { x: number, y: number };
    // New format: direct polygon
    polygon?: { x: number, y: number }[];
    // Legacy format: apron.polygon
    apron?: {
        polygon: { x: number, y: number }[];
    };
    gates: Gate[] | string[];
}

export interface Fix {
    x: number;
    y: number;
}

export interface AirportData {
    code: string;
    name: string;
    elevation: number;
    runways: Runway[];
    terminals: Terminal[];
    fixes?: Record<string, Fix>;
    taxiwayNodes?: Record<string, TaxiwayNode>;
    taxiways?: Taxiway[];
    groundRules?: any;
}

export class Airport {
    name: string;
    elevation: number;
    runways: Runway[];
    terminals: Terminal[];
    fixes: Record<string, Fix>;
    taxiwayNodes: Record<string, TaxiwayNode>;
    taxiways: Taxiway[];

    constructor(data?: AirportData) {
        if (data) {
            this.name = data.name;
            this.elevation = data.elevation;
            this.taxiwayNodes = data.taxiwayNodes || {};

            // Normalize Runways - support both legacy and new formats
            this.runways = data.runways.map(r => {
                const name = r.name || (r.id ? r.id.replace('RWY_', '') : 'UNK');
                let x = r.x || 0;
                let y = r.y || 0;
                let endX = r.endX || 0;
                let endY = r.endY || 0;

                // New format with threshold
                if (r.threshold) {
                    x = r.threshold.x;
                    y = r.threshold.y;
                    // Calculate end point using rectangle if available
                    if (r.rectangle && r.rectangle.length >= 2) {
                        // Find the opposite corner of the runway
                        const pts = r.rectangle;
                        const minX = Math.min(...pts.map(p => p.x));
                        const maxX = Math.max(...pts.map(p => p.x));
                        const avgY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

                        // End is on opposite side from threshold
                        if (x > 0) {
                            endX = minX;
                        } else {
                            endX = maxX;
                        }
                        endY = avgY;
                    }
                }

                // Legacy format with start/end objects
                if (r.start && r.end) {
                    x = r.start.x;
                    y = r.start.y;
                    endX = r.end.x;
                    endY = r.end.y;
                }

                return {
                    ...r,
                    name,
                    x,
                    y,
                    endX,
                    endY
                };
            });

            // Normalize Terminals - support both legacy and new formats
            this.terminals = data.terminals.map(t => {
                let gates: Gate[] = [];
                if (Array.isArray(t.gates)) {
                    if (typeof t.gates[0] === 'string') {
                        // Convert string IDs to Gate objects using taxiwayNodes
                        gates = (t.gates as string[]).map(gid => {
                            const node = this.taxiwayNodes[gid];
                            return {
                                id: gid,
                                x: node ? node.x : 0,
                                y: node ? node.y : 0
                            };
                        });
                    } else {
                        gates = t.gates as Gate[];
                    }
                }

                // Calculate position if missing (centroid of gates)
                let pos = t.position;
                if (!pos && gates.length > 0) {
                    const cx = gates.reduce((sum, g) => sum + g.x, 0) / gates.length;
                    const cy = gates.reduce((sum, g) => sum + g.y, 0) / gates.length;
                    pos = { x: cx, y: cy };
                }

                // Normalize polygon - support both direct polygon and apron.polygon
                let polygon = t.polygon || (t.apron?.polygon);

                return {
                    ...t,
                    position: pos || { x: 0, y: 0 },
                    polygon,
                    gates
                };
            });

            this.fixes = data.fixes || {};
            this.taxiways = data.taxiways || [];
        } else {
            this.name = "Loading...";
            this.elevation = 0;
            this.runways = [];
            this.terminals = [];
            this.fixes = {};
            this.taxiwayNodes = {};
            this.taxiways = [];
        }
    }

    draw(ctx: CanvasRenderingContext2D, scale: number, center: { x: number, y: number }, showDetails: boolean = false, transparentMode: boolean = false) {
        // Draw Terminal polygons first (bottom layer)
        if (showDetails) {
            this.terminals.forEach(t => {
                const polygon = t.polygon || (t.apron?.polygon);
                if (polygon && polygon.length > 0) {
                    if (transparentMode) {
                        ctx.fillStyle = 'rgba(33, 150, 243, 0.5)';
                        ctx.strokeStyle = '#2196f3';
                        ctx.lineWidth = 2 * scale / 120; // Approx based on editor scale
                    } else {
                        ctx.fillStyle = '#3498db'; // Blue for Terminal/Apron (was #2c3e50)
                    }

                    ctx.beginPath();
                    const startX = center.x + polygon[0].x * scale;
                    const startY = center.y - polygon[0].y * scale;
                    ctx.moveTo(startX, startY);
                    for (let i = 1; i < polygon.length; i++) {
                        ctx.lineTo(center.x + polygon[i].x * scale, center.y - polygon[i].y * scale);
                    }
                    ctx.closePath();
                    ctx.fill();

                    if (transparentMode) ctx.stroke();
                }
            });

            // Draw Taxiways - support both legacy (from/to) and new (points) formats
            if (this.taxiways) {
                this.taxiways.forEach(tw => {
                    if (transparentMode) {
                        ctx.strokeStyle = '#ffeb3b';
                    } else {
                        ctx.strokeStyle = '#f1c40f'; // Yellow for Taxiways (was #3498db)
                    }

                    // New format: points array (LineString)
                    if (tw.points && tw.points.length >= 2) {
                        ctx.lineWidth = transparentMode ? (3 * scale / 120) : ((tw.width || 0.1) * scale);
                        ctx.beginPath();
                        const firstPt = tw.points[0];
                        ctx.moveTo(center.x + firstPt.x * scale, center.y - firstPt.y * scale);
                        for (let i = 1; i < tw.points.length; i++) {
                            const pt = tw.points[i];
                            ctx.lineTo(center.x + pt.x * scale, center.y - pt.y * scale);
                        }
                        ctx.stroke();
                    }
                    // Legacy format: from/to node references
                    else if (tw.from && tw.to && this.taxiwayNodes) {
                        const nodeA = this.taxiwayNodes[tw.from];
                        const nodeB = this.taxiwayNodes[tw.to];
                        if (nodeA && nodeB) {
                            ctx.lineWidth = transparentMode ? (3 * scale / 120) : ((tw.width || 0.05) * scale);
                            const startX = center.x + nodeA.x * scale;
                            const startY = center.y - nodeA.y * scale;
                            const endX = center.x + nodeB.x * scale;
                            const endY = center.y - nodeB.y * scale;

                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(endX, endY);
                            ctx.stroke();
                        }
                    }
                });
            }
        }

        // Draw Runways
        this.runways.forEach(rwy => {
            // New format: rectangle polygon
            if (rwy.rectangle && rwy.rectangle.length >= 4) {
                if (transparentMode && showDetails) {
                    ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
                    ctx.strokeStyle = '#ff9800';
                    ctx.lineWidth = 2 * scale / 120;
                } else {
                    ctx.fillStyle = '#555'; // Darker gray for runway
                }

                ctx.beginPath();
                const poly = rwy.rectangle;
                ctx.moveTo(center.x + poly[0].x * scale, center.y - poly[0].y * scale);
                for (let i = 1; i < poly.length; i++) {
                    ctx.lineTo(center.x + poly[i].x * scale, center.y - poly[i].y * scale);
                }
                ctx.closePath();
                ctx.fill();

                if (transparentMode && showDetails) {
                    ctx.stroke();
                } else {
                    // Draw centerline only if NOT in transparent mode (editor doesn't show it typically or user wants clean look)
                    // Actually editor doesn't show centerline in the code I read?
                    // Let's keep centerline for now unless it conflicts.
                    // The prompt said "same colors on the airport view... only when user will trick a button... to make airport transparent".
                    // Editor has no centerline code block? I'll keep it for now as it's useful.

                    const minX = Math.min(...poly.map(p => p.x));
                    const maxX = Math.max(...poly.map(p => p.x));
                    const avgY = poly.reduce((sum, p) => sum + p.y, 0) / poly.length;

                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([8, 8]);
                    ctx.beginPath();
                    ctx.moveTo(center.x + minX * scale, center.y - avgY * scale);
                    ctx.lineTo(center.x + maxX * scale, center.y - avgY * scale);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Label at threshold
                if (rwy.threshold) {
                    if (transparentMode && showDetails) {
                        ctx.fillStyle = '#ff9800'; // Orange like editor
                    } else {
                        ctx.fillStyle = showDetails ? '#333' : '#fff';
                    }
                    ctx.font = 'bold 12px monospace';
                    ctx.fillText(rwy.name || '', center.x + rwy.threshold.x * scale, center.y - rwy.threshold.y * scale - 10);
                }
            }
            // Legacy format: line segment
            else {
                // ... legacy handling ...
                const startX = center.x + (rwy.x || 0) * scale;
                const startY = center.y - (rwy.y || 0) * scale;
                const endX = center.x + (rwy.endX || 0) * scale;
                const endY = center.y - (rwy.endY || 0) * scale;

                ctx.strokeStyle = '#555';
                ctx.lineWidth = showDetails ? 18 : 6;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // Centerline
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.setLineDash([8, 8]);
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label
                ctx.fillStyle = showDetails ? '#333' : '#ccc';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(rwy.name || '', startX, startY - 5);
            }
        });

        // Draw Terminals
        if (showDetails) {
            this.terminals.forEach(t => {
                const px = center.x + (t.position?.x || 0) * scale;
                const py = center.y - (t.position?.y || 0) * scale;

                // Terminal Label
                ctx.fillStyle = '#000';
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(t.name, px, py);

                // Gates
                if (t.gates) {
                    (t.gates as Gate[]).forEach(g => {
                        const gx = center.x + g.x * scale;
                        const gy = center.y - g.y * scale;

                        ctx.fillStyle = '#f1c40f'; // Yellow for gates
                        ctx.beginPath();
                        ctx.arc(gx, gy, 3, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#f1c40f';
                        ctx.font = '9px monospace';
                        ctx.fillText(g.id, gx + 5, gy);
                    });
                }
            });
        }

        // Draw Fixes (Only in Radar View i.e. !showDetails)
        if (!showDetails) {
            ctx.fillStyle = '#999';
            for (let name in this.fixes) {
                const fix = this.fixes[name];
                let px = center.x + fix.x * scale;
                let py = center.y - fix.y * scale;

                ctx.beginPath();
                ctx.moveTo(px, py - 4);
                ctx.lineTo(px + 4, py);
                ctx.lineTo(px, py + 4);
                ctx.lineTo(px - 4, py);
                ctx.fill();

                ctx.font = '10px monospace';
                ctx.fillText(name, px + 6, py);
            }
        }
    }
}
