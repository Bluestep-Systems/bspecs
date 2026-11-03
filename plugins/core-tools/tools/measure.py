#!/usr/bin/env python3
"""Measure Claude Code token/context usage from local transcripts.

Reads ~/.claude/projects/**/*.jsonl and reports where context tokens actually go:
session-start baseline, context per request, session length, tool mix, repeat reads,
cache economics (in tokens and price-weighted), a quality signal, and a counterfactual
replay of context-cap / baseline / growth policies.

Nothing is sent anywhere; this only reads local files.

Usage:
    python tools/measure.py --since 2026-08-10        # pin the date for a recorded row
    python tools/measure.py --since 7d
    python tools/measure.py --root /path/to/.claude/projects
    python tools/measure.py --since 2026-08-10 --routine-marker fix-agent-routine.md

Correctness notes (see .claude/specs/agent-workflow-efficiency/REVIEW.md, 2026-09-09):
  * The transcript writes one record per content block, so a single API response appears
    ~2.4 times, each carrying the same `usage`. This script dedupes by (file, requestId).
  * Sessions are reported in three groups: MAIN (interactive), SUB (subagent transcripts,
    under a `subagents/` folder) and ROUTINE (main sessions whose first Read is the file
    named by --routine-marker; an automated job). Mixing them hides what matters.
  * A repeat read is the same (path, offset, limit) read twice in one session with no
    Edit/Write to that path in between. Keying by path alone counts ranged reads of a big
    file as re-reads and was wrong by a factor of ~30.
  * `<synthetic>` records are API errors/retries with zero context; they are excluded from
    model tables and model-switch detection.
  * The headline is PRICE-WEIGHTED (cache reads 0.1x, cache writes 1.25x, output 1x,
    plain input 1x), because that is the unit plan usage is drawn in. Raw context tokens
    are still printed.
  * Every section header carries the span actually measured.
"""

import argparse
import collections
import datetime
import json
import os
import re
import sys

DEFAULT_ROOT = os.path.join(os.path.expanduser("~"), ".claude", "projects")
READ_W, WRITE_W = 0.1, 1.25

# Heuristic for "a check failed" (criterion 9). Documented, not perfect.
FAIL_RE = re.compile(r"(FAILED|\bFAIL\b|Exit code [1-9]\d*|Error:|error\[|npm ERR!|Traceback \(most recent|"
                     r"\bpassed=\d+ failed=[1-9])")


def parse_since(s):
    m = re.fullmatch(r"(\d+)d", s)
    if m:
        return datetime.datetime.now() - datetime.timedelta(days=int(m.group(1)))
    return datetime.datetime.strptime(s, "%Y-%m-%d")


def fmt(n):
    n = float(n)
    for unit in ("", "K", "M", "B"):
        if abs(n) < 1000:
            return "%.1f%s" % (n, unit)
        n /= 1000
    return "%.1fT" % n


def pct(a, b):
    return 100.0 * a / max(b, 1)


def median(lst):
    if not lst:
        return 0
    s = sorted(lst)
    return s[len(s) // 2]


def quantile(lst, q):
    if not lst:
        return 0
    s = sorted(lst)
    return s[min(int(len(s) * q), len(s) - 1)]


def ts(s):
    try:
        return datetime.datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


GAP_BUCKETS = [(0, 1, "< 1 min"), (1, 5, "1-5 min"), (5, 15, "5-15 min"),
               (15, 60, "15-60 min"), (60, 300, "1-5 h"), (300, 1440, "5-24 h"),
               (1440, float("inf"), "> 24 h")]


def gap_bucket(mins):
    for lo, hi, _label in GAP_BUCKETS:
        if lo <= mins < hi:
            return lo
    return 1440


def walk(root):
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn.endswith(".jsonl"):
                yield os.path.join(dirpath, fn)


class Session(object):
    __slots__ = ("proj", "path", "kind", "reqs", "reads", "edits", "read_events", "fails",
                 "edit_seq", "branch_points", "first_read")

    def __init__(self, proj, path, kind):
        self.proj = proj
        self.path = path
        self.kind = kind            # MAIN / SUB / ROUTINE (ROUTINE decided after parse)
        self.reqs = []              # dicts per deduped request, in file order
        self.reads = collections.Counter()      # (path, offset, limit) -> count
        self.edits = collections.defaultdict(list)   # path -> [seq]
        self.read_events = collections.defaultdict(list)  # (path, off, lim) -> [seq]
        self.fails = []             # seq numbers where a check failed
        self.edit_seq = []          # (seq, path) for Edit/Write in order
        self.branch_points = 0
        self.first_read = None


def collect(root, since, routine_marker):
    st = {
        "files": 0, "records": 0, "dupes": 0, "skipped_old": 0,
        "span_lo": None, "span_hi": None,
        "sessions": [],
        "tools": collections.Counter(), "res_bytes": collections.Counter(), "res_count": collections.Counter(),
        "bash_heads": collections.Counter(),
        "skills": collections.Counter(), "agents": collections.Counter(),
        "hooks": collections.Counter(), "hook_stderr": collections.Counter(),
        "attach_n": collections.Counter(), "attach_b": collections.Counter(),
        "reads_all": collections.Counter(),     # path -> count (for the "most read" list)
        "read_bytes": collections.Counter(),    # whole vs ranged
        "read_calls": collections.Counter(),
        "big_reads": 0, "big_results": 0,
    }

    for path in walk(root):
        try:
            if datetime.datetime.fromtimestamp(os.path.getmtime(path)) < since:
                continue
        except OSError:
            continue
        rel = os.path.relpath(path, root)
        proj = rel.split(os.sep)[0]
        kind = "SUB" if "subagents" in rel else "MAIN"
        sess = Session(proj, path, kind)
        st["files"] += 1
        seen = set()
        idmap = {}
        children = collections.Counter()   # parentUuid -> assistant children (rewind proxy)
        seq = 0
        try:
            fh = open(path, "r", encoding="utf-8", errors="replace")
        except OSError:
            continue
        with fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                rtype = rec.get("type")
                rec_t = ts(rec.get("timestamp") or "")
                if rec_t is not None:
                    if rec_t < since:
                        st["skipped_old"] += 1
                        continue
                    if st["span_lo"] is None or rec_t < st["span_lo"]:
                        st["span_lo"] = rec_t
                    if st["span_hi"] is None or rec_t > st["span_hi"]:
                        st["span_hi"] = rec_t
                st["records"] += 1

                att = rec.get("attachment")
                if isinstance(att, dict):
                    size = len(json.dumps(att))
                    st["attach_n"][att.get("type", "?")] += 1
                    st["attach_b"][att.get("type", "?")] += size
                    if att.get("type") == "hook_success":
                        key = str(att.get("hookName") or "?")[:40]
                        st["hooks"][key] += 1
                        err = (att.get("stderr") or "").strip()
                        if err:
                            st["hook_stderr"][re.sub(r"^.*?/hooks/", "", err)[:70]] += 1

                if rtype == "assistant":
                    msg = rec.get("message") or {}
                    usage = msg.get("usage") or {}
                    model = msg.get("model", "?")
                    rid = rec.get("requestId") or msg.get("id")
                    if rec.get("parentUuid"):
                        children[rec["parentUuid"]] += 1
                    if rid and rid not in seen:
                        seen.add(rid)
                        cc = usage.get("cache_creation") or {}
                        seq += 1
                        sess.reqs.append({
                            "t": rec_t, "seq": seq, "model": model,
                            "in": usage.get("input_tokens", 0),
                            "cw": usage.get("cache_creation_input_tokens", 0),
                            "cr": usage.get("cache_read_input_tokens", 0),
                            "out": usage.get("output_tokens", 0),
                            "w1h": cc.get("ephemeral_1h_input_tokens", 0),
                            "w5m": cc.get("ephemeral_5m_input_tokens", 0),
                            "ntools": 0,
                        })
                    elif rid:
                        st["dupes"] += 1
                    for blk in msg.get("content") or []:
                        if not isinstance(blk, dict) or blk.get("type") != "tool_use":
                            continue
                        name = blk.get("name", "?")
                        inp = blk.get("input") or {}
                        idmap[blk.get("id")] = (name, inp)
                        st["tools"][name] += 1
                        if sess.reqs and rid == (rec.get("requestId") or msg.get("id")):
                            sess.reqs[-1]["ntools"] += 1
                        if name in ("Bash", "PowerShell"):
                            cmd = (inp.get("command") or "").strip().lstrip("( ")
                            st["bash_heads"][re.split(r"[\s|;&]", cmd, maxsplit=1)[0]] += 1
                        elif name == "Read":
                            fp = inp.get("file_path", "?")
                            key = (fp, inp.get("offset"), inp.get("limit"))
                            sess.reads[key] += 1
                            sess.read_events[key].append(seq)
                            st["reads_all"][fp] += 1
                            if sess.first_read is None:
                                sess.first_read = fp
                            ranged = "ranged" if (inp.get("offset") or inp.get("limit")) else "whole"
                            st["read_calls"][ranged] += 1
                            idmap[blk.get("id")] = (name, dict(inp, _ranged=ranged))
                        elif name in ("Edit", "Write", "NotebookEdit"):
                            fp = inp.get("file_path", "?")
                            sess.edits[fp].append(seq)
                            sess.edit_seq.append((seq, fp))
                        elif name == "Skill":
                            st["skills"][inp.get("skill", "?")] += 1
                        elif name in ("Agent", "Task"):
                            st["agents"][inp.get("subagent_type", "default")] += 1

                elif rtype == "user":
                    content = (rec.get("message") or {}).get("content")
                    if isinstance(content, list):
                        for blk in content:
                            if not isinstance(blk, dict) or blk.get("type") != "tool_result":
                                continue
                            name, inp = idmap.get(blk.get("tool_use_id"), ("?", {}))
                            body = blk.get("content")
                            try:
                                size = len(json.dumps(body)) if body is not None else 0
                            except (TypeError, ValueError):
                                size = 0
                            st["res_bytes"][name] += size
                            st["res_count"][name] += 1
                            if size > 25000:
                                st["big_results"] += 1
                            if name == "Read":
                                st["read_bytes"][inp.get("_ranged", "whole")] += size
                                if inp.get("_ranged") == "whole" and size > 25000:
                                    st["big_reads"] += 1
                            failed = bool(blk.get("is_error"))
                            if not failed and name in ("Bash", "PowerShell"):
                                text = body if isinstance(body, str) else json.dumps(body)
                                failed = bool(FAIL_RE.search(text[:4000]))
                            if failed:
                                sess.fails.append(seq)

        if not sess.reqs:
            continue
        sess.branch_points = sum(1 for v in children.values() if v > 1)
        if sess.kind == "MAIN" and routine_marker and sess.first_read and routine_marker in sess.first_read:
            sess.kind = "ROUTINE"
        st["sessions"].append(sess)
    return st


def ctx_of(q):
    return q["in"] + q["cw"] + q["cr"]


def cost_of(q):
    return q["in"] + q["out"] + WRITE_W * q["cw"] + READ_W * q["cr"]


def replay(sessions, cap, baseline, growth=1.0):
    """Replay each session's own growth under a policy. Returns (context_tokens, price_weighted, compactions)."""
    tok = cost = 0.0
    clears = 0
    for s in sessions:
        r = s.reqs
        cur = baseline
        prev = ctx_of(r[0])
        tok += cur
        cost += WRITE_W * cur + r[0]["out"]
        for q in r[1:]:
            d = ctx_of(q) - prev
            prev = ctx_of(q)
            if d < 0 or d > 200000:
                d = 3000
            d *= growth
            cur += d
            if cur > cap:
                cur = baseline + d
                clears += 1
                cost += WRITE_W * cur + q["out"]
            else:
                cost += READ_W * (cur - d) + WRITE_W * d + q["out"]
            tok += cur
    return tok, cost, clears


def quality(sessions):
    """Criterion 9. Human MAIN sessions only.
    correction loop: the same file edited 3+ times in a row with a failed check between edits.
    abandoned: a failed check within the last 3 requests of the session.
    branch points: a parentUuid with more than one assistant child (rewind / retry proxy)."""
    loops = 0
    loop_sessions = 0
    abandoned = 0
    branches = 0
    for s in sessions:
        fails = set(s.fails)
        found = False
        run_file, run_len, last_edit = None, 0, None
        for seq, fp in s.edit_seq:
            if fp == run_file and last_edit is not None and any(last_edit < f < seq for f in fails):
                run_len += 1
            else:
                if run_len >= 3:
                    loops += 1
                    found = True
                run_file, run_len = fp, 1
            last_edit = seq
        if run_len >= 3:
            loops += 1
            found = True
        if found:
            loop_sessions += 1
        last_seq = s.reqs[-1]["seq"]
        if s.fails and s.fails[-1] >= last_seq - 3:
            abandoned += 1
        branches += s.branch_points
    return loops, loop_sessions, abandoned, branches


def report(st, since):
    lo, hi = st["span_lo"], st["span_hi"]
    span = "%s -> %s" % (lo.date() if lo else "?", hi.date() if hi else "?")

    def H(title):
        print("\n## %s   [%s]" % (title, span))

    sessions = st["sessions"]
    if not sessions:
        print("No transcripts found since %s." % since.date())
        return
    groups = {k: [s for s in sessions if s.kind == k] for k in ("MAIN", "ROUTINE", "SUB")}
    human = groups["MAIN"]
    allreq = [q for s in sessions for q in s.reqs]
    real = [q for q in allreq if q["model"] != "<synthetic>" and ctx_of(q) > 0]
    ctxs = sorted(ctx_of(q) for q in real)
    nreq = len(ctxs)

    print("=" * 78)
    print("Claude Code usage since %s   (%d files, %d records, %d duplicate records skipped,"
          % (since.date(), st["files"], st["records"], st["dupes"]))
    print("  %d older records skipped by timestamp)   actual span: %s" % (st["skipped_old"], span))
    print("=" * 78)

    # ---------------- headline: price-weighted first ----------------
    tot_cost = sum(cost_of(q) for q in allreq)
    tot_ctx = sum(ctx_of(q) for q in allreq)
    tot_out = sum(q["out"] for q in allreq)
    H("Headline (price-weighted: cache reads 0.1x, writes 1.25x, output 1x)")
    print("  API requests                 %s   (%d synthetic/error records excluded from per-request stats)"
          % (fmt(len(allreq)), len(allreq) - len(real)))
    print("  PRICE-WEIGHTED bill          %s base-equivalent tokens   <-- the unit plan usage is drawn in"
          % fmt(tot_cost))
    print("  per request                  %s" % fmt(tot_cost / max(len(allreq), 1)))
    print("  Raw context tokens           %s     output %s" % (fmt(tot_ctx), fmt(tot_out)))
    print("  Context per request          median %s  p75 %s  p90 %s  mean %s"
          % (fmt(quantile(ctxs, .5)), fmt(quantile(ctxs, .75)), fmt(quantile(ctxs, .9)), fmt(tot_ctx / max(nreq, 1))))
    print("  Requests above 200K / 400K   %.1f%% / %.1f%%"
          % (pct(sum(1 for c in ctxs if c > 200000), nreq), pct(sum(1 for c in ctxs if c > 400000), nreq)))
    growth = []
    for s in sessions:
        r = [q for q in s.reqs if ctx_of(q) > 0]
        for a, b in zip(r, r[1:]):
            d = ctx_of(b) - ctx_of(a)
            if 0 < d < 200000:
                growth.append(d)
    if growth:
        print("  New content per request      median %s  mean %s  total %s"
              % (fmt(median(growth)), fmt(sum(growth) / len(growth)), fmt(sum(growth))))
        print("    of which model output      %s (%.0f%%)   tool results ~%s (%.0f%%, bytes/4)   Read ~%s (%.0f%%)"
              % (fmt(tot_out), pct(tot_out, sum(growth)),
                 fmt(sum(st["res_bytes"].values()) / 4), pct(sum(st["res_bytes"].values()) / 4, sum(growth)),
                 fmt(st["res_bytes"].get("Read", 0) / 4), pct(st["res_bytes"].get("Read", 0) / 4, sum(growth))))

    # ---------------- sessions, split ----------------
    H("Sessions by kind (MAIN = interactive, ROUTINE = automated job, SUB = subagent transcripts)")
    print("  %-8s %8s %10s %10s %10s %12s %14s %12s" % ("kind", "sessions", "med turns", "p90 turns", "max turns", "start median", "start p10/p90", "context"))
    for k in ("MAIN", "ROUTINE", "SUB"):
        g = groups[k]
        if not g:
            continue
        turns = [len(s.reqs) for s in g]
        starts = [ctx_of(s.reqs[0]) for s in g if ctx_of(s.reqs[0]) > 0]
        print("  %-8s %8d %10d %10d %10d %12s %14s %12s"
              % (k, len(g), median(turns), quantile(turns, .9), max(turns), fmt(median(starts)),
                 "%s/%s" % (fmt(quantile(starts, .1)), fmt(quantile(starts, .9))),
                 fmt(sum(ctx_of(q) for s in g for q in s.reqs))))
    if human:
        peaks = [max(ctx_of(q) for q in s.reqs) for s in human]
        print("  MAIN sessions peaking above 400K: %d of %d (%.0f%%)"
              % (sum(1 for p in peaks if p > 400000), len(human), pct(sum(1 for p in peaks if p > 400000), len(human))))
        starts = [ctx_of(s.reqs[0]) for s in human if ctx_of(s.reqs[0]) > 0]
        print("  MAIN session-start baseline: median %s, lowest %s   <-- criterion 1 is about this number"
              % (fmt(median(starts)), fmt(min(starts))))
        byp = collections.defaultdict(list)
        for s in human:
            if ctx_of(s.reqs[0]) > 0:
                byp[s.proj].append(ctx_of(s.reqs[0]))
        for p, l in sorted(byp.items(), key=lambda kv: -len(kv[1]))[:8]:
            print("    %-58s n=%3d  start median %s  min %s" % (p[:58], len(l), fmt(median(l)), fmt(min(l))))

    # ---------------- models ----------------
    H("Models (synthetic excluded)")
    bym = collections.defaultdict(list)
    for q in real:
        bym[q["model"]].append(ctx_of(q))
    for m, l in sorted(bym.items(), key=lambda kv: -len(kv[1])):
        print("  %-32s n=%6d  median ctx %s  >200K %.0f%%  max %s"
              % (m, len(l), fmt(median(l)), pct(sum(1 for c in l if c > 200000), len(l)), fmt(max(l))))

    # ---------------- tools ----------------
    H("Tools (full names; result bytes are what came back into context)")
    print("  total calls %d" % sum(st["tools"].values()))
    for name, count in st["tools"].most_common(14):
        rb = st["res_bytes"].get(name, 0)
        print("    %-70s %6d  results %8s (avg %s)"
              % (name[:70], count, fmt(rb), fmt(rb / max(st["res_count"].get(name, 1), 1))))
    mcp_bytes = sum(v for k, v in st["res_bytes"].items() if k.startswith("mcp__"))
    print("  MCP results total %s   shell (Bash+PowerShell) %s   Read %s"
          % (fmt(mcp_bytes), fmt(st["res_bytes"].get("Bash", 0) + st["res_bytes"].get("PowerShell", 0)),
             fmt(st["res_bytes"].get("Read", 0))))
    tpr = collections.Counter(q["ntools"] for q in allreq if q["ntools"])
    single = tpr.get(1, 0)
    multi = sum(v for k, v in tpr.items() if k > 1)
    if single + multi:
        print("  single-tool-call requests: %d of %d (%.1f%%)   (reported, not a gate)"
              % (single, single + multi, pct(single, single + multi)))
    print("  Read calls: whole-file %d (%s) vs ranged %d (%s)   whole-file reads >25KB: %d   any tool result >25KB: %d"
          % (st["read_calls"].get("whole", 0), fmt(st["read_bytes"].get("whole", 0)),
             st["read_calls"].get("ranged", 0), fmt(st["read_bytes"].get("ranged", 0)),
             st["big_reads"], st["big_results"]))
    if st["bash_heads"]:
        print("  shell command heads: %s"
              % ", ".join("%s=%d" % (k, v) for k, v in st["bash_heads"].most_common(6)))

    # ---------------- repeat reads (correct key) ----------------
    H("Repeat reads - same (path, offset, limit) twice in one session with no edit in between")
    rtot = sum(sum(s.reads.values()) for s in sessions)
    exact = 0
    after_edit = 0
    for s in sessions:
        for key, seqs in s.read_events.items():
            eds = s.edits.get(key[0], [])
            for a, b in zip(seqs, seqs[1:]):
                if any(a < e < b for e in eds):
                    after_edit += 1
                else:
                    exact += 1
    print("  Read calls %d;  true repeats %d (%.1f%%);  re-reads after an edit to the file (legitimate) %d"
          % (rtot, exact, pct(exact, rtot), after_edit))
    print("  most-read files (across sessions; a file read once per session is a startup cost, not a re-read):")
    for fp, count in st["reads_all"].most_common(4):
        nsess = sum(1 for s in sessions if any(k[0] == fp for k in s.reads))
        print("    %4d reads in %3d sessions  %s" % (count, nsess, fp[-80:]))

    # ---------------- quality signal ----------------
    H("Quality signal (criterion 9) - human MAIN sessions only; heuristics, compare rows not absolutes")
    if human:
        loops, loop_sessions, abandoned, branches = quality(human)
        print("  correction loops (same file edited 3+ times with a failed check between): %d loops in %d of %d sessions"
              % (loops, loop_sessions, len(human)))
        print("  abandoned sessions (a failed check within the last 3 requests): %d" % abandoned)
        print("  branch points (a turn with >1 assistant child; rewind/retry proxy): %d" % branches)
        print("  failed checks detected: %d  (tool_result is_error, or shell output matching FAIL/Error/Exit code)"
              % sum(len(s.fails) for s in human))

    # ---------------- hooks / attachments ----------------
    if st["hooks"]:
        H("Hooks (records on disk; stdout reaches the model, stderr does not)")
        for k, n in st["hooks"].most_common(6):
            print("    %-40s n=%6d" % (k, n))
        for e, n in st["hook_stderr"].most_common(4):
            print("    stderr x%-6d %s" % (n, e))
    if st["attach_b"]:
        H("Start-of-session listings (attachment bytes on disk; ~1 per session, already inside the baseline)")
        for name, size in st["attach_b"].most_common(5):
            print("  %-28s n=%5d  %s" % (str(name)[:28], st["attach_n"][name], fmt(size)))

    # ---------------- cache ----------------
    H("Cache economics")
    c = collections.Counter()
    for q in allreq:
        c["read"] += q["cr"]
        c["write"] += q["cw"]
        c["plain"] += q["in"]
        c["out"] += q["out"]
    base_eq = c["plain"] + c["out"] + WRITE_W * c["write"] + READ_W * c["read"]
    print("  %-16s %10s %14s %8s" % ("", "tokens", "base-equiv", "share"))
    for label, tok, w in (("cache reads", c["read"], READ_W), ("cache writes", c["write"], WRITE_W),
                          ("output", c["out"], 1.0), ("plain input", c["plain"], 1.0)):
        print("  %-16s %10s %14s %7.1f%%" % (label, fmt(tok), fmt(tok * w), pct(tok * w, base_eq)))
    ideal = c["plain"] + c["out"] + READ_W * (c["write"] + c["read"])
    print("  if every write were a hit: %s (%.0f%% of actual) -- the ceiling on cache savings"
          % (fmt(ideal), pct(ideal, base_eq)))
    print("  cache writes by TTL:  MAIN+ROUTINE 1h %s / 5m %s     SUB 1h %s / 5m %s   (5m on MAIN => usage credits / short TTL)"
          % (fmt(sum(q["w1h"] for s in sessions if s.kind != "SUB" for q in s.reqs)),
             fmt(sum(q["w5m"] for s in sessions if s.kind != "SUB" for q in s.reqs)),
             fmt(sum(q["w1h"] for s in groups["SUB"] for q in s.reqs)),
             fmt(sum(q["w5m"] for s in groups["SUB"] for q in s.reqs))))
    gap_n, gap_cc, gap_miss = collections.Counter(), collections.Counter(), collections.Counter()
    sw_pairs, sw_write, same_pairs, same_write = 0, 0, 0, 0
    for s in sessions:
        r = [q for q in s.reqs if q["model"] != "<synthetic>" and ctx_of(q) > 0]
        for a, b in zip(r, r[1:]):
            if a["t"] and b["t"]:
                g = gap_bucket((b["t"] - a["t"]).total_seconds() / 60.0)
                gap_n[g] += 1
                gap_cc[g] += b["cw"]
                if b["cw"] >= 2000 and b["cw"] > 0.05 * max(ctx_of(b), 1):
                    gap_miss[g] += 1
            if a["model"] != b["model"]:
                sw_pairs += 1
                sw_write += b["cw"]
            else:
                same_pairs += 1
                same_write += b["cw"]
    print("  cache writes by idle gap since the previous request (synthetic excluded):")
    print("    %-11s %9s %12s %10s %14s" % ("gap", "requests", "written", "avg", "looks-like-miss"))
    for lo_, _hi, label in GAP_BUCKETS:
        n = gap_n.get(lo_, 0)
        if n:
            print("    %-11s %9d %12s %10s %7d (%4.1f%%)"
                  % (label, n, fmt(gap_cc[lo_]), fmt(gap_cc[lo_] / n), gap_miss[lo_], pct(gap_miss[lo_], n)))
    if sw_pairs and same_pairs:
        print("  real model switches mid-session: %d pairs, avg write %s vs %s same-model; %s of %s total writes (%.1f%%)"
              % (sw_pairs, fmt(sw_write / sw_pairs), fmt(same_write / same_pairs), fmt(sw_write), fmt(c["write"]),
                 pct(sw_write, c["write"])))

    # ---------------- counterfactual ----------------
    H("Counterfactual replay (both units). Each session starts at the MAIN median baseline (~5% artifact); compare rows")
    starts = [ctx_of(s.reqs[0]) for s in human if ctx_of(s.reqs[0]) > 0] or [ctx_of(s.reqs[0]) for s in sessions]
    med_base = median(starts)
    ref_tok, ref_cost, _ = replay(sessions, 10 ** 9, med_base)
    print("  %-44s %10s %8s %12s %8s %6s" % ("policy", "context", "vs", "price-wtd", "vs", "compactions"))
    rows = [("today (no cap)", 10 ** 9, med_base, 1.0)]
    rows += [("cap %dK" % (cap // 1000), cap, med_base, 1.0) for cap in (600000, 500000, 400000, 300000, 250000)]
    rows += [("baseline 50K", 10 ** 9, 50000, 1.0), ("baseline 35K (below observed floor)", 10 ** 9, 35000, 1.0)]
    rows += [("growth -%d%% (what-if; no mechanism)" % round((1 - g) * 100), 10 ** 9, med_base, g) for g in (0.85, 0.5)]
    rows += [("cap 400K + baseline 50K", 400000, 50000, 1.0),
             ("cap 400K + baseline 50K + growth -15%", 400000, 50000, 0.85)]
    for label, cap, base, g in rows:
        tok, cost, cl = replay(sessions, cap, base, g)
        print("  %-44s %10s %7.0f%% %12s %7.0f%% %6d"
              % (label, fmt(tok), pct(tok, ref_tok), fmt(cost), pct(cost, ref_cost), cl))
    print("\n  Every figure above was measured over %s. Quote it with that span." % span)
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--since", default="30d", help="'30d' or 'YYYY-MM-DD' (pin the date for a recorded row)")
    ap.add_argument("--root", default=DEFAULT_ROOT, help="transcript root")
    ap.add_argument("--routine-marker", default="fix-agent-routine.md",
                    help="a MAIN session whose first Read contains this string is counted as ROUTINE ('' to disable)")
    args = ap.parse_args()
    if not os.path.isdir(args.root):
        sys.exit("No transcript directory at %s" % args.root)
    since = parse_since(args.since)
    report(collect(args.root, since, args.routine_marker), since)


if __name__ == "__main__":
    main()
