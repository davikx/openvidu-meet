import { DOCUMENT } from '@angular/common';
import { effect, inject, Service, signal } from '@angular/core';
import { LoggerService } from '../../../../../shared/services/logger.service';
import type { RemoteTrackPublication, Room } from '../livekit';
import { LocalMediaService } from '../local-media/local-media.service';
import { MeetingLiveKitService } from '../meeting-livekit/meeting-livekit.service';

export const RESUBSCRIBE_GAP_MS = 300;
export const CAMERA_RESTORE_DELAY_MS = 1000;

const remoteVideos = (room: Room): RemoteTrackPublication[] =>
	[...room.remoteParticipants.values()].flatMap((participant) => [...participant.videoTrackPublications.values()]);

@Service()
export class VideoRefreshService {
	private readonly meetingLiveKitService = inject(MeetingLiveKitService);
	private readonly localMedia = inject(LocalMediaService);
	private readonly log = inject(LoggerService).get('VideoRefreshService');
	private readonly document = inject(DOCUMENT);
	private readonly _refreshing = signal(false);

	readonly refreshing = this._refreshing.asReadonly();

	private readonly cameraRestore = effect((onCleanup) => {
		if (!this.meetingLiveKitService.isConnected()) return;

		let timer: ReturnType<typeof setTimeout> | undefined;

		const restoreAfter = (delayMs: number) => {
			clearTimeout(timer);

			if (this.document.visibilityState === 'visible') {
				timer = setTimeout(() => void this.restoreCamera(), delayMs);
			}
		};

		const restoreOnReturn = () => restoreAfter(CAMERA_RESTORE_DELAY_MS);

		restoreAfter(0);
		this.document.addEventListener('visibilitychange', restoreOnReturn);
		onCleanup(() => {
			clearTimeout(timer);
			this.document.removeEventListener('visibilitychange', restoreOnReturn);
		});
	});

	private readonly canRestoreCamera = (): boolean =>
		this.document.visibilityState === 'visible' && this.meetingLiveKitService.isConnected();

	async refresh(): Promise<void> {
		if (this._refreshing() || !this.meetingLiveKitService.isConnected()) return;

		const room = this.meetingLiveKitService.getRoom();

		this._refreshing.set(true);

		try {
			room.startVideo().catch((error: unknown) => this.log.w('Could not resume the video playback:', error));
			await Promise.all([this.resubscribe(room), this.reopenCamera()]);
		} finally {
			this._refreshing.set(false);
		}
	}

	private async resubscribe(room: Room): Promise<void> {
		const videos = remoteVideos(room);

		for (const publication of videos) publication.setSubscribed(false);

		await new Promise((resolve) => setTimeout(resolve, RESUBSCRIBE_GAP_MS));

		for (const publication of videos) publication.setSubscribed(true);
	}

	private async reopenCamera(): Promise<void> {
		try {
			await this.localMedia.refreshCamera();
		} catch (error) {
			this.log.w('Could not open the camera again:', error);
		}
	}

	private async restoreCamera(): Promise<void> {
		if (!this.canRestoreCamera()) return;

		try {
			await this.localMedia.restoreCamera(this.canRestoreCamera);
		} catch (error) {
			this.log.w('Could not bring the camera back:', error);
		}
	}
}
