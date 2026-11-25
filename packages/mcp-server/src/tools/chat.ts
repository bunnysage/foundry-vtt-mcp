import { z } from 'zod';
import { FoundryClient } from '../foundry-client.js';
import { Logger } from '../logger.js';

export interface ChatToolsOptions {
  foundryClient: FoundryClient;
  logger: Logger;
}

export class ChatTools {
  private foundryClient: FoundryClient;
  private logger: Logger;

  constructor({ foundryClient, logger }: ChatToolsOptions) {
    this.foundryClient = foundryClient;
    this.logger = logger.child({ component: 'ChatTools' });
  }

  getToolDefinitions() {
    return [
      {
        name: 'list-chat-messages',
        description:
          'Read recent messages from the Foundry chat log, oldest first: who spoke, the text, ' +
          'whisper recipients, and dice results (formula, total, each die). Use this after ' +
          'request-player-rolls to see what the player rolled, or to catch up on table chat.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'How many of the latest messages (default 20, max 100)',
            },
            rollsOnly: { type: 'boolean', description: 'Only messages that contain dice rolls' },
            speaker: {
              type: 'string',
              description: 'Only messages whose speaker or author name contains this text',
            },
          },
        },
      },
      {
        name: 'create-chat-message',
        description:
          'Speak an in-character line as an actor or a specific token: a floating speech ' +
          'bubble over the token (the default), a real chat-log message, or a whisper to ' +
          'named players. Pass a language to have Polyglot scramble a chat-log message for ' +
          "viewers who don't know it. With no actor or token and chatLog: true, the line is " +
          'posted to the chat log as the Gamemaster (narration). One call posts one line. Requires Allow Write ' +
          'Operations in the bridge module settings.',
        inputSchema: {
          type: 'object',
          properties: {
            actorIdentifier: {
              type: 'string',
              description:
                'Name or ID of the actor speaking (resolves world actors and scene tokens). ' +
                'Give this or tokenId.',
            },
            tokenId: {
              type: 'string',
              description:
                'ID of a specific token on the current scene. Prefer this over actorIdentifier ' +
                'when several tokens share one actor (guards, bandits), since a name lookup ' +
                'cannot tell them apart.',
            },
            content: {
              type: 'string',
              description:
                'The message text as plain text, in the language actually being spoken (not ' +
                'translated or bracketed). HTML is escaped and shows literally.',
            },
            language: {
              type: 'string',
              description:
                'Optional language key matching the game system\'s language list (e.g. "common", ' +
                '"necril"). With Polyglot active the line is tagged so it scrambles for viewers ' +
                "who don't know that language, on bubbles as well as chat-log messages. Without " +
                'Polyglot, Foundry has no notion of a spoken language, so the line plays as written ' +
                'and the result reports polyglotApplied: false.',
            },
            chatLog: {
              type: 'boolean',
              description:
                'Post a real chat-log message (which also shows its own bubble) instead of the ' +
                'default bubble-only delivery. Bubble-only requires the speaker to have a token ' +
                'on the current scene.',
            },
            whisperTo: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Optional player names or user IDs to whisper this line to. Each must be an exact ' +
                'user ID or exact name (case is ignored only when that finds a single user); if ' +
                'any one does not resolve, the call fails and nothing is sent. A whisper is always ' +
                'delivered as a chat-log message, since a bubble would be visible to everyone, so ' +
                'passing this implies chatLog: true.',
            },
          },
          required: ['content'],
        },
      },
    ];
  }

  async handleListChatMessages(args: any): Promise<any> {
    const parsed = z
      .object({
        limit: z.number().int().min(1).max(100).optional(),
        rollsOnly: z.boolean().optional(),
        speaker: z.string().optional(),
      })
      .parse(args ?? {});
    try {
      return await this.foundryClient.query('foundry-mcp-bridge.listChatMessages', parsed);
    } catch (error) {
      throw new Error(
        `Failed to list chat messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async handleCreateChatMessage(args: any): Promise<any> {
    const schema = z
      .object({
        actorIdentifier: z.string().optional(),
        tokenId: z.string().optional(),
        content: z.string().min(1),
        language: z.string().optional(),
        chatLog: z.boolean().optional(),
        whisperTo: z.array(z.string()).optional(),
      })
      .refine(v => v.actorIdentifier || v.tokenId || v.chatLog || v.whisperTo?.length, {
        message:
          'Either actorIdentifier or tokenId is required for a speech bubble. Pass chatLog: true to post to the chat log as the Gamemaster (narration).',
      });

    const parsed = schema.parse(args);

    this.logger.info('Creating chat message', {
      speaker: parsed.tokenId ?? parsed.actorIdentifier,
      whispered: !!parsed.whisperTo?.length,
    });

    try {
      const result = await this.foundryClient.query('foundry-mcp-bridge.createChatMessage', parsed);
      this.logger.debug('Chat message created', { result });
      return result;
    } catch (error) {
      this.logger.error('Failed to create chat message', { error });
      throw new Error(
        `Failed to create chat message for "${parsed.tokenId ?? parsed.actorIdentifier}": ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
