import type { FilterOptions } from '../guild/Player';
import type { NodeOption } from '../LvgoClient';
import type { Node, NodeInfo, Stats } from './Node';

export type Severity = 'common' | 'suspicious' | 'fault';

export enum LoadType {
	TRACK = 'TRACK',
	PLAYLIST = 'PLAYLIST',
	SEARCH = 'SEARCH',
	EMPTY = 'EMPTY',
	ERROR = 'ERROR'
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
	type: LoadType;
	playlistName?: string;
	exception?: Exception;
	tracks: Track[];
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
		sys: number;
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
	id: string;
	hostGuildId: string;
	hostSessionId: string;
	members: PartyMember[];
	syncEnabled: boolean;
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
	resumingKey?: string;
	timeout: number;
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
	remaining: number;
}

export interface HistoryReplayResponse {
	track: Track;
	position: string;
}

export interface History {
	total: number;
	tracks: ({ endTime: number } & Track)[];
	endTime: number;
}

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
		body?: Record<string, unknown>;
		[key: string]: unknown;
	};
}

interface FinalFetchOptions {
	method: string;
	headers: Record<string, string>;
	signal: AbortSignal;
	body?: string;
}

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
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/seek`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { position }
			}
		};
		return this.fetch(options);
	}

	/**
	 * Set auto-shuffle mode
	 * @param guildId Guild ID
	 * @param enabled Whether to enable auto-shuffle
	 */
	public async setAutoShuffle(guildId: string, enabled: boolean): Promise<void> {
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
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/party/create`,
			options: { method: 'POST' }
		};
		return this.fetch(options);
	}

	/**
	 * Join an existing party
	 * @param guildId Guild ID
	 * @param partyId Party ID to join
	 * @returns Promise that resolves to the party info
	 */
	public joinParty(guildId: string, partyId: string): Promise<PartyInfo | undefined> {
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/party/join`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { partyId }
			}
		};
		return this.fetch(options);
	}

	/**
	 * Leave the current party
	 * @param guildId Guild ID
	 */
	public async leaveParty(guildId: string): Promise<void> {
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
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/party`,
			options: {}
		};
		return this.fetch(options);
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
	 * Move track
	 */
	public moveQueue(guildId: string, from: number, to: number): Promise<void> {
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
	 * Skip track
	 */
	public skipQueue(guildId: string): Promise<void> {
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
	public replayHistory(guildId: string, index: number, mode: 'play' | 'queue' | 'next'): Promise<HistoryReplayResponse | undefined> {
		const options = {
			endpoint: `/sessions/${this.sessionId}/players/${guildId}/history/replay`,
			options: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: { index, mode }
			}
		};
		return this.fetch<HistoryReplayResponse>(options);
	}

	/**
	 * Clear history
	 */
	public clearHistory(guildId: string): Promise<void> {
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
	public invalidateCache(identifier: string, scope: 'metadata' | 'content' | 'all'): Promise<void> {
		const options = {
			endpoint: `/cache/${identifier}`,
			options: {
				method: 'DELETE',
				params: { scope }
			}
		};
		return this.fetch(options).then(() => undefined);
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
}

export class RestError extends Error {
	public timestamp: number;
	public status: number;
	public error: string;
	public trace?: string;
	public path: string;

	constructor({ timestamp, status, error, trace, message, path }: LavalinkRestError) {
		super(`Rest request failed with response code: ${status}${message ? ` | message: ${message}` : ''}`);
		this.name = 'RestError';
		this.timestamp = timestamp;
		this.status = status;
		this.error = error;
		this.trace = trace;
		this.message = message;
		this.path = path;
		Object.setPrototypeOf(this, new.target.prototype);
	}
}
