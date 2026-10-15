import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MeetingLiveKitService } from '../../openvidu-components/services/meeting-livekit/meeting-livekit.service';
import { VideoRefreshService } from '../../openvidu-components/services/video-refresh/video-refresh.service';
import { MeetingStateService } from '../../services/meeting-state.service';

@Component({
	selector: 'ov-meeting-video-refresh-button',
	templateUrl: './meeting-video-refresh-button.component.html',
	styleUrl: './meeting-video-refresh-button.component.scss',
	imports: [MatButtonModule, MatIconModule, TranslatePipe]
})
export class MeetingVideoRefreshButtonComponent {
	private readonly videoRefresh = inject(VideoRefreshService);

	protected readonly refreshing = this.videoRefresh.refreshing;
	protected readonly isAlone = inject(MeetingStateService).isAlone;
	protected readonly connected = inject(MeetingLiveKitService).isConnected;

	protected refresh(): void {
		void this.videoRefresh.refresh();
	}
}
