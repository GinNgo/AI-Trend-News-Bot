const { PlatformAdapter } = require('../adapters/platform_adapter.js');
const logger = require('../../collector/utils/logger.js');

class MockProvider extends PlatformAdapter {
  constructor(platformName = 'mock') {
    super(platformName);
  }

  async authenticate() {
    return true;
  }

  async validateAccount() {
    return true;
  }

  async validateMedia(mediaPath) {
    return true;
  }

  async publish(publicationRecord) {
    logger.info(`[MockProvider] Simulated publication for platform ${this.platformName}`);
    return {
      platformVideoId: `mock-${this.platformName}-${Date.now()}`,
      url: `https://${this.platformName}.com/video/mock-${Date.now()}`
    };
  }

  async getPublicationStatus(platformVideoId) {
    return { status: 'PUBLISHED' };
  }
}

module.exports = { MockProvider };
