import type { ITheme } from '@xterm/xterm';

/** Base palette; `background` is overridden per-pane with the configured opacity. */
const base = {
	foreground: '#d6dae3',
	cursor: '#4da6ff',
	cursorAccent: '#111318',
	selectionBackground: '#4da6ff55',
	black: '#1a1d24',
	red: '#f07178',
	green: '#8bd49c',
	yellow: '#e5c07b',
	blue: '#61afef',
	magenta: '#c678dd',
	cyan: '#56b6c2',
	white: '#d6dae3',
	brightBlack: '#4b5263',
	brightRed: '#f4838f',
	brightGreen: '#a5e6b8',
	brightYellow: '#f0d090',
	brightBlue: '#7fc1ff',
	brightMagenta: '#d99ce8',
	brightCyan: '#7fd6e0',
	brightWhite: '#ffffff'
};

export const volttDarkTheme: ITheme = { ...base, background: '#111318' };

export function themeWithOpacity(opacity: number): ITheme {
	return { ...base, background: `rgba(17, 19, 24, ${opacity})` };
}
