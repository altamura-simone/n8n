import type { Theme, CreateThemeDto, UpdateThemeDto } from '@/types/theme.types';
import { IRestApiContext, makeRestApiRequest } from '@n8n/rest-api-client';

export async function getAllThemes(context: IRestApiContext): Promise<Theme[]> {
	return await makeRestApiRequest(context, 'GET', '/themes');
}

export async function createTheme(context: IRestApiContext, data: Partial<Theme>): Promise<Theme> {
	return await makeRestApiRequest(context, 'POST', `/themes`, data);
}

export async function updateTheme(
	context: IRestApiContext,
	id: string,
	data: UpdateThemeDto,
): Promise<Theme> {
	return await makeRestApiRequest(context, 'PUT', `/themes/${id}`, data);
}

export async function deleteTheme(context: IRestApiContext, id: string): Promise<void> {
	return await makeRestApiRequest(context, 'DELETE', `/themes/${id}`);
}
