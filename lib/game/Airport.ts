export interface Runway {
    name: string;
    x: number;
    y: number;
    heading: number;
    length: number;
    endX: number;
    endY: number;
}

export interface Terminal {
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
}

export interface Fix {
    x: number;
    y: number;
}

export class Airport {
    name: string;
    elevation: number;
    runways: Runway[];
    terminals: Terminal[];
    fixes: Record<string, Fix>;

    constructor() {
        this.name = "IGIA";
        this.elevation = 668; // Feet MSL

        this.runways = [
            //A=(-1.5,1.14) && B=(4.56,1.3)
            { name: "A", x: -1.5, y: 1.14, heading: 280, length: 8, endX: 4.56, endY: 1.3 },
            { name: "B", x: 4.56, y: 1.3, heading: 100, length: 8, endX: -1.5, endY: 1.14 },

            //C=(-1.64,2.36) && D=(3.84,4.48)
            { name: "C", x: -1.64, y: 2.36, heading: 280, length: 8, endX: 3.84, endY: 4.48 },
            { name: "D", x: 3.84, y: 4.48, heading: 100, length: 8, endX: -1.64, endY: 2.36 },
            //E=(-1.4,-1.58) && F=(4.76,-1.52)
            { name: "E", x: -1.4, y: -1.58, heading: 280, length: 8, endX: 4.76, endY: -1.52 },
            { name: "F", x: 4.76, y: -1.52, heading: 100, length: 8, endX: -1.4, endY: -1.58 },
            //G=(-1.28,-2.88) && H=(4.92,-2.82)
            { name: "G", x: -1.28, y: -2.88, heading: 280, length: 8, endX: 4.92, endY: -2.82 },
            { name: "H", x: 4.92, y: -2.82, heading: 100, length: 8, endX: -1.28, endY: -2.88 }

        ];

        this.terminals = [];

        this.fixes = {

            // Runway A (heading 280) fixes - Start: (-1.5, 1.14)
            "ALFIX": { x: 30, y: 0 },      // IAF - Initial Approach Fix for RWY A (30nm out)
            "ALNEAR": { x: 10, y: 0.5 },    // FAF - Final Approach Fix for RWY A (10nm out)
            "ALFINAL": { x: 20, y: 0.5 },    // Intermediate fix for RWY A (20nm out)
            // "ALNEAR2": { x: 25, y: 2 },       // Near fix for RWY A

            // // Runway B (heading 100) fixes - Start: (4.56, 1.3)
            "BRFIX": { x: -30, y: 1.3 },       // IAF - Initial Approach Fix for RWY B (30nm out)
            "BRFINAL": { x: -20, y: 1.3 },     // Intermediate fix for RWY B (20nm out)
            "BRNEAR": { x: -10, y: 1.3 },     // FAF - Final Approach Fix for RWY B (10nm out)


            // // Runway E (heading 280) fixes - Start: (-1.4, -1.58)
            "ENEAR": { x: 10, y: -1.58 },   // FAF - Final Approach Fix for RWY E (10nm out)
            "EFINAL": { x: 20, y: -1.58 },    // Intermediate fix for RWY E (20nm out)
            "EFIX": { x: 30, y: -1.58 },   // IAF - Initial Approach Fix for RWY E (30nm out)

            // // Runway F (heading 100) fixes - Start: (4.76, -1.52)
            "FFIX": { x: -30, y: -1.58 },    // IAF - Initial Approach Fix for RWY F (30nm out)
            "FNEAR": { x: -10, y: -1.58 },    // FAF - Final Approach Fix for RWY F (10nm out)
            "FFINAL": { x: -20, y: -1.58 },   // Intermediate fix for RWY F (20nm out)

            // Runway G (heading 280) fixes - Start: (-1.28, -2.88)
            "GFIX": { x: 30, y: -2.88 },   // IAF - Initial Approach Fix for RWY G (30nm out)
            "GNEAR": { x: 10, y: -2.88 },   // FAF - Final Approach Fix for RWY G (10nm out)
            "GFINAL": { x: 20, y: -2.88 },    // Intermediate fix for RWY G (20nm out)

            // Runway H (heading 100) fixes - Start: (4.92, -2.82)
            "HFIX": { x: -30, y: -2.88 },    // IAF - Initial Approach Fix for RWY H (30nm out)
            "HFINAL": { x: -20, y: -2.88 },    // Intermediate fix for RWY H (20nm out)
            "HNEAR": { x: -10, y: -2.88 },    // FAF - Final Approach Fix for RWY H (10nm out)

            // Runway C (heading 280) fixes 
            "CFIX": { x: 28, y: -11 },     // IAF - Initial Approach Fix for RWY C (30nm out, extended east)
            "CFINAL": { x: 19, y: -6.5 },    // Intermediate fix for RWY C (20nm out)
            "CNEAR": { x: 10, y: -2 },     // FAF - Final Approach Fix for RWY C (10nm out)

            // Runway D (heading 100) fixes 
            "DNEAR": { x: -8, y: 6.1 },     // FAF - Final Approach Fix for RWY D (10nm out)
            "DFIX": { x: -27.5, y: 12.0 },       // IAF - Initial Approach Fix for RWY D (30nm out, extended west)
            "DFINAL": { x: -18, y: 9.0 }     // Intermediate fix for RWY D (20nm out)

        };
    }

    draw(ctx: CanvasRenderingContext2D, scale: number, center: { x: number, y: number }) {
        ctx.lineWidth = 2;

        // Draw Terminals
        this.terminals.forEach(t => {
            const px = center.x + (t.x - t.w / 2) * scale;
            const py = center.y - (t.y + t.h / 2) * scale;
            ctx.fillStyle = t.color;
            ctx.fillRect(px, py, t.w * scale, t.h * scale);
            ctx.strokeStyle = '#555';
            ctx.strokeRect(px, py, t.w * scale, t.h * scale);

            // Label
            ctx.fillStyle = '#888';
            ctx.font = '10px monospace';
            ctx.fillText(t.name, px + 2, py + 10);
        });

        // Draw runways
        this.runways.forEach(rwy => {
            const startX = center.x + rwy.x * scale;
            const startY = center.y - rwy.y * scale;
            const endX = center.x + rwy.endX * scale;
            const endY = center.y - rwy.endY * scale;

            ctx.strokeStyle = '#666';
            ctx.lineWidth = 4; // Thicker runways
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Centerline
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = '#888';
            ctx.font = '10px monospace';
            ctx.fillText(rwy.name, startX, startY - 5);
        });

        // Draw fixes
        ctx.fillStyle = '#444';
        for (let name in this.fixes) {
            const fix = this.fixes[name];
            let px = center.x + fix.x * scale;
            let py = center.y - fix.y * scale;

            ctx.beginPath();
            ctx.moveTo(px, py - 3);
            ctx.lineTo(px + 3, py);
            ctx.lineTo(px, py + 3);
            ctx.lineTo(px - 3, py);
            ctx.fill();

            ctx.fillText(name, px + 5, py);
        }
    }
}
