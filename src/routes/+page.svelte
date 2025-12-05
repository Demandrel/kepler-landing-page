<script lang="ts">
	import { spring } from 'svelte/motion';

	// position en X du chevron (en pixels)
	const chevronX = spring(0, {
		stiffness: 0.1,
		damping: 0.6
	});

	function triggerBoop() {
		chevronX.set(5);
		setTimeout(() => {
			chevronX.set(0);
		}, 250);
	}

	const buttonScale = spring(1, {
		stiffness: 0.25,
		damping: 0.5
	});

	function pressDown() {
		buttonScale.set(0.98);
	}

	function release() {
		buttonScale.set(1);
	}

	// 👇 sert à savoir si le focus vient d'un clic souris/touch
	let pointerIsDown = false;

	function handlePointerDown() {
		pointerIsDown = true;
		pressDown();
		if (clickDownSound) {
			clickDownSound.currentTime = 0;
			clickDownSound.play();
		}
	}

	function handlePointerUp() {
		pointerIsDown = false;
		release();
		if (clickUpSound) {
			clickUpSound.currentTime = 0;
			clickUpSound.play();
		}
	}

	function handlePointerLeave() {
		pointerIsDown = false;
		release();
	}

	function handleFocus() {
		// si le focus vient d'un clic (pointerdown juste avant) → on ne rejoue pas le boop
		if (pointerIsDown) return;
		triggerBoop();
	}

	// Audio pour le bouton
	const clickDownVolume = 0.15; // volume pour click_1 (0.0 à 1.0)
	const clickUpVolume = 0.15; // volume pour click_2 (0.0 à 1.0)

	let clickDownSound: HTMLAudioElement;
	let clickUpSound: HTMLAudioElement;
	if (typeof window !== 'undefined') {
		clickDownSound = new Audio('/click_1.mp3');
		clickDownSound.volume = clickDownVolume;
		clickUpSound = new Audio('/click_2.mp3');
		clickUpSound.volume = clickUpVolume;
	}

	// Form submission state
	type ButtonState = 'idle' | 'loading' | 'success';
	let buttonState = $state<ButtonState>('idle');
	let email = $state('');

	// Spring animation for success background
	const successSlide = spring(0, {
		stiffness: 0.15,
		damping: 0.6
	});

	// Fake API call to simulate waitlist subscription
	async function subscribeToWaitlist(email: string): Promise<void> {
		const startTime = Date.now();

		// Simulate API call (will replace with real Resend call later)
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Ensure minimum 200ms loading time
		const elapsed = Date.now() - startTime;
		if (elapsed < 200) {
			await new Promise((resolve) => setTimeout(resolve, 200 - elapsed));
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (buttonState !== 'idle') return;

		buttonState = 'loading';

		try {
			await subscribeToWaitlist(email);
			buttonState = 'success';
			successSlide.set(100);
		} catch (error) {
			console.error('Failed to subscribe:', error);
			buttonState = 'idle';
		}
	}
</script>

<!-- Background stars decoration -->
<img
	src="/stars_bg.png"
	alt="background stars"
	class="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
	aria-hidden="true"
/>

<div class="pt-40 flex flex-col gap-0">
	<h1
		class="text-[72px] leading-tight text-center font-bold bg-gradient-to-b from-white from-50% to-[#838383] bg-clip-text text-transparent"
	>
		All your design inspiration.
	</h1>
	<h1
		class="text-[72px] text-center leading-tight font-bold bg-gradient-to-b from-white from-50% to-[#838383] bg-clip-text text-transparent"
	>
		Finally organized.
	</h1>
</div>

<h2 class="text-[#909090] font-[17px] mt-6 max-w-[600px] text-center mx-auto">
	Your design inspiration is scattered between Mobbin, X, Dribbble, etc. Kepler is the new way to
	collect, organize, search and share your design files.
</h2>

<div
	class="flex bg-[#212121] max-w-[420px] h-[60px] rounded-2xl mx-auto mt-32 items-center
           focus-within:ring-2 focus-within:ring-[#414141] focus-within:ring-offset-2 focus-within:ring-offset-black"
>
	<form class="flex w-full items-center pr-1" onsubmit={handleSubmit}>
		<input
			type="email"
			bind:value={email}
			class="flex-1 text-white rounded-xl px-5 placeholder-[#646464] bg-[#212121]
                   focus:outline-none"
			placeholder="john.kepler@gmail.com"
			autocomplete="off"
			required
			disabled={buttonState !== 'idle'}
		/>

		<button
			type="submit"
			disabled={buttonState !== 'idle'}
			class="relative h-[52px] overflow-hidden font-medium rounded-[14px] px-3 shrink-0
           flex items-center gap-1 transition-colors duration-300 cursor-pointer"
			style={`transform: scale(${$buttonScale});`}
			onpointerenter={buttonState === 'idle' ? triggerBoop : undefined}
			onfocus={buttonState === 'idle' ? handleFocus : undefined}
			onpointerdown={buttonState === 'idle' ? handlePointerDown : undefined}
			onpointerup={buttonState === 'idle' ? handlePointerUp : undefined}
			onpointerleave={buttonState === 'idle' ? handlePointerLeave : undefined}
			ontouchstart={buttonState === 'idle' ? handlePointerDown : undefined}
			ontouchend={buttonState === 'idle' ? handlePointerUp : undefined}
			ontouchcancel={buttonState === 'idle' ? handlePointerLeave : undefined}
		>
			<!-- Background color layers with slide animation -->
			<div
				class="absolute inset-0 bg-[#F0F0F0]"
				style={`transform: translateY(${$successSlide}%)`}
			></div>
			<div
				class="absolute inset-0 bg-[#5839F0]"
				style={`transform: translateY(${$successSlide - 100}%)`}
			></div>

			<!-- Content with slide animation -->
			<div
				class="relative flex items-center gap-1"
				style={`transform: translateY(${$successSlide}%); opacity: ${buttonState === 'success' ? '0' : '1'}`}
			>
				{#if buttonState === 'loading'}
					<!-- Loading spinner -->
					<svg
						class="animate-spin h-5 w-5 text-black"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<span>Loading...</span>
				{:else}
					<span>Join waitlist</span>
					<span
						class="inline-flex"
						style={`transform: translateX(${$chevronX}px);`}
						aria-hidden="true"
					>
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M10.1392 8C11.601 9.06206 12.9104 10.3071 14.0334 11.7021C14.1744 11.8774 14.1744 12.1226 14.0334 12.2979C12.9104 13.6929 11.601 14.9379 10.1392 16"
								stroke="#111111"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</span>
				{/if}
			</div>

			<!-- Success state sliding from top -->
			<div
				class="absolute inset-0 flex items-center justify-center gap-2 text-white"
				style={`transform: translateY(${$successSlide - 100}%); opacity: ${buttonState === 'success' ? '1' : '0'}`}
			>
				<img src="/check-tick-circle.svg" alt="Success" width="20" height="20" />
				<span>Subscrived!</span>
			</div>
		</button>
	</form>
</div>

<img
	src="/main.png"
	alt="Kepler main illustration"
	class="mt-12 max-w-[1200px] mx-auto mb-32
border-solid border-[1px] border-[#242424] rounded-[20px]"
/>
