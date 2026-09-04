/**
 * Enum representing the embedded (HTML attribute) properties of the OpenVidu Meet application.
 */
export enum EmbeddedAttribute {
	/**
	 * The OpenVidu Meet room URL to access to.
	 * @required This attribute is required unless `recording-url` is provided.
	 */
	ROOM_URL = 'room-url',
	/**
	 * The URL of a recording to view.
	 * @required This attribute is required unless `room-url` is provided.
	 */
	RECORDING_URL = 'recording-url',
	/**
	 * Display name for the local participant.
	 */
	PARTICIPANT_NAME = 'participant-name',
	/**
	 * Secret key for end-to-end encryption (E2EE).
	 * If provided, the participant will join the meeting using E2EE key.
	 */
	E2EE_KEY = 'e2ee-key',
	/**
	 * URL to redirect to when leaving OpenVidu Meet.
	 * Redirection occurs after the **`CLOSED` event** fires.
	 */
	LEAVE_REDIRECT_URL = 'leave-redirect-url',
	/**
	 * Whether to show only recordings instead of live meetings.
	 */
	SHOW_ONLY_RECORDINGS = 'show-only-recordings',
	/**
	 * Identifier of the recording to display.
	 * When provided along with `room-url`, the app redirects to the recording view.
	 */
	SHOW_RECORDING = 'show-recording',
	/**
	 * Whether to skip the lobby screen (participant name input) and join the meeting directly.
	 * Requires `participant-name` (or an authenticated user / room member) to resolve the display name.
	 * Default: false (lobby is shown).
	 */
	SKIP_LOBBY = 'skip-lobby',
	/**
	 * Whether to skip the prejoin screen (camera/microphone preview).
	 * Default: false (prejoin is shown).
	 */
	SKIP_PREJOIN = 'skip-prejoin'
}

/**
 * Value shape of the OpenVidu Meet web component properties, keyed by the camelCase
 * JS property names (the DOM-attribute aliases are listed in {@link EmbeddedAttribute}).
 */
export interface WebComponentPropertyValues {
	/** The OpenVidu Meet room URL to access to. Required unless `recordingUrl` is provided. */
	roomUrl?: string;
	/** URL of a recording to view. When provided, `roomUrl` is not required. */
	recordingUrl?: string;
	/** Display name for the local participant. */
	participantName?: string;
	/** Secret key for end-to-end encryption (E2EE). When provided the participant joins using E2EE. */
	e2eeKey?: string;
	/** URL to redirect to after the `CLOSED` event fires when leaving OpenVidu Meet. */
	leaveRedirectUrl?: string;
	/** When true, shows only recordings instead of live meetings. */
	showOnlyRecordings?: boolean;
	/** Identifier of the recording to display. When provided along with `room-url`, the app redirects to the recording view. */
	showRecording?: string;
	/** When true, skips the lobby (participant name input) and joins the meeting directly. */
	skipLobby?: boolean;
	/** When true, skips the prejoin screen (camera/microphone preview). */
	skipPrejoin?: boolean;
}
