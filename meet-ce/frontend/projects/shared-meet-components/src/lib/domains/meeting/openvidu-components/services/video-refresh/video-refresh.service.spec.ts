import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '../../../../../shared/services/logger.service';
import { LocalMediaService } from '../local-media/local-media.service';
import { MeetingLiveKitService } from '../meeting-livekit/meeting-livekit.service';
import { RESUBSCRIBE_GAP_MS, VideoRefreshService } from './video-refresh.service';

class FakePublication {
	readonly setSubscribed = jasmine.createSpy('setSubscribed');
}

const settle = async (): Promise<void> => {
	for (let turn = 0; turn < 10; turn++) await Promise.resolve();
};

describe('VideoRefreshService', () => {
	let service: VideoRefreshService;
	let connected: WritableSignal<boolean>;
	let camera: FakePublication;
	let screen: FakePublication;
	let startVideo: jasmine.Spy;
	let refreshCamera: jasmine.Spy;
	let calls: string[];

	const afterTheGap = async (refresh: Promise<void>): Promise<void> => {
		jasmine.clock().tick(RESUBSCRIBE_GAP_MS);
		await refresh;
	};

	beforeEach(() => {
		jasmine.clock().install();
		calls = [];
		connected = signal(true);
		camera = new FakePublication();
		screen = new FakePublication();
		camera.setSubscribed.and.callFake((subscribed: boolean) => calls.push(`camera ${subscribed}`));
		startVideo = jasmine.createSpy('startVideo').and.callFake(() => {
			calls.push('startVideo');

			return Promise.resolve();
		});
		refreshCamera = jasmine.createSpy('refreshCamera').and.resolveTo();

		const room = {
			startVideo,
			remoteParticipants: new Map([
				['operator', { videoTrackPublications: new Map([['TR_camera', camera]]) }],
				['guest', { videoTrackPublications: new Map([['TR_screen', screen]]) }]
			])
		};

		TestBed.configureTestingModule({
			providers: [
				provideZonelessChangeDetection(),
				{ provide: MeetingLiveKitService, useValue: { isConnected: connected, getRoom: () => room } },
				{ provide: LocalMediaService, useValue: { refreshCamera } },
				{ provide: LoggerService, useValue: { get: () => ({ d: () => {}, w: () => {}, e: () => {} }) } }
			]
		});

		service = TestBed.inject(VideoRefreshService);
	});

	afterEach(() => jasmine.clock().uninstall());

	it('subscribes again to every remote video', async () => {
		await afterTheGap(service.refresh());

		expect(camera.setSubscribed.calls.allArgs()).toEqual([[false], [true]]);
		expect(screen.setSubscribed.calls.allArgs()).toEqual([[false], [true]]);
	});

	it('lets go of a video for a moment before taking it back', async () => {
		const refresh = service.refresh();

		expect(camera.setSubscribed.calls.allArgs()).toEqual([[false]]);

		jasmine.clock().tick(RESUBSCRIBE_GAP_MS - 1);
		await settle();
		expect(camera.setSubscribed.calls.allArgs()).toEqual([[false]]);

		jasmine.clock().tick(1);
		await refresh;
		expect(camera.setSubscribed.calls.allArgs()).toEqual([[false], [true]]);
	});

	it('resumes playback at once, while the tap that asked for it still counts', async () => {
		const refresh = service.refresh();

		expect(calls).toEqual(['startVideo', 'camera false']);

		await afterTheGap(refresh);
	});

	it('opens the local camera again', async () => {
		await afterTheGap(service.refresh());

		expect(refreshCamera).toHaveBeenCalledTimes(1);
	});

	it('says it is refreshing until everything was asked for again', async () => {
		expect(service.refreshing()).toBeFalse();

		const refresh = service.refresh();
		expect(service.refreshing()).toBeTrue();

		jasmine.clock().tick(RESUBSCRIBE_GAP_MS - 1);
		await settle();
		expect(service.refreshing()).toBeTrue();

		jasmine.clock().tick(1);
		await refresh;
		expect(service.refreshing()).toBeFalse();
	});

	it('says it is refreshing until the camera is open again', async () => {
		let cameraOpened = (): void => {};

		refreshCamera.and.returnValue(new Promise<void>((resolve) => (cameraOpened = resolve)));

		const refresh = service.refresh();

		jasmine.clock().tick(RESUBSCRIBE_GAP_MS);
		await settle();
		expect(service.refreshing()).toBeTrue();

		cameraOpened();
		await refresh;
		expect(service.refreshing()).toBeFalse();
	});

	it('does not start a second refresh while one is running', async () => {
		const refresh = service.refresh();
		await service.refresh();

		expect(startVideo).toHaveBeenCalledTimes(1);
		expect(camera.setSubscribed.calls.allArgs()).toEqual([[false]]);

		await afterTheGap(refresh);
	});

	it('still finishes when the camera cannot be opened or playback cannot resume', async () => {
		refreshCamera.and.rejectWith(new Error('camera busy'));
		startVideo.and.rejectWith(new Error('not allowed'));

		await afterTheGap(service.refresh());

		expect(camera.setSubscribed.calls.allArgs()).toEqual([[false], [true]]);
		expect(service.refreshing()).toBeFalse();
	});

	it('does nothing while the room is not connected', async () => {
		connected.set(false);

		await service.refresh();

		expect(startVideo).not.toHaveBeenCalled();
		expect(camera.setSubscribed).not.toHaveBeenCalled();
		expect(refreshCamera).not.toHaveBeenCalled();
	});
});
