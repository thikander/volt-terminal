<script lang="ts">
	import { onMount } from 'svelte';
	import TitleBar from '$lib/components/TitleBar.svelte';
	import SplitView from '$lib/components/SplitView.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import QuickConnect from '$lib/components/QuickConnect.svelte';
	import ResizeHandles from '$lib/components/ResizeHandles.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';
	import { fromShellProfile, type ConnectionTarget } from '$lib/connections';
	import { matchesCombo } from '$lib/keys';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { updateStore } from '$lib/stores/update.svelte';
	import { windowState } from '$lib/stores/window-state.svelte';
	import { workspace } from '$lib/stores/workspace.svelte';

	let showSettings = $state(false);
	let showQuickConnect = $state(false);

	onMount(() => {
		windowState.init();
		void updateStore.check();

		(async () => {
			await settingsStore.load();
			const profile = settingsStore.defaultProfile;
			if (profile) {
				workspace.ensureInitialTab(fromShellProfile(profile).spawn, profile.name);
			}
		})();
	});

	function newDefaultTab() {
		const profile = settingsStore.defaultProfile;
		if (profile) workspace.newTab(fromShellProfile(profile).spawn, profile.name);
	}

	function connect(target: ConnectionTarget) {
		workspace.newTab(target.spawn, target.label);
		showQuickConnect = false;
	}

	function onKeydown(e: KeyboardEvent) {
		const kb = settingsStore.current.keybindings;

		if (e.ctrlKey && e.key === 'Tab') {
			e.preventDefault();
			workspace.cycleTab(e.shiftKey ? -1 : 1);
		} else if (matchesCombo(e, kb.new_tab)) {
			e.preventDefault();
			newDefaultTab();
		} else if (matchesCombo(e, kb.close_pane)) {
			e.preventDefault();
			const tab = workspace.activeTab;
			if (tab) workspace.closePane(tab.id, tab.activePaneId);
		} else if (matchesCombo(e, kb.split_right)) {
			e.preventDefault();
			const tab = workspace.activeTab;
			const profile = settingsStore.defaultProfile;
			if (tab && profile) workspace.splitPane(tab.id, tab.activePaneId, 'row', fromShellProfile(profile).spawn);
		} else if (matchesCombo(e, kb.split_down)) {
			e.preventDefault();
			const tab = workspace.activeTab;
			const profile = settingsStore.defaultProfile;
			if (tab && profile) workspace.splitPane(tab.id, tab.activePaneId, 'column', fromShellProfile(profile).spawn);
		} else if (matchesCombo(e, kb.quick_connect)) {
			e.preventDefault();
			showQuickConnect = true;
		} else if (matchesCombo(e, kb.open_settings)) {
			e.preventDefault();
			showSettings = true;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app" class:maximized={windowState.maximized}>
	<ResizeHandles />
	<TitleBar
		onNewTab={newDefaultTab}
		onQuickConnect={() => (showQuickConnect = true)}
		onOpenSettings={() => (showSettings = true)}
	/>
	<UpdateBanner />
	<div class="workspace">
		{#each workspace.tabs as tab (tab.id)}
			{@const isVisibleTab = tab.id === workspace.activeTabId}
			<div class="tab-content" class:hidden={!isVisibleTab}>
				<SplitView
					tabId={tab.id}
					node={tab.root}
					activePaneId={isVisibleTab ? tab.activePaneId : ''}
				/>
			</div>
		{:else}
			<div class="empty">No terminals open — press Ctrl+Shift+T to start one.</div>
		{/each}
	</div>
</div>

{#if showSettings}
	<SettingsModal onClose={() => (showSettings = false)} />
{/if}

{#if showQuickConnect}
	<QuickConnect onClose={() => (showQuickConnect = false)} onSelect={connect} />
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		border-radius: 8px;
		overflow: hidden;
	}

	.app.maximized {
		border-radius: 0;
	}

	.workspace {
		position: relative;
		flex: 1;
		min-height: 0;
		background: var(--bg);
	}

	.tab-content {
		position: absolute;
		inset: 0;
	}

	.tab-content.hidden {
		/* Not display:none: that collapses the box to 0x0, which spuriously
		   triggers xterm's ResizeObserver-driven refit on every switch back
		   (and the resulting re-layout/repaint is what shows up as a flicker).
		   visibility:hidden keeps the box's real layout size at all times, so
		   switching tabs never changes any pane's measured size at all. */
		visibility: hidden;
		pointer-events: none;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-dim);
		font-size: 13px;
	}
</style>
