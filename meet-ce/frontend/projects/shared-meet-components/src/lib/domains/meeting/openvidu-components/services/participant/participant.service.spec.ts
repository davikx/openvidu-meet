import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '../../../../../shared/services/logger.service';
import { MeetStorageService } from '../../../../../shared/services/storage.service';
import { E2eeService } from '../e2ee/e2ee.service';
import { StreamLayoutStateService } from '../layout/stream-layout-state.service';
import type { RemoteParticipant } from '../livekit';
import { LocalMediaService } from '../local-media/local-media.service';
import { MeetingLiveKitService } from '../meeting-livekit/meeting-livekit.service';
import { ViewportService } from '../viewport/viewport.service';
import { ParticipantService } from './participant.service';

describe('ParticipantService (where the local camera sits)', () => {
	let service: ParticipantService;
	let streamLayoutService: jasmine.SpyObj<StreamLayoutStateService>;
	let isShortLandscape: WritableSignal<boolean>;
	let storedFloating: boolean | null;
	let roomRemotes: Map<string, RemoteParticipant>;

	const remote = (sid: string): RemoteParticipant =>
		({ sid, identity: sid, name: sid }) as unknown as RemoteParticipant;

	const createService = (): void => {
		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				{ provide: StreamLayoutStateService, useValue: streamLayoutService },
				{ provide: ViewportService, useValue: { isShortLandscape } },
				{ provide: MeetStorageService, useValue: { getLocalTileFloating: () => storedFloating } },
				{ provide: E2eeService, useValue: { decryptOrMask: async (name: string) => name } },
				{ provide: LocalMediaService, useValue: { publish: async () => {} } },
				{ provide: LoggerService, useValue: { get: () => ({ d: () => {}, w: () => {}, e: () => {} }) } },
				{
					provide: MeetingLiveKitService,
					useValue: {
						connect: async () => {},
						getRoom: () => ({
							localParticipant: { sid: 'PA_me', identity: 'me', name: 'me' },
							remoteParticipants: roomRemotes
						}),
						hasRemoteParticipant: () => true
					}
				}
			]
		});

		service = TestBed.inject(ParticipantService);
		TestBed.tick();
		streamLayoutService.dockLocalCameraVideo.calls.reset();
		streamLayoutService.floatLocalCameraVideo.calls.reset();
	};

	const turnTo = (shortLandscape: boolean): void => {
		isShortLandscape.set(shortLandscape);
		TestBed.tick();
	};

	beforeEach(() => {
		streamLayoutService = jasmine.createSpyObj<StreamLayoutStateService>('StreamLayoutStateService', [
			'dockLocalCameraVideo',
			'floatLocalCameraVideo'
		]);
		isShortLandscape = signal(false);
		storedFloating = null;
		roomRemotes = new Map();
	});

	it('docks the local camera into the grid when the viewport turns to a short landscape', () => {
		createService();
		service.addRemoteParticipant(remote('PA_bob'));

		turnTo(true);

		expect(streamLayoutService.dockLocalCameraVideo).toHaveBeenCalledTimes(1);
		expect(streamLayoutService.floatLocalCameraVideo).not.toHaveBeenCalled();
	});

	it('floats it again when the viewport turns back', () => {
		isShortLandscape.set(true);
		createService();
		service.addRemoteParticipant(remote('PA_bob'));

		turnTo(false);

		expect(streamLayoutService.floatLocalCameraVideo).toHaveBeenCalledTimes(1);
		expect(streamLayoutService.dockLocalCameraVideo).not.toHaveBeenCalled();
	});

	it('leaves it docked on turning back when the user docked it themselves', () => {
		isShortLandscape.set(true);
		storedFloating = false;
		createService();
		service.addRemoteParticipant(remote('PA_bob'));

		turnTo(false);

		expect(streamLayoutService.floatLocalCameraVideo).not.toHaveBeenCalled();
	});

	it('leaves it docked on turning back when nobody else is in the room', () => {
		isShortLandscape.set(true);
		createService();

		turnTo(false);

		expect(streamLayoutService.floatLocalCameraVideo).not.toHaveBeenCalled();
	});

	it('floats it on entering a room where someone is already waiting', async () => {
		roomRemotes.set('bob', remote('PA_bob'));
		createService();

		await service.connect();

		expect(streamLayoutService.floatLocalCameraVideo).toHaveBeenCalledTimes(1);
	});

	it('keeps it in the grid on entering that room in a short landscape', async () => {
		isShortLandscape.set(true);
		roomRemotes.set('bob', remote('PA_bob'));
		createService();

		await service.connect();

		expect(streamLayoutService.floatLocalCameraVideo).not.toHaveBeenCalled();
	});
});
