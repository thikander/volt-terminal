<script lang="ts">
	import type { PaneNode } from '../types';
	import TerminalPane from './TerminalPane.svelte';
	import SplitView from './SplitView.svelte';
	import { workspace } from '../stores/workspace.svelte';

	let { tabId, node, activePaneId }: { tabId: string; node: PaneNode; activePaneId: string } =
		$props();

	let dragIndex = $state<number | null>(null);

	function startDrag(index: number, event: PointerEvent) {
		if (node.kind !== 'split') return;
		event.preventDefault();
		dragIndex = index;
		const container = (event.currentTarget as HTMLElement).parentElement!;
		const rect = container.getBoundingClientRect();
		const isRow = node.direction === 'row';

		function onMove(e: PointerEvent) {
			if (node.kind !== 'split') return;
			const pos = isRow ? e.clientX - rect.left : e.clientY - rect.top;
			const total = isRow ? rect.width : rect.height;
			const pct = Math.min(90, Math.max(10, (pos / total) * 100));

			const before = node.sizes.slice(0, index).reduce((a, b) => a + b, 0);
			const combined = node.sizes[index] + node.sizes[index + 1];
			const newFirst = Math.min(Math.max(pct - before, 5), combined - 5);
			node.sizes[index] = newFirst;
			node.sizes[index + 1] = combined - newFirst;
		}

		function onUp() {
			dragIndex = null;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}
</script>

{#if node.kind === 'leaf'}
	<TerminalPane {tabId} pane={node} active={node.id === activePaneId} />
{:else}
	<div class="split" class:column={node.direction === 'column'}>
		{#each node.children as child, i (child.id)}
			<div class="cell" style:flex-basis="{node.sizes[i]}%">
				<SplitView {tabId} node={child} {activePaneId} />
			</div>
			{#if i < node.children.length - 1}
				<div
					class="gutter"
					class:column={node.direction === 'column'}
					onpointerdown={(e) => startDrag(i, e)}
					role="separator"
					aria-orientation={node.direction === 'row' ? 'vertical' : 'horizontal'}
				></div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.split {
		display: flex;
		width: 100%;
		height: 100%;
	}

	.split.column {
		flex-direction: column;
	}

	.cell {
		overflow: hidden;
		min-width: 0;
		min-height: 0;
	}

	.gutter {
		flex: 0 0 4px;
		cursor: col-resize;
		background: var(--border);
	}

	.gutter:hover {
		background: var(--accent);
	}

	.gutter.column {
		cursor: row-resize;
	}
</style>
