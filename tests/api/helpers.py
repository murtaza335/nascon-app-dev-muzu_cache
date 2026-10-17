"""Shared API test helpers."""
import uuid


def uid(prefix="x"):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


class Match:
    """Appends events to an existing match stream (league fixture or match_init)."""

    def __init__(self, api, match_id):
        self.api, self.match_id, self.n = api, match_id, 0

    def post(self, type_, payload=None, event_id=None):
        self.n += 1
        return self.api.post("/audit/v1/events", json={
            "event_id": event_id or f"{self.match_id}-e{self.n}-{uuid.uuid4().hex[:6]}", "match_id": self.match_id,
            "type": type_, "payload": payload or {}})

    def ok(self, type_, payload=None):
        r = self.post(type_, payload)
        assert r.status_code == 201, r.text
        return r.json()

    def play(self, home, away, hs, as_, event_type="goal", end=True):
        """Start, score hs for home and as_ for away, optionally end."""
        self.ok("match_start")
        for _ in range(hs):
            self.ok("score", {"team_id": home, "event_type": event_type})
        for _ in range(as_):
            self.ok("score", {"team_id": away, "event_type": event_type})
        if end:
            self.ok("match_end")
        return self


def make_league(api, teams, fixtures, league_id=None, **extra):
    lid = league_id or uid("lg")
    body = {
        "league_id": lid, "sport_id": extra.pop("sport_id", "football"), "teams": teams,
        "fixtures": [{"match_id": f"{lid}-{i}", "home": h, "away": a} for i, (h, a) in enumerate(fixtures)],
        "qualification": extra.pop("qualification", {"spots": 2}),
    }
    body.update(extra)
    r = api.post("/audit/v1/leagues", json=body)
    assert r.status_code == 201, r.text
    return lid, [f["match_id"] for f in body["fixtures"]]
