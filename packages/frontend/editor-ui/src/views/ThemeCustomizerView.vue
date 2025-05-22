<template>
	<div class="theme-manager">
		<h2 class="title">Gestione Temi</h2>

		<!-- Form per creare o modificare un tema -->
		<form @submit.prevent="createThemeFromForm" class="theme-form card">
			<h3>{{ selectedThemeId ? 'Modifica tema' : 'Crea nuovo tema' }}</h3>
			<div class="form-group">
				<input class="input" v-model="newThemeName" placeholder="Nome tema" required />
			</div>
			<div class="form-group">
				<label>CSS Personalizzato:</label>
				<MonacoEditor theme="vs" language="css" v-model:value="customCss" class="editor" />
			</div>
			<button class="btn primary" type="submit">
				{{ selectedThemeId ? '💾 Aggiorna tema' : '💾 Salva tema' }}
			</button>
		</form>

		<!-- Elenco temi esistenti -->
		<div class="theme-list card">
			<h3>Temi disponibili</h3>
			<ul>
				<li v-for="theme in themesStore.themes" :key="theme.id" class="theme-item">
					<div>
						<strong class="clickable" @click="editTheme(theme.id)">{{ theme.name }}</strong>
						<span v-if="theme.id === themesStore.currentTheme?.id" class="active">🌟 Attivo</span>
					</div>
					<div class="actions">
						<button class="btn small" @click="themesStore.setSelectedTheme(theme.id)">
							Applica
						</button>
						<button class="btn small danger" @click="deleteTheme(theme.id)">Elimina</button>
					</div>
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useThemesStore } from '@/stores/themes.store';
import MonacoEditor from 'monaco-editor-vue3';

const themesStore = useThemesStore();

const newThemeName = ref('Tema personalizzato');
const customCss = ref('');
const selectedThemeId = ref<string | null>(null);

// Crea o aggiorna un tema
const createThemeFromForm = async () => {
	if (selectedThemeId.value) {
		await themesStore.updateTheme(selectedThemeId.value, {
			name: newThemeName.value,
			properties: {},
			customCss: customCss.value,
		});
	} else {
		await themesStore.createTheme({
			name: newThemeName.value,
			properties: {},
			customCss: customCss.value,
		});
	}
	resetForm();
};

// Carica i dati del tema da modificare
const editTheme = (themeId: string) => {
	const theme = themesStore.themes.find((t) => t.id === themeId);
	if (theme) {
		newThemeName.value = theme.name;
		customCss.value = theme.customCss || '';
		selectedThemeId.value = theme.id;
	}
};

// Elimina un tema
const deleteTheme = async (id: string) => {
	await themesStore.deleteTheme(id);
	if (selectedThemeId.value === id) resetForm();
};

// Reset form
const resetForm = () => {
	newThemeName.value = 'Tema personalizzato';
	customCss.value = '';
	selectedThemeId.value = null;
};

// Caricamento iniziale
onMounted(async () => {
	await themesStore.getAllThemes();
	const savedThemeId = localStorage.getItem('selectedThemeId');
	if (savedThemeId) {
		themesStore.setSelectedTheme(savedThemeId);
	}
});
</script>

<style scoped>
.theme-manager {
	max-width: 1000px;
	width: 100%;
	margin: 0 auto;
	padding: 2rem;
	font-family: 'Inter', sans-serif;
	color: #333;
}

.title {
	font-size: 1.8rem;
	margin-bottom: 1rem;
}

.card {
	background: #f9f9f9;
	border-radius: 8px;
	padding: 1.5rem;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
	margin-bottom: 2rem;
}

.theme-form h3,
.theme-list h3 {
	margin-bottom: 1rem;
}

.form-group {
	margin-bottom: 1rem;
}

.input {
	padding: 0.5rem;
	border: 1px solid #ccc;
	border-radius: 4px;
	width: 100%;
}

.editor {
	border: 1px solid #ccc;
	border-radius: 4px;
	min-height: 500px;
	width: 100%;
}

.theme-list ul {
	list-style: none;
	padding: 0;
	margin: 0;
}

.theme-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0.75rem 0;
	border-bottom: 1px solid #eee;
}

.actions {
	display: flex;
	gap: 0.5rem;
}

.btn {
	padding: 0.4rem 0.8rem;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-size: 0.9rem;
}

.btn.primary {
	background-color: #4caf50;
	color: white;
}

.btn.small {
	font-size: 0.8rem;
	padding: 0.3rem 0.6rem;
}

.btn.danger {
	background-color: #f44336;
	color: white;
}

.btn:hover {
	opacity: 0.9;
}

.active {
	color: #4caf50;
	margin-left: 0.5rem;
	font-weight: bold;
}

.clickable {
	cursor: pointer;
	color: #2196f3;
	transition: color 0.2s;
}

.clickable:hover {
	color: #1769aa;
	text-decoration: underline;
}
</style>
