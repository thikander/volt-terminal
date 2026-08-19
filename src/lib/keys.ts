/** Matches a KeyboardEvent against a combo string like "Ctrl+Shift+T" or "Ctrl+,". */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
	const parts = combo.split('+').map((p) => p.trim());
	const key = parts[parts.length - 1];
	const mods = new Set(parts.slice(0, -1).map((p) => p.toLowerCase()));

	const wantCtrl = mods.has('ctrl') || mods.has('control');
	const wantShift = mods.has('shift');
	const wantAlt = mods.has('alt');
	const wantMeta = mods.has('meta') || mods.has('cmd');

	if ((e.ctrlKey || e.metaKey) !== (wantCtrl || wantMeta)) return false;
	if (e.shiftKey !== wantShift) return false;
	if (e.altKey !== wantAlt) return false;

	return e.key.toLowerCase() === key.toLowerCase();
}
