import { inject, Service, signal } from '@angular/core';
import { LoggerService } from '../../../../../shared/services/logger.service';
import type { RemoteTrackPublication, Room } from '../livekit';
import { LocalMediaService } from '../local-media/local-media.service';
import { MeetingLiveKitService } from '../meeting-livekit/meeting-livekit.service';

export const RESUBSCRIBE_GAP_MS = 300;

const remoteVideos = (room: Room): RemoteTrackPublication[] =>
	[...room.remoteParticipants.values()].flatMap((participant) => [...participant.videoTrackPublications.values()]);

@Service()
export class VideoRefreshService {
	private readonly meetingLiveKitService = inject(MeetingLiveKitService);
	private readonly localMedia = inject(LocalMediaService);
	private readonly log = inject(LoggerService).get('VideoRefreshService');
	private readonly _refreshing = signal(false);

	readonly refreshing = this._refreshing.asReadonly();

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
}
