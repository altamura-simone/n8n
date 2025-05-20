import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as themesApi from '@/api/themes.api';
// import type { Theme } from '@/types/themes.types';
import { STORES } from '@/constants';
import { CreateThemeDto, Theme } from '@/types/theme.types';
import { useRootStore } from '@n8n/stores/useRootStore';

export const useThemesStore = defineStore(STORES.THEMES, () => {
	const rootStore = useRootStore();
	const themes = ref<Theme[]>([]);
	const selectedThemeId = ref<string | null>(null);
	const currentTheme = ref<Theme | null>(null);

	const getAllThemes = async () => {
		themes.value = await themesApi.getAllThemes(rootStore.restApiContext);
	};

	const createTheme = async (themeData: Partial<Theme>): Promise<Theme> => {
		const theme = await themesApi.createTheme(rootStore.restApiContext, themeData);
		themes.value.push(theme);
		return theme;
	};

	const updateTheme = async (id: string, themeData: Partial<Theme>): Promise<Theme> => {
		const updated = await themesApi.updateTheme(rootStore.restApiContext, id, themeData);
		const index = themes.value.findIndex((t) => t.id === id);
		if (index !== -1) themes.value[index] = updated;
		if (currentTheme.value?.id === id) currentTheme.value = updated;
		return updated;
	};

	const deleteTheme = async (id: string): Promise<void> => {
		await themesApi.deleteTheme(rootStore.restApiContext, id);
		themes.value = themes.value.filter((t) => t.id !== id);
		if (currentTheme.value?.id === id) currentTheme.value = null;
	};

	const setSelectedTheme = (id: string) => {
		selectedThemeId.value = id;
		applyTheme(id);
	};

	const applyTheme = (id: string) => {
		const theme = themes.value.find((t) => t.id === id);
		if (!theme || !theme.properties) {
			console.warn(`Tema con id ${id} non trovato o non ha delle properties`);
			return;
		}
		for (const [key, value] of Object.entries(theme.properties)) {
			document.documentElement.style.setProperty(key, value);
		}
		if (theme.customCss) {
			let styleEl = document.getElementById('custom-theme-css') as HTMLStyleElement;
			if (!styleEl) {
				styleEl = document.createElement('style');
				styleEl.id = 'custom-theme-css';
				document.head.appendChild(styleEl);
			}
			styleEl.innerHTML = theme.customCss;
		}
	};

	return {
		themes,
		currentTheme,
		getAllThemes,
		setSelectedTheme,
		createTheme,
		updateTheme,
		deleteTheme,
	};
});
