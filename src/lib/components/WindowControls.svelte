<script lang="ts">
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { windowState } from '../stores/window-state.svelte';

	const win = getCurrentWindow();
</script>

<div class="controls">
	<button class="ctl" onclick={() => win.minimize()} aria-label="Minimize">
		<svg width="10" height="10" viewBox="0 0 10 10"
			><rect y="4.5" width="10" height="1" fill="currentColor" /></svg
		>
	</button>
	<button class="ctl" onclick={() => win.toggleMaximize()} aria-label="Maximize">
		{#if windowState.maximized}
			<svg width="10" height="10" viewBox="0 0 10 10">
				<rect x="1.5" y="0" width="7" height="7" fill="none" stroke="currentColor" />
				<rect x="0" y="2.5" width="7" height="7" fill="var(--surface)" stroke="currentColor" />
			</svg>
		{:else}
			<svg width="10" height="10" viewBox="0 0 10 10">
				<rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
			</svg>
		{/if}
	</button>
	<button class="ctl close" onclick={() => win.close()} aria-label="Close">
		<svg width="10" height="10" viewBox="0 0 10 10">
			<line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" />
			<line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" />
		</svg>
	</button>
</div>

<style>
	.controls {
		display: flex;
		height: 100%;
	}

	.ctl {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 100%;
		background: transparent;
		border: none;
		color: var(--text-dim);
		cursor: pointer;
	}

	.ctl:hover {
		background: var(--border);
		color: var(--text);
	}

	.ctl.close:hover {
		background: #e5484d;
		color: #ffffff;
	}
</style>
