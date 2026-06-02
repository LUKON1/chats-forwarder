// Abstract Base class for platform adapters. All platform-specific adapters must extend this class.
export class BaseAdapter {
  constructor(platformName) {
    this.platform = platformName;
  }

  // Parses incoming message event from webhook into a unified format
  async parseMessage(ctx) {
    throw new Error(`parseMessage not implemented for platform ${this.platform}`);
  }

  // Sends plain text message to a specific chat/channel
  async sendMessage(chatId, text, options = {}) {
    throw new Error(`sendMessage not implemented for platform ${this.platform}`);
  }

  // Sends a single photo to a specific chat/channel
  async sendPhoto(chatId, url, caption) {
    throw new Error(`sendPhoto not implemented for platform ${this.platform}`);
  }

  // Sends an array of photos as a single media group (album)
  async sendMediaGroup(chatId, urls, caption) {
    throw new Error(`sendMediaGroup not implemented for platform ${this.platform}`);
  }

  // Sends a document to a specific chat/channel
  async sendDocument(chatId, url, filename, caption) {
    throw new Error(`sendDocument not implemented for platform ${this.platform}`);
  }

  // Sends a voice message to a specific chat/channel
  async sendVoice(chatId, url) {
    throw new Error(`sendVoice not implemented for platform ${this.platform}`);
  }

  // Downloads a file from the platform storage and returns a ReadableStream
  async downloadFileStream(fileIdOrUrl) {
    throw new Error(`downloadFileStream not implemented for platform ${this.platform}`);
  }

  // Handles incoming HTTP webhook requests from the platform
  async handleWebhook(req) {
    throw new Error(`handleWebhook not implemented for platform ${this.platform}`);
  }
}
