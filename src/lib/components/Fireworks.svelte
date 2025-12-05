<script lang="ts">
	import { onMount } from 'svelte';

	// Configuration
	const CONFIG = {
		spawnRate: 0.03,
		coneChance: 0.3,

		// Rocket physics
		rocketSpeed: { min: -12, max: -18 },
		gravity: 0.06,
		rocketAirResistance: 0.995,

		// Standard explosion (spherical)
		particleCount: { min: 60, max: 150 },
		explosionPower: { min: 2, max: 6 },
		friction: 0.96,

		// Cone physics (floating effect)
		coneGravity: 0.005,
		coneFriction: 0.92,

		trailLength: 0.15,

		// Halo configuration
		haloSize: 200,
		haloOpacity: 0.03,
		// Longer duration (reduced decay speed)
		haloDecay: { min: 0.0001, max: 0.00025 },
		// Halo gravity (falls slowly)
		haloGravity: 0.02
	};

	const PALETTES = [
		['#ffffff', '#E0E0E0'],
		['#FFD700', '#FFEB3B', '#FFCCBC'],
		['#E040FB', '#7C4DFF', '#00BCD4'],
		['#B2FF59', '#64DD17', '#CCFF90'],
		['#18FFFF', '#84FFFF', '#E0F7FA']
	];

	// Audio configuration
	const EXPLOSION_VOLUME_1 = 0.3;
	const EXPLOSION_VOLUME_2 = 0.3;
	const EXPLOSION_VOLUME_3 = 0.3;
	const LAUNCH_VOLUME_1 = 0.3;
	const LAUNCH_VOLUME_2 = 0.3;
	const LAUNCH_VOLUME_3 = 0.3;

	let { active = $bindable(false) } = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let width = $state(0);
	let height = $state(0);
	let rockets: Rocket[] = $state([]);
	let particles: Particle[] = $state([]);
	let flashes: Flash[] = $state([]);
	let animationId: number | null = null;

	// Audio
	let explosionSounds: HTMLAudioElement[] = [];
	let launchSounds: HTMLAudioElement[] = [];
	if (typeof window !== 'undefined') {
		explosionSounds = [
			new Audio('/firework_explode_1.wav'),
			new Audio('/firework_explode_2.wav'),
			new Audio('/firework_explode_3.wav')
		];
		explosionSounds[0].volume = EXPLOSION_VOLUME_1;
		explosionSounds[1].volume = EXPLOSION_VOLUME_2;
		explosionSounds[2].volume = EXPLOSION_VOLUME_3;

		launchSounds = [
			new Audio('/firework_lauch_1.wav'),
			new Audio('/firework_lauch_2.wav'),
			new Audio('/firework_lauch_3.wav')
		];
		launchSounds[0].volume = LAUNCH_VOLUME_1;
		launchSounds[1].volume = LAUNCH_VOLUME_2;
		launchSounds[2].volume = LAUNCH_VOLUME_3;
	}

	function playRandomExplosion() {
		if (explosionSounds.length === 0) return;
		const randomIndex = Math.floor(Math.random() * explosionSounds.length);
		const sound = explosionSounds[randomIndex];

		// 30% chance of 2x volume
		const volumeMultiplier = Math.random() < 0.3 ? 2 : 1;
		const baseVolume = [EXPLOSION_VOLUME_1, EXPLOSION_VOLUME_2, EXPLOSION_VOLUME_3][randomIndex];
		sound.volume = Math.min(1.0, baseVolume * volumeMultiplier);

		sound.currentTime = 0;
		sound.play().catch((err) => console.log('Audio play failed:', err));
	}

	function playRandomLaunch() {
		if (launchSounds.length === 0) return;
		const randomIndex = Math.floor(Math.random() * launchSounds.length);
		const sound = launchSounds[randomIndex];
		sound.currentTime = 0;
		sound.play().catch((err) => console.log('Audio play failed:', err));
	}

	const random = (min: number, max: number) => Math.random() * (max - min) + min;
	const randomColor = (palette: string[]) =>
		palette[Math.floor(Math.random() * palette.length)];

	class Flash {
		x: number;
		y: number;
		color: string;
		alpha: number;
		decay: number;
		size: number;

		constructor(x: number, y: number, color: string) {
			this.x = x;
			this.y = y;
			this.color = color;
			this.alpha = CONFIG.haloOpacity;
			this.decay = random(CONFIG.haloDecay.min, CONFIG.haloDecay.max);
			this.size = CONFIG.haloSize;
		}

		update() {
			this.alpha -= this.decay;
			// Halo falls slowly with gravity
			this.y += CONFIG.haloGravity;
		}

		draw() {
			if (this.alpha <= 0.0001) return;
			ctx.save();
			ctx.globalAlpha = this.alpha;
			const drawRadius = this.size * 1.5;
			const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, drawRadius);
			gradient.addColorStop(0, this.color);
			gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(this.x, this.y, drawRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}

		isDead() {
			return this.alpha <= 0;
		}
	}

	class Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		color: string;
		alpha: number;
		decay: number;
		type: 'cone' | 'standard';

		constructor(
			x: number,
			y: number,
			palette: string[],
			type: 'cone' | 'standard',
			rocketVx: number,
			rocketVy: number
		) {
			this.x = x;
			this.y = y;
			this.type = type;
			this.color = randomColor(palette);
			this.alpha = 1;
			this.decay = random(0.008, 0.015);

			const power = random(CONFIG.explosionPower.min, CONFIG.explosionPower.max);

			if (type === 'cone') {
				// Cone: spray pattern based on rocket direction
				const baseAngle = Math.atan2(rocketVy, rocketVx);
				const spread = Math.PI * 0.35;
				const angle = baseAngle + random(-spread, spread);
				const speed = power * 1.3;

				this.vx = Math.cos(angle) * speed;
				this.vy = Math.sin(angle) * speed;
			} else {
				// Standard: spherical explosion
				const angle = random(0, Math.PI * 2);
				this.vx = Math.cos(angle) * power;
				this.vy = Math.sin(angle) * power;
			}
		}

		update() {
			if (this.type === 'cone') {
				// Cone physics: floating effect
				this.vx *= CONFIG.coneFriction;
				this.vy *= CONFIG.coneFriction;
				this.vy += CONFIG.coneGravity;
			} else {
				// Standard physics: falling effect
				this.vx *= CONFIG.friction;
				this.vy *= CONFIG.friction;
				this.vy += CONFIG.gravity;
			}

			this.x += this.vx;
			this.y += this.vy;
			this.alpha -= this.decay;
		}

		draw() {
			ctx.save();
			ctx.globalAlpha = this.alpha;
			ctx.fillStyle = this.color;
			ctx.beginPath();
			ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}

		isDead() {
			return this.alpha <= 0;
		}
	}

	class Rocket {
		x: number;
		y: number;
		vx: number;
		vy: number;
		type: 'cone' | 'standard';
		palette: string[];
		mainColor: string;
		prevX: number;
		prevY: number;
		triggerVelocity: number;

		constructor() {
			// CUSTOM PLACEMENT: Avoid center 40% - spawn on sides only
			const centerExclusionStart = width * 0.3;
			const centerExclusionEnd = width * 0.7;

			if (Math.random() < 0.5) {
				// Left side (0% to 30%)
				this.x = Math.random() * centerExclusionStart;
			} else {
				// Right side (70% to 100%)
				this.x = Math.random() * (width - centerExclusionEnd) + centerExclusionEnd;
			}

			this.y = height;
			this.type = random(0, 1) < CONFIG.coneChance ? 'cone' : 'standard';

			const targetX = random(width * 0.1, width * 0.9);
			this.vy = random(CONFIG.rocketSpeed.min, CONFIG.rocketSpeed.max);
			const timeToPeak = Math.abs(this.vy) / CONFIG.gravity;
			this.vx = (targetX - this.x) / timeToPeak;

			this.palette = PALETTES[Math.floor(random(0, PALETTES.length))];
			this.mainColor = this.palette[0];
			this.prevX = this.x;
			this.prevY = this.y;
			this.triggerVelocity = random(0.5, 3.0);
		}

		update() {
			this.prevX = this.x;
			this.prevY = this.y;
			this.vx *= CONFIG.rocketAirResistance;
			this.vy *= CONFIG.rocketAirResistance;
			this.vy += CONFIG.gravity;
			this.x += this.vx;
			this.y += this.vy;
		}

		draw() {
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(this.prevX, this.prevY);
			ctx.lineTo(this.x, this.y);
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.restore();
		}

		shouldExplode() {
			if (this.type === 'cone') {
				// Cone: explode at peak or slight rise
				return this.vy > -2 && this.vy < 1;
			} else {
				// Standard: explode on descent
				return this.vy > this.triggerVelocity || (this.y > height * 0.8 && this.vy > 0);
			}
		}
	}

	function resize() {
		width = canvas.width = window.innerWidth;
		height = canvas.height = window.innerHeight;
	}

	function loop() {
		// Transparency with trail effect using destination-out
		ctx.globalCompositeOperation = 'destination-out';
		ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.trailLength})`;
		ctx.fillRect(0, 0, width, height);

		// Luminous drawing
		ctx.globalCompositeOperation = 'lighter';

		// Spawn rockets when active
		if (active && random(0, 1) < CONFIG.spawnRate) {
			rockets.push(new Rocket());
			playRandomLaunch();
		}

		// Update and draw rockets
		for (let i = rockets.length - 1; i >= 0; i--) {
			const r = rockets[i];
			r.update();
			r.draw();

			if (r.shouldExplode()) {
				flashes.push(new Flash(r.x, r.y, r.mainColor));
				const count = random(CONFIG.particleCount.min, CONFIG.particleCount.max);
				for (let j = 0; j < count; j++) {
					particles.push(new Particle(r.x, r.y, r.palette, r.type, r.vx, r.vy));
				}
				rockets.splice(i, 1);
				playRandomExplosion();
			}
		}

		// Update and draw flashes
		for (let i = flashes.length - 1; i >= 0; i--) {
			const f = flashes[i];
			f.update();
			f.draw();
			if (f.isDead()) flashes.splice(i, 1);
		}

		// Update and draw particles
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.update();
			p.draw();
			if (p.isDead()) particles.splice(i, 1);
		}

		animationId = requestAnimationFrame(loop);
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		resize();

		window.addEventListener('resize', resize);
		loop();

		return () => {
			window.removeEventListener('resize', resize);
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="fixed inset-0 pointer-events-none z-40"
	style="background: transparent;"
></canvas>
