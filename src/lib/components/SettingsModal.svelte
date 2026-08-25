<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { getVersion } from '@tauri-apps/api/app';
	import { open } from '@tauri-apps/plugin-dialog';
	import { listSshConfigHosts, sshHostToProfile } from '../connections';
	import { t } from '../i18n';
	import { settingsStore } from '../stores/settings.svelte';
	import { updateStore } from '../stores/update.svelte';
	import IconGlyph from './IconGlyph.svelte';
	import type {
		DetectedShell,
		Keybindings,
		Language,
		ShellProfile,
		SshHostEntry,
		SshProfile
	} from '../types';

	let appVersion = $state('');
	getVersion().then((v) => (appVersion = v));

	let { onClose }: { onClose: () => void } = $props();

	let draft = $state(structuredClone($state.snapshot(settingsStore.current)));
	let section = $state<
		'general' | 'profiles' | 'ssh' | 'appearance' | 'terminal' | 'keybindings' | 'about'
	>('general');
	let detecting = $state(false);
	let detectMessage = $state('');

	let profileFilter = $state('');
	let sshFilter = $state('');

	let filteredProfiles = $derived(
		draft.profiles.filter((p) => matchesFilter(profileFilter, p.name, p.command, p.group))
	);
	let filteredSshProfiles = $derived(
		draft.ssh_profiles.filter((p) => matchesFilter(sshFilter, p.name, p.host, p.group))
	);

	function matchesFilter(filter: string, ...fields: (string | undefined)[]): boolean {
		const q = filter.trim().toLowerCase();
		if (!q) return true;
		return fields.some((f) => f?.toLowerCase().includes(q));
	}

	function addProfile() {
		const profile: ShellProfile = {
			id: crypto.randomUUID(),
			name: 'New profile',
			command: '',
			args: []
		};
		draft.profiles.push(profile);
	}

	function removeProfile(id: string) {
		draft.profiles = draft.profiles.filter((p) => p.id !== id);
	}

	function duplicateProfile(profile: ShellProfile) {
		draft.profiles.push({
			...structuredClone($state.snapshot(profile)),
			id: crypto.randomUUID(),
			name: `${profile.name} copy`
		});
	}

	function addEnvVar(profile: ShellProfile) {
		profile.env = [...(profile.env ?? []), { key: '', value: '' }];
	}

	async function browseCwd(profile: ShellProfile) {
		const dir = await open({ directory: true, multiple: false });
		if (typeof dir === 'string') profile.cwd = dir;
	}

	async function detectShells() {
		detecting = true;
		detectMessage = '';
		try {
			const found = await invoke<DetectedShell[]>('detect_shells');
			const existing = new Set(draft.profiles.map((p) => `${p.command} ${p.args.join(' ')}`));
			let added = 0;
			for (const shell of found) {
				const key = `${shell.command} ${shell.args.join(' ')}`;
				if (existing.has(key)) continue;
				existing.add(key);
				draft.profiles.push({
					id: crypto.randomUUID(),
					name: shell.name,
					command: shell.command,
					args: shell.args
				});
				added++;
			}
			detectMessage = added > 0 ? `Added ${added} shell${added === 1 ? '' : 's'}.` : 'No new shells found.';
		} finally {
			detecting = false;
		}
	}

	function addSshProfile() {
		const profile: SshProfile = {
			id: crypto.randomUUID(),
			name: 'New SSH connection',
			host: '',
			agent_forwarding: false
		};
		draft.ssh_profiles.push(profile);
	}

	function removeSshProfile(id: string) {
		draft.ssh_profiles = draft.ssh_profiles.filter((p) => p.id !== id);
	}

	function duplicateSshProfile(profile: SshProfile) {
		draft.ssh_profiles.push({
			...structuredClone($state.snapshot(profile)),
			id: crypto.randomUUID(),
			name: `${profile.name} copy`
		});
	}

	let sshConfigHosts = $state<SshHostEntry[]>([]);
	let sshConfigLoaded = $state(false);
	let sshConfigLoading = $state(false);

	async function loadSshConfigHosts() {
		if (sshConfigLoaded || sshConfigLoading) return;
		sshConfigLoading = true;
		try {
			sshConfigHosts = await listSshConfigHosts();
			sshConfigLoaded = true;
		} finally {
			sshConfigLoading = false;
		}
	}

	function isImported(host: SshHostEntry): boolean {
		return draft.ssh_profiles.some(
			(p) => p.host === (host.hostname ?? host.alias) && p.user === host.user
		);
	}

	function importSshHost(host: SshHostEntry) {
		if (isImported(host)) return;
		draft.ssh_profiles.push(sshHostToProfile(host));
	}

	$effect(() => {
		if (section === 'ssh') loadSshConfigHosts();
	});

	function captureCombo(e: KeyboardEvent, field: keyof Keybindings) {
		e.preventDefault();
		if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
		const parts: string[] = [];
		if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
		if (e.shiftKey) parts.push('Shift');
		if (e.altKey) parts.push('Alt');
		parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
		draft.keybindings[field] = parts.join('+');
	}

	async function save() {
		await settingsStore.save(draft);
		onClose();
	}

	const NAV: { id: typeof section; key: Parameters<typeof t>[0] }[] = [
		{ id: 'general', key: 'nav_general' },
		{ id: 'profiles', key: 'nav_profiles' },
		{ id: 'ssh', key: 'nav_ssh' },
		{ id: 'appearance', key: 'nav_appearance' },
		{ id: 'terminal', key: 'nav_terminal' },
		{ id: 'keybindings', key: 'nav_keybindings' },
		{ id: 'about', key: 'nav_about' }
	];

	const KEYBIND_FIELDS: { field: keyof Keybindings; key: Parameters<typeof t>[0] }[] = [
		{ field: 'new_tab', key: 'kb_new_tab' },
		{ field: 'close_pane', key: 'kb_close_pane' },
		{ field: 'split_right', key: 'kb_split_right' },
		{ field: 'split_down', key: 'kb_split_down' },
		{ field: 'quick_connect', key: 'kb_quick_connect' },
		{ field: 'open_settings', key: 'kb_open_settings' }
	];

	const LANGUAGES: { id: Language; label: string }[] = [
		{ id: 'en', label: 'English' },
		{ id: 'th', label: 'ไทย' }
	];
</script>

<div
	class="backdrop"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="button"
	tabindex="-1"
>
	<div
		class="modal"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-label="Settings"
		tabindex="-1"
	>
		<nav>
			<h2>{t('settings_title')}</h2>
			{#each NAV as item (item.id)}
				<button class:active={section === item.id} onclick={() => (section = item.id)}>
					{t(item.key)}
				</button>
			{/each}
		</nav>

		<div class="content">
			{#if section === 'general'}
				<label>
					{t('language_label')}
					<select bind:value={draft.language}>
						{#each LANGUAGES as lang (lang.id)}
							<option value={lang.id}>{lang.label}</option>
						{/each}
					</select>
				</label>
			{:else if section === 'profiles'}
				<h3>{t('local_profiles')}</h3>
				<input class="filter" bind:value={profileFilter} placeholder={t('filter_profiles')} />
				{#each filteredProfiles as profile (profile.id)}
					<details class="profile-card">
						<summary>
							<span class="profile-icon" style:color={profile.color}>
								<IconGlyph icon={profile.icon} fallback="›_" />
							</span>
							<span class="profile-name">{profile.name}</span>
							<span class="profile-sub">{profile.command}</span>
							<span class="card-actions">
								<button
									type="button"
									class="ghost"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										duplicateProfile(profile);
									}}
								>
									{t('duplicate')}
								</button>
								<button
									type="button"
									class="danger"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										removeProfile(profile.id);
									}}
								>
									{t('remove')}
								</button>
							</span>
						</summary>

						<div class="row">
							<input bind:value={profile.name} placeholder="Name" />
							<input bind:value={profile.command} placeholder="Command (e.g. powershell.exe)" />
							<input bind:value={profile.group} placeholder="Group (optional)" />
						</div>
						<div class="row">
							<textarea
								bind:value={profile.icon}
								placeholder="Icon: emoji or pasted SVG markup"
								class="icon-input"
								rows="1"
							></textarea>
							<input type="color" bind:value={profile.color} class="narrow" />
							<label class="checkbox">
								<input type="checkbox" bind:checked={profile.close_on_exit} />
								Close tab when process exits
							</label>
						</div>
						<div class="row">
							<input bind:value={profile.cwd} placeholder="Working directory (optional)" />
							<button type="button" onclick={() => browseCwd(profile)}>{t('browse')}</button>
						</div>
						<div class="list-field">
							<span class="list-label">Environment variables</span>
							{#each profile.env ?? [] as env, i (i)}
								<div class="list-row">
									<input bind:value={env.key} placeholder="KEY" class="env-key" />
									<input bind:value={env.value} placeholder="value" />
									<button
										type="button"
										class="danger"
										onclick={() => profile.env?.splice(i, 1)}
									>
										×
									</button>
								</div>
							{/each}
							<button type="button" onclick={() => addEnvVar(profile)}>{t('add_variable')}</button>
						</div>
					</details>
				{/each}
				<div class="row">
					<button onclick={addProfile}>{t('add_profile')}</button>
					<button onclick={detectShells} disabled={detecting}>
						{detecting ? t('detecting') : `⟲ ${t('detect_shells')}`}
					</button>
				</div>
				{#if detectMessage}
					<p class="hint">{detectMessage}</p>
				{/if}

				<h3>{t('default_profile')}</h3>
				<select bind:value={draft.default_profile_id}>
					{#each draft.profiles as profile (profile.id)}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
			{:else if section === 'ssh'}
				<h3>{t('from_ssh_config')}</h3>
				{#if sshConfigLoading}
					<p class="hint">Reading ~/.ssh/config…</p>
				{:else if sshConfigHosts.length === 0}
					<p class="hint">No hosts found in ~/.ssh/config.</p>
				{:else}
					{#each sshConfigHosts as host (host.alias)}
						<div class="row config-host">
							<div class="config-host-info">
								<span class="config-host-alias">{host.alias}</span>
								{#if host.user || host.hostname}
									<span class="config-host-detail">
										{[host.user, host.hostname].filter(Boolean).join('@')}
									</span>
								{/if}
							</div>
							<button
								onclick={() => importSshHost(host)}
								disabled={isImported(host)}
							>
								{isImported(host) ? t('imported') : t('import')}
							</button>
						</div>
					{/each}
				{/if}

				<h3>{t('saved_connections')}</h3>
				<input class="filter" bind:value={sshFilter} placeholder={t('filter_connections')} />
				{#each filteredSshProfiles as profile (profile.id)}
					<div class="ssh-card">
						<div class="row">
							<span class="profile-icon" style:color={profile.color}>
								<IconGlyph icon={profile.icon} fallback="⇄" />
							</span>
							<input bind:value={profile.name} placeholder="Name" />
							<input bind:value={profile.group} placeholder="Group (optional)" />
							<button type="button" class="ghost" onclick={() => duplicateSshProfile(profile)}>
								{t('duplicate')}
							</button>
							<button type="button" class="danger" onclick={() => removeSshProfile(profile.id)}>
								{t('remove')}
							</button>
						</div>
						<div class="row">
							<input bind:value={profile.host} placeholder="Host or IP" />
							<input
								type="number"
								bind:value={profile.port}
								placeholder="Port"
								class="narrow"
							/>
							<input bind:value={profile.user} placeholder="User" />
						</div>
						<div class="row">
							<input bind:value={profile.identity_file} placeholder="Identity file (optional)" />
							<label class="checkbox">
								<input type="checkbox" bind:checked={profile.agent_forwarding} />
								Agent forwarding
							</label>
						</div>
						<div class="row">
							<textarea
								bind:value={profile.icon}
								placeholder="Icon: emoji or pasted SVG markup"
								class="icon-input"
								rows="1"
							></textarea>
							<input type="color" bind:value={profile.color} class="narrow" />
							<label class="checkbox">
								<input type="checkbox" bind:checked={profile.close_on_exit} />
								Close tab when connection ends
							</label>
						</div>
						<div class="list-field">
							<span class="list-label">{t('port_forward')}</span>
							<div class="row">
								<input
									type="number"
									bind:value={profile.local_port}
									placeholder={t('local_port')}
									class="narrow"
								/>
								<input bind:value={profile.remote_host} placeholder={t('remote_host')} />
								<input
									type="number"
									bind:value={profile.remote_port}
									placeholder={t('remote_port')}
									class="narrow"
								/>
							</div>
							<div class="row">
								<label class="checkbox">
									<input type="checkbox" bind:checked={profile.no_remote_command} />
									{t('no_remote_command')}
								</label>
								<label class="checkbox">
									<input type="checkbox" bind:checked={profile.verbose} />
									{t('verbose')}
								</label>
							</div>
						</div>
					</div>
				{/each}
				<button onclick={addSshProfile}>{t('add_ssh_connection')}</button>
			{:else if section === 'appearance'}
				<label>
					Font family
					<input bind:value={draft.font_family} />
				</label>
				<label>
					Font size
					<input type="number" min="8" max="32" bind:value={draft.font_size} />
				</label>
				<label>
					Line height
					<input type="number" step="0.05" min="1" max="2" bind:value={draft.line_height} />
				</label>
				<label>
					Cursor style
					<select bind:value={draft.cursor_style}>
						<option value="block">Block</option>
						<option value="underline">Underline</option>
						<option value="bar">Bar</option>
					</select>
				</label>
				<label class="checkbox">
					<input type="checkbox" bind:checked={draft.cursor_blink} />
					Cursor blink
				</label>
				<label>
					Background opacity
					<input type="range" min="0.4" max="1" step="0.05" bind:value={draft.background_opacity} />
				</label>
			{:else if section === 'terminal'}
				<label>
					Scrollback lines
					<input type="number" min="0" bind:value={draft.scrollback} />
				</label>
				<label class="checkbox">
					<input type="checkbox" bind:checked={draft.copy_on_select} />
					Copy on select
				</label>
				<label class="checkbox">
					<input type="checkbox" bind:checked={draft.right_click_paste} />
					Right-click pastes from clipboard
				</label>
				<label>
					Bell style
					<select bind:value={draft.bell_style}>
						<option value="none">None</option>
						<option value="visual">Visual</option>
						<option value="sound">Sound</option>
					</select>
				</label>
				<label class="checkbox">
					<input type="checkbox" bind:checked={draft.confirm_close} />
					Confirm before closing a tab with a running process
				</label>
			{:else if section === 'keybindings'}
				{#each KEYBIND_FIELDS as { field, key } (field)}
					<label>
						{t(key)}
						<input
							readonly
							value={draft.keybindings[field]}
							onkeydown={(e) => captureCombo(e, field)}
						/>
					</label>
				{/each}
			{:else if section === 'about'}
				<h3>Volt Terminal</h3>
				<p>Version {appVersion || '—'}</p>

				<h3>Updates</h3>
				<div class="row">
					<button onclick={() => updateStore.check()} disabled={updateStore.status === 'checking'}>
						{updateStore.status === 'checking' ? t('checking') : t('check_updates')}
					</button>
					{#if updateStore.status === 'available'}
						<button class="primary" onclick={() => updateStore.installAndRestart()}>
							Update to {updateStore.available?.version}
						</button>
					{/if}
				</div>
				{#if updateStore.status === 'up-to-date'}
					<p class="hint">{t('up_to_date')}</p>
				{:else if updateStore.status === 'downloading'}
					<p class="hint">Downloading… {Math.round(updateStore.progress * 100)}%</p>
				{:else if updateStore.status === 'error'}
					<p class="hint">Check failed: {updateStore.errorMessage}</p>
				{/if}
			{/if}
		</div>

		<div class="actions">
			<button onclick={onClose}>{t('cancel')}</button>
			<button class="primary" onclick={save}>{t('save')}</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: #00000080;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		width: 680px;
		height: 520px;
		max-height: 85vh;
		color: var(--text);
		display: grid;
		grid-template-columns: 160px 1fr;
		grid-template-rows: 1fr auto;
		overflow: hidden;
	}

	nav {
		grid-row: 1 / 3;
		border-right: 1px solid var(--border);
		padding: 14px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	nav h2 {
		font-size: 13px;
		margin: 0 8px 10px;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	nav button {
		background: transparent;
		border: none;
		color: var(--text-dim);
		text-align: left;
		padding: 7px 8px;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}

	nav button.active {
		background: var(--border);
		color: var(--text);
	}

	.content {
		padding: 18px 20px;
		overflow-y: auto;
		overflow-x: hidden;
		min-width: 0;
	}

	.content h3 {
		margin: 0 0 8px;
		font-size: 12px;
		text-transform: uppercase;
		color: var(--text-dim);
		letter-spacing: 0.05em;
	}

	.content h3:not(:first-child) {
		margin-top: 20px;
	}

	.hint {
		font-size: 12px;
		color: var(--text-dim);
		margin: -4px 0 10px;
	}

	label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
		font-size: 13px;
	}

	label.checkbox {
		justify-content: flex-start;
	}

	input,
	select,
	textarea {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		padding: 4px 8px;
		font-size: 13px;
		font-family: inherit;
	}

	input[type='number'] {
		width: 70px;
	}

	input.narrow {
		width: 70px;
	}

	.icon-input {
		flex: 1;
		min-width: 0;
		resize: vertical;
		min-height: 26px;
		max-height: 90px;
		font-family: 'Cascadia Code', Consolas, monospace;
		font-size: 11px;
	}

	input[type='color'] {
		width: 44px;
		padding: 2px;
		flex: 0 0 auto;
	}

	.row {
		display: flex;
		gap: 6px;
		margin-bottom: 6px;
	}

	.row input {
		flex: 1;
		min-width: 0;
	}

	.ssh-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px;
		margin-bottom: 8px;
	}

	.filter {
		width: 100%;
		margin-bottom: 10px;
	}

	.profile-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 10px;
		margin-bottom: 8px;
	}

	.profile-card summary {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		list-style: none;
		font-size: 13px;
	}

	.profile-card summary::-webkit-details-marker {
		display: none;
	}

	.profile-card[open] summary {
		margin-bottom: 8px;
	}

	.profile-icon {
		font-family: monospace;
		font-size: 13px;
		width: 18px;
		text-align: center;
		flex-shrink: 0;
	}

	.profile-name {
		font-weight: 600;
	}

	.profile-sub {
		color: var(--text-dim);
		font-size: 11px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	button.ghost {
		background: transparent;
		color: var(--text-dim);
	}

	button.ghost:hover {
		color: var(--text);
		background: var(--border);
	}

	.config-host {
		align-items: center;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 6px 10px;
	}

	.config-host-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.config-host-alias {
		font-size: 13px;
		font-weight: 600;
	}

	.config-host-detail {
		font-size: 11px;
		color: var(--text-dim);
	}

	.config-host button {
		flex-shrink: 0;
	}

	button {
		background: var(--border);
		border: none;
		border-radius: 6px;
		color: var(--text);
		padding: 6px 12px;
		font-size: 13px;
		cursor: pointer;
	}

	button.primary {
		background: var(--accent);
		color: #0b0d11;
		font-weight: 600;
	}

	button.danger {
		background: transparent;
		color: #f07178;
	}

	.actions {
		grid-column: 2;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--border);
	}
</style>
