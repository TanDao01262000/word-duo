#!/usr/bin/env python3
"""Merge US IPA and Vietnamese meanings into words.json and pairs.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import vi_ipa_data as d  # noqa: E402

words = json.loads((ROOT / "data/words.json").read_text())
pairs = json.loads((ROOT / "data/pairs.json").read_text())
by_lemma = {w["lemma"]: w["id"] for w in words}

for w in words:
    ipa, vi, note = d.WORDS[w["id"]]
    w["ipa"] = ipa
    w["vi"] = vi
    w["viNote"] = note

def lookup(lemma):
    wid = by_lemma.get(lemma)
    if lemma in d.PAIRS:
        return d.PAIRS[lemma]
    return d.WORDS[wid]

for p in pairs:
    for side in ("a", "b"):
        ipa, vi, note = lookup(p[side]["lemma"])
        p[side]["ipa"] = ipa
        p[side]["vi"] = vi
        if note:
            p[side]["viNote"] = note

(ROOT / "data/words.json").write_text(json.dumps(words, indent=2, ensure_ascii=False) + "\n")
(ROOT / "data/pairs.json").write_text(json.dumps(pairs, indent=2, ensure_ascii=False) + "\n")
print("merged", len(words), "words,", len(pairs), "pairs")
