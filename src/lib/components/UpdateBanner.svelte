<script lang="ts">
	import { updateStore } from '../stores/update.svelte';
</script>

{#if updateStore.status === 'available'}
	<div class="banner">
		<span>Volt Terminal {updateStore.available?.version} is available.</span>
		<button class="primary" onclick={() => updateStore.installAndRestart()}>
			Update & restart
		</button>
		<button class="ghost" onclick={() => updateStore.dismiss()}>Later</button>
	</div>
{:else if updateStore.status === 'downloading'}
	<div class="banner">
		<span>Downloading update… {Math.round(updateStore.progress * 100)}%</span>
	</div>
{:else if updateStore.status === 'error'}
	<div class="banner error">
		<span>Update check failed: {updateStore.errorMessage}</span>
		<button class="ghost" onclick={() => updateStore.dismiss()}>Dismiss</button>
	</div>
{/if}

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 14px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		color: var(--text);
		font-size: 12.5px;
	}

	.banner.error {
		background: #3a1f22;
		color: #f4a3a7;
	}

	.banner span {
		flex: 1;
	}

	button {
		background: var(--border);
		border: none;
		border-radius: 6px;
		color: var(--text);
		padding: 5px 12px;
		font-size: 12px;
		cursor: pointer;
	}

	button.primary {
		background: var(--accent);
		color: #0b0d11;
		font-weight: 600;
	}

	button.ghost {
		background: transparent;
		color: var(--text-dim);
	}

	button.ghost:hover {
		color: var(--text);
	}
</style>
