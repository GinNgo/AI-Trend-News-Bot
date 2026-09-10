class PlatformAdapter {
  constructor(platformName) {
    this.platformName = platformName;
  }

  async authenticate() {
    throw new Error('Not implemented');
  }

  async validateAccount() {
    throw new Error('Not implemented');
  }

  async validateMedia(mediaPath) {
    throw new Error('Not implemented');
  }

  async publish(publicationRecord) {
    throw new Error('Not implemented');
  }

  async getPublicationStatus(platformVideoId) {
    throw new Error('Not implemented');
  }
}

module.exports = { PlatformAdapter };
