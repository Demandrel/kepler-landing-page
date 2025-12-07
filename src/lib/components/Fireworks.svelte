<script lang="ts">
	import { onMount } from 'svelte';

	let { active = $bindable(false) } = $props();

	// --- UI STATE ---
	let isSettingsOpen = $state(false);
	let activeTab = $state('tab-launch');
	let currentSeed = $state(5);
	let hasBeenActivatedOnce = $state(false);
	let activePalette = $state('multicolor');
	let isMuted = $state(false);
	let isMobile = $state(false);

	// --- CONFIGURATION ---
	// Default configuration values
	const DEFAULT_CONFIG = {
		spawnRate: 0.03,
		coneChance: 0.3,
		rocketSpeed: { min: -12, max: -17 },
		gravity: 0.06,
		rocketAirResistance: 0.995,
		particleCount: { min: 60, max: 150 },
		explosionPower: { min: 2, max: 6 },
		friction: 0.96,
		coneGravity: 0.005,
		coneFriction: 0.92,
		trailLength: 0.15,
		haloSize: 200,
		haloOpacity: 0.03,
		haloDecay: { min: 0.0001, max: 0.00025 },
		haloGravity: 0.02,
		finalBouquetMultiplier: 3.0,
		finalBouquetLoudChance: 0.7,
		finalBouquetPowerMult: 1.9,
		finalBouquetDensityMult: 1.9,
		smokeEnabled: true,
		smokeColor: '35, 35, 35',
		smokeLineOpacity: 0.06,
		smokeLineWidth: 4,
		smokeFadeOut: 0.003,
		smokeFadeOutFast: 0.02,
		minVelocityToSmoke: 0.5
	};

	const CONFIG = $state({
		spawnRate: 0.03,
		coneChance: 0.3,

		// Physique
		// Rocket speed is negative (moving up).
		// min: -12 (lower height), max: -18 (higher height)
		// We will control these via UI as positive values representing "Height"
		rocketSpeed: { min: -12, max: -17 },
		gravity: 0.06,
		rocketAirResistance: 0.995,

		// Explosion
		particleCount: { min: 60, max: 150 },
		explosionPower: { min: 2, max: 6 },
		friction: 0.96,

		// Cône
		coneGravity: 0.005,
		coneFriction: 0.92,

		trailLength: 0.15,

		// Halo
		haloSize: 200,
		haloOpacity: 0.03,
		haloDecay: { min: 0.0001, max: 0.00025 },
		haloGravity: 0.02,

		// Bouquet Final Boosters
		finalBouquetMultiplier: 3.0,
		finalBouquetLoudChance: 0.7,
		finalBouquetPowerMult: 1.9,
		finalBouquetDensityMult: 1.9,

		// Fumée
		smokeEnabled: true,
		smokeColor: '35, 35, 35',
		smokeLineOpacity: 0.06,
		smokeLineWidth: 4,
		smokeFadeOut: 0.003,
		smokeFadeOutFast: 0.02,
		minVelocityToSmoke: 0.5
	});

	// --- MOTEUR (NON-REACTIF) ---
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let smokeCanvas: HTMLCanvasElement;
	let smokeCtx: CanvasRenderingContext2D;

	let width = 0;
	let height = 0;

	let rockets: Rocket[] = [];
	let particles: Particle[] = [];
	let flashes: Flash[] = [];

	let animationId: number | null = null;
	let startTime: number | null = null;
	let smokeClearTimer: number | null = null;

	// --- OLD RNG ---
	class SeededRandom {
		seed: number;
		constructor(seed: number) {
			this.seed = seed;
		}
		next() {
			this.seed = (this.seed * 9301 + 49297) % 233280;
			return this.seed / 233280;
		}
	}
	let rng = new SeededRandom(currentSeed);
	const random = (min: number, max: number) => rng.next() * (max - min) + min;

	// --- PALETTES ---
	const PALETTES_DICT: Record<string, string[][]> = {
		multicolor: [
			['#ffffff', '#E0E0E0'],
			['#FFD700', '#FFEB3B', '#FFCCBC'],
			['#E040FB', '#7C4DFF', '#00BCD4'],
			['#B2FF59', '#64DD17', '#CCFF90'],
			['#18FFFF', '#84FFFF', '#E0F7FA'],
			['#FF5252', '#FF1744']
		],
		classic: [
			['#ffffff', '#E0E0E0'],
			['#FFD700', '#FFEB3B']
		],
		neon: [
			['#FF00FF', '#E040FB'],
			['#00E5FF', '#18FFFF'],
			['#7C4DFF', '#651FFF']
		],
		warm: [
			['#FF5252', '#D50000'],
			['#FFAB40', '#FF6D00'],
			['#FFD740', '#FFC400']
		],
		cold: [
			['#E0F7FA', '#B2EBF2'],
			['#80DEEA', '#4DD0E1'],
			['#ffffff', '#F5F5F5']
		],
		matrix: [
			['#00E676', '#69F0AE'],
			['#00C853', '#B9F6CA'],
			['#B2FF59', '#76FF03']
		]
	};

	function getRocketPalette() {
		const pal = PALETTES_DICT[activePalette];
		return pal[Math.floor(rng.next() * pal.length)];
	}

	// --- AUDIO ---
	const EXPLOSION_VOLUME_1 = 0.3;
	const LAUNCH_VOLUME_1 = 0.3;
	let explosionSounds: HTMLAudioElement[] = [];
	let launchSounds: HTMLAudioElement[] = [];

	if (typeof window !== 'undefined') {
		explosionSounds = [
			new Audio('/firework_explode_1.wav'),
			new Audio('/firework_explode_2.wav'),
			new Audio('/firework_explode_3.wav')
		];
		launchSounds = [
			new Audio('/firework_lauch_1.wav'),
			new Audio('/firework_lauch_2.wav'),
			new Audio('/firework_lauch_3.wav')
		];
		explosionSounds.forEach((s) => (s.volume = EXPLOSION_VOLUME_1));
		launchSounds.forEach((s) => (s.volume = LAUNCH_VOLUME_1));
	}

	function playRandomExplosion(isLoud = false) {
		if (isMuted || explosionSounds.length === 0) return;
		const sound = explosionSounds[Math.floor(rng.next() * explosionSounds.length)];
		sound.volume = isLoud ? Math.min(1, EXPLOSION_VOLUME_1 * 1.5) : EXPLOSION_VOLUME_1;
		sound.currentTime = 0;
		sound.play().catch(() => {});
	}

	function playRandomLaunch() {
		if (isMuted || launchSounds.length === 0) return;
		const sound = launchSounds[Math.floor(rng.next() * launchSounds.length)];
		sound.currentTime = 0;
		sound.play().catch(() => {});
	}

	// --- CLASSES ---
	function drawSmokeLine(x1: number, y1: number, x2: number, y2: number) {
		if (!CONFIG.smokeEnabled || !smokeCtx) return;
		smokeCtx.globalCompositeOperation = 'source-over';
		smokeCtx.beginPath();
		smokeCtx.moveTo(x1, y1);
		smokeCtx.lineTo(x2, y2);
		smokeCtx.strokeStyle = `rgba(${CONFIG.smokeColor}, ${CONFIG.smokeLineOpacity})`;
		smokeCtx.lineWidth = CONFIG.smokeLineWidth;
		smokeCtx.lineCap = 'round';
		smokeCtx.stroke();
	}

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
		prevX: number;
		prevY: number;
		vx: number;
		vy: number;
		color: string;
		alpha: number;
		decay: number;
		size: number;
		type: string;

		constructor(
			x: number,
			y: number,
			type: string,
			rocketVx: number,
			rocketVy: number,
			paletteColors: string[],
			powerMultiplier = 1
		) {
			this.x = x;
			this.y = y;
			this.prevX = x;
			this.prevY = y;
			this.type = type;
			this.color = paletteColors[Math.floor(rng.next() * paletteColors.length)];
			this.alpha = 1;
			this.decay = random(0.008, 0.015);

			const power = random(CONFIG.explosionPower.min, CONFIG.explosionPower.max) * powerMultiplier;
			this.size = 2;

			if (type === 'cone') {
				const baseAngle = Math.atan2(rocketVy, rocketVx);
				const spread = Math.PI * 0.35;
				const angle = baseAngle + random(-spread, spread);
				const speed = power * 1.3;
				this.vx = Math.cos(angle) * speed;
				this.vy = Math.sin(angle) * speed;
			} else {
				const angle = random(0, Math.PI * 2);
				this.vx = Math.cos(angle) * power;
				this.vy = Math.sin(angle) * power;
			}
		}

		update() {
			this.prevX = this.x;
			this.prevY = this.y;
			if (this.type === 'cone') {
				this.vx *= CONFIG.coneFriction;
				this.vy *= CONFIG.coneFriction;
				this.vy += CONFIG.coneGravity;
			} else {
				this.vx *= CONFIG.friction;
				this.vy *= CONFIG.friction;
				this.vy += CONFIG.gravity;
			}
			this.x += this.vx;
			this.y += this.vy;
			this.alpha -= this.decay;

			const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
			if (this.alpha > 0.1 && speed > CONFIG.minVelocityToSmoke) {
				drawSmokeLine(this.prevX, this.prevY, this.x, this.y);
			}
		}

		draw() {
			ctx.save();
			ctx.globalAlpha = this.alpha;
			ctx.fillStyle = this.color;
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
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
		prevX: number;
		prevY: number;
		vx: number;
		vy: number;
		type: string;
		paletteColors: string[];
		mainColor: string;
		triggerVelocity: number;
		isFinalBouquet: boolean;

		constructor(isFinalBouquet = false) {
			const margin = width * 0.1;

			const sideRoll = rng.next();
			if (sideRoll < 0.5) {
				this.x = random(margin, width * 0.3); // Gauche
			} else {
				this.x = random(width * 0.7, width - margin); // Droite
			}

			this.y = height;
			this.prevX = this.x;
			this.prevY = this.y;
			this.type = rng.next() < CONFIG.coneChance ? 'cone' : 'standard';
			this.isFinalBouquet = isFinalBouquet;

			const targetX = random(width * 0.1, width * 0.9);

			// Adjust speeds for mobile (divide by 2 = less height)
			const mobileMultiplier = isMobile ? 0.7 : 1;

			if (this.isFinalBouquet) {
				// Fixed high speed for finale
				this.vy = random(-15 * mobileMultiplier, -12 * mobileMultiplier);
			} else {
				// Use the configured range
				// Note: speeds are negative (upwards), so 'min' speed (height) corresponds to a smaller absolute value (closer to 0)
				// We use the UI values (e.g. 10 to 25) directly from CONFIG logic
				this.vy = random(
					CONFIG.rocketSpeed.min * mobileMultiplier,
					CONFIG.rocketSpeed.max * mobileMultiplier
				);
			}

			const timeToPeak = Math.abs(this.vy) / CONFIG.gravity;
			this.vx = (targetX - this.x) / timeToPeak;

			this.paletteColors = getRocketPalette();
			this.mainColor = this.paletteColors[0];
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
			drawSmokeLine(this.prevX, this.prevY, this.x, this.y);
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
				return this.vy > -2 && this.vy < 1;
			} else {
				return this.vy > this.triggerVelocity || (this.y > height * 0.8 && this.vy > 0);
			}
		}
	}

	// --- LOOP & LOGIC ---
	function resize() {
		if (!canvas || !smokeCanvas) return;
		width = canvas.width = window.innerWidth;
		height = canvas.height = window.innerHeight;
		smokeCanvas.width = width;
		smokeCanvas.height = height;
	}

	function restartShow() {
		active = true;
		rng = new SeededRandom(currentSeed);
		startTime = Date.now();
		rockets = [];
		particles = [];
		flashes = [];
		hasBeenActivatedOnce = true;
		if (smokeClearTimer) {
			clearTimeout(smokeClearTimer);
			smokeClearTimer = null;
		}
	}

	function stopShow() {
		active = false;
		rockets = [];
		particles = [];
		flashes = [];
		if (smokeCtx) smokeCtx.clearRect(0, 0, width, height);
	}

	function clearSmoke() {
		if (smokeCtx) smokeCtx.clearRect(0, 0, width, height);
	}

	function resetSettings() {
		CONFIG.spawnRate = DEFAULT_CONFIG.spawnRate;
		CONFIG.coneChance = DEFAULT_CONFIG.coneChance;
		CONFIG.rocketSpeed = { ...DEFAULT_CONFIG.rocketSpeed };
		CONFIG.gravity = DEFAULT_CONFIG.gravity;
		CONFIG.rocketAirResistance = DEFAULT_CONFIG.rocketAirResistance;
		CONFIG.particleCount = { ...DEFAULT_CONFIG.particleCount };
		CONFIG.explosionPower = { ...DEFAULT_CONFIG.explosionPower };
		CONFIG.friction = DEFAULT_CONFIG.friction;
		CONFIG.coneGravity = DEFAULT_CONFIG.coneGravity;
		CONFIG.coneFriction = DEFAULT_CONFIG.coneFriction;
		CONFIG.trailLength = DEFAULT_CONFIG.trailLength;
		CONFIG.haloSize = DEFAULT_CONFIG.haloSize;
		CONFIG.haloOpacity = DEFAULT_CONFIG.haloOpacity;
		CONFIG.haloDecay = { ...DEFAULT_CONFIG.haloDecay };
		CONFIG.haloGravity = DEFAULT_CONFIG.haloGravity;
		CONFIG.finalBouquetMultiplier = DEFAULT_CONFIG.finalBouquetMultiplier;
		CONFIG.finalBouquetLoudChance = DEFAULT_CONFIG.finalBouquetLoudChance;
		CONFIG.finalBouquetPowerMult = DEFAULT_CONFIG.finalBouquetPowerMult;
		CONFIG.finalBouquetDensityMult = DEFAULT_CONFIG.finalBouquetDensityMult;
		CONFIG.smokeEnabled = DEFAULT_CONFIG.smokeEnabled;
		CONFIG.smokeColor = DEFAULT_CONFIG.smokeColor;
		CONFIG.smokeLineOpacity = DEFAULT_CONFIG.smokeLineOpacity;
		CONFIG.smokeLineWidth = DEFAULT_CONFIG.smokeLineWidth;
		CONFIG.smokeFadeOut = DEFAULT_CONFIG.smokeFadeOut;
		CONFIG.smokeFadeOutFast = DEFAULT_CONFIG.smokeFadeOutFast;
		CONFIG.minVelocityToSmoke = DEFAULT_CONFIG.minVelocityToSmoke;
		currentSeed = 5;
		activePalette = 'multicolor';
	}

	function manualLaunch() {
		if (ctx) {
			rockets.push(new Rocket(false));
			playRandomLaunch();
		}
	}

	function loop() {
		if (smokeCtx) {
			smokeCtx.globalCompositeOperation = 'destination-out';
			const fadeSpeed = active ? CONFIG.smokeFadeOut : CONFIG.smokeFadeOutFast;
			smokeCtx.fillStyle = `rgba(0, 0, 0, ${fadeSpeed})`;
			smokeCtx.fillRect(0, 0, width, height);
		}

		ctx.globalCompositeOperation = 'destination-out';
		ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.trailLength})`;
		ctx.fillRect(0, 0, width, height);

		ctx.globalCompositeOperation = 'lighter';

		if (active && startTime === null) {
			startTime = Date.now();
			rng = new SeededRandom(currentSeed);
			hasBeenActivatedOnce = true;
			if (smokeClearTimer) {
				clearTimeout(smokeClearTimer);
				smokeClearTimer = null;
			}
		} else if (!active && startTime !== null) {
			startTime = null;
			if (smokeClearTimer) clearTimeout(smokeClearTimer);
			smokeClearTimer = window.setTimeout(() => {
				if (smokeCtx) smokeCtx.clearRect(0, 0, width, height);
				smokeClearTimer = null;
			}, 10000);
		}

		const elapsedTime = startTime ? (Date.now() - startTime) / 1000 : 0;
		const isFinalBouquetTime = elapsedTime >= 7 && elapsedTime < 10;

		// Reduce final bouquet by 2 on mobile
		const bouquetMultiplier = isMobile
			? CONFIG.finalBouquetMultiplier / 2.5
			: CONFIG.finalBouquetMultiplier;

		const currentSpawnRate = isFinalBouquetTime
			? CONFIG.spawnRate * bouquetMultiplier
			: CONFIG.spawnRate;

		if ((active || (startTime !== null && elapsedTime < 10)) && random(0, 1) < currentSpawnRate) {
			rockets.push(new Rocket(isFinalBouquetTime));
			playRandomLaunch();
		}

		for (let i = rockets.length - 1; i >= 0; i--) {
			const r = rockets[i];
			r.update();
			r.draw();
			if (r.shouldExplode()) {
				flashes.push(new Flash(r.x, r.y, r.mainColor));

				const densityMult = r.isFinalBouquet ? CONFIG.finalBouquetDensityMult : 1;
				const powerMult = r.isFinalBouquet ? CONFIG.finalBouquetPowerMult : 1;
				const count = random(CONFIG.particleCount.min, CONFIG.particleCount.max) * densityMult;

				for (let j = 0; j < count; j++) {
					particles.push(new Particle(r.x, r.y, r.type, r.vx, r.vy, r.paletteColors, powerMult));
				}
				rockets.splice(i, 1);
				playRandomExplosion(r.isFinalBouquet);
			}
		}

		for (let i = flashes.length - 1; i >= 0; i--) {
			const f = flashes[i];
			f.update();
			f.draw();
			if (f.isDead()) flashes.splice(i, 1);
		}

		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.update();
			p.draw();
			if (p.isDead()) particles.splice(i, 1);
		}

		animationId = requestAnimationFrame(loop);
	}

	function setNewSeed(val: number) {
		currentSeed = val;
		rng = new SeededRandom(currentSeed);
		rockets = [];
		particles = [];
		flashes = [];
		if (smokeCtx) smokeCtx.clearRect(0, 0, width, height);
	}

	function randomSeed() {
		const s = Math.floor(Math.random() * 10000);
		currentSeed = s;
		setNewSeed(s);
	}

	function switchTab(tab: string) {
		activeTab = tab;
	}
	function setPalette(key: string) {
		activePalette = key;
	}

	// UI Helpers for Height Range
	// We map UI values (positive) to engine values (negative)
	// Low height = low speed (e.g. -12), High height = high speed (e.g. -25)
	// UI Slider 1 (Min Height) -> Controls CONFIG.rocketSpeed.min (e.g. -12)
	// UI Slider 2 (Max Height) -> Controls CONFIG.rocketSpeed.max (e.g. -18)
	// Note: In engine logic, "max" speed is usually the *faster* one (more negative),
	// but random(min, max) doesn't care about order.
	// Let's standardise: UI 10-30 => Engine -10 to -30.

	function updateMinHeight(val: number) {
		// UI Value (e.g. 12) -> Engine Value (-12)
		// We want 'min' to be the lower bound of speed (closest to 0, so 'lowest height')
		// And 'max' to be the upper bound (furthest from 0, 'highest height')
		// Actually random() usually expects min < max. -18 < -12.
		// So 'min' in random() should be the most negative (highest height).
		// Let's simplify: we just update the range.
		CONFIG.rocketSpeed.min = -Math.abs(val);
	}

	function updateMaxHeight(val: number) {
		CONFIG.rocketSpeed.max = -Math.abs(val);
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		smokeCtx = smokeCanvas.getContext('2d')!;
		resize();

		// Mobile detection
		const checkMobile = () => {
			isMobile = window.innerWidth < 768; // md breakpoint
		};
		checkMobile();

		window.addEventListener('resize', resize);
		window.addEventListener('resize', checkMobile);
		loop();

		return () => {
			window.removeEventListener('resize', resize);
			window.removeEventListener('resize', checkMobile);
			if (animationId) cancelAnimationFrame(animationId);
			if (smokeClearTimer) clearTimeout(smokeClearTimer);
		};
	});
</script>

<svelte:head>
	<style>
		.scroller::-webkit-scrollbar {
			width: 4px;
		}
		.scroller::-webkit-scrollbar-track {
			background: transparent;
		}
		.scroller::-webkit-scrollbar-thumb {
			background: #444;
			border-radius: 2px;
		}
		input[type='range'] {
			-webkit-appearance: none;
			width: 100%;
			background: transparent;
		}
		input[type='range']::-webkit-slider-thumb {
			-webkit-appearance: none;
			height: 14px;
			width: 14px;
			border-radius: 50%;
			background: #fff;
			cursor: pointer;
			margin-top: -5px;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
			transition: transform 0.1s;
		}
		input[type='range']::-webkit-slider-thumb:hover {
			transform: scale(1.2);
		}
		input[type='range']::-webkit-slider-runnable-track {
			width: 100%;
			height: 4px;
			cursor: pointer;
			background: rgba(255, 255, 255, 0.2);
			border-radius: 2px;
		}
		.palette-btn.active {
			box-shadow:
				0 0 0 2px black,
				0 0 0 4px white;
			transform: scale(1.1);
		}
	</style>
</svelte:head>

<canvas
	bind:this={smokeCanvas}
	class="fixed inset-0 pointer-events-none z-[5]"
	style="background: transparent;"
></canvas>
<canvas
	bind:this={canvas}
	class="fixed inset-0 pointer-events-none z-40"
	style="background: transparent;"
></canvas>

{#if active || hasBeenActivatedOnce}
	<button
		onclick={() => (isSettingsOpen = !isSettingsOpen)}
		class="fixed bottom-8 cursor-pointer right-8 z-50 bg-white text-black px-5 py-3 rounded-full hidden md:flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 transition-transform active:scale-95 font-bold tracking-wide text-sm group"
	>
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			class="shrink-0"
		>
			<path
				d="M10.2431 1.36917C9.8947 0.940653 9.26487 0.875723 8.83636 1.22414C8.40784 1.57256 8.34291 2.20239 8.69133 2.6309C9.73145 3.91013 10.0678 5.63406 9.55125 7.1838C9.3766 7.70775 9.65976 8.27407 10.1837 8.44872C10.7077 8.62336 11.274 8.3402 11.4486 7.81626C12.1892 5.59451 11.6992 3.16001 10.2431 1.36917Z"
				fill="black"
			/>
			<path
				d="M13.9999 3.00003C13.4476 3.00003 12.9999 3.44775 12.9999 4.00003C12.9999 4.55232 13.4476 5.00003 13.9999 5.00003H14.0099C14.5622 5.00003 15.0099 4.55232 15.0099 4.00003C15.0099 3.44775 14.5622 3.00003 14.0099 3.00003H13.9999Z"
				fill="black"
			/>
			<path
				d="M22.2881 5.30703C22.8171 5.14828 23.1172 4.59077 22.9585 4.06179C22.7997 3.53281 22.2422 3.23268 21.7133 3.39142C18.1791 4.45201 15.0021 6.33042 12.6999 9.4C12.3685 9.84183 12.4581 10.4686 12.8999 10.8C13.3417 11.1314 13.9685 11.0418 14.2999 10.6C16.2897 7.94698 19.064 6.27458 22.2881 5.30703Z"
				fill="black"
			/>
			<path
				d="M5.99991 4.00003C5.44763 4.00003 4.99991 4.44775 4.99991 5.00003C4.99991 5.55232 5.44763 6.00003 5.99991 6.00003H6.00991C6.5622 6.00003 7.00991 5.55232 7.00991 5.00003C7.00991 4.44775 6.5622 4.00003 6.00991 4.00003H5.99991Z"
				fill="black"
			/>
			<path
				d="M12.6284 11.3716C11.402 10.1452 10.0977 9.17016 8.9543 8.59848C8.38755 8.31511 7.80826 8.10442 7.26602 8.04015C6.73803 7.97758 6.06213 8.03838 5.55734 8.54317C5.28037 8.82013 5.13658 9.15272 5.07389 9.47901C4.93538 9.67316 4.79896 9.89937 4.6704 10.1285C4.46062 10.5023 4.23042 10.9597 3.99457 11.4683C3.52265 12.4859 3.01189 13.7436 2.58037 15.0145C2.1513 16.2781 1.78737 17.5931 1.62795 18.7149C1.54854 19.2737 1.51364 19.8257 1.56404 20.319C1.61214 20.7897 1.75227 21.3537 2.15888 21.7785C2.57517 22.2134 3.14557 22.3663 3.61676 22.4211C4.11044 22.4786 4.66429 22.4475 5.2236 22.3711C6.34704 22.2177 7.66964 21.8555 8.94144 21.4268C10.2209 20.9955 11.4892 20.4831 12.5153 20.0096C13.0281 19.773 13.4892 19.542 13.8657 19.3316C14.0966 19.2026 14.3249 19.0655 14.5205 18.9262C14.847 18.8636 15.1797 18.7198 15.4568 18.4427C15.9616 17.9379 16.0224 17.262 15.9598 16.734C15.8956 16.1917 15.6849 15.6124 15.4015 15.0457C14.8298 13.9023 13.8548 12.598 12.6284 11.3716ZM8.05987 10.3873C8.9639 10.8394 10.0975 11.6691 11.2142 12.7858C12.3309 13.9025 13.1606 15.0361 13.6127 15.9401C13.8375 16.3898 13.9436 16.7328 13.9724 16.9586C13.6733 16.9208 13.1445 16.7396 12.4176 16.3016C11.6163 15.8187 10.7002 15.1003 9.79998 14.2C8.89973 13.2998 8.18125 12.3837 7.69837 11.5824C7.26038 10.8555 7.07919 10.3267 7.04145 10.0276C7.26718 10.0564 7.61017 10.1625 8.05987 10.3873Z"
				fill="black"
			/>
			<path
				d="M20.9999 9.00003C20.4476 9.00003 19.9999 9.44775 19.9999 10C19.9999 10.5523 20.4476 11 20.9999 11H21.0099C21.5622 11 22.0099 10.5523 22.0099 10C22.0099 9.44775 21.5622 9.00003 21.0099 9.00003H20.9999Z"
				fill="black"
			/>
			<path
				d="M15.9999 11C15.4476 11 14.9999 11.4477 14.9999 12C14.9999 12.5523 15.4476 13 15.9999 13H16.0099C16.5622 13 17.0099 12.5523 17.0099 12C17.0099 11.4477 16.5622 11 16.0099 11H15.9999Z"
				fill="black"
			/>
			<path
				d="M22.8574 16.4855C21.4751 14.1816 19.0448 13.6978 16.8585 14.0101C16.3118 14.0882 15.9319 14.5947 16.01 15.1415C16.0881 15.6882 16.5946 16.0681 17.1413 15.99C18.8869 15.7406 20.3321 16.164 21.1424 17.5145C21.4266 17.9881 22.0408 18.1417 22.5144 17.8575C22.988 17.5734 23.1416 16.9591 22.8574 16.4855Z"
				fill="black"
			/>
			<path
				d="M17.9999 18C17.4476 18 16.9999 18.4477 16.9999 19C16.9999 19.5523 17.4476 20 17.9999 20H18.0099C18.5622 20 19.0099 19.5523 19.0099 19C19.0099 18.4477 18.5622 18 18.0099 18H17.9999Z"
				fill="black"
			/>
		</svg>
		Play with me
	</button>

	<div
		class="fixed bottom-28 right-8 z-50 w-80 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all duration-300 origin-bottom-right"
		class:opacity-0={!isSettingsOpen}
		class:translate-y-4={!isSettingsOpen}
		class:pointer-events-none={!isSettingsOpen}
		class:scale-95={!isSettingsOpen}
	>
		<div class="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
			<h2 class="text-sm font-bold tracking-wide text-white">Firework settings</h2>
			<button
				onclick={() => (isMuted = !isMuted)}
				class="text-[10px] uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors {isMuted
					? 'text-red-400'
					: 'text-gray-400 hover:text-white'}"
			>
				{isMuted ? 'Sound OFF' : 'Sound ON'}
			</button>
		</div>

		<div class="flex border-b border-white/10 text-[11px] font-bold uppercase tracking-wider">
			<button
				onclick={() => (activeTab = 'tab-launch')}
				class="flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer {activeTab ===
				'tab-launch'
					? 'text-white border-white bg-white/5'
					: 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'}">Launch</button
			>
			<button
				onclick={() => (activeTab = 'tab-burst')}
				class="flex-1 cursor-pointer py-3 text-center border-b-2 transition-colors {activeTab ===
				'tab-burst'
					? 'text-white border-white bg-white/5'
					: 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'}"
				>Firework</button
			>
		</div>

		<div class="p-6 overflow-y-auto scroller flex-1 pb-20">
			{#if activeTab === 'tab-launch'}
				<div class="space-y-6">
					<div class="space-y-2">
						<label class="text-[10px] text-gray-400 uppercase font-bold tracking-widest"
							>Simulation Seed</label
						>
						<div class="flex gap-2 mt-2">
							<input
								type="number"
								bind:value={currentSeed}
								onchange={() => setNewSeed(currentSeed)}
								class="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-white/40 transition-colors font-mono text-gray-300"
							/>
							<button
								onclick={randomSeed}
								class="px-2 rounded cursor-pointer hover:bg-white/10 transition-colors"
							>
								<svg
									width="24"
									height="24"
									viewBox="0 0 40 40"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fill-rule="evenodd"
										clip-rule="evenodd"
										d="M18.2604 3.33331H21.7396C24.0113 3.3333 25.818 3.33329 27.2757 3.45238C28.7684 3.57434 30.0411 3.82944 31.2066 4.42325C33.0882 5.38198 34.618 6.91179 35.5767 8.79341C36.1705 9.95882 36.4256 11.2316 36.5476 12.7243C36.6667 14.1819 36.6667 15.9885 36.6666 18.2602V21.7396C36.6667 24.0113 36.6667 25.8181 36.5476 27.2757C36.4256 28.7684 36.1705 30.0411 35.5767 31.2066C34.618 33.0882 33.0882 34.618 31.2066 35.5767C30.0411 36.1705 28.7684 36.4256 27.2757 36.5476C25.8181 36.6667 24.0114 36.6667 21.7398 36.6666H18.2603C15.9887 36.6667 14.1819 36.6667 12.7243 36.5476C11.2316 36.4256 9.95882 36.1705 8.79341 35.5767C6.91179 34.618 5.38198 33.0882 4.42325 31.2066C3.82944 30.0411 3.57434 28.7684 3.45238 27.2757C3.33329 25.818 3.3333 24.0113 3.33331 21.7396V18.2604C3.3333 15.9886 3.33329 14.1819 3.45238 12.7243C3.57434 11.2316 3.82944 9.95882 4.42325 8.79341C5.38198 6.91179 6.91179 5.38198 8.79341 4.42325C9.95882 3.82944 11.2316 3.57434 12.7243 3.45238C14.1819 3.33329 15.9886 3.3333 18.2604 3.33331ZM13.3333 11.5C12.3208 11.5 11.5 12.3208 11.5 13.3333C11.5 14.3458 12.3208 15.1666 13.3333 15.1666H13.35C14.3625 15.1666 15.1833 14.3458 15.1833 13.3333C15.1833 12.3208 14.3625 11.5 13.35 11.5H13.3333ZM26.6666 11.5C25.6541 11.5 24.8333 12.3208 24.8333 13.3333C24.8333 14.3458 25.6541 15.1666 26.6666 15.1666H26.6833C27.6958 15.1666 28.5166 14.3458 28.5166 13.3333C28.5166 12.3208 27.6958 11.5 26.6833 11.5H26.6666ZM20 18.1666C18.9875 18.1666 18.1666 18.9875 18.1666 20C18.1666 21.0125 18.9875 21.8333 20 21.8333H20.0166C21.0292 21.8333 21.85 21.0125 21.85 20C21.85 18.9875 21.0292 18.1666 20.0166 18.1666H20ZM13.3333 24.8333C12.3208 24.8333 11.5 25.6541 11.5 26.6666C11.5 27.6792 12.3208 28.5 13.3333 28.5H13.35C14.3625 28.5 15.1833 27.6792 15.1833 26.6666C15.1833 25.6541 14.3625 24.8333 13.35 24.8333H13.3333ZM26.6666 24.8333C25.6541 24.8333 24.8333 25.6541 24.8333 26.6666C24.8333 27.6792 25.6541 28.5 26.6666 28.5H26.6833C27.6958 28.5 28.5166 27.6792 28.5166 26.6666C28.5166 25.6541 27.6958 24.8333 26.6833 24.8333H26.6666Z"
										fill="white"
									/>
								</svg>
							</button>
						</div>
						<div class="flex flex-wrap gap-2 mt-2">
							{#each [5, 22, 100, 6486] as seed}
								<button
									onclick={() => {
										currentSeed = seed;
										setNewSeed(seed);
									}}
									class="text-[10px] cursor-pointer bg-white/5 text-gray-300 hover:bg-white/20 border border-white/5 px-2 py-1 rounded transition-colors"
									>#{seed}</button
								>
							{/each}
						</div>
					</div>
					<div class="w-full h-px bg-white/10"></div>
					<div class="space-y-5">
						<div>
							<div class="flex justify-between text-xs mb-2 font-medium">
								<span class="text-gray-400">Spawn Rate</span>
								<span class="text-white">{CONFIG.spawnRate.toFixed(2)}</span>
							</div>
							<input type="range" min="0.01" max="0.20" step="0.01" bind:value={CONFIG.spawnRate} />
						</div>

						<div>
							<div class="flex justify-between text-xs mb-2 font-medium">
								<span class="text-gray-400">Min Height</span>
								<span class="text-white">{Math.abs(CONFIG.rocketSpeed.min)}</span>
							</div>
							<input
								type="range"
								min="10"
								max="17"
								step="1"
								value={Math.abs(CONFIG.rocketSpeed.min)}
								oninput={(e) => updateMinHeight(parseFloat(e.currentTarget.value))}
							/>
						</div>

						<div>
							<div class="flex justify-between text-xs mb-2 font-medium">
								<span class="text-gray-400">Max Height</span>
								<span class="text-white">{Math.abs(CONFIG.rocketSpeed.max)}</span>
							</div>
							<input
								type="range"
								min="10"
								max="17"
								step="1"
								value={Math.abs(CONFIG.rocketSpeed.max)}
								oninput={(e) => updateMaxHeight(parseFloat(e.currentTarget.value))}
							/>
						</div>
					</div>
				</div>
			{/if}

			{#if activeTab === 'tab-burst'}
				<div class="space-y-6">
					<div class="space-y-3">
						<label class="text-[10px] text-gray-400 uppercase font-bold tracking-widest"
							>Color Theme</label
						>
						<div class="grid grid-cols-6 gap-2 mt-3">
							<button
								onclick={() => (activePalette = 'multicolor')}
								class="palette-btn w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-yellow-500 to-blue-500 transition-all cursor-pointer"
								class:active={activePalette === 'multicolor'}
								title="Multicolor"
							></button>
							<button
								onclick={() => (activePalette = 'classic')}
								class="palette-btn w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-300 to-white transition-all cursor-pointer"
								class:active={activePalette === 'classic'}
								title="Classic"
							></button>
							<button
								onclick={() => (activePalette = 'neon')}
								class="palette-btn w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 transition-all cursor-pointer"
								class:active={activePalette === 'neon'}
								title="Neon"
							></button>
							<button
								onclick={() => (activePalette = 'warm')}
								class="palette-btn w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-orange-400 transition-all cursor-pointer"
								class:active={activePalette === 'warm'}
								title="Warm"
							></button>
							<button
								onclick={() => (activePalette = 'cold')}
								class="palette-btn w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-200 transition-all cursor-pointer"
								class:active={activePalette === 'cold'}
								title="Cold"
							></button>
							<button
								onclick={() => (activePalette = 'matrix')}
								class="palette-btn w-8 h-8 rounded-full bg-gradient-to-tr from-green-700 to-green-400 transition-all cursor-pointer"
								class:active={activePalette === 'matrix'}
								title="Matrix"
							></button>
						</div>
					</div>
					<div class="w-full h-px bg-white/10"></div>
					<div class="space-y-5">
						<div>
							<div class="flex justify-between text-xs mb-2 font-medium">
								<span class="text-gray-400">Power</span>
								<span class="text-white">{CONFIG.explosionPower.max}</span>
							</div>
							<input
								type="range"
								min="2"
								max="10"
								step="0.5"
								bind:value={CONFIG.explosionPower.max}
								oninput={() => (CONFIG.explosionPower.min = CONFIG.explosionPower.max / 2)}
							/>
						</div>
						<div>
							<div class="flex justify-between text-xs mb-2 font-medium">
								<span class="text-gray-400">Density</span>
								<span class="text-white">{CONFIG.particleCount.max}</span>
							</div>
							<input
								type="range"
								min="30"
								max="300"
								step="10"
								bind:value={CONFIG.particleCount.max}
								oninput={() => (CONFIG.particleCount.min = CONFIG.particleCount.max / 2)}
							/>
						</div>
						<div>
							<div class="flex justify-between text-xs mb-2 font-medium">
								<span class="text-gray-400">Cone Chance</span>
								<span class="text-white">{Math.round(CONFIG.coneChance * 100)}%</span>
							</div>
							<input type="range" min="0" max="1" step="0.1" bind:value={CONFIG.coneChance} />
						</div>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex row gap-2 w-[288px] mx-auto">
			<button
				onclick={stopShow}
				class="w-[138px] h-[44px] cursor-pointer mx-auto bg-red-500 text-white tracking-widest hover:bg-red-600 transition-colors shrink-0 mb-3 rounded-[14px]"
			>
				Stop
			</button>

			<button
				onclick={clearSmoke}
				class="w-[138px] h-[44px] cursor-pointer mx-auto bg-gray-700 text-white text-[16px] tracking-widest hover:bg-gray-800 transition-colors shrink-0 mb-3 rounded-[14px]"
			>
				Clean Smoke
			</button>
		</div>

		<button
			onclick={resetSettings}
			class="w-[288px] h-[44px] cursor-pointer mx-auto bg-white text-dark font-semibold tracking-widest hover:bg-orange-700 transition-colors shrink-0 mb-4 rounded-[14px]"
		>
			Reset Settings
		</button>

		<button
			onclick={restartShow}
			class="w-[288px] h-[44px] cursor-pointer mx-auto bg-[#A125EE] text-white font-semibold tracking-widest hover:bg-[#891fcb] transition-colors shrink-0 mb-3 rounded-[14px]"
		>
			Fire
		</button>
	</div>
{/if}
