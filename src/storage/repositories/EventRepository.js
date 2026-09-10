const { getDb } = require('../db.js');

class EventRepository {
  constructor() {
    this.db = getDb();
  }

  createEvent(event) {
    const stmt = this.db.prepare(`
      INSERT INTO events (
        eventId, canonicalTopic, entities, locations, startTime, status, importance, primarySourceId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.eventId,
      event.canonicalTopic || null,
      event.entities ? JSON.stringify(event.entities) : null,
      event.locations ? JSON.stringify(event.locations) : null,
      event.startTime || new Date().toISOString(),
      event.status || 'DETECTED',
      event.importance || 0.0,
      event.primarySourceId || null
    );

    return this.getEvent(event.eventId);
  }

  getEvent(eventId) {
    const row = this.db.prepare('SELECT * FROM events WHERE eventId = ?').get(eventId);
    if (row) {
      if (row.entities) row.entities = JSON.parse(row.entities);
      if (row.locations) row.locations = JSON.parse(row.locations);
    }
    return row;
  }

  addEventTimeline(eventId, timestamp, description, sourceId = null) {
    this.db.prepare(`
      INSERT INTO event_timeline (eventId, timestamp, eventDescription, sourceId)
      VALUES (?, ?, ?, ?)
    `).run(eventId, timestamp, description, sourceId);
  }
}

module.exports = { EventRepository };
