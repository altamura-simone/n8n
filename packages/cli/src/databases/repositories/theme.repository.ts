import { Theme } from '@n8n/db';
import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

@Service()
export class ThemeRepository extends Repository<Theme> {
	constructor(dataSource: DataSource) {
		super(Theme, dataSource.manager);
	}

	async getAllThemes() {
		return await this.find();
	}

	async getThemeById(id: string) {
		return this.findOneBy({ id });
	}

	async createTheme(theme: Partial<Theme>) {
		const newTheme = this.create(theme);
		return this.save(newTheme);
	}

	async updateTheme(id: string, updateData: Partial<Theme>) {
		await this.update(id, updateData);
		return this.findOneBy({ id });
	}

	async deleteTheme(id: string) {
		return this.delete(id);
	}
}
