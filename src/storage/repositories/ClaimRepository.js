const { getDb } = require('../db.js');

class ClaimRepository {
  constructor() {
    this.db = getDb();
  }

  createClaim(claim) {
    const stmt = this.db.prepare(`
      INSERT INTO claims (claimId, eventId, statement, status)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(claim.claimId, claim.eventId, claim.statement, claim.status || 'UNVERIFIED');

    if (claim.evidence && Array.isArray(claim.evidence)) {
      const evStmt = this.db.prepare(`
        INSERT INTO claim_evidence (claimId, sourceId, url, quote, context)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const ev of claim.evidence) {
        evStmt.run(claim.claimId, ev.sourceId || null, ev.url || null, ev.quote || null, ev.context || null);
      }
    }

    return this.getClaim(claim.claimId);
  }

  getClaim(claimId) {
    const claim = this.db.prepare('SELECT * FROM claims WHERE claimId = ?').get(claimId);
    if (!claim) return null;

    claim.evidence = this.db.prepare('SELECT * FROM claim_evidence WHERE claimId = ?').all(claimId);
    claim.contradictions = this.db.prepare('SELECT * FROM claim_contradictions WHERE claimId = ?').all(claimId);

    return claim;
  }

  getClaimsByEvent(eventId) {
    const claims = this.db.prepare('SELECT * FROM claims WHERE eventId = ?').all(eventId);
    return claims.map(c => this.getClaim(c.claimId));
  }

  updateClaimStatus(claimId, status) {
    this.db.prepare('UPDATE claims SET status = ? WHERE claimId = ?').run(status, claimId);
  }
}

module.exports = { ClaimRepository };
