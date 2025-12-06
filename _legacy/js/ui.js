class UI {
    constructor(game) {
        this.game = game;
        this.stripsContainer = document.getElementById('flight-strips');
        this.input = document.getElementById('command-input');
        this.history = document.getElementById('command-history');

        this.selectedAircraftId = null;

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.parseAndExecute(this.input.value);
                this.input.value = '';
            }
        });

        // Canvas click
        this.game.canvas.addEventListener('click', (e) => {
            const id = this.game.handleClick(e.clientX, e.clientY);
            if (id) {
                this.selectAircraft(id);
            }
        });
    }

    addStrip(ac) {
        const div = document.createElement('div');
        div.className = 'flight-strip ' + (ac.isArrival ? 'arrival' : 'departure');
        div.id = 'strip-' + ac.id;
        div.onclick = () => this.selectAircraft(ac.id);

        // Initial render
        this.updateStrip(div, ac);

        this.stripsContainer.appendChild(div);
    }

    updateStrip(div, ac) {
        // Arrow for altitude trend
        let altArrow = '=';
        if (ac.targetAltitude > ac.altitude + 1) altArrow = '↑';
        if (ac.targetAltitude < ac.altitude - 1) altArrow = '↓';

        div.innerHTML = `
            <div class="strip-row">
                <strong>${ac.id}</strong>
                <span>${ac.type}</span>
            </div>
            <div class="strip-row">
                <span>${Math.round(ac.heading)}°</span>
                <span>${altArrow} ${Math.round(ac.altitude)}</span>
                <span>${Math.round(ac.speed)}kt</span>
            </div>
            <div class="strip-row status">
                <span>${ac.navFix ? ac.navFix.name : (ac.landingRunway ? 'L ' + ac.landingRunway.name : '')}</span>
            </div>
        `;
    }

    update() {
        // Update Score
        const scoreEl = document.getElementById('score-info');
        if (scoreEl) scoreEl.innerText = `Score: ${Math.floor(this.game.score)}`;

        this.game.aircrafts.forEach(ac => {
            const div = document.getElementById('strip-' + ac.id);
            if (div) {
                this.updateStrip(div, ac);
            } else {
                // Strip missing? Add it (e.g. for new spawns)
                this.addStrip(ac);
            }
        });

        // Remove strips for removed aircraft
        const strips = document.querySelectorAll('.flight-strip');
        strips.forEach(strip => {
            const id = strip.id.replace('strip-', '');
            if (!this.game.getAircraft(id)) {
                strip.remove();
            }
        });
    }

    selectAircraft(id) {
        if (this.selectedAircraftId) {
            const prev = document.getElementById('strip-' + this.selectedAircraftId);
            if (prev) prev.classList.remove('selected');
        }
        this.selectedAircraftId = id;
        const curr = document.getElementById('strip-' + id);
        if (curr) curr.classList.add('selected');

        this.input.value = id + ' ';
        this.input.focus();
    }

    parseAndExecute(cmdStr) {
        // Format: FLIGHTID COMMAND [ARGS] ...
        // Can be chained: ID C 12 C OBK S 200

        const parts = cmdStr.trim().toUpperCase().split(/\s+/);
        if (parts.length < 2) return;

        const id = parts[0];
        const ac = this.game.getAircraft(id);

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
                    // Not implemented in physics yet, but parser should consume it
                    if (i < parts.length && (parts[i] === 'L' || parts[i] === 'R')) {
                        i++; // Consume L/R
                    }

                    // Logic to distinguish Heading vs Altitude vs Fix
                    if (!isNaN(val)) {
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
                        const fix = this.game.airport.fixes[val];
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

                    const rwy = this.game.airport.runways.find(r => r.name === rwyName);
                    if (rwy) {
                        // Validation: < 3000ft AGL, +/- 60 deg
                        // AGL = altitude - elevation/100. Elevation is 668ft ~ 7.
                        const agl = ac.altitude - (this.game.airport.elevation / 100);
                        if (agl > 30) {
                            this.log(`${id} too high for landing approach`);
                        } else {
                            ac.setLanding(rwy);
                            this.log(`${id} cleared to land ${rwyName}`);
                        }
                    } else {
                        this.log(`Unknown Runway: ${rwyName}`);
                    }
                    break;

                case 'S': // Speed
                    if (i >= parts.length) break;
                    let spd = parseInt(parts[i]);
                    i++;
                    ac.setSpeed(spd);
                    this.log(`${id} speed ${spd}`);
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
                    // Maybe it's a fix name directly? No, syntax is C [FIX].
                    // Ignore unknown
                    break;
            }
        }
    }

    log(msg) {
        const div = document.createElement('div');
        div.innerText = msg;
        this.history.appendChild(div);
        this.history.scrollTop = this.history.scrollHeight;
    }
}
