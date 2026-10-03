"""Real HTTP planning walkthrough for CI's isolated fresh Compose project.

Run only on a disposable, freshly seeded stack. Advances its scenario clock and saves/releases plans.
Uses standard-library HTTP so the Compose runner needs no backend dependencies.
"""

import json
import os
from urllib.request import Request, urlopen


def main():
    base = os.environ.get("ALLOCATION_SMOKE_URL", "http://localhost:8080") + "/api/v1"
    token = None

    def request(path, body=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = json.dumps(body).encode() if body is not None else None
        with urlopen(Request(base + path, data=data, headers=headers), timeout=30) as response:
            return json.load(response)

    token = request("/auth/login", {"email": "dispatcher@waypoint.demo", "password": os.environ.get("DEMO_PASSWORD", "waypoint-demo")})["accessToken"]
    request("/demo/advance", {"to": "2026-09-28T16:06:00+05:30"})
    original = request("/dispatcher/plan?depot=peliyagoda")
    assert original["version"]["number"] == 1
    request("/dispatcher/capacity?depot=peliyagoda")
    deferrals = request("/dispatcher/deferrals?depot=peliyagoda")
    assert any(row["orderId"] == "ORD1020" for row in deferrals["capacity"])
    redraft = request("/dispatcher/plan/redraft?depot=peliyagoda", {})
    assert redraft["version"]["number"] == 2
    order_id = next(oid for lane in redraft["lanes"] for trip in lane["trips"] for stop in trip["stops"]
                    if not stop["protected"] for oid in stop["orderIds"])
    move = {"orderId": order_id, "to": {"deferred": True}}
    assert request("/dispatcher/plan/validate-move", move)["ok"]
    adjusted = request("/dispatcher/plan/moves?depot=peliyagoda", {"moves": [move]})
    assert adjusted["version"]["number"] == 3
    released = request("/dispatcher/plan/release?depot=peliyagoda", {"sendNotices": True})
    assert released["version"]["state"] == "released" and released["readOnly"]
    print(json.dumps({"allocation_http_smoke": "passed", "initial_peliyagoda_deferrals": deferrals["counts"]["total"],
                      "versions": [original["version"]["number"], redraft["version"]["number"], released["version"]["number"]]}))


if __name__ == "__main__":
    main()
