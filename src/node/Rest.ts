import type { FilterOptions } from '../guild/Player';
import type { NodeOption } from '../LvgoClient';
import type { Node, NodeInfo, Stats } from './Node';

export type Severity = 'common' | 'suspicious' | 'fault';

export enum LoadType {
	TRACK = 'track',
	PLAYLIST = 'playlist',
	SEARCH = 'search',
	EMPTY = 'empty',
	ERROR = 'error'
}

export interface Track {
	encoded: string;
	info: {
		identifier: string;
		isSeekable: boolean;
		author: string;
		length: number;
		isStream: boolean;
		position: number;
		title: string;
		uri?: string;
		artworkUrl?: string;
		isrc?: string;
		sourceName: string;
	};
	pluginInfo?: unknown;
	userData?: unknown;
}

export interface Playlist {
	name: string;
	selectedTrack: number;
	tracks: Track[];
}

export interface Exception {
	message: string;
	severity: Severity;
	cause: string;
}

export interface LavalinkResponse {
	loadType: LoadType;
	data: Track | Playlist | Track[] | ExceptionRecord | null;
	type?: LoadType;
	playlistName?: string;
	exception?: ExceptionRecord;
	tracks?: Track[];
}

export interface ExceptionRecord {
	message: string;
	severity: Severity;
	cause: string;
}

export interface MultiSearchResult {
	[source: string]: {
		result: LavalinkResponse;
		latency: number;
	};
}

export interface PlayerStats {
	TotalPlaytimeMs: number;
	TracksPlayed: number;
	TrackSkips: number;
	SessionStartTime: number;
}

export interface GuildStats {
	TotalTracksPlayed: number;
	TotalPlaytimeMs: number;
	TopTracks: Track[];
}

export interface HealthResponse {
	status: string;
	uptime: number;
	memory: {
		alloc: number;
		totalAlloc?: number;
		sys: number;
		numGC?: number;
	};
}

export interface RateLimitInfo {
	global: {
		limit: number;
		remaining: number;
		reset: number;
	};
	perIp: {
		limit: number;
		remaining: number;
	};
}

export interface PartyMember {
	guildId: string;
	sessionId: string;
}

export interface PartyInfo {
	id?: string;
	hostGuildId?: string;
	hostSessionId?: string;
	members?: PartyMember[];
	syncEnabled?: boolean;
	ID?: string;
	HostGuildID?: string;
	HostSessionID?: string;
	Members?: PartyMember[];
	SyncEnabled?: boolean;
}

export interface LavalinkPlayerVoice {
	token: string;
	endpoint: string;
	sessionId: string;
	channelId: string;
	connected?: boolean;
	ping?: number;
}

export type LavalinkPlayerVoiceOptions = Omit<LavalinkPlayerVoice, 'connected' | 'ping'>;

export interface LavalinkPlayer {
	guildId: string;
	track?: Track;
	volume: number;
	paused: boolean;
	voice: LavalinkPlayerVoice;
	filters: FilterOptions;
	state: {
		time: number;
		position: number;
		connected: boolean;
		ping: number;
	};
}

export interface UpdatePlayerTrackOptions {
	encoded?: string | null;
	identifier?: string;
	userData?: unknown;
}

export interface UpdatePlayerOptions {
	track?: UpdatePlayerTrackOptions;
	position?: number;
	endTime?: number;
	volume?: number;
	paused?: boolean;
	filters?: FilterOptions;
	voice?: LavalinkPlayerVoiceOptions;
}

export interface UpdatePlayerInfo {
	guildId: string;
	playerOptions: UpdatePlayerOptions;
	noReplace?: boolean;
}

export interface SessionInfo {
	resuming?: boolean;
	resumingKey?: string;
	timeout?: number;
}

export interface Queue {
	total: number;
	page: number;
	tracks: Track[];
}

export interface QueueResponse {
	added: number;
	queueLength: number;
}

export interface QueueRemoveResponse {
	removed: number;
}

export interface History {
	total: number;
	page: number;
	tracks: ({ endTime: number } & Track)[];
}

export type HistoryReplayMode = 'play' | 'queue' | 'next';

export interface FetchOptions {
	/**
	 * Lavalink endpoint
	 */
	endpoint: string;
	/**
	 * Options passed to fetch
	 */
	options: {
		headers?: Record<string, string>;
		params?: Record<string, string>;
		method?: string;
		body?: unknown;
		[key: string]: unknown;
	};
}

interface FinalFetchOptions {
	method: string;
	headers: Record<string, string>;
	signal: AbortSignal;
	body?: string;
}

const MAX_MULTI_SEARCH_SOURCES = 10;
const QUEUE_BATCH_LIMIT = 500;
const PAGINATION_MIN = 1;
const PAGINATION_LIMIT_MAX = 100;
const MIN_SLEEP_DURATION_MS = 1;
const MAX_SLEEP_DURATION_MS = 86_400_000;
const MIN_PLAYER_VOLUME = 0;
const MAX_PLAYER_VOLUME = 1000;
const MIN_FILTER_VOLUME = 0;
const MAX_FILTER_VOLUME = 5;
const MAX_EQUALIZER_BANDS = 15;

/**
 * Wrapper around Lavalink REST API
 */
export class Rest {
	/**
	 * Node that initialized this instance
	 */
	protected readonly node: Node;
	/**
	 * URL of Lavalink
	 */
	protected readonly url: string;
	/**
	 * Credentials to access Lavalink
	 */
	protected readonly auth: string;
	/**
	 * @param node An instance of Node
	 * @param options The options to initialize this rest class
	 */
	constructor(node: Node, options: NodeOption) {
		this.node = node;
		this.url = `${options.secure ? 'https' : 'http'}://${options.url}/g1`;
		this.auth = options.auth;
	}

	protected get sessionId(): string {
		return this.node.sessionId!;
	}

	/**
	 * Resolve a track
	 * @param identifier Track ID
	 * @returns A promise that resolves to a Lavalink response
	 */
	public resolve(identifier: string): Promise<LavalinkResponse | undefined> {
		this.assertNonEmptyString(identifier, 'identifier');
		const options = {
			endpoint: '/tracks/resolve',
			options: { params: { identifier }}
		};
		return this.fetch(options);
	}

	/**
	 * Decode a track
	 * @param encoded Encoded track
	 * @returns Promise that resolves to a track
	 */
	public decode(encoded: string): Promise<Track | undefined> {
		this.assertNonEmptyString(encoded, 'encoded');
		const options = {
			endpoint: '/tracks/decode',
			options: { params: { encoded }}
		};
		return this.fetch<Track>(options);
	}


	/**
	 * Gets all the player with the specified sessionId
	 * @returns Promise that resolves to an array of Lavalink players
	 */
	public async getPlayers(): Promise<LavalinkPlayer[]> {
		const options = {
			endpoint: `/sessions/${this.sessionId}/players`,
			options: {}
		};
		return await this.fetch<LavalinkPlayer[]>(options) ?? [];
	}

	/**
	 * Gets the player with the specified guildId
	 * @returns Promise that resolves to a Lavalink player
	 */
	public getPlayer(guildId: string): Promise<LavalinkPlayer | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}`,
			options: {}
		};
		return this.fetch(options);
	}

	/**
	 * Updates a Lavalink player
	 * @param data SessionId from Discord
	 * @returns Promise that resolves to a Lavalink player
	 */
	public updatePlayer(data: UpdatePlayerInfo): Promise<LavalinkPlayer | undefined> {
		this.assertUpdatePlayerPayload(data);
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${data.guildId}`,
			options: {
				method: 'PATCH',
				params: { noReplace: data.noReplace?.toString() ?? 'false' },
				headers: { 'Content-Type': 'application/json' },
				body: data.playerOptions as Record<string, unknown>
			}
		};
		return this.fetch<LavalinkPlayer>(options);
	}

	/**
	 * Deletes a Lavalink player
	 * @param guildId guildId where this player is
	 */
	public async destroyPlayer(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}`,
			options: { method: 'DELETE' }
		};
		await this.fetch(options);
	}

	/**
	 * Updates the session with a resume boolean and timeout
	 * @param resuming Whether resuming is enabled for this session or not
	 * @param timeout Timeout to wait for resuming
	 * @returns Promise that resolves to a Lavalink player
	 */
	public updateSession(resuming?: boolean, timeout?: number): Promise<SessionInfo | undefined> {
		if (typeof timeout !== 'undefined' && (!Number.isInteger(timeout) || timeout < 0))
			throw new RangeError('[Rest] timeout must be an integer >= 0');
		const options = {
			endpoint: `/sessions/${this.sessionId}`,
			options: {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: { resuming, timeout }
			}
		};
		return this.fetch(options);
	}

	/**
	 * Gets the status of this node
	 * @returns Promise that resolves to a node stats response
	 */
	public stats(): Promise<Stats | undefined> {
		const options = {
			endpoint: '/stats',
			options: {}
		};
		return this.fetch(options);
	}

	/**
	 * Multi-source search
	 * @param query Search query
	 * @param sources Optional comma-separated list of sources (e.g., 'youtube,soundcloud')
	 * @returns Promise that resolves to search results from multiple sources
	 */
	public multiSearch(query: string, sources?: string[]): Promise<MultiSearchResult | undefined> {
		this.assertNonEmptyString(query, 'query');
		if (sources?.length && sources.length > MAX_MULTI_SEARCH_SOURCES)
			throw new RangeError(`[Rest] sources length must be <= ${MAX_MULTI_SEARCH_SOURCES}`);
		const params: Record<string, string> = { query };
		if (sources?.length) params.sources = sources.join(',');
		const options = {
			endpoint: '/tracks/search',
			options: { params }
		};
		return this.fetch(options);
	}

	/**
	 * Stop the player
	 * @param guildId Guild ID
	 */
	public async stopPlayer(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/stop`,
			options: { method: 'POST' }
		};
		await this.fetch(options);
	}

	/**
	 * Replay the current track from the beginning
	 * @param guildId Guild ID
	 * @returns Promise that resolves to the player object
	 */
	public replayPlayer(guildId: string): Promise<LavalinkPlayer | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/replay`,
			options: { method: 'POST' }
		};
		return this.fetch(options);
	}

	/**
	 * Seek to a specific position using POST endpoint
	 * @param guildId Guild ID
	 * @param position Position in milliseconds
	 * @returns Promise that resolves to the new position
	 */
	public seekPlayer(guildId: string, position: number): Promise<number | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertNonNegativeInteger(position, 'position');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/seek`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { position }
			}
		};
		return this.fetch<LavalinkPlayer>(options).then(player => player?.state.position);
	}

	/**
	 * Set auto-shuffle mode
	 * @param guildId Guild ID
	 * @param enabled Whether to enable auto-shuffle
	 */
	public async setAutoShuffle(guildId: string, enabled: boolean): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/autoshuffle`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { enabled }
			}
		};
		await this.fetch(options);
	}

	/**
	 * Set sleep timer
	 * @param guildId Guild ID
	 * @param duration Duration in milliseconds
	 */
	public async setSleepTimer(guildId: string, duration: number): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		if (!Number.isInteger(duration) || duration < MIN_SLEEP_DURATION_MS || duration > MAX_SLEEP_DURATION_MS)
			throw new RangeError(`[Rest] duration must be an integer between ${MIN_SLEEP_DURATION_MS} and ${MAX_SLEEP_DURATION_MS}`);
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/sleep`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { duration }
			}
		};
		await this.fetch(options);
	}

	/**
	 * Cancel sleep timer
	 * @param guildId Guild ID
	 */
	public async cancelSleepTimer(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/sleep`,
			options: { method: 'DELETE' }
		};
		await this.fetch(options);
	}

	/**
	 * Play the previous track from history
	 * @param guildId Guild ID
	 */
	public async playPrevious(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/previous`,
			options: { method: 'POST' }
		};
		await this.fetch(options);
	}

	/**
	 * Get player playback statistics
	 * @param guildId Guild ID
	 * @returns Promise that resolves to player stats
	 */
	public getPlayerStats(guildId: string): Promise<PlayerStats | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/stats`,
			options: {}
		};
		return this.fetch(options);
	}

	/**
	 * Create a new party hosted by the current player
	 * @param guildId Guild ID
	 * @returns Promise that resolves to the created party
	 */
	public createParty(guildId: string): Promise<PartyInfo | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/party/create`,
			options: { method: 'POST' }
		};
		return this.fetch<PartyInfo>(options).then(party => this.normalizePartyInfo(party));
	}

	/**
	 * Join an existing party
	 * @param guildId Guild ID
	 * @param partyId Party ID to join
	 * @returns Promise that resolves to the party info
	 */
	public joinParty(guildId: string, partyId: string): Promise<PartyInfo | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertNonEmptyString(partyId, 'partyId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/party/join`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { partyId }
			}
		};
		return this.fetch<PartyInfo>(options).then(party => this.normalizePartyInfo(party));
	}

	/**
	 * Leave the current party
	 * @param guildId Guild ID
	 */
	public async leaveParty(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/party`,
			options: { method: 'DELETE' }
		};
		await this.fetch(options);
	}

	/**
	 * Get party info for the current player
	 * @param guildId Guild ID
	 * @returns Promise that resolves to the party info or undefined if not in a party
	 */
	public getParty(guildId: string): Promise<PartyInfo | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/party`,
			options: {}
		};
		return this.fetch<PartyInfo>(options).then(party => this.normalizePartyInfo(party));
	}

	/**
	 * Enhanced health check
	 * @returns Promise that resolves to health status
	 */
	public healthCheck(): Promise<HealthResponse | undefined> {
		const options = {
			endpoint: '/health',
			options: {}
		};
		return this.fetch(options);
	}

	/**
	 * Get rate limit info
	 * @returns Promise that resolves to rate limit information
	 */
	public getRateLimits(): Promise<RateLimitInfo | undefined> {
		const options = {
			endpoint: '/info/limits',
			options: {}
		};
		return this.fetch(options);
	}

	/**
	 * Get guild usage statistics
	 * @param guildId Guild ID
	 * @returns Promise that resolves to guild stats
	 */
	public getGuildStats(guildId: string): Promise<GuildStats | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/stats/${guildId}`,
			options: {}
		};
		return this.fetch(options);
	}

	/**
	 * Get Lavalink info
	 */
	public getLavalinkInfo(): Promise<NodeInfo | undefined> {
		const options = {
			endpoint: '/info',
			options: {
				headers: { 'Content-Type': 'application/json' }
			}
		};
		return this.fetch(options);
	}

	/**
	 * Get queue
	 */
	public getQueue(guildId: string, page = 1, limit = 50): Promise<Queue | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertPagination(page, limit);
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue`,
			options: {
				params: { page: page.toString(), limit: limit.toString() }
			}
		};
		return this.fetch(options);
	}

	/**
	 * Add to queue
	 */
	public addQueue(guildId: string, tracks: Track[]): Promise<QueueResponse | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertQueueTracks(tracks);
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { tracks }
			}
		};
		return this.fetch<QueueResponse>(options);
	}

	/**
	 * Prepend to queue
	 */
	public prependQueue(guildId: string, tracks: Track[]): Promise<QueueResponse | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertQueueTracks(tracks);
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue/prepend`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { tracks }
			}
		};
		return this.fetch<QueueResponse>(options);
	}

	/**
	 * Clear queue
	 */
	public clearQueue(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue`,
			options: {
				method: 'DELETE'
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	/**
	 * Move track
	 */
	public moveQueue(guildId: string, from: number, to: number): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertNonNegativeInteger(from, 'from');
		this.assertNonNegativeInteger(to, 'to');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue/move`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { from, to }
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	/**
	 * Swap tracks
	 */
	public swapQueue(guildId: string, indexA: number, indexB: number): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertNonNegativeInteger(indexA, 'indexA');
		this.assertNonNegativeInteger(indexB, 'indexB');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue/swap`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { indexA, indexB }
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	/**
	 * Shuffle queue
	 */
	public shuffleQueue(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue/shuffle`,
			options: {
				method: 'POST'
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	/**
	 * Skip track
	 */
	public skipQueue(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue/skip`,
			options: {
				method: 'POST'
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	/**
	 * Remove range
	 */
	public removeQueue(guildId: string, start: number, end: number): Promise<QueueRemoveResponse | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertNonNegativeInteger(start, 'start');
		this.assertNonNegativeInteger(end, 'end');
		if (start > end) throw new RangeError('[Rest] start must be <= end');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue/range`,
			options: {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: { start, end }
			}
		};
		return this.fetch<QueueRemoveResponse>(options);
	}

	/**
	 * Get history
	 */
	public getHistory(guildId: string, page = 1, limit = 50): Promise<History | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertPagination(page, limit);
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/history`,
			options: {
				params: { page: page.toString(), limit: limit.toString() }
			}
		};
		return this.fetch(options);
	}

	/**
	 * Replay history
	 */
	public replayHistory(guildId: string, index: number, mode: HistoryReplayMode): Promise<LavalinkPlayer | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertNonNegativeInteger(index, 'index');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/history/replay`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { index, mode }
			}
		};
		return this.fetch<LavalinkPlayer>(options);
	}

	/**
	 * Clear history
	 */
	public clearHistory(guildId: string): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/history`,
			options: {
				method: 'DELETE'
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	/**
	 * Remove queue item by index
	 */
	public removeQueueItem(guildId: string, index: number): Promise<void> {
		this.assertNonEmptyString(guildId, 'guildId');
		this.assertNonNegativeInteger(index, 'index');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/queue/${index}`,
			options: {
				method: 'DELETE'
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	/**
	 * Set repeat mode
	 */
	public setRepeatMode(guildId: string, mode: 'off' | 'track' | 'queue'): Promise<LavalinkPlayer | undefined> {
		this.assertNonEmptyString(guildId, 'guildId');
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/repeat`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { mode }
			}
		};
		return this.fetch<LavalinkPlayer>(options);
	}

	/**
	 * Invalidate cache
	 */
	public invalidateCache(identifier: string): Promise<void> {
		this.assertNonEmptyString(identifier, 'identifier');
		const options = {
			endpoint: `/cache/${identifier}`,
			options: {
				method: 'DELETE'
			}
		};
		return this.fetch(options).then(() => undefined);
	}

	private normalizePartyInfo(party?: PartyInfo): PartyInfo | undefined {
		if (!party) return undefined;
		return {
			id: party.id ?? party.ID,
			hostGuildId: party.hostGuildId ?? party.HostGuildID,
			hostSessionId: party.hostSessionId ?? party.HostSessionID,
			members: party.members ?? party.Members ?? [],
			syncEnabled: party.syncEnabled ?? party.SyncEnabled ?? true
		};
	}

	private assertNonEmptyString(value: string, fieldName: string): void {
		if (typeof value !== 'string' || value.trim().length === 0)
			throw new TypeError(`[Rest] ${fieldName} must be a non-empty string`);
	}

	private assertNonNegativeInteger(value: number, fieldName: string): void {
		if (!Number.isInteger(value) || value < 0)
			throw new RangeError(`[Rest] ${fieldName} must be an integer >= 0`);
	}

	private assertPagination(page: number, limit: number): void {
		if (!Number.isInteger(page) || page < PAGINATION_MIN)
			throw new RangeError(`[Rest] page must be an integer >= ${PAGINATION_MIN}`);
		if (!Number.isInteger(limit) || limit < PAGINATION_MIN || limit > PAGINATION_LIMIT_MAX)
			throw new RangeError(`[Rest] limit must be an integer between ${PAGINATION_MIN} and ${PAGINATION_LIMIT_MAX}`);
	}

	private assertQueueTracks(tracks: Track[]): void {
		if (!Array.isArray(tracks) || tracks.length === 0)
			throw new TypeError('[Rest] tracks must be a non-empty array');
		if (tracks.length > QUEUE_BATCH_LIMIT)
			throw new RangeError(`[Rest] tracks length must be <= ${QUEUE_BATCH_LIMIT}`);
	}

	private assertUpdatePlayerPayload(data: UpdatePlayerInfo): void {
		this.assertNonEmptyString(data.guildId, 'guildId');
		const options = data.playerOptions;

		if (typeof options.volume === 'number' && (options.volume < MIN_PLAYER_VOLUME || options.volume > MAX_PLAYER_VOLUME))
			throw new RangeError(`[Rest] player volume must be between ${MIN_PLAYER_VOLUME} and ${MAX_PLAYER_VOLUME}`);

		if (typeof options.position === 'number' && options.position < 0)
			throw new RangeError('[Rest] position must be >= 0');

		if (typeof options.endTime === 'number' && options.endTime < 0)
			throw new RangeError('[Rest] endTime must be >= 0');

		if (options.filters?.volume !== undefined && (options.filters.volume < MIN_FILTER_VOLUME || options.filters.volume > MAX_FILTER_VOLUME))
			throw new RangeError(`[Rest] filter volume must be between ${MIN_FILTER_VOLUME} and ${MAX_FILTER_VOLUME}`);

		if (options.filters?.equalizer && options.filters.equalizer.length > MAX_EQUALIZER_BANDS)
			throw new RangeError(`[Rest] equalizer band count must be <= ${MAX_EQUALIZER_BANDS}`);
	}

	/**
	 * Make a request to Lavalink
	 * @param fetchOptions Options passed to fetch
	 * @throws `RestError` when encountering a Lavalink error response
	 * @internal
	 */
	protected async fetch<T = unknown>(fetchOptions: FetchOptions) {
		const { endpoint, options } = fetchOptions;
		let headers = {
			'Authorization': this.auth,
			'User-Agent': this.node.manager.options.userAgent
		};

		if (options.headers) headers = { ...headers, ...options.headers };

		const url = new URL(`${this.url}${endpoint}`);

		if (options.params) url.search = new URLSearchParams(options.params).toString();

		const abortController = new AbortController();
		const timeout = setTimeout(() => abortController.abort(), this.node.manager.options.restTimeout * 1000);

		const method = options.method?.toUpperCase() ?? 'GET';

		const finalFetchOptions: FinalFetchOptions = {
			method,
			headers,
			signal: abortController.signal
		};

		if (![ 'GET', 'HEAD' ].includes(method) && options.body)
			finalFetchOptions.body = JSON.stringify(options.body);

		const request = await fetch(url.toString(), finalFetchOptions)
			.finally(() => clearTimeout(timeout));

		if (!request.ok) {
			const response = await request
				.json()
				.catch(() => null) as LavalinkRestError | null;
			throw new RestError(response ?? {
				timestamp: Date.now(),
				status: request.status,
				error: 'Unknown Error',
				message: 'Unexpected error response from Lavalink server',
				path: endpoint
			});
		}
		try {
			// Handle 204 No Content
			if (request.status === 204) return;
			return await request.json() as T;
		} catch {
			return;
		}
	}
}

export interface LavalinkRestError {
	timestamp: number;
	status: number;
	error: string;
	trace?: string;
	message: string;
	path: string;
	retry_after?: number;
	retryAfter?: number;
}

export class RestError extends Error {
	public timestamp: number;
	public status: number;
	public error: string;
	public trace?: string;
	public path: string;
	public retryAfter?: number;
	public isUnauthorized: boolean;
	public isForbidden: boolean;
	public isRateLimited: boolean;

	constructor({ timestamp, status, error, trace, message, path, retry_after, retryAfter }: LavalinkRestError) {
		const hint = status === 403
			? ' | hint: guildAuthorization may require a voice update before player operations'
			: status === 429
				? ' | hint: rate limit exceeded'
				: '';
		super(`Rest request failed with response code: ${status}${message ? ` | message: ${message}` : ''}${hint}`);
		this.name = 'RestError';
		this.timestamp = timestamp;
		this.status = status;
		this.error = error;
		this.trace = trace;
		this.message = message;
		this.path = path;
		this.retryAfter = retryAfter ?? retry_after;
		this.isUnauthorized = status === 401;
		this.isForbidden = status === 403;
		this.isRateLimited = status === 429;
		Object.setPrototypeOf(this, new.target.prototype);
	}
}
