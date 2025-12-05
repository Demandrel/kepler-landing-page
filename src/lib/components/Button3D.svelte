<script>
	import { onMount } from 'svelte';

	let { label = 'Join waitlist', execFunction = () => {} } = $props();

	// visual config
	const shadowHeight = '4px'; // how much the button moves down
	const topColor = '#ffffff'; // button color
	const shadowColor = '#E4E4E4'; // shadow "base" color
	const buttonHeight = '52px'; // same as your current h-[52px]

	let button = $state();

	const calculatedButtonHeight = `calc(100% - ${shadowHeight})`;

	function pressButtonDown() {
		button.style = `
            translate: 0 ${shadowHeight};
            background-color: ${topColor};
            height: ${calculatedButtonHeight};
        `;
	}

	function shiftButtonUp() {
		button.style = `
            translate: 0 0;
            background-color: ${topColor};
            height: ${calculatedButtonHeight};
        `;
	}

	onMount(shiftButtonUp);
</script>

<!-- outer wrapper just for the 3D effect -->
<div class="relative shrink-0" style:height={`calc(${buttonHeight} + ${shadowHeight})`}>
	<button
		bind:this={button}
		class="rounded-[14px] z-10 px-5 w-full h-full
               bg-white text-black font-medium cursor-pointer
               flex items-center justify-center
               ease-out duration-150"
		onpointerdown={pressButtonDown}
		onpointerup={shiftButtonUp}
		onpointerout={shiftButtonUp}
		ontouchstart={pressButtonDown}
		ontouchend={shiftButtonUp}
		ontouchcancel={shiftButtonUp}
		onclick={execFunction}
	>
		{label}
	</button>

	<!-- shadow "base" -->
	<div
		class="rounded-[14px] absolute w-full -z-10"
		style:background-color={shadowColor}
		style:height={`calc(100% - ${shadowHeight})`}
		style:margin-top={shadowHeight}
	></div>
</div>
