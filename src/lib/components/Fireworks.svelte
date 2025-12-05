<script lang="ts">
	import { onMount } from 'svelte';

	// Configuration: fireworks per second
	const FIREWORKS_PER_SECOND = 2;

	let { active = $bindable(false) } = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let w = $state(0);
	let h = $state(0);
	let particles: Particle[] = $state([]);
	let animationId: number | null = null;

	// Calculate probability based on desired fireworks per second (60 fps)
	const probability = FIREWORKS_PER_SECOND / 60;

	class Particle {
		w: number;
		h: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
		alpha: number;
		color: string;
		gravity = 0.08;

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
		const c = `rgb(${~~(Math.random() * 200 + 55)},${~~(Math.random() * 200 + 55)},${~~(Math.random() * 200 + 55)})`;

		for (let i = 0; i < nFire; i++) {
			const particle = new Particle(xPoint, yPoint, c);
			particles.push(particle);
		}
	}

	function update() {
		if (active && particles.length < 500 && Math.random() < probability) {
			createFirework();
		}

		const alive: Particle[] = [];
		for (let i = 0; i < particles.length; i++) {
			if (particles[i].move()) {
				alive.push(particles[i]);
			}
		}
		particles = alive;
	}

	function paint() {
		if (!ctx) return;

		// Transparent canvas
		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, w, h);
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
