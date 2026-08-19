<script lang="ts">
	import { dockerPanel } from '../stores/docker-panel.svelte';
	import { DOCKER_SHORTCUTS } from '../docker';

	const state = $derived(dockerPanel.openState);

	function addPort(serviceName: string) {
		const svc = state?.model?.services.find((s) => s.name === serviceName);
		svc?.ports.push('8080:80');
	}

	function addVolume(serviceName: string) {
		const svc = state?.model?.services.find((s) => s.name === serviceName);
		svc?.volumes.push('./data:/data');
	}

	function addEnv(serviceName: string) {
		const svc = state?.model?.services.find((s) => s.name === serviceName);
		svc?.environment.push({ key: '', value: '' });
	}
</script>

{#if state}
	<div class="panel">
		<div class="header">
			<div>
				<h2>Docker Compose</h2>
				<span class="filename">{state.filename || '—'}</span>
			</div>
			<div class="header-actions">
				<button
					class="icon-btn"
					onclick={() => dockerPanel.openPaneId && dockerPanel.rescan(dockerPanel.openPaneId)}
					disabled={state.status === 'scanning'}
					aria-label="Rescan"
					title="Rescan for a compose file"
				>
					⟲
				</button>
				<button class="icon-btn" onclick={() => dockerPanel.close()} aria-label="Close">×</button>
			</div>
		</div>

		<div class="shortcuts">
			{#each DOCKER_SHORTCUTS as shortcut (shortcut.args)}
				<button onclick={() => dockerPanel.runCommand(shortcut.args)}>{shortcut.label}</button>
			{/each}
		</div>

		<div class="body">
			{#if (state.status === 'available' || state.status === 'saving') && state.model}
				{#each state.model.services as svc (svc.name)}
					<details class="service-card" open>
						<summary>
							<span>{svc.name}</span>
							<button
								type="button"
								class="remove"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									dockerPanel.removeService(svc.name);
								}}
							>
								Remove
							</button>
						</summary>

						<label>
							Image
							<input bind:value={svc.image} placeholder="nginx:latest" />
						</label>
						<label>
							Build context
							<input bind:value={svc.build} placeholder="./app" />
						</label>
						<label>
							Container name
							<input bind:value={svc.containerName} />
						</label>
						<label>
							Command
							<input bind:value={svc.command} />
						</label>
						<label>
							Restart policy
							<select bind:value={svc.restart}>
								<option value="">(default)</option>
								<option value="no">no</option>
								<option value="always">always</option>
								<option value="on-failure">on-failure</option>
								<option value="unless-stopped">unless-stopped</option>
							</select>
						</label>

						<div class="list-field">
							<span class="list-label">Ports (host:container)</span>
							{#each svc.ports as _, i (i)}
								<div class="list-row">
									<input bind:value={svc.ports[i]} />
									<button class="danger" onclick={() => svc.ports.splice(i, 1)}>×</button>
								</div>
							{/each}
							<button onclick={() => addPort(svc.name)}>+ Add port</button>
						</div>

						<div class="list-field">
							<span class="list-label">Volumes (host:container)</span>
							{#each svc.volumes as _, i (i)}
								<div class="list-row">
									<input bind:value={svc.volumes[i]} />
									<button class="danger" onclick={() => svc.volumes.splice(i, 1)}>×</button>
								</div>
							{/each}
							<button onclick={() => addVolume(svc.name)}>+ Add volume</button>
						</div>

						<div class="list-field">
							<span class="list-label">Environment</span>
							{#each svc.environment as env, i (i)}
								<div class="list-row">
									<input bind:value={env.key} placeholder="KEY" class="env-key" />
									<input bind:value={env.value} placeholder="value" />
									<button class="danger" onclick={() => svc.environment.splice(i, 1)}>×</button>
								</div>
							{/each}
							<button onclick={() => addEnv(svc.name)}>+ Add variable</button>
						</div>
					</details>
				{/each}
				<button onclick={() => dockerPanel.addService()}>+ Add service</button>
			{:else if state.status === 'scanning'}
				<p class="hint">Scanning for a compose file…</p>
			{:else if state.status === 'none'}
				<p class="hint">
					No docker-compose.yml / compose.yaml found in this shell's current directory.
				</p>
			{:else if state.status === 'unsupported'}
				<p class="hint">This shell type isn't supported for compose editing yet.</p>
			{:else if state.status === 'error'}
				<p class="hint error">{state.error}</p>
			{/if}
		</div>

		{#if state.status === 'available' || state.status === 'saving'}
			<div class="footer">
				<button onclick={() => dockerPanel.save()} disabled={state.status === 'saving'}>
					{state.status === 'saving' ? 'Saving…' : `Save to ${state.filename}`}
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.panel {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 380px;
		background: var(--surface);
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		z-index: 150;
		color: var(--text);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.header h2 {
		margin: 0;
		font-size: 14px;
	}

	.filename {
		font-size: 11px;
		color: var(--text-dim);
	}

	.icon-btn {
		background: transparent;
		border: none;
		color: var(--text-dim);
		font-size: 16px;
		cursor: pointer;
	}

	.icon-btn:hover {
		color: var(--text);
	}

	.shortcuts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
	}

	.shortcuts button {
		background: var(--border);
		border: none;
		border-radius: 6px;
		color: var(--text);
		padding: 5px 10px;
		font-size: 12px;
		cursor: pointer;
	}

	.shortcuts button:hover {
		background: var(--accent);
		color: #0b0d11;
	}

	.body {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px;
	}

	.hint {
		font-size: 12.5px;
		color: var(--text-dim);
	}

	.hint.error {
		color: #f4a3a7;
	}

	.service-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 10px;
		margin-bottom: 10px;
	}

	.service-card summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
		list-style: none;
	}

	.service-card summary::-webkit-details-marker {
		display: none;
	}

	button.remove {
		background: transparent;
		border: none;
		font-weight: 400;
		font-size: 11px;
		color: #f07178;
		cursor: pointer;
		padding: 0;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 11px;
		color: var(--text-dim);
		margin-top: 8px;
	}

	input,
	select {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		padding: 4px 8px;
		font-size: 12.5px;
	}

	.list-field {
		margin-top: 10px;
	}

	.list-label {
		font-size: 11px;
		color: var(--text-dim);
		display: block;
		margin-bottom: 4px;
	}

	.list-row {
		display: flex;
		gap: 4px;
		margin-bottom: 4px;
	}

	.list-row input {
		flex: 1;
		min-width: 0;
	}

	.env-key {
		flex: 0 0 40%;
	}

	.list-field > button,
	.body > button {
		background: var(--border);
		border: none;
		border-radius: 6px;
		color: var(--text);
		padding: 4px 10px;
		font-size: 11.5px;
		cursor: pointer;
	}

	button.danger {
		background: transparent;
		border: none;
		color: #f07178;
		cursor: pointer;
		font-size: 14px;
		flex: 0 0 auto;
	}

	.footer {
		padding: 12px 16px;
		border-top: 1px solid var(--border);
	}

	.footer button {
		width: 100%;
		background: var(--accent);
		color: #0b0d11;
		border: none;
		border-radius: 6px;
		padding: 8px;
		font-weight: 600;
		cursor: pointer;
	}
</style>
