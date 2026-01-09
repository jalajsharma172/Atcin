export interface Runway {
    name: string;
    x: number;
    y: number;
    heading: number;
    length: number;
    endX: number;
    endY: number;
}

export interface TaxiwayNode {
    x: number;
    y: number;
}

export interface Taxiway {
    name: string;
    type?: string;
    from: string;
    to: string;
    width?: number;
}

export interface Gate {
    id: string;
    x: number;
    y: number;
}

export interface Terminal {
    id: string;
    name: string;
    position: { x: number, y: number };
    apron?: {
        polygon: { x: number, y: number }[];
    };
    gates: Gate[];
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
    fixes: Record<string, Fix>;
    taxiwayNodes?: Record<string, TaxiwayNode>;
    taxiways?: Taxiway[];
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
            this.runways = data.runways;
            this.terminals = data.terminals;
            this.fixes = data.fixes;
            this.taxiwayNodes = data.taxiwayNodes || {};
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

    draw(ctx: CanvasRenderingContext2D, scale: number, center: { x: number, y: number }, showDetails: boolean = false) {
        // Draw Aprons first (bottom layer)
        if (showDetails) {
            this.terminals.forEach(t => {
                if (t.apron && t.apron.polygon) {
                    ctx.fillStyle = '#2c3e50'; // Dark blue-gray for apron
                    ctx.beginPath();
                    const poly = t.apron.polygon;
                    if (poly.length > 0) {
                        const startX = center.x + poly[0].x * scale;
                        const startY = center.y - poly[0].y * scale;
                        ctx.moveTo(startX, startY);
                        for (let i = 1; i < poly.length; i++) {
                            ctx.lineTo(center.x + poly[i].x * scale, center.y - poly[i].y * scale);
                        }
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            });

            // Draw Taxiways
            if (this.taxiways && this.taxiwayNodes) {
                ctx.strokeStyle = '#3498db'; // Taxiway Blue
                this.taxiways.forEach(tw => {
                    const nodeA = this.taxiwayNodes[tw.from];
                    const nodeB = this.taxiwayNodes[tw.to];
                    if (nodeA && nodeB) {
                        ctx.lineWidth = (tw.width || 0.05) * scale;
                        const startX = center.x + nodeA.x * scale;
                        const startY = center.y - nodeA.y * scale;
                        const endX = center.x + nodeB.x * scale;
                        const endY = center.y - nodeB.y * scale;

                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();
                    }
                });
            }
        }

        // Draw Runways (Layered above taxiways)
        this.runways.forEach(rwy => {
            const startX = center.x + rwy.x * scale;
            const startY = center.y - rwy.y * scale;
            const endX = center.x + rwy.endX * scale;
            const endY = center.y - rwy.endY * scale;

            ctx.strokeStyle = '#555'; // Darker gray for runway
            ctx.lineWidth = 6;
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
            ctx.fillText(rwy.name, startX, startY - 5);
        });

        // Draw Terminals
        if (showDetails) {
            this.terminals.forEach(t => {
                const px = center.x + t.position.x * scale;
                const py = center.y - t.position.y * scale;

                // Terminal Label
                ctx.fillStyle = '#000'; // Black text for detailed view
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText(t.name, px, py);

                // Gates
                if (t.gates) {
                    t.gates.forEach(g => {
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
