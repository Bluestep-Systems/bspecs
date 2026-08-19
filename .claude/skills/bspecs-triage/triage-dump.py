#!/usr/bin/env python3
"""Dump AI.List to a local digest for a triage run.

Usage (from a scratch dir, e.g. .triage/):  python3 <path-to>/triage-dump.py

Writes:
  tasks.json   raw task list (all statuses, both pages)
  digest.json  flattened rows (id, status, tags, reporter, version, kind,
               resolution, note, desc, assignees, created/closed dates)
  index.txt    one line per ai-plugin task, grouped by status
  inbox.txt    full descriptions of the triage INPUT SET only
               (status == Open AND tag == ai-plugin)

Needs $CLICKUP_TOKEN (see CLAUDE.md "ClickUp (AI.List) via the REST API").
"""
import datetime
import json
import os
import urllib.request

LIST_ID = "901414350506"
TOKEN = os.environ["CLICKUP_TOKEN"]

STATUS_ORDER = {"Open": 0, "up next": 1, "in progress": 2, "blocked/waiting": 3,
                "git": 4, "check on 20": 5, "review/test": 6, "on-going": 7, "Closed": 8}


def fetch(page):
    url = ("https://api.clickup.com/api/v2/list/%s/task"
           "?include_closed=true&subtasks=true&page=%d" % (LIST_ID, page))
    req = urllib.request.Request(url, headers={"Authorization": TOKEN})
    return json.load(urllib.request.urlopen(req))


def cf(t, name):
    for f in t.get("custom_fields", []):
        if f["name"] != name:
            continue
        v = f.get("value")
        if v is None:
            return ""
        tc = f.get("type_config", {})
        if f["type"] == "drop_down":
            for o in tc.get("options", []):
                if o["id"] == v or o.get("orderindex") == v:
                    return o.get("name", "")
            return str(v)
        if f["type"] == "labels":
            ids = v if isinstance(v, list) else [v]
            return ",".join(o.get("label", "") for o in tc.get("options", []) if o["id"] in ids)
        return str(v)
    return ""


def d(ms):
    if not ms:
        return ""
    return datetime.datetime.fromtimestamp(int(ms) / 1000, datetime.timezone.utc).strftime("%Y-%m-%d")


tasks, page = [], 0
while True:
    r = fetch(page)
    tasks += r.get("tasks", [])
    if r.get("last_page", True) or not r.get("tasks"):
        break
    page += 1
json.dump(tasks, open("tasks.json", "w"))

rows = []
for t in tasks:
    rows.append(dict(
        id=t["id"], status=t["status"]["status"], name=t["name"],
        tags=",".join(x["name"] for x in t.get("tags", [])),
        assignees=",".join(a["username"] for a in t.get("assignees", [])),
        created=d(t.get("date_created")), closed=d(t.get("date_closed")),
        reporter=cf(t, "reporter"), version=cf(t, "Version"), kind=cf(t, "Kind"),
        target=cf(t, "Target"), resolution=cf(t, "resolution"),
        note=cf(t, "resolution-note"), desc=t.get("description") or "",
    ))
json.dump(rows, open("digest.json", "w"), indent=1)

plugin_rows = sorted((r for r in rows if "ai-plugin" in r["tags"]),
                     key=lambda r: (STATUS_ORDER.get(r["status"], 9), r["created"]))
with open("index.txt", "w") as f:
    for r in plugin_rows:
        mcp = " [MCP]" if "mcp" in r["tags"] else ""
        f.write("{} | {:<15} | {} | v{:<7} | {:<30} | {:<12}{} | {}\n".format(
            r["id"], r["status"], r["created"], r["version"] or "-",
            r["reporter"][:30], r["resolution"] or "-", mcp, r["name"][:100]))

inbox = [r for r in plugin_rows if r["status"] == "Open"]
with open("inbox.txt", "w") as f:
    for r in inbox:
        f.write("=" * 100 + "\n")
        f.write("ID: {} | CREATED: {} | PLUGIN v{}\n".format(r["id"], r["created"], r["version"] or "?"))
        f.write("REPORTER: {}\nKIND: {} | TARGET: {} | ASSIGNEES: {}\n".format(
            r["reporter"] or "(none)", r["kind"], r["target"], r["assignees"] or "(none)"))
        f.write("TITLE: {}\n".format(r["name"]))
        f.write("-" * 40 + " DESCRIPTION " + "-" * 40 + "\n")
        f.write(r["desc"].strip()[:3500] + ("\n...[TRUNCATED]" if len(r["desc"]) > 3500 else "") + "\n\n")

print("tasks: {} total | {} ai-plugin | {} in the Open inbox".format(
    len(rows), len(plugin_rows), len(inbox)))
print("wrote tasks.json, digest.json, index.txt, inbox.txt")
