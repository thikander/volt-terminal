<script lang="ts">
	// Profile icons are either a short glyph/emoji (rendered as text) or
	// pasted SVG markup (rendered as markup). Profile icons are always
	// authored locally by the user in Settings, never remote/untrusted
	// content, so {@html} here doesn't cross a trust boundary.
	let { icon, fallback = '' }: { icon: string | undefined; fallback?: string } = $props();

	let isSvg = $derived(icon?.trim().startsWith('<svg'));
</script>

{#if isSvg}
	<span class="svg-icon">{@html icon}</span>
{:else}
	{icon || fallback}
{/if}

<style>
	.svg-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.svg-icon :global(svg) {
		width: 1em;
		height: 1em;
	}
</style>
