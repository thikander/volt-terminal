<script lang="ts">
	import { workspace } from '../stores/workspace.svelte';
	import type { PaneNode } from '../types';

	let { onNewTab, onQuickConnect }: { onNewTab: () => void; onQuickConnect: () => void } =
		$props();

	function rootLeaf(node: PaneNode): Extract<PaneNode, { kind: 'leaf' }> {
		return node.kind === 'leaf' ? node : rootLeaf(node.children[0]);
	}
</script>

<div class="tab-bar" data-tauri-drag-region>
	<div class="tabs">
		{#each workspace.tabs as tab (tab.id)}
			{@const leaf = rootLeaf(tab.root)}
			<button
				class="tab"
				class:active={tab.id === workspace.activeTabId}
				style:box-shadow={tab.id === workspace.activeTabId && leaf.spawn.color
					? `inset 0 -2px 0 ${leaf.spawn.color}`
					: undefined}
				onclick={() => workspace.setActiveTab(tab.id)}
			>
				<span class="icon" style:color={leaf.spawn.color}>{leaf.spawn.icon || '›_'}</span>
				<span class="title">{tab.title}</span>
				<span
					class="close"
					role="button"
					tabindex="0"
					onclick={(e) => {
						e.stopPropagation();
						workspace.closeTab(tab.id);
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.stopPropagation();
							workspace.closeTab(tab.id);
						}
					}}
				>
					×
				</span>
			</button>
		{/each}
	</div>
	<button class="icon-btn" onclick={onNewTab} title="New tab (default profile)">+</button>
	<button class="icon-btn" onclick={onQuickConnect} title="Quick connect / new SSH tab">▾</button>
</div>

<style>
	.tab-bar {
		display: flex;
		align-items: stretch;
		height: 100%;
		flex: 0 1 auto;
		min-width: 0;
		max-width: 100%;
		user-select: none;
	}

	.tabs {
		display: flex;
		overflow-x: auto;
		flex: 0 1 auto;
		min-width: 0;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 0 10px;
		background: transparent;
		border: none;
		border-right: 1px solid var(--border);
		color: var(--text-dim);
		font-size: 12.5px;
		cursor: pointer;
		white-space: nowrap;
		max-width: 220px;
	}

	.tab.active {
		background: var(--bg);
		color: var(--text);
		box-shadow: inset 0 -2px 0 var(--accent);
	}

	.icon {
		font-family: monospace;
		font-size: 11px;
		opacity: 0.8;
	}

	.title {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.close {
		opacity: 0.6;
		border-radius: 4px;
		width: 16px;
		height: 16px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.close:hover {
		opacity: 1;
		background: var(--border);
	}

	.icon-btn {
		width: 32px;
		flex-shrink: 0;
		background: transparent;
		border: none;
		border-right: 1px solid var(--border);
		color: var(--text-dim);
		cursor: pointer;
		font-size: 13px;
	}

	.icon-btn:hover {
		color: var(--text);
		background: var(--border);
	}
</style>
