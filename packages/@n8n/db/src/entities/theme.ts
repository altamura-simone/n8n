// src/databases/entities/theme.ts
import { Column, Entity } from '@n8n/typeorm';
import { WithTimestampsAndStringId } from './abstract-entity';

@Entity()
export class Theme extends WithTimestampsAndStringId {
	@Column({ type: 'varchar', length: 255 })
	name: string;

	@Column('simple-json') // oppure 'json' se usi Postgres/MySQL
	properties: Record<string, string>;

	@Column({ type: 'text', nullable: true })
	customCss: string | null;

	@Column({ type: 'boolean', default: false })
	isDefault: boolean;
}
