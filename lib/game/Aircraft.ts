import { Runway } from './Airport';

export interface FlightStripData {
    id: string;
    type: string;
    altitude: number;
    speed: number;
    heading: number;
    isArrival: boolean;
    navFix?: string;
    landingRunway?: string;
    history: { x: number, y: number }[];
}

export interface AircraftStats {
    speed_cruise: number;
    speed_landing: number;
    rate_climb: number;
    rate_turn: number;
    wake_category?: string;
}

export class Aircraft {
    id: string;
    type: string;
    x: number;
    y: number;
    heading: number;
    altitude: number;
    speed: number;
    isArrival: boolean;

    targetHeading: number;
    targetAltitude: number;
    targetSpeed: number;

    navFix: { name: string; x: number; y: number } | null;
    landingRunway: Runway | null;
    isOnGround: boolean;
    isTakingOff: boolean;

    expedite: boolean;
    holding: boolean;

    history: { x: number; y: number }[];
    violation: boolean = false;

    stats: AircraftStats;

    constructor(id: string, type: string, x: number, y: number, heading: number, altitude: number, speed: number, isArrival: boolean, stats?: AircraftStats) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.heading = heading;
        this.altitude = altitude;
        this.speed = speed;
        this.isArrival = isArrival;

        this.stats = stats || {
            speed_cruise: 250,
            speed_landing: 140,
            rate_climb: 8,
            rate_turn: 3
        };

        this.targetHeading = heading;
        this.targetAltitude = altitude;
        this.targetSpeed = speed;

        this.navFix = null;
        this.landingRunway = null;
        this.isOnGround = !isArrival && altitude === 0;
        this.isTakingOff = false;

        this.expedite = false;
        this.holding = false;

        this.history = [];
    }

    setHeading(h: number) {
        this.targetHeading = h;
        this.navFix = null;
        this.landingRunway = null;
        this.holding = false;
    }

    setAltitude(a: number, expedite = false) {
        this.targetAltitude = a;
        this.expedite = expedite;
    }

    setSpeed(s: number) {
        this.targetSpeed = s;
    }

    setFix(fixName: string, fixPos: { x: number; y: number }) {
        this.navFix = { name: fixName, x: fixPos.x, y: fixPos.y };
        this.landingRunway = null;
        this.holding = false;
    }

    setLanding(runway: Runway) {
        this.landingRunway = runway;
        this.navFix = null;
        this.holding = false;
    }

    takeoff() {
        if (this.isOnGround && this.targetAltitude > 0) {
            this.isTakingOff = true;
            this.isOnGround = false;
            this.speed = this.stats.speed_landing; // Rotate speed
            this.targetSpeed = this.stats.speed_cruise;
        }
    }

    update(dt: number) {
        if (this.isOnGround && !this.isTakingOff) return;

        // Speed Logic
        if (this.speed !== this.targetSpeed) {
            const accel = 2 * dt; // Keep accel constant/generic for now
            if (Math.abs(this.targetSpeed - this.speed) < accel) {
                this.speed = this.targetSpeed;
            } else {
                this.speed += Math.sign(this.targetSpeed - this.speed) * accel;
            }
        }

        // Navigation Logic
        if (this.navFix) {
            const dx = this.navFix.x - this.x;
            const dy = this.navFix.y - this.y;
            let bearing = Math.atan2(dy, dx) * 180 / Math.PI;
            bearing = bearing + 90; // Standard Canvas (Y+ Down) to Compass (0=North/Up)
            if (bearing < 0) bearing += 360;
            this.targetHeading = bearing;
        } else if (this.landingRunway) {
            const dx = this.landingRunway.x - this.x;
            const dy = this.landingRunway.y - this.y;
            let bearing = Math.atan2(dy, dx) * 180 / Math.PI;
            bearing = bearing + 90;
            if (bearing < 0) bearing += 360;

            const dist = Math.hypot(dx, dy);
            const headingDiff = Math.abs(this.heading - this.landingRunway.heading);

            // Landing Logic (Touchdown)
            if (dist < 0.5 && this.altitude < 5 && this.targetAltitude === 0) {
                this.isOnGround = true;
                this.speed = 0;
                this.targetSpeed = 0;
            }

            if (dist < 15) {
                // Inside Terminal Area
                const aligned = headingDiff < 40 || dist < 3;

                if (aligned) {
                    // KEY FIX: Do NOT lock to runway heading immediately. 
                    // Continue homing (flying towards threshold) to close any lateral gap.
                    // Only lock heading if we are extremely close (flare).
                    if (dist < 1) {
                        this.targetHeading = this.landingRunway.heading;
                    } else {
                        this.targetHeading = bearing;
                    }

                    // Glideslope logic: 300ft/nm = 3 degrees. 
                    // If we are aligned, descend.
                    if (dist < 12) {
                        this.targetAltitude = 0;
                    }
                } else {
                    // Not aligned yet, keep homing to threshold
                    this.targetHeading = bearing;

                    // If very close but not aligned, force alignment to avoid circling
                    if (dist < 2) {
                        this.targetHeading = this.landingRunway.heading;
                        this.targetAltitude = 0;
                    }
                }
            } else {
                // Far out: Homing
                this.targetHeading = bearing;
            }
        }

        // Heading Logic
        if (this.heading !== this.targetHeading) {
            let diff = this.targetHeading - this.heading;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            const turnRate = this.stats.rate_turn * dt;

            if (Math.abs(diff) < turnRate) {
                this.heading = this.targetHeading;
            } else {
                this.heading += Math.sign(diff) * turnRate;
            }

            if (this.heading < 0) this.heading += 360;
            if (this.heading >= 360) this.heading -= 360;
        }

        // Altitude Logic
        if (this.altitude !== this.targetAltitude) {
            let rate = this.stats.rate_climb * dt;
            if (this.expedite) rate *= 2;

            if (Math.abs(this.targetAltitude - this.altitude) < rate) {
                this.altitude = this.targetAltitude;
            } else {
                this.altitude += Math.sign(this.targetAltitude - this.altitude) * rate;
            }
        }

        // Movement
        const milesPerSec = (this.speed * 1.15) / 3600;
        const timeScale = 5;
        const moveDist = milesPerSec * dt * timeScale;

        const rad = (this.heading - 90) * Math.PI / 180;
        this.x += Math.cos(rad) * moveDist;
        this.y += Math.sin(rad) * moveDist;

        // Trail
        if (this.history.length === 0 ||
            Math.hypot(this.x - this.history[0].x, this.y - this.history[0].y) > 0.5) {
            this.history.unshift({ x: this.x, y: this.y });
            if (this.history.length > 5) this.history.pop();
        }
    }

    draw(ctx: CanvasRenderingContext2D, scale: number, center: { x: number, y: number }, showDetails: boolean = false) {
        let px = center.x + this.x * scale;
        let py = center.y - this.y * scale;

        // Trail - Hide in detailed view or if too short
        if (!showDetails) {
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (this.history.length > 0) {
                ctx.moveTo(px, py);
                for (let p of this.history) {
                    ctx.lineTo(center.x + p.x * scale, center.y - p.y * scale);
                }
            }
            ctx.stroke();
        }

        // Symbol
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((this.heading - 90) * Math.PI / 180);

        // Darker colors for light background in detailed view
        if (showDetails) {
            ctx.fillStyle = this.isArrival ? '#d35400' : '#2980b9'; // Darker Orange / Blue
            ctx.scale(2, 2); // Double size for detailed view
        } else {
            ctx.fillStyle = this.isArrival ? '#ffcc00' : '#00ccff';
        }

        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, 4);
        ctx.lineTo(-4, -4);
        ctx.fill();
        ctx.restore();

        // Data Block
        ctx.fillStyle = showDetails ? '#333' : '#0f0'; // Black text for detailed view
        ctx.font = '11px monospace';
        ctx.fillText(this.id, px + 10, py - 10);

        const altStr = Math.floor(this.altitude).toString().padStart(3, '0');
        const spdStr = Math.floor(this.speed / 10).toString();
        ctx.fillText(altStr + ' ' + spdStr, px + 10, py + 2);

        if (this.landingRunway) {
            ctx.fillText(this.landingRunway.name, px + 10, py + 14);
        } else if (this.navFix) {
            ctx.fillText(this.navFix.name, px + 10, py + 14);
        }
    }
}
