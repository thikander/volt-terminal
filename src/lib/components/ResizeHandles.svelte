<script lang="ts">
	import { getCurrentWindow } from '@tauri-apps/api/window';

	const win = getCurrentWindow();
	const EDGE = 6;

	const handles: { dir: 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest'; style: string }[] = [
		{ dir: 'North', style: `top:0; left:${EDGE}px; right:${EDGE}px; height:${EDGE}px; cursor:n-resize;` },
		{ dir: 'South', style: `bottom:0; left:${EDGE}px; right:${EDGE}px; height:${EDGE}px; cursor:s-resize;` },
		{ dir: 'East', style: `top:${EDGE}px; right:0; bottom:${EDGE}px; width:${EDGE}px; cursor:e-resize;` },
		{ dir: 'West', style: `top:${EDGE}px; left:0; bottom:${EDGE}px; width:${EDGE}px; cursor:w-resize;` },
		{ dir: 'NorthWest', style: `top:0; left:0; width:${EDGE}px; height:${EDGE}px; cursor:nw-resize;` },
		{ dir: 'NorthEast', style: `top:0; right:0; width:${EDGE}px; height:${EDGE}px; cursor:ne-resize;` },
		{ dir: 'SouthWest', style: `bottom:0; left:0; width:${EDGE}px; height:${EDGE}px; cursor:sw-resize;` },
		{ dir: 'SouthEast', style: `bottom:0; right:0; width:${EDGE}px; height:${EDGE}px; cursor:se-resize;` }
	];
</script>

{#each handles as handle (handle.dir)}
	<div
		class="handle"
		style={handle.style}
		onmousedown={() => win.startResizeDragging(handle.dir)}
		role="presentation"
	></div>
{/each}

<style>
	.handle {
		position: fixed;
		z-index: 1000;
	}
</style>
