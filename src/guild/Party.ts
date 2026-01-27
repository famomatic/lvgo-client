import type { Node } from '../node/Node';
import type { PartyInfo as PartyData, PartyMember } from '../node/Rest';

/**
 * Represents a Listen Together party for synchronized playback across guilds
 */
export class Party {
	/**
	 * The party ID
	 */
	public readonly id: string;
	/**
	 * The guild ID of the party host
	 */
	public readonly hostGuildId: string;
	/**
	 * The session ID of the party host
	 */
	public readonly hostSessionId: string;
	/**
	 * Whether playback sync is enabled
	 */
	public syncEnabled: boolean;
	/**
	 * List of party members (excluding host)
	 */
	public members: PartyMember[];
	/**
	 * The node this party is managed through
	 */
	private readonly node: Node;
	/**
	 * The guild ID of the player that created/joined this party instance
	 */
	private readonly guildId: string;

	/**
	 * @param node The node managing this party
	 * @param guildId The guild ID of the player that created/joined this party
	 * @param data The party data from the API
	 */
	constructor(node: Node, guildId: string, data: PartyData) {
		this.node = node;
		this.guildId = guildId;
		this.id = data.id;
		this.hostGuildId = data.hostGuildId;
		this.hostSessionId = data.hostSessionId;
		this.syncEnabled = data.syncEnabled;
		this.members = data.members;
	}

	/**
	 * Whether the current player is the host of this party
	 */
	public get isHost(): boolean {
		return this.guildId === this.hostGuildId;
	}

	/**
	 * Total number of participants in the party (including host)
	 */
	public get size(): number {
		return this.members.length + 1;
	}

	/**
	 * Refresh the party data from the server
	 * @returns Promise that resolves to the updated party or undefined if no longer in party
	 */
	public async refresh(): Promise<Party | undefined> {
		const data = await this.node.rest.getParty(this.guildId);
		if (data) {
			this.syncEnabled = data.syncEnabled;
			this.members = data.members;
			return this;
		}
		return undefined;
	}

	/**
	 * Leave this party
	 * If the host leaves, the party will be disbanded
	 */
	public leave(): Promise<void> {
		return this.node.rest.leaveParty(this.guildId);
	}

	/**
	 * Create a Party instance from API data
	 * @param node The node managing this party
	 * @param guildId The guild ID of the player
	 * @param data The party data from the API
	 * @returns A new Party instance
	 */
	public static from(node: Node, guildId: string, data: PartyData): Party {
		return new Party(node, guildId, data);
	}
}
