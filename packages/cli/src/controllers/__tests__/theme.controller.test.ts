import { mock } from 'jest-mock-extended';

import type { AuthenticatedRequest } from '@/requests';

import { ThemeRepository } from '@/databases/repositories/theme.repository';
import { ThemeController } from '../theme.controller';

describe('ThemeController', () => {
	const themeRepository = mock<ThemeRepository>();
	const controller = new ThemeController(themeRepository);

	beforeEach(() => {
		jest.restoreAllMocks();
	});

	describe('getAllThemes', () => {
		it('recovery all themes', async () => {
			const request = mock<AuthenticatedRequest>({
				user: { id: '123' },
			});
			themeRepository.find();

			await controller.getAllThemes(request);

			// expect(eventService.emit).toHaveBeenCalledWith('user-changed-role', {
			// 	userId: '123',
			// 	targetUserId: '456',
			// 	targetUserNewRole: 'global:member',
			// 	publicApi: false,
			// });
		});
	});
});
