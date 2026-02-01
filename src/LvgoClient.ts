import { LvgoClientDefaults, VoiceState } from './Constants';
import { Node } from './node/Node';
import { Connector } from './connectors/Connector';
import { Constructor, mergeDefault, TypedEventEmitter } from './Utils';
import { FilterOptions, Player } from './guild/Player';
import { Rest } from './node/Rest';
import { Connection } from './guild/Connection';

export interface Structures {
	/**
     * A custom structure that extends the Rest class
     */
	rest?: Constructor<Rest>;
	/**
     * A custom structure that extends the Player class
     */
	player?: Constructor<Player>;
}

export interface NodeOption {
	/**
     * Name of the Lavalink node
     */
	name: string;
	/**
     * Lavalink node host and port without any prefix
     */
	url: string;
	/**
     * Credentials to access Lavalink
     */
	auth: string;
	/**
     * Whether to use secure protocols or not
     */
	secure?: boolean;
	/**
     * Name of the Lavalink node group
     */
	group?: string;
}

export interface LvgoClientOptions {
	/**
     * Whether to resume a connection on disconnect to Lavalink (Server Side) (Note: DOES NOT RESUME WHEN THE LAVALINK SERVER DIES)
     */
	resume?: boolean;
	/**
     * Time to wait before lavalink starts to destroy the players of the disconnected client
     */
	resumeTimeout?: number;
	/**
     * Whether to resume the players by doing it in the library side (Client Side) (Note: TRIES TO RESUME REGARDLESS OF WHAT HAPPENED ON A LAVALINK SERVER)
     */
	resumeByLibrary?: boolean;
	/**
     * Number of times to try and reconnect to Lavalink before giving up
     */
	reconnectTries?: number;
	/**
     * Timeout before trying to reconnect
     */
	reconnectInterval?: number;
	/**
     * Time to wait for a response from the Lavalink REST API before giving up
     */
	restTimeout?: number;
	/**
     * Whether to move players to a different Lavalink node when a node disconnects
     */
	moveOnDisconnect?: boolean;
	/**
     * User Agent to use when making requests to Lavalink
     */
	userAgent?: string;
	/**
     * Custom structures for shoukaku to use
     */
	structures?: Structures;
	/**
     * Timeout before abort connection
     */
	voiceConnectionTimeout?: number;
	/**
     * Node Resolver to use if you want to customize it
     */
	nodeResolver?: (nodes: Map<string, Node>, connection?: Connection) => Node | undefined;
}

export interface VoiceChannelOptions {
	/**
	 * GuildId in which the ChannelId of the voice channel is located
	 */
	guildId: string;
	/**
	 * ShardId to track where this should send on sharded websockets, put 0 if you are unsharded
	 */
	shardId: number;
	/**
	 * ChannelId of the voice channel you want to connect to
	 */
	channelId: string;
	/**
	 * Optional boolean value to specify whether to deafen or undeafen the current bot user
	 */
	deaf?: boolean;
	/**
	 * Optional boolean value to specify whether to mute or unmute the current bot user
	 */
	mute?: boolean;
}

/**
 * Options for resuming a single session with full Voice Connection restoration
 */
export interface ResumeSessionOptions {
	/**
	 * GuildId of the session
	 */
	guildId: string;
	/**
	 * ChannelId of the voice channel to join
	 */
	channelId: string;
	/**
	 * ShardId for the websocket
	 */
	shardId: number;
	/**
	 * Player state to restore
	 */
	playerState?: {
		track?: string | null;
		position?: number;
		paused?: boolean;
		volume?: number;
		filters?: FilterOptions;
	};
	/**
	 * Whether to deafen the bot
	 */
	deaf?: boolean;
	/**
	 * Whether to mute the bot
	 */
	mute?: boolean;
}

/**
 * Serialized session data for export/import functionality
 */
export interface SerializedSession {
	/**
	 * GuildId of the session
	 */
	guildId: string;
	/**
	 * ChannelId of the voice channel
	 */
	channelId: string;
	/**
	 * ShardId for the websocket
	 */
	shardId: number;
	/**
	 * Node name this player was connected to
	 */
	nodeName: string;
	/**
	 * Player state
	 */
	player: {
		track: string | null;
		position: number;
		paused: boolean;
		volume: number;
		filters: FilterOptions;
		partyId: string | null;
	};
	/**
	 * Connection state
	 */
	connection: {
		deaf: boolean;
		mute: boolean;
		sessionId: string | null;
		region: string | null;
	};
}

// Interfaces are not final, but types are, and therefore has an index signature
// https://stackoverflow.com/a/64970740
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type LvgoClientEvents = {
	/**
     * Emitted when reconnect tries are occurring and how many tries are left
     * @eventProperty
     */
	'reconnecting': [name: string, reconnectsLeft: number, reconnectInterval: number];
	/**
     * Emitted when data useful for debugging is produced
     * @eventProperty
     */
	'debug': [name: string, info: string];
	/**
     * Emitted when an error occurs
     * @eventProperty
     */
	'error': [name: string, error: Error];
	/**
     * Emitted when Shoukaku is ready to receive operations
     * @eventProperty
     */
	'ready': [name: string, lavalinkResume: boolean, libraryResume: boolean];
	/**
     * Emitted when a websocket connection to Lavalink closes
     * @eventProperty
     */
	'close': [name: string, code: number, reason: string];
	/**
     * Emitted when a websocket connection to Lavalink disconnects
     * @eventProperty
     */
	'disconnect': [name: string, count: number];
	/**
     * Emitted when a raw message is received from Lavalink
     * @eventProperty
     */
	'raw': [name: string, json: unknown];
	/**
	 * Emitted when a session is successfully resumed
	 * @eventProperty
	 */
	'sessionResumed': [guildId: string, player: Player];
	/**
	 * Emitted when a session resume fails
	 * @eventProperty
	 */
	'sessionResumeFailed': [guildId: string, error: Error];
};

/**
 * Main LvgoClient class
 */
export class LvgoClient extends TypedEventEmitter<LvgoClientEvents> {
	/**
     * Discord library connector
     */
	public readonly connector: Connector;
	/**
     * LvgoClient options
     */
	public readonly options: Required<LvgoClientOptions>;
	/**
     * Connected Lavalink nodes
     */
	public readonly nodes: Map<string, Node>;
	/**
     * Voice connections being handled
     */
	public readonly connections: Map<string, Connection>;
	/**
     * Players being handled
     */
	public readonly players: Map<string, Player>;
	/**
     * LvgoClient instance identifier
     */
	public id: string | null;
	/**
     * @param connector A Discord library connector
     * @param nodes An array that conforms to the NodeOption type that specifies nodes to connect to
     * @param options Options to pass to create this LvgoClient instance
     */
	constructor(connector: Connector, nodes: NodeOption[], options: LvgoClientOptions = {}) {
		super();
		this.connector = connector.set(this);
		this.options = mergeDefault<LvgoClientOptions>(LvgoClientDefaults, options);
		this.nodes = new Map();
		this.connections = new Map();
		this.players = new Map();
		this.id = null;
		this.connector.listen(nodes);
	}

	/**
     * Gets an ideal node based on the nodeResolver you provided
     * @param connection Optional connection class for ideal node selection, if you use it
     * @returns An ideal node for you to do things with
     */
	public getIdealNode(connection?: Connection): Node | undefined {
		return this.options.nodeResolver(this.nodes, connection);
	}

	/**
     * Add a Lavalink node to the pool of available nodes
     * @param options Options to create the node
     */
	public addNode(options: NodeOption): void {
		const node = new Node(this, options);
		node.on('debug', (...args) => this.emit('debug', node.name, ...args));
		node.on('reconnecting', (...args) => this.emit('reconnecting', node.name, ...args));
		node.on('error', (...args) => this.emit('error', node.name, ...args));
		node.on('close', (...args) => this.emit('close', node.name, ...args));
		node.on('ready', (...args) => this.emit('ready', node.name, ...args));
		node.on('raw', (...args) => this.emit('raw', node.name, ...args));
		node.once('disconnect', () => this.nodes.delete(node.name));
		node.connect().catch((error) => this.emit('error', node.name, error as Error));
		this.nodes.set(node.name, node);
	}

	/**
     * Remove a Lavalink node from the pool of available nodes
     * @param name Name of the node
     * @param reason Reason of removing the node
     */
	public removeNode(name: string, reason = 'Remove node executed'): void {
		const node = this.nodes.get(name);
		if (!node) throw new Error('The node name you specified doesn\'t exist');
		node.disconnect(1000, reason);
		this.nodes.delete(name);
	}

	/**
     * Joins a voice channel
     * @param options Options to join a voice channel
     * @returns The created player
     */
	public async joinVoiceChannel(options: VoiceChannelOptions): Promise<Player> {
		if (this.connections.has(options.guildId))
			throw new Error('This guild already have an existing connection');
		const connection = new Connection(this, options);
		this.connections.set(connection.guildId, connection);
		try {
			await connection.connect();
		} catch (error) {
			this.connections.delete(options.guildId);
			throw error;
		}
		try {
			const node = this.getIdealNode(connection);
			if (!node)
				throw new Error('Can\'t find any nodes to connect on');
			const player = this.options.structures.player ? new this.options.structures.player(connection.guildId, node) : new Player(connection.guildId, node);
			const onUpdate = (state: VoiceState) => {
				if (state !== VoiceState.SESSION_READY) return;
				void player.sendServerUpdate(connection);
			};
			await player.sendServerUpdate(connection);
			connection.on('connectionUpdate', onUpdate);
			this.players.set(player.guildId, player);
			return player;
		} catch (error) {
			connection.disconnect();
			this.connections.delete(options.guildId);
			throw error;
		}
	}

	/**
     * Leaves a voice channel
     * @param guildId The id of the guild you want to delete
     * @returns The destroyed / disconnected player or undefined if none
     */
	public async leaveVoiceChannel(guildId: string): Promise<void> {
		const connection = this.connections.get(guildId);
		if (connection) {
			connection.disconnect();
			this.connections.delete(guildId);
		}
		const player = this.players.get(guildId);
		if (player) {
			try {
				await player.destroy();
			} catch { /* empty */ }
			player.clean();
			this.players.delete(guildId);
		}
	}

	/**
	 * Resume sessions with full Voice Connection and Player restoration
	 * @param sessions Array of session options to resume
	 * @returns Promise that resolves to an array of resumed players
	 */
	public async resumeSessions(sessions: ResumeSessionOptions[]): Promise<Player[]> {
		const resumedPlayers: Player[] = [];

		for (const session of sessions) {
			try {
				// Skip if already connected
				if (this.connections.has(session.guildId)) {
					this.emit('debug', 'LvgoClient', `[Resume] Guild ${session.guildId} already has a connection, skipping`);
					continue;
				}

				// 1. Create Connection and join voice channel
				const connection = new Connection(this, {
					guildId: session.guildId,
					channelId: session.channelId,
					shardId: session.shardId,
					deaf: session.deaf,
					mute: session.mute
				});
				this.connections.set(session.guildId, connection);

				try {
					await connection.connect();
				} catch (error) {
					this.connections.delete(session.guildId);
					this.emit('sessionResumeFailed', session.guildId, error as Error);
					continue;
				}

				// 2. Get ideal node and create Player
				const node = this.getIdealNode(connection);
				if (!node) {
					connection.disconnect();
					this.connections.delete(session.guildId);
					this.emit('sessionResumeFailed', session.guildId, new Error('No available nodes'));
					continue;
				}

				const player = this.options.structures.player
					? new this.options.structures.player(session.guildId, node)
					: new Player(session.guildId, node);

				// 3. Setup connection update listener
				const onUpdate = (state: VoiceState) => {
					if (state !== VoiceState.SESSION_READY) return;
					void player.sendServerUpdate(connection);
				};
				connection.on('connectionUpdate', onUpdate);

				// 4. Send initial server update to Lavalink
				await player.sendServerUpdate(connection);
				this.players.set(player.guildId, player);

				// 5. Restore player state if provided
				if (session.playerState) {
					const { track, position, paused, volume, filters } = session.playerState;
					await player.update({
						track: track !== undefined ? { encoded: track } : undefined,
						position,
						paused,
						volume,
						filters
					});
				}

				resumedPlayers.push(player);
				this.emit('sessionResumed', session.guildId, player);
				this.emit('debug', 'LvgoClient', `[Resume] Successfully resumed session for guild ${session.guildId}`);

			} catch (error) {
				this.emit('sessionResumeFailed', session.guildId, error as Error);
				this.emit('error', 'LvgoClient', error as Error);
			}
		}

		return resumedPlayers;
	}

	/**
	 * Export all active sessions as serializable data
	 * Useful for persisting session state before shutdown
	 * @returns Array of serialized session data
	 */
	public exportSessions(): SerializedSession[] {
		const sessions: SerializedSession[] = [];

		for (const [guildId, player] of this.players) {
			const connection = this.connections.get(guildId);
			if (!connection || !connection.channelId) continue;

			sessions.push({
				guildId,
				channelId: connection.channelId,
				shardId: connection.shardId,
				nodeName: player.node.name,
				player: {
					track: player.track,
					position: player.position,
					paused: player.paused,
					volume: player.volume,
					filters: { ...player.filters },
					partyId: player.partyId
				},
				connection: {
					deaf: connection.deafened,
					mute: connection.muted,
					sessionId: connection.sessionId,
					region: connection.region
				}
			});
		}

		return sessions;
	}

	/**
	 * Import and resume previously exported sessions
	 * @param sessions Array of serialized session data from exportSessions()
	 * @param options Import options
	 * @returns Promise that resolves to array of resumed players
	 */
	public async importSessions(
		sessions: SerializedSession[],
		options: { preferOriginalNode?: boolean } = {}
	): Promise<Player[]> {
		const resumeOptions: ResumeSessionOptions[] = sessions.map(session => ({
			guildId: session.guildId,
			channelId: session.channelId,
			shardId: session.shardId,
			deaf: session.connection.deaf,
			mute: session.connection.mute,
			playerState: {
				track: session.player.track,
				position: session.player.position,
				paused: session.player.paused,
				volume: session.player.volume,
				filters: session.player.filters
			}
		}));

		return this.resumeSessions(resumeOptions);
	}
}
