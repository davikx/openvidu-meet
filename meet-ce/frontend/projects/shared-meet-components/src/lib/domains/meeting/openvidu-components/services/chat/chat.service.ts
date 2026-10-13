import { effect, inject, Service, signal, untracked } from '@angular/core';
import { ChatMessage } from '../../models/chat.model';

import { DataTopic } from '../../models/data-topic.model';
import { PanelType } from '../../models/panel.model';
import { E2eeService } from '../e2ee/e2ee.service';
import { MeetingLiveKitService } from '../meeting-livekit/meeting-livekit.service';
import { PanelService } from '../panel/panel.service';
import { ParticipantService } from '../participant/participant.service';
import { ChatHistoryStore } from './chat-history.store';
import { AssetsService } from '../../../../../shared/services/assets.service';
import { LoggerService } from '../../../../../shared/services/logger.service';
import { NotificationService } from '../../../../../shared/services/notification.service';
import type { ILogger } from '../../../../../shared/models/logger.model';

/** Long enough to reach the button it offers, which three seconds was not. */
const CHAT_NOTIFICATION_DURATION_MS = 5_000;

/**
 * @internal
 */
@Service()
export class ChatService {
	private readonly participantService = inject(ParticipantService);
	private readonly panelService = inject(PanelService);
	private readonly notificationService = inject(NotificationService);
	private readonly assets = inject(AssetsService);
	private readonly meetingLiveKitService = inject(MeetingLiveKitService);
	private readonly e2eeService = inject(E2eeService);
	private readonly history = inject(ChatHistoryStore);
	private log: ILogger = inject(LoggerService).get('ChatService');

	chatMessages = signal<ChatMessage[]>([]);
	// Chat notification sound served as a static asset (resolves in SPA & WC modes),
	// matching SoundService instead of inlining the audio as base64.
	private messageSound: HTMLAudioElement = new Audio(this.assets.chatMessageSound);
	private messageList: ChatMessage[] = [];
	private shownId: number | undefined;
	private roomId = '';

	private readonly roomEffect = effect(() => {
		if (this.meetingLiveKitService.isConnected()) untracked(() => this.followRoom());
	});

	constructor() {
		this.messageSound.volume = 0.6;
	}

	/** Adds a new message to the chat from a remote participant
	 * @param message
	 * @param participantName
	 */
	async addRemoteMessage(message: string, participantName: string) {
		this.addMessage(message, false, participantName);

		if (!this.panelService.isChatPanelOpened()) {
			this.announceMessage(participantName);
			this.messageSound.play().catch(() => {});
		}
	}

	/**
	 * Sends a chat message through the data channel.
	 *
	 * @param message The message text to send
	 */
	async sendMessage(message: string) {
		const plainTextMessage = message.replace(/ +(?= )/g, '');

		if (plainTextMessage !== '' && plainTextMessage !== ' ') {
			try {
				// Create message payload
				const payload = JSON.stringify({ message: plainTextMessage });
				const data: Uint8Array<ArrayBuffer> = new TextEncoder().encode(payload);

				// Send through data channel
				await this.participantService.publishData(data, { topic: DataTopic.CHAT, reliable: true });

				// Add to local message list
				this.addMessage(plainTextMessage, true, this.participantService.getMyName()!);
			} catch (error) {
				this.log.e('Error sending chat message:', error);
				throw error;
			}
		}
	}

	forgetRoom(): void {
		const roomId = this.meetingLiveKitService.getRoomName() || this.roomId;

		if (roomId) this.history.forget(roomId);

		this.roomId = '';
		this.messageList = [];
		this.chatMessages.set([]);
	}

	private addMessage(message: string, isLocal: boolean, participantName: string) {
		this.followRoom();
		this.messageList.push({
			isLocal,
			participantName,
			message
		});
		this.chatMessages.set([...this.messageList]);

		if (this.roomId && this.keepsHistory()) this.history.save(this.roomId, this.messageList);
	}

	private followRoom(): void {
		const roomId = this.meetingLiveKitService.getRoomName();

		if (!roomId || roomId === this.roomId) return;

		this.roomId = roomId;
		this.messageList = this.keepsHistory() ? this.history.load(roomId) : [];
		this.chatMessages.set([...this.messageList]);
	}

	private keepsHistory(): boolean {
		return !this.e2eeService.isEnabled;
	}

	/**
	 * Tells the participant a message arrived while they had the chat closed, offering to open it.
	 * Only the latest message is announced: a burst of them must not stack up over the meeting.
	 */
	private announceMessage(participantName: string): void {
		if (this.shownId !== undefined) {
			this.notificationService.dismissNotification(this.shownId);
		}

		this.shownId = this.notificationService.showNotification({
			kind: 'chat-message',
			icon: 'chat',
			message: {
				key: 'PANEL.CHAT.MESSAGE_SENT_NOTIFICATION',
				params: { name: participantName.toUpperCase() }
			},
			durationMs: CHAT_NOTIFICATION_DURATION_MS,
			action: {
				label: { key: 'PANEL.CHAT.OPEN_CHAT' },
				run: () => this.panelService.togglePanel(PanelType.CHAT)
			}
		});
	}
}
