import type { MigrationContext, ReversibleMigration } from '@/databases/types';

const names = {
	t: {
		theme: 'theme',
	},
	c: {
		theme: {
			id: 'id',
			name: 'name',
			properties: 'properties',
			isDefault: 'isDefault',
			customCss: 'customCss',
			createdAt: 'createdAt',
			updatedAt: 'updatedAt',
		},
	},
};

export class CreateThemeTable1746597188633 implements ReversibleMigration {
	async up({ schemaBuilder: { createTable, column } }: MigrationContext) {
		await createTable(names.t.theme).withColumns(
			column(names.c.theme.id).primary.notNull.varchar(16),
			column(names.c.theme.name).notNull.varchar(38),
			column(names.c.theme.properties).notNull.text,
			column(names.c.theme.customCss).text,
			column(names.c.theme.isDefault).bool.default(false),
			column(names.c.theme.createdAt).notNull,
			column(names.c.theme.updatedAt).notNull,
		);
	}

	async down({ schemaBuilder: { dropTable } }: MigrationContext) {
		await dropTable(names.t.theme);
	}
}
