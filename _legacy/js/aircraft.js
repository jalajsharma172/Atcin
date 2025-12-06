class Aircraft {
    constructor(id, type, x, y, heading, altitude, speed, isArrival) {
        this.id = id;
        this.type = type; // e.g. B737
        this.x = x; // miles
        this.y = y; // miles
        this.heading = heading; // degrees
        this.altitude = altitude; // 100s of feet (e.g. 50 = 5000ft)
        this.speed = speed; // knots
        this.isArrival = isArrival; // boolean

        // Target states
        this.targetHeading = heading;
        this.targetAltitude = altitude;
        this.targetSpeed = speed;

        // Navigation
        this.navFix = null; // If set, heading is auto-calculated to this fix
        this.landingRunway = null; // If set, logic for intercepting ILS
        this.isOnGround = !isArrival && altitude === 0;
        this.isTakingOff = false;

        // Flags
        this.expedite = false;
        this.holding = false;

        this.history = [];
    }

    setHeading(h) {
        this.targetHeading = h;
        this.navFix = null;
        this.landingRunway = null;
        this.holding = false;
    }

    setAltitude(a, expedite = false) {
        this.targetAltitude = a;
        this.expedite = expedite;
    }

    setSpeed(s) {
        this.targetSpeed = s;
    }

    setFix(fixName, fixPos) {
        this.navFix = { name: fixName, x: fixPos.x, y: fixPos.y };
        this.landingRunway = null;
        this.holding = false;
    }

    setLanding(runway) {
        this.landingRunway = runway;
        this.navFix = null;
        this.holding = false;
    }

    takeoff() {
        if (this.isOnGround && this.targetAltitude > 0) {
            this.isTakingOff = true;
            this.isOnGround = false;
            this.speed = 140; // Initial takeoff speed
            this.targetSpeed = 250;
        }
    }

    update(dt) {
        if (this.isOnGround && !this.isTakingOff) return;

        // Speed Logic
        // Accelerate/Decelerate
        if (this.speed !== this.targetSpeed) {
            const accel = 2 * dt; // 2 knots per second
            if (Math.abs(this.targetSpeed - this.speed) < accel) {
                this.speed = this.targetSpeed;
            } else {
                this.speed += Math.sign(this.targetSpeed - this.speed) * accel;
            }
        }

        // Navigation Logic (Fix or Runway)
        if (this.navFix) {
            // Calculate bearing to fix
            const dx = this.navFix.x - this.x;
            const dy = this.navFix.y - this.y;
            let bearing = Math.atan2(dy, dx) * 180 / Math.PI;
            bearing = 90 - bearing; // Convert to compass heading
            if (bearing < 0) bearing += 360;
            this.targetHeading = bearing;
        } else if (this.landingRunway) {
            // ILS Logic
            // Simple version: fly heading until intercepting runway line
            // Check if we are close to centerline
            // This is complex, for now let's just fly to runway start
            const dx = this.landingRunway.x - this.x;
            const dy = this.landingRunway.y - this.y;
            let bearing = Math.atan2(dy, dx) * 180 / Math.PI;
            bearing = 90 - bearing;
            if (bearing < 0) bearing += 360;

            // If aligned and close, lock heading to runway heading
            const dist = Math.hypot(dx, dy);
            const headingDiff = Math.abs(this.heading - this.landingRunway.heading);

            if (dist < 10 && (headingDiff < 10 || headingDiff > 350)) {
                this.targetHeading = this.landingRunway.heading;
                // Auto descend on glideslope?
                if (dist < 5) this.targetAltitude = 0;
            } else {
                this.targetHeading = bearing;
            }
        }

        // Heading Logic (Turn)
        if (this.heading !== this.targetHeading) {
            let diff = this.targetHeading - this.heading;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            const turnRate = 3 * dt; // 3 degrees per second (standard rate turn)

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
            let rate = 8 * dt; // ~800 fpm normal
            if (this.expedite) rate *= 2; // Expedite

            if (Math.abs(this.targetAltitude - this.altitude) < rate) {
                this.altitude = this.targetAltitude;
            } else {
                this.altitude += Math.sign(this.targetAltitude - this.altitude) * rate;
            }
        }

        // Movement
        // 1 knot = 1.15 mph
        // Speed is in knots. Map scale is miles.
        // Distance = Speed * Time
        // Miles = (Knots * 1.15) * (dt / 3600)
        const milesPerSec = (this.speed * 1.15) / 3600;
        // Speed up simulation time? Usually ATC sims run 1x or slightly faster.
        // Let's use a time multiplier if needed, but for now 1x.
        const timeScale = 5; // Speed up game 5x for playability
        const moveDist = milesPerSec * dt * timeScale;

        const rad = (this.heading - 90) * Math.PI / 180;
        this.x += Math.cos(rad) * moveDist;
        this.y += Math.sin(rad) * moveDist;

        // Trail update
        if (this.history.length === 0 ||
            Math.hypot(this.x - this.history[0].x, this.y - this.history[0].y) > 0.5) {
            this.history.unshift({ x: this.x, y: this.y });
            if (this.history.length > 5) this.history.pop();
        }
    }

    draw(ctx, scale, center) {
        let px = center.x + this.x * scale;
        let py = center.y - this.y * scale;

        // Trail
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

        // Symbol
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((this.heading - 90) * Math.PI / 180);

        ctx.fillStyle = this.isArrival ? '#ffcc00' : '#00ccff'; // Yellow for arrival, Blue for departure
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, 4);
        ctx.lineTo(-4, -4);
        ctx.fill();
        ctx.restore();

        // Data Block
        ctx.fillStyle = '#0f0';
        ctx.font = '11px monospace';
        ctx.fillText(this.id, px + 10, py - 10);

        // Altitude (hundreds) + Speed (tens)
        // e.g. 050 25 = 5000ft 250kts
        const altStr = Math.floor(this.altitude).toString().padStart(3, '0');
        const spdStr = Math.floor(this.speed / 10).toString();
        ctx.fillText(altStr + ' ' + spdStr, px + 10, py + 2);

        // Destination/Runway
        if (this.landingRunway) {
            ctx.fillText(this.landingRunway.name, px + 10, py + 14);
        } else if (this.navFix) {
            ctx.fillText(this.navFix.name, px + 10, py + 14);
        }
    }
}
