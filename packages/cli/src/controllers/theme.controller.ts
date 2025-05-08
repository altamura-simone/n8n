import type { Theme } from '@n8n/db';
import { Body, Delete, Get, Param, Post, Put, RestController } from '@n8n/decorators';
// eslint-disable-next-line n8n-local-rules/misplaced-n8n-typeorm-import

import { AuthenticatedRequest, AuthlessRequest } from '@/requests';
import { ThemeRepository } from '@/databases/repositories/theme.repository';

@RestController('/themes')
export class ThemeController {
	constructor(private readonly themeService: ThemeRepository) {}

	@Get('/', { skipAuth: true })
	async getAllThemes(req: AuthenticatedRequest): Promise<Theme[]> {
		return await this.themeService.getAllThemes(); //req.user
	}

	@Get('/:id', { skipAuth: true })
	async getOne(@Param('id') id: string): Promise<Theme | null> {
		return this.themeService.getThemeById(id);
	}

	@Post('/', { skipAuth: true })
	async create(req: AuthlessRequest): Promise<Theme> {
		console.debug(req.body);
		return this.themeService.createTheme(req.body);
	}

	@Put('/:id', { skipAuth: true })
	async update(req: AuthlessRequest): Promise<Theme | null> {
		return this.themeService.updateTheme((req.params as any)['id'], req.body);
	}

	@Delete('/:id', { skipAuth: true })
	async remove(req: AuthlessRequest): Promise<void> {
		console.debug('ECCOMI ' + (req.params as any)['id']);
		await this.themeService.deleteTheme((req.params as any)['id']);
	}
}
