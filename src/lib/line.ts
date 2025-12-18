/**
 * LINE Messaging API Client
 */

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LinePushMessageResponse {
  success: boolean;
  error?: string;
  sentMessages?: number;
}

export class LineMessagingClient {
  private channelAccessToken: string;
  private apiBaseUrl = 'https://api.line.me/v2/bot';

  constructor(channelAccessToken: string) {
    this.channelAccessToken = channelAccessToken;
  }

  /**
   * プッシュメッセージ送信
   */
  async pushMessage(
    lineUserId: string,
    message: string
  ): Promise<LinePushMessageResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/message/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [
            {
              type: 'text',
              text: message,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || 'Failed to send message',
        };
      }

      return {
        success: true,
        sentMessages: 1,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ユーザープロフィール取得
   */
  async getProfile(lineUserId: string): Promise<LineProfile | null> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/profile/${lineUserId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.channelAccessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        userId: data.userId,
        displayName: data.displayName,
        pictureUrl: data.pictureUrl,
        statusMessage: data.statusMessage,
      };
    } catch (error) {
      console.error('Failed to get LINE profile:', error);
      return null;
    }
  }

  /**
   * リプライメッセージ送信
   */
  async replyMessage(
    replyToken: string,
    message: string
  ): Promise<LinePushMessageResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/message/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: [
            {
              type: 'text',
              text: message,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || 'Failed to reply message',
        };
      }

      return {
        success: true,
        sentMessages: 1,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
