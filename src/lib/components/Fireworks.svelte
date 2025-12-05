<script lang="ts">
	import { onMount } from 'svelte';

	// Configuration: fireworks per second
	const FIREWORKS_PER_SECOND = 2;

	// Audio configuration: volume for each explosion sound (0.0 to 1.0)
	const EXPLOSION_VOLUME_1 = 0.3;
	const EXPLOSION_VOLUME_2 = 0.3;
	const EXPLOSION_VOLUME_3 = 0.3;

	let { active = $bindable(false) } = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let w = $state(0);
	let h = $state(0);
	let particles: Particle[] = $state([]);
	let glows: Glow[] = $state([]);
	let animationId: number | null = null;

	// Calculate probability based on desired fireworks per second (60 fps)
	const probability = FIREWORKS_PER_SECOND / 60;

	// Audio: explosion sounds
	let explosionSounds: HTMLAudioElement[] = [];
	if (typeof window !== 'undefined') {
		explosionSounds = [
			new Audio('/firework_explode_1.wav'),
			new Audio('/firework_explode_2.wav'),
			new Audio('/firework_explode_3.wav')
		];
		explosionSounds[0].volume = EXPLOSION_VOLUME_1;
		explosionSounds[1].volume = EXPLOSION_VOLUME_2;
		explosionSounds[2].volume = EXPLOSION_VOLUME_3;
	}

	function playRandomExplosion() {
		if (explosionSounds.length === 0) return;
		const randomIndex = Math.floor(Math.random() * explosionSounds.length);
		const sound = explosionSounds[randomIndex];
		sound.currentTime = 0;
		sound.play().catch((err) => console.log('Audio play failed:', err));
	}

	// Generate 3 harmonious colors for a firework
	function generateColorPalette(): [string, string, string] {
		// Generate base color
		const baseHue = Math.random() * 360;
		const baseSat = 70 + Math.random() * 30;
		const baseLit = 50 + Math.random() * 20;

		// Create 3 variations: base, lighter, slightly different hue
		const color1 = `hsl(${baseHue}, ${baseSat}%, ${baseLit}%)`;
		const color2 = `hsl(${baseHue}, ${baseSat - 10}%, ${baseLit + 15}%)`;
		const color3 = `hsl(${(baseHue + 20) % 360}, ${baseSat}%, ${baseLit - 10}%)`;

		return [color1, color2, color3];
	}

	class Particle {
		w: number;
		h: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
		alpha: number;
		color: string;
		gravity = 0.15;
		friction = 0.98;

		constructor(xPoint: number, yPoint: number, color: string) {
			// 2x smaller particles
			this.w = this.h = (Math.random() * 6 + 1) / 2;
			this.x = xPoint - this.w / 2;
			this.y = yPoint - this.h / 2;
			this.vx = (Math.random() - 0.5) * 10;
			this.vy = (Math.random() - 0.5) * 10;
			this.alpha = Math.random() * 0.5 + 0.5;
			this.color = color;

			// Adjust vy to keep velocity in bounds
			const vy = Math.sqrt(25 - this.vx * this.vx);
			if (Math.abs(this.vy) > vy) {
				this.vy = this.vy > 0 ? vy : -vy;
			}
		}

		move(): boolean {
			// Apply friction for more realistic physics
			this.vx *= this.friction;
			this.vy *= this.friction;

			this.x += this.vx;
			this.vy += this.gravity;
			this.y += this.vy;
			this.alpha -= 0.01;

			if (
				this.x <= -this.w ||
				this.x >= w ||
				this.y >= h ||
				this.alpha <= 0
			) {
				return false;
			}
			return true;
		}

		draw(c: CanvasRenderingContext2D) {
			c.save();
			c.beginPath();
			c.translate(this.x + this.w / 2, this.y + this.h / 2);
			c.arc(0, 0, this.w, 0, Math.PI * 2);
			c.fillStyle = this.color;
			c.globalAlpha = this.alpha;
			c.closePath();
			c.fill();
			c.restore();
		}
	}

	class Glow {
		x: number;
		y: number;
		radius: number;
		alpha: number;
		color: string;
		maxAlpha = 0.4;

		constructor(x: number, y: number, color: string) {
			this.x = x;
			this.y = y;
			this.radius = 80;
			this.alpha = this.maxAlpha;
			this.color = color;
		}

		update(): boolean {
			this.alpha -= 0.02;
			return this.alpha > 0;
		}

		draw(c: CanvasRenderingContext2D) {
			c.save();
			c.globalAlpha = this.alpha;
			const gradient = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
			gradient.addColorStop(0, this.color);
			gradient.addColorStop(1, 'rgba(0,0,0,0)');
			c.fillStyle = gradient;
			c.beginPath();
			c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
			c.fill();
			c.restore();
		}
	}

	function resizeCanvas() {
		if (canvas) {
			w = canvas.width = window.innerWidth;
			h = canvas.height = window.innerHeight;
		}
	}

	function createFirework() {
		// Avoid center 40% of screen - spawn only on left 30% or right 30%
		const centerExclusionStart = w * 0.3;
		const centerExclusionEnd = w * 0.7;

		let xPoint: number;
		if (Math.random() < 0.5) {
			// Left side (0% to 30%)
			xPoint = Math.random() * centerExclusionStart;
		} else {
			// Right side (70% to 100%)
			xPoint = Math.random() * (w - centerExclusionEnd) + centerExclusionEnd;
		}

		const yPoint = Math.random() * (h - 200) + 100;
		// Reduced number of particles by 2 (was 50-150, now 25-75)
		const nFire = Math.random() * 25 + 50;

		// Generate 3 harmonious colors for this firework
		const [color1, color2, color3] = generateColorPalette();
		const colors = [color1, color2, color3];

		// Play random explosion sound
		playRandomExplosion();

		// Create glow effect at explosion point
		glows.push(new Glow(xPoint, yPoint, color1));

		// Create particles with the 3 colors distributed randomly
		for (let i = 0; i < nFire; i++) {
			const colorIndex = Math.floor(Math.random() * 3);
			const particle = new Particle(xPoint, yPoint, colors[colorIndex]);
			particles.push(particle);
		}
	}

	function update() {
		if (active && particles.length < 500 && Math.random() < probability) {
			createFirework();
		}

		// Update particles
		const alive: Particle[] = [];
		for (let i = 0; i < particles.length; i++) {
			if (particles[i].move()) {
				alive.push(particles[i]);
			}
		}
		particles = alive;

		// Update glows
		const aliveGlows: Glow[] = [];
		for (let i = 0; i < glows.length; i++) {
			if (glows[i].update()) {
				aliveGlows.push(glows[i]);
			}
		}
		glows = aliveGlows;
	}

	function paint() {
		if (!ctx) return;

		// Transparent canvas
		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, w, h);

		// Draw glows first (background)
		for (let i = 0; i < glows.length; i++) {
			glows[i].draw(ctx);
		}

		// Draw particles on top with lighter blend mode
		ctx.globalCompositeOperation = 'lighter';
		for (let i = 0; i < particles.length; i++) {
			particles[i].draw(ctx);
		}
	}

	function updateWorld() {
		update();
		paint();
		animationId = window.requestAnimationFrame(updateWorld);
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		resizeCanvas();

		window.addEventListener('resize', resizeCanvas);
		updateWorld();

		return () => {
			window.removeEventListener('resize', resizeCanvas);
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
