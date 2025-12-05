class Airport {
    constructor() {
        this.name = "ORD";
        this.elevation = 668; // Feet MSL

        // Runways (Scaled x3)
        this.runways = [
            // Existing 27/09 Parallels
            { name: "27R", x: 6, y: 1.5, heading: 270, length: 6, endX: -6, endY: 1.5 },
            { name: "27L", x: 6, y: -1.5, heading: 270, length: 6, endX: -6, endY: -1.5 },
            { name: "09L", x: -6, y: 1.5, heading: 90, length: 6, endX: 6, endY: 1.5 },
            { name: "09R", x: -6, y: -1.5, heading: 90, length: 6, endX: 6, endY: -1.5 },

            // New 1: 18C/36C (Center North-South)
            { name: "18C", x: 0, y: 6, heading: 180, length: 6, endX: 0, endY: -6 },
            { name: "36C", x: 0, y: -6, heading: 360, length: 6, endX: 0, endY: 6 },

            // New 2: 18L/36R (West North-South)
            { name: "18L", x: -4, y: 6, heading: 180, length: 6, endX: -4, endY: -6 },
            { name: "36R", x: -4, y: -6, heading: 360, length: 6, endX: -4, endY: 6 },

            // New 3: 18R/36L (East North-South)
            { name: "18R", x: 4, y: 6, heading: 180, length: 6, endX: 4, endY: -6 },
            { name: "36L", x: 4, y: -6, heading: 360, length: 6, endX: 4, endY: 6 },

            // New 4: 04/22 (Diagonal NE-SW)
            { name: "04", x: -4, y: -4, heading: 45, length: 8, endX: 4, endY: 4 },
            { name: "22", x: 4, y: 4, heading: 225, length: 8, endX: -4, endY: -4 },

            // New 5: 14/32 (Diagonal SE-NW)
            { name: "14", x: -4, y: 4, heading: 135, length: 8, endX: 4, endY: -4 },
            { name: "32", x: 4, y: -4, heading: 315, length: 8, endX: -4, endY: 4 }
        ];

        // Terminals (5 Terminals, Scaled)
        this.terminals = [
            { name: "T1", x: 0, y: 0, w: 2, h: 1, color: '#444' },   // Central
            { name: "T2", x: 3, y: 0, w: 1.5, h: 1, color: '#444' }, // East
            { name: "T3", x: -3, y: 0, w: 1.5, h: 1, color: '#444' },// West
            { name: "T4", x: 0, y: 2.5, w: 2, h: 0.8, color: '#444' }, // North
            { name: "T5", x: 0, y: -2.5, w: 2, h: 0.8, color: '#444' } // South
        ];

        // Waypoints / VORs (Scaled x2 to keep them on screen but further out)
        this.fixes = {
            "FONTI": { x: 20, y: 30 },
            "OBK": { x: 10, y: -20 },
            "DPA": { x: -30, y: 10 },
            "VANA": { x: -20, y: -30 },
            "KEAN": { x: 24, y: 10 },
            "NIL": { x: -24, y: -10 }
        };
    }

    draw(ctx, scale, center) {
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
