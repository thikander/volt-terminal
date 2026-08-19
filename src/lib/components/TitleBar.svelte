<script lang="ts">
	import TabBar from './TabBar.svelte';
	import WindowControls from './WindowControls.svelte';
	import { windowState } from '../stores/window-state.svelte';

	let {
		onNewTab,
		onQuickConnect,
		onOpenSettings
	}: { onNewTab: () => void; onQuickConnect: () => void; onOpenSettings: () => void } = $props();
</script>

<div class="title-bar" class:unfocused={!windowState.focused}>
	<TabBar {onNewTab} {onQuickConnect} />
	<div class="spacer" data-tauri-drag-region></div>
	<button class="icon-btn" onclick={onOpenSettings} title="Settings (Ctrl+,)">⚙</button>
	<WindowControls />
</div>

<style>
	.title-bar {
		display: flex;
		align-items: stretch;
		height: 36px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		user-select: none;
		transition: opacity 150ms ease;
	}

	.title-bar.unfocused {
		opacity: 0.6;
	}

	.spacer {
		flex: 1;
	}

	.icon-btn {
		width: 40px;
		background: transparent;
		border: none;
		color: var(--text-dim);
		cursor: pointer;
		font-size: 14px;
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}

	.icon-btn:hover {
		color: var(--text);
		background: var(--border);
	}
</style>
