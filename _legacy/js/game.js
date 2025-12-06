class Game {
    constructor() {
        this.canvas = document.getElementById('radar');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.airport = new Airport();
        this.aircrafts = [];
        this.lastTime = 0;
        this.scale = 15; // Pixels per mile
        this.center = { x: this.width / 2, y: this.height / 2 };
        this.score = 0;
        this.spawnTimer = 2; // Start spawning quickly

        this.ui = null;

        // Initial Traffic
        this.spawnAircraft();
    }

    init(ui) {
        this.ui = ui;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        if (this.canvas.parentElement) {
            this.canvas.width = this.canvas.parentElement.clientWidth;
            this.canvas.height = this.canvas.parentElement.clientHeight;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
            this.center = { x: this.width / 2, y: this.height / 2 };
        }
    }

    addAircraft(ac) {
        this.aircrafts.push(ac);
        if (this.ui) this.ui.addStrip(ac);
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap dt to prevent huge jumps
        const safeDt = Math.min(dt, 0.1);

        this.update(safeDt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Update aircraft
        this.aircrafts.forEach(ac => ac.update(dt));

        // Remove landed or exited aircraft
        this.aircrafts = this.aircrafts.filter(ac => {
            // Landed
            if (ac.isArrival && ac.isOnGround && ac.speed < 10) {
                this.score += 50;
                return false;
            }
            // Exited airspace (distance > 50)
            const dist = Math.hypot(ac.x, ac.y);
            if (!ac.isArrival && dist > 50) {
                this.score += 50;
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

        if (this.ui) this.ui.update();
    }

    spawnAircraft() {
        const isArrival = Math.random() > 0.3; // 70% chance of arrival
        const id = (Math.random() > 0.5 ? 'UAL' : 'AAL') + Math.floor(Math.random() * 900 + 100);

        if (isArrival) {
            // Spawn at edge (50 miles)
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * 50;
            const y = Math.sin(angle) * 50;
            // Heading towards center
            let heading = (Math.atan2(-y, -x) * 180 / Math.PI) + 90;
            if (heading < 0) heading += 360;

            // Random altitude 5000-10000
            const alt = 50 + Math.floor(Math.random() * 50);

            this.addAircraft(new Aircraft(id, 'B737', x, y, heading, alt, 250, true));
        } else {
            // Spawn at runway
            const rwy = this.airport.runways[Math.floor(Math.random() * this.airport.runways.length)];
            this.addAircraft(new Aircraft(id, 'A320', rwy.x, rwy.y, rwy.heading, 0, 0, false));
        }
    }

    handleClick(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = x - rect.left;
        const my = y - rect.top;

        for (let ac of this.aircrafts) {
            let px = this.center.x + ac.x * this.scale;
            let py = this.center.y - ac.y * this.scale;

            if (Math.hypot(mx - px, my - py) < 20) {
                return ac.id;
            }
        }
        return null;
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
                    this.score -= 0.1;
                } else {
                    a.violation = false;
                    b.violation = false;
                }
            }
        }
    }

    draw() {
        // Clear background
        this.ctx.fillStyle = '#001100';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw Airport
        this.airport.draw(this.ctx, this.scale, this.center);

        // Draw Range Rings (every 10 miles)
        this.ctx.strokeStyle = '#003300';
        this.ctx.lineWidth = 1;
        for (let r = 10; r <= 50; r += 10) {
            this.ctx.beginPath();
            this.ctx.arc(this.center.x, this.center.y, r * this.scale, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Draw Aircraft
        this.aircrafts.forEach(ac => {
            ac.draw(this.ctx, this.scale, this.center);
            if (ac.violation) {
                let px = this.center.x + ac.x * this.scale;
                let py = this.center.y - ac.y * this.scale;
                this.ctx.strokeStyle = 'red';
                this.ctx.beginPath();
                this.ctx.arc(px, py, 15, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        });
    }

    getAircraft(id) {
        return this.aircrafts.find(ac => ac.id === id);
    }
}
