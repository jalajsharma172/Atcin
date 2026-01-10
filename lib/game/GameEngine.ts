import { Airport } from './Airport';
import { Aircraft } from './Aircraft';

export class GameEngine {
    airport: Airport;
    aircrafts: Aircraft[];
    lastTime: number;
    scale: number;
    center: { x: number; y: number };
    width: number = 0;
    height: number = 0;
    score: number;
    spawnTimer: number;

    // Callbacks for UI updates
    onAircraftAdded?: (ac: Aircraft) => void;
    onAircraftRemoved?: (ac: Aircraft) => void;
    onScoreUpdated?: (score: number) => void;
    onLog?: (msg: string) => void;

    aircraftTypes: Record<string, any>;

    constructor() {
        this.airport = new Airport(); // Starts empty/loading
        this.aircrafts = [];
        this.aircraftTypes = {};
        this.lastTime = 0;
        this.scale = 35; // Pixels per mile
        this.center = { x: 0, y: 0 };
        this.score = 0;
        this.spawnTimer = 2;
    }

    async init(airportCode: string) {
        try {
            // Load Airport
            const airportRes = await fetch(`/data/airports/${airportCode}.json`);
            if (!airportRes.ok) {
                this.log(`❌ Airport "${airportCode}" is currently not available`);
                this.log('Please select a different airport from the homepage');
                return;
            }
            const airportData = await airportRes.json();
            this.airport = new Airport(airportData);
            this.log(`✅ Loaded airport: ${airportData.name}`);

            // Load Aircraft Specs
            const aircraftRes = await fetch('/data/aircraft.json');
            if (aircraftRes.ok) {
                this.aircraftTypes = await aircraftRes.json();
                this.log('✅ Loaded aircraft specs');
            }

            // Start Traffic
            this.spawnAircraft(); // Regular spawn

            // Force spawn a few ground aircraft immediately so detailed view isn't empty
            for (let i = 0; i < 2; i++) {
                this.spawnDeparture();
            }
        } catch (e) {
            console.error(e);
            this.log(`❌ Error loading airport "${airportCode}"`);
            this.log('This airport is currently not available');
        }
    }

    resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.center = { x: width / 2, y: height / 2 };
    }

    addAircraft(ac: Aircraft) {
        this.aircrafts.push(ac);
        if (this.onAircraftAdded) this.onAircraftAdded(ac);
    }

    spawnAircraft() {
        const isArrival = Math.random() > 0.3; // 70% chance of arrival
        if (isArrival) {
            this.spawnArrival();
        } else {
            this.spawnDeparture();
        }
    }

    spawnArrival() {
        const id = 'UAL' + Math.floor(Math.random() * 900 + 100);
        const type = 'B737';
        const stats = this.aircraftTypes[type];

        // Spawn at edge (50 miles)
        const angle = Math.random() * Math.PI * 2;
        const x = Math.cos(angle) * 50;
        const y = Math.sin(angle) * 50;

        // Heading towards center
        let heading = (Math.atan2(-y, -x) * 180 / Math.PI) + 90;
        if (heading < 0) heading += 360;

        // Random altitude 5000-10000
        const alt = 50 + Math.floor(Math.random() * 50);

        this.addAircraft(new Aircraft(id, type, x, y, heading, alt, 250, true, stats));
    }

    spawnDeparture() {
        if (this.airport.runways.length === 0) return;

        const id = 'AAL' + Math.floor(Math.random() * 900 + 100);
        const type = 'A320';
        const stats = this.aircraftTypes[type];

        // Spawn at runway start - support both new and legacy formats
        const rwy = this.airport.runways[Math.floor(Math.random() * this.airport.runways.length)];
        const spawnX = rwy.threshold?.x ?? rwy.x ?? 0;
        const spawnY = rwy.threshold?.y ?? rwy.y ?? 0;
        this.addAircraft(new Aircraft(id, type, spawnX, spawnY, rwy.heading, 0, 0, false, stats));
    }

    update(dt: number) {
        // Update aircraft
        this.aircrafts.forEach(ac => ac.update(dt));

        // Remove landed or exited aircraft
        const initialCount = this.aircrafts.length;
        this.aircrafts = this.aircrafts.filter(ac => {
            // Landed
            if (ac.isArrival && ac.isOnGround && ac.speed < 10) {
                this.score += 50;
                if (this.onScoreUpdated) this.onScoreUpdated(this.score);
                if (this.onAircraftRemoved) this.onAircraftRemoved(ac);
                return false;
            }
            // Exited airspace (distance > 50)
            const dist = Math.hypot(ac.x, ac.y);
            if (!ac.isArrival && dist > 50) {
                this.score += 50;
                if (this.onScoreUpdated) this.onScoreUpdated(this.score);
                if (this.onAircraftRemoved) this.onAircraftRemoved(ac);
                return false;
            }
            return true;
        });

        // Spawn Traffic
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnAircraft();
            this.spawnTimer = 10 + Math.random() * 10; // Spawn every 10-20 seconds
        }

        // Check Separation
        this.checkSeparation();
    }

    checkSeparation() {
        for (let i = 0; i < this.aircrafts.length; i++) {
            for (let j = i + 1; j < this.aircrafts.length; j++) {
                const a = this.aircrafts[i];
                const b = this.aircrafts[j];

                if (a.isOnGround || b.isOnGround) continue;

                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const altDiff = Math.abs(a.altitude - b.altitude);

                if (dist < 3 && altDiff < 10) {
                    a.violation = true;
                    b.violation = true;
                    // Penalty handled in score? Legacy code decrements score continuously
                    // this.score -= 0.1; 
                    // To avoid spamming React state, we might throttle score updates or just update local score
                    this.score -= 0.1;
                } else {
                    a.violation = false;
                    b.violation = false;
                }
            }
        }
    }

    showDetails: boolean = false;
    transparentMode: boolean = true;
    savedState: { scale: number, center: { x: number, y: number } } | null = null;

    toggleDetails() {
        this.showDetails = !this.showDetails;

        if (this.showDetails) {
            // Save current radar state
            this.savedState = {
                scale: this.scale,
                center: { ...this.center }
            };

            // Zoom in for detailed view (e.g., 8x default)
            // Center on airport (0,0 world coords -> canvas center)
            this.scale = 120; // Much larger scale for airport details
            this.center = { x: this.width / 2, y: this.height / 2 };
        } else {
            // Restore radar state
            if (this.savedState) {
                this.scale = this.savedState.scale;
                this.center = this.savedState.center;
            } else {
                this.scale = 35;
                this.center = { x: this.width / 2, y: this.height / 2 };
            }
        }

        return this.showDetails;
    }

    handlePan(dx: number, dy: number) {
        if (!this.showDetails) return;

        // Inverted controls for natural drag feel (moving mouse left moves view right)
        // Adjust sensitivity based on scale
        this.center.x += dx;
        this.center.y += dy;
    }

    handleZoom(delta: number) {
        if (!this.showDetails) return;

        const zoomSpeed = 0.1;
        const oldScale = this.scale;

        // Apply zoom
        this.scale -= delta * zoomSpeed;

        // Limits
        this.scale = Math.max(20, Math.min(this.scale, 300));
    }

    draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        // Clear background
        if (this.showDetails) {
            ctx.fillStyle = this.transparentMode ? '#0a1929' : '#f0f3f5';
        } else {
            ctx.fillStyle = '#001100';
        }
        ctx.fillRect(0, 0, width, height);

        // Draw Airport
        this.airport.draw(ctx, this.scale, this.center, this.showDetails, this.transparentMode);

        // Draw Range Rings (every 10 miles) - Only in Radar View
        if (!this.showDetails) {
            ctx.strokeStyle = '#003300';
            ctx.lineWidth = 1;
            for (let r = 10; r <= 50; r += 10) {
                ctx.beginPath();
                ctx.arc(this.center.x, this.center.y, r * this.scale, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Draw Aircraft
        this.aircrafts.forEach(ac => {
            // In Airport View, only show aircraft that are on the ground
            if (this.showDetails && !ac.isOnGround) return;
            // In Radar View (showDetails=false), show all aircraft (standard behavior)

            ac.draw(ctx, this.scale, this.center, this.showDetails);

            if (ac.violation) {
                let px = this.center.x + ac.x * this.scale;
                let py = this.center.y - ac.y * this.scale;
                ctx.strokeStyle = 'red';
                ctx.beginPath();
                ctx.arc(px, py, 15, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }

    getAircraft(id: string) {
        return this.aircrafts.find(ac => ac.id === id);
    }

    handleClick(x: number, y: number, rectLeft: number, rectTop: number): string | null {
        const mx = x - rectLeft;
        const my = y - rectTop;

        for (let ac of this.aircrafts) {
            let px = this.center.x + ac.x * this.scale;
            let py = this.center.y - ac.y * this.scale;

            if (Math.hypot(mx - px, my - py) < 20) {
                return ac.id;
            }
        }
        return null;
    }

    log(msg: string) {
        if (this.onLog) this.onLog(msg);
    }

    parseAndExecute(cmdStr: string) {
        // Format: FLIGHTID COMMAND [ARGS] ...
        // Can be chained: ID C 12 C OBK S 200

        const parts = cmdStr.trim().toUpperCase().split(/\s+/);
        if (parts.length < 2) return;

        const id = parts[0];
        const ac = this.getAircraft(id);

        if (!ac) {
            this.log(`Unknown ID: ${id}`);
            return;
        }

        this.log(`> ${cmdStr.toUpperCase()}`);

        let i = 1;
        while (i < parts.length) {
            const cmd = parts[i];
            i++;

            switch (cmd) {
                case 'C': // Change Heading, Altitude, or Fix
                    if (i >= parts.length) break;
                    let val = parts[i];
                    i++;

                    // Check if expedite
                    let expedite = false;
                    if (i < parts.length && (parts[i] === 'X' || parts[i] === 'EX')) {
                        expedite = true;
                        i++;
                    }

                    // Check if L/R turn
                    if (i < parts.length && (parts[i] === 'L' || parts[i] === 'R')) {
                        i++; // Consume L/R
                    }

                    // Logic to distinguish Heading vs Altitude vs Fix
                    if (!isNaN(parseInt(val))) {
                        const num = parseInt(val);
                        if (num >= 100 || val.length === 3) {
                            // Heading (3 digits or >= 100)
                            ac.setHeading(num);
                            this.log(`${id} heading ${num}`);
                        } else {
                            // Altitude (1 or 2 digits)
                            ac.setAltitude(num, expedite);
                            this.log(`${id} altitude ${num}00 ${expedite ? 'EXPEDITE' : ''}`);
                        }
                    } else {
                        // Fix name
                        const fix = this.airport.fixes[val];
                        if (fix) {
                            ac.setFix(val, fix);
                            this.log(`${id} cleared to ${val}`);
                        } else {
                            this.log(`Unknown Fix: ${val}`);
                        }
                    }
                    break;

                case 'T': // Takeoff
                    if (ac.isOnGround) {
                        if (ac.targetAltitude > 0) {
                            ac.takeoff();
                            this.log(`${id} cleared for takeoff`);
                        } else {
                            this.log(`${id} needs altitude clearance first`);
                        }
                    } else {
                        this.log(`${id} already airborne`);
                    }
                    break;

                case 'L': // Land
                    if (i >= parts.length) break;
                    let rwyName = parts[i];
                    i++;

                    const rwy = this.airport.runways.find(r => r.name === rwyName);
                    if (rwy) {
                        // Validation: < 3000ft AGL, +/- 60 deg
                        const agl = ac.altitude - (this.airport.elevation / 100);
                        if (agl > 30) {
                            this.log(`${id} too high. Alt: ${ac.altitude.toFixed(1)}, Elev: ${(this.airport.elevation / 100).toFixed(1)}, AGL: ${agl.toFixed(1)}`);
                        } else {
                            ac.setLanding(rwy);
                            this.log(`${id} cleared to land ${rwyName}`);
                        }
                    } else {
                        this.log(`Unknown Runway: ${rwyName}`);
                    }
                    break;

                case 'A': // Abort
                    ac.landingRunway = null;
                    ac.navFix = null;
                    this.log(`${id} approach aborted`);
                    break;

                case 'W': // Wait / Line up
                    this.log(`${id} hold position`);
                    break;

                default:
                    break;
            }
        }
    }
}
