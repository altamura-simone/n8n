<template>
	<div>
		<h2>Temi</h2>

		<!-- Form per creare un nuovo tema -->
		<form @submit.prevent="createThemeFromForm" class="theme-form">
			<input v-model="newThemeName" placeholder="Nome tema" required />
			<label>
				Primario:
				<input type="color" v-model="primaryColor" />
			</label>
			<label>
				Sfondo:
				<input type="color" v-model="backgroundColor" />
			</label>
			<label>
				Sidebar:
				<input type="color" v-model="backgroundXColor" />
			</label>
			<button type="submit">Crea tema</button>
		</form>

		<!-- Elenco temi esistenti -->
		<ul>
			<li v-for="theme in themesStore.themes" :key="theme.id">
				<strong>{{ theme.name }}</strong>
				<span v-if="theme.id === themesStore.currentTheme?.id">🌟 Attivo</span>
				<button @click="themesStore.setSelectedTheme(theme.id)">Seleziona</button>
				<button @click="deleteTheme(theme.id)">Elimina</button>
			</li>
		</ul>
	</div>
	<MonacoEditor theme="vs" language="css" v-model:value="customCss"></MonacoEditor>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useThemesStore } from '@/stores/themes.store';
import MonacoEditor from 'monaco-editor-vue3';

const themesStore = useThemesStore();

// Valori per nuovo tema
const newThemeName = ref('Tema personalizzato');
const primaryColor = ref('#000000');
const backgroundColor = ref('#ffffff');
const backgroundXColor = ref('#ffffff');
const customCss = ref('');

// Crea nuovo tema con i colori scelti
const createThemeFromForm = async () => {
	await themesStore.createTheme({
		name: newThemeName.value,
		properties: {},
		customCss: customCss.value,
	});
	// Reset form
	newThemeName.value = 'Tema personalizzato';
	primaryColor.value = '#000000';
	backgroundColor.value = '#ffffff';
	backgroundXColor.value = '#ffffff';
};

// Elimina un tema
const deleteTheme = async (id: string) => {
	await themesStore.deleteTheme(id);
};

// Al caricamento: carica temi + applica tema selezionato
onMounted(async () => {
	await themesStore.getAllThemes();
	const savedThemeId = localStorage.getItem('selectedThemeId');
	if (savedThemeId) {
		themesStore.setSelectedTheme(savedThemeId);
	}
});
</script>

<style scoped>
.theme-form {
	margin-bottom: 1rem;
	display: flex;
	gap: 0.5rem;
	align-items: center;
	flex-wrap: wrap;
}
</style>
