<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fromAddress,
		fromShellProfile,
		fromSshConfigHost,
		fromSshProfile,
		listSshConfigHosts,
		loadRecents,
		looksLikeAddress,
		pushRecent,
		type ConnectionTarget
	} from '../connections';
	import { settingsStore } from '../stores/settings.svelte';

	let { onClose, onSelect }: { onClose: () => void; onSelect: (t: ConnectionTarget) => void } =
		$props();

	let query = $state('');
	let sshHosts = $state<ReturnType<typeof fromSshConfigHost>[]>([]);
	let selected = $state(0);
	let input: HTMLInputElement;

	onMount(async () => {
		input?.focus();
		try {
			const hosts = await listSshConfigHosts();
			sshHosts = hosts.map(fromSshConfigHost);
		} catch {
			sshHosts = [];
		}
	});

	let allTargets = $derived([
		...loadRecents(),
		...settingsStore.current.profiles.map(fromShellProfile),
		...settingsStore.current.ssh_profiles.map(fromSshProfile),
		...sshHosts
	]);

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		let list = !q
			? allTargets
			: allTargets.filter(
					(t) =>
						t.label.toLowerCase().includes(q) || t.subtitle?.toLowerCase().includes(q)
				);

		if (q && looksLikeAddress(query.trim()) && !list.some((t) => t.label === query.trim())) {
			list = [fromAddress(query.trim()), ...list];
		}
		return list;
	});

	let groups = $derived.by(() => {
		const map = new Map<string, ConnectionTarget[]>();
		for (const item of filtered) {
			if (!map.has(item.group)) map.set(item.group, []);
			map.get(item.group)!.push(item);
		}
		return [...map.entries()];
	});

	function choose(target: ConnectionTarget) {
		pushRecent(target);
		onSelect(target);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			selected = Math.min(selected + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selected = Math.max(selected - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const target = filtered[selected];
			if (target) choose(target);
		}
	}

	$effect(() => {
		if (selected > filtered.length - 1) selected = 0;
	});
</script>

<div class="backdrop" onclick={onClose} onkeydown={() => {}} role="presentation">
	<div
		class="palette"
		onclick={(e) => e.stopPropagation()}
		onkeydown={onKeydown}
		role="listbox"
		tabindex="-1"
		aria-label="Quick connect"
	>
		<input
			bind:this={input}
			bind:value={query}
			placeholder="Select profile or enter an address"
			autocomplete="off"
			spellcheck="false"
		/>
		<div class="list">
			{#each groups as [group, items] (group)}
				<div class="group-label">{group}</div>
				{#each items as item (group + item.label)}
					{@const index = filtered.indexOf(item)}
					<button
						class="row"
						class:selected={index === selected}
						onmouseenter={() => (selected = index)}
						onclick={() => choose(item)}
					>
						<span class="icon" style:color={item.color}>{item.icon}</span>
						<span class="label">{item.label}</span>
						{#if item.subtitle}
							<span class="subtitle">{item.subtitle}</span>
						{/if}
					</button>
				{/each}
			{/each}
			{#if filtered.length === 0}
				<div class="empty">No matches — type a host to connect via SSH</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: #00000060;
		display: flex;
		justify-content: center;
		padding-top: 80px;
		z-index: 200;
	}

	.palette {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		width: 520px;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 12px 40px #00000080;
		overflow: hidden;
	}

	input {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		padding: 14px 16px;
		font-size: 14px;
		outline: none;
	}

	.list {
		overflow-y: auto;
		padding: 6px;
	}

	.group-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-dim);
		padding: 8px 10px 4px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--text);
		padding: 7px 10px;
		font-size: 13px;
		cursor: pointer;
		text-align: left;
	}

	.row.selected {
		background: var(--accent);
		color: #0b0d11;
	}

	.row.selected .subtitle {
		color: #0b0d11a0;
	}

	.icon {
		font-size: 12px;
		width: 18px;
		text-align: center;
		color: var(--accent);
		font-family: monospace;
	}

	.row.selected .icon {
		color: #0b0d11;
	}

	.label {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.subtitle {
		color: var(--text-dim);
		font-size: 12px;
		flex-shrink: 0;
		max-width: 45%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty {
		padding: 16px;
		color: var(--text-dim);
		font-size: 13px;
		text-align: center;
	}
</style>
