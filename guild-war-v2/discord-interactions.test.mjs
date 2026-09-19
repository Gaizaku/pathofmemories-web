import test from "node:test";
import assert from "node:assert/strict";
import {findAnnouncementOwner} from "./discord-interactions.mjs";

test("button interaction resolves the organizer that owns its Discord message", async () => {
  const queried = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          queried.push({sql, values});
          return {
            async all() {
              return {
                results: [
                  {organizer_id: "old-organizer", event_ids_json: JSON.stringify(["E001", "E002", "E003", "E004"])},
                  {organizer_id: "gaizaku", event_ids_json: JSON.stringify(["E101", "E102", "E103", "E104"])},
                ],
              };
            },
          };
        },
      };
    },
  };

  const organizerId = await findAnnouncementOwner(db, "where-winds-meet", {
    channel_id: "channel-1",
    message: {id: "message-current"},
  }, ["E101", "E102", "E103", "E104"]);

  assert.equal(organizerId, "gaizaku");
  assert.deepEqual(queried[0].values, ["where-winds-meet", "channel-1", "message-current"]);
});
