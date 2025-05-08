export interface Theme {
	id: string;
	name: string;
	properties: Record<string, string>; // es: { "--color-primary": "#000000", ... }
	customCss?: string;
	createdAt: string;
	updatedAt: string;
}

export type CreateThemeDto = Omit<Theme, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateThemeDto = Partial<CreateThemeDto>;
