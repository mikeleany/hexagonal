#!/usr/bin/env python3
"""Generates the game's dictionary from SCOWL (Spell Checker Oriented Word
Lists, https://github.com/en-wl/wordlist): a full valid-word list plus a
binary common/rare rarity tag per word, replacing the old enable1.txt +
Norvig-corpus continuous rarity pipeline -- see
https://github.com/mikeleany/hexagonal/issues/11.

Unlike the old pipeline's continuous 0..1 rarity score, this produces a
binary common/rare tag from two SCOWL "size" levels. SCOWL's size levels are
cumulative (a size-N query already includes everything from every smaller
size), so a "valid" list at one size and a smaller "common" list at a lower
size naturally nest, as long as valid-size >= common-size.

This is a build-time dependency, not a standalone data tool: src/lib/
dictionary.ts imports its output directly (see the Output section below), so
it must run before `npm run dev`/`build`/`check` -- wired up via package.json
's predev/prebuild/precheck hooks.

Uses SCOWL v2 (https://github.com/en-wl/wordlist, `v2` branch), not the older
v1 tool (`mk-list`, e.g. what `apt install scowl` ships): v1 has no way to
select just the plain "words" category -- it always mixes in abbreviations,
contractions, and proper names for a given dialect. v2 replaced v1's flat
per-category files with a SQLite database and a `scowl word-list` query tool
that supports real category/class filtering, which this script relies on to
build a clean list of ordinary dictionary words.

Fetches the pinned SCOWL v2 source release, builds its SQLite database with
`make` (pure Python stdlib under the hood, no pip installs), and queries it
with the `scowl word-list` tool using a filter recipe that excludes:
  - abbreviations/contractions, prefixes/suffixes/roman-numerals, and
    multi-word fragments (--wo-pos-categories)
  - proper-noun-ish entries: names, places, surnames, trademarks,
    words that must be capitalized, demonyms (--wo-pos-classes)
  - the SCOWL "hacker" and "roman-numerals" categories (--categories '')

Profanity/slur filtering (see https://github.com/mikeleany/hexagonal/issues/6)
is deliberately NOT applied at query time above -- SCOWL's usage-note tiers
are all-or-nothing per query, which leaves no way to exclude a tier but keep
one specific word a user wants preserved (e.g. "fart", tagged under the
milder `vulgar-3` tier alongside plenty of words that should stay excluded).
Instead, filtering happens as a single combined step after the valid/common
lists are generated:
  1. Query SCOWL again, positively this time, for every word tagged
     `vulgar-1`, `vulgar-3`, `offensive-1`, or `offensive-2` (the full set of
     profanity/slur tiers -- see USAGE_NOTES_OFFENSIVE below).
  2. Union that with an external blocklist: LDNOOBW's "List of Dirty,
     Naughty, Obscene, and Otherwise Bad Words"
     (https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words,
     CC BY 4.0), included because SCOWL's own tagging alone was confirmed to
     miss at least one clearly-vulgar word entirely.
  3. Subtract scripts/wordWhitelist.txt, a small hand-maintained list of
     words to keep despite being blocklisted.
  4. Remove whatever's left from the valid/common word sets.
This combined list is also written to .cache/scowl/filtered-offensive.txt
(see Output below) so it can be reviewed and used to grow the whitelist.

Requires `make` and `python3` on PATH (both used to build SCOWL's own
database from its source; no pip installs needed for this script or for
SCOWL v2 itself).

Usage:
  python3 scripts/generateWordLists.py [--valid-size 80] [--common-size 50]
      [--valid-variant-level 6] [--common-variant-level 4]

Inputs:
  scripts/wordWhitelist.txt -- checked into git (unlike everything below,
                                which is gitignored); one lowercase word per
                                line, '#' starts an inline comment, blank
                                lines ignored. Words to keep even though
                                they'd otherwise be blocklisted.

Output (all under .cache/scowl/, gitignored -- not committed, so anything
that needs these files must generate them first):
  valid.txt               -- the full valid-word list, one word per line
  common.txt               -- the common-word subset, one word per line
  words.txt                -- "{word}\t{common|rare}" per line, one line per
                               valid word; this is the file dictionary.ts
                               actually imports
  filtered-offensive.txt   -- every word actually removed by the combined
                               blocklist (post-whitelist), for review
"""

import argparse
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path
from typing import Sequence

SCOWL_TAG = "rel-2026.02.25"
SCOWL_TARBALL_URL = (
    f"https://github.com/en-wl/wordlist/archive/refs/tags/{SCOWL_TAG}.tar.gz"
)

# LDNOOBW has no tags/releases, so pin to a commit for reproducibility.
LDNOOBW_COMMIT = "4638b970cb8d9d82789564fcba1f4a1eb508ff1a"
LDNOOBW_URL = (
    "https://raw.githubusercontent.com/LDNOOBW/"
    f"List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/{LDNOOBW_COMMIT}/en"
)

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / ".cache"
SCOWL_TARBALL = CACHE_DIR / f"wordlist-{SCOWL_TAG}.tar.gz"
SCOWL_SRC_DIR = CACHE_DIR / f"wordlist-{SCOWL_TAG}"
LDNOOBW_CACHE = CACHE_DIR / "ldnoobw" / "en.txt"
OUTPUT_DIR = CACHE_DIR / "scowl"
WHITELIST_PATH = REPO_ROOT / "scripts" / "wordWhitelist.txt"

# American only -- SCOWL's --spellings codes are single letters (A/B/Z/C/D);
# dialect is a settled choice here, not exposed as a CLI flag.
SPELLING = "A"

# pos_class values that mark proper-noun-ish or abbreviation-ish entries.
# Deliberately does NOT include 'number'/'ordinal': confirmed against the
# built database that those tag ordinary spelled-out words like
# "billion"/"billionth" (for grammatical multi-function reasons), not
# numeral symbols.
WO_POS_CLASSES = "abbr,abbr?,name,name?,person,place,surname,trademark,upper,upper?,demonym"

# pos_category values for non-plain-word entries: abbreviations/contractions,
# prefixes/suffixes/roman-numerals, and multi-word fragments.
WO_POS_CATEGORIES = "special,nonword,wordpart"

# usage_note values covering all of SCOWL's profanity/slur tiers, including
# the milder vulgar-3 tier -- unlike the old query-time exclusion, this is
# used as a *positive* filter (passed to run_word_list as --usage-notes, not
# --wo-usage-notes) to build a combined blocklist after the fact, so
# individual wanted words can be whitelisted back in. See module docstring.
USAGE_NOTES_OFFENSIVE = "vulgar-1,vulgar-3,offensive-1,offensive-2"

VARIANT_LEVEL_CHOICES = range(0, 10)

# Matches dictionary.ts's word-validation rule for words.txt.
WORD_RE = re.compile(r"^[a-z]+$")


def fetch_scowl_tarball() -> None:
    if SCOWL_TARBALL.exists():
        print(f"Using cached tarball at {SCOWL_TARBALL}")
        return
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {SCOWL_TARBALL_URL} ...")
    with urllib.request.urlopen(SCOWL_TARBALL_URL) as response, open(
        SCOWL_TARBALL, "wb"
    ) as f:
        shutil.copyfileobj(response, f)
    print(f"Cached tarball to {SCOWL_TARBALL}")


def extract_scowl_tarball() -> Path:
    scowl_bin = SCOWL_SRC_DIR / "scowl"
    makefile = SCOWL_SRC_DIR / "Makefile"
    if scowl_bin.exists() and makefile.exists():
        print(f"Using cached extraction at {SCOWL_SRC_DIR}")
        return SCOWL_SRC_DIR
    print(f"Extracting {SCOWL_TARBALL} ...")
    with tarfile.open(SCOWL_TARBALL, "r:gz") as tar:
        tar.extractall(CACHE_DIR, filter="data")
    if not scowl_bin.exists() or not makefile.exists():
        raise RuntimeError(
            f"Extraction did not produce expected scowl/Makefile layout under {SCOWL_SRC_DIR}"
        )
    return SCOWL_SRC_DIR


def build_scowl_db(src_dir: Path) -> Path:
    db_path = src_dir / "scowl.db"
    if db_path.exists():
        print(f"Using cached database at {db_path}")
        return db_path
    if shutil.which("make") is None:
        raise RuntimeError("make is required to build the SCOWL database but was not found on PATH")
    print(f"Building SCOWL database in {src_dir} (this can take about a minute) ...")
    subprocess.run(["make"], cwd=src_dir, check=True)
    if not db_path.exists():
        raise RuntimeError(f"make completed but {db_path} was not created")
    return db_path


def run_word_list(
    scowl_bin: Path,
    db_path: Path,
    size: int,
    variant_level: int,
    *,
    extra_args: Sequence[str] = (),
) -> list[str]:
    cmd = [
        sys.executable, str(scowl_bin), "word-list",
        "--db", str(db_path),
        str(size), SPELLING, str(variant_level),
        "--wo-pos-categories", WO_POS_CATEGORIES,
        "--wo-pos-classes", WO_POS_CLASSES,
        "--categories", "",
        *extra_args,
    ]
    result = subprocess.run(cmd, cwd=scowl_bin.parent, capture_output=True, text=True, check=True)
    words = []
    dropped = 0
    for line in result.stdout.splitlines():
        word = line.strip().lower()
        if not word:
            continue
        if WORD_RE.match(word):
            words.append(word)
        else:
            dropped += 1
    if dropped:
        print(
            f"  (size {size}, variant-level {variant_level}): dropped {dropped} entries not matching /^[a-z]+$/",
            file=sys.stderr,
        )
    return sorted(set(words))


def fetch_ldnoobw_wordlist() -> Path:
    if LDNOOBW_CACHE.exists():
        print(f"Using cached LDNOOBW word list at {LDNOOBW_CACHE}")
        return LDNOOBW_CACHE
    LDNOOBW_CACHE.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {LDNOOBW_URL} ...")
    with urllib.request.urlopen(LDNOOBW_URL) as response, open(
        LDNOOBW_CACHE, "wb"
    ) as f:
        shutil.copyfileobj(response, f)
    print(f"Cached LDNOOBW word list to {LDNOOBW_CACHE}")
    return LDNOOBW_CACHE


def load_ldnoobw_blocklist(path: Path) -> set[str]:
    """No regex filtering needed: multi-word phrases/leetspeak entries in
    LDNOOBW's list can never match a single-word dictionary entry anyway, so
    they're harmless to keep as-is rather than filtered out here."""
    return {
        entry
        for line in path.read_text(encoding="utf-8").splitlines()
        if (entry := line.strip().lower())
    }


def load_whitelist(path: Path) -> set[str]:
    """Words to keep even though they're blocklisted. Not required to be a
    subset of the blocklist -- it's simply subtracted from it, the same
    relationship the blocklist has to the word list."""
    if not path.exists():
        return set()
    words = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        entry = line.split("#", 1)[0].strip().lower()
        if entry:
            words.add(entry)
    return words


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--valid-size", type=int, default=80, help="SCOWL size level for the full valid-word list (default: 80)")
    parser.add_argument("--common-size", type=int, default=50, help="SCOWL size level for the common-word subset (default: 50)")
    parser.add_argument("--valid-variant-level", type=int, default=6, choices=VARIANT_LEVEL_CHOICES, help="SCOWL variant level for the valid-word list (default: 6)")
    parser.add_argument("--common-variant-level", type=int, default=4, choices=VARIANT_LEVEL_CHOICES, help="SCOWL variant level for the common-word subset (default: 4)")
    args = parser.parse_args()

    if args.common_size > args.valid_size:
        parser.error("--common-size must be <= --valid-size")
    if args.common_variant_level > args.valid_variant_level:
        parser.error("--common-variant-level must be <= --valid-variant-level")

    fetch_scowl_tarball()
    src_dir = extract_scowl_tarball()
    db_path = build_scowl_db(src_dir)
    scowl_bin = src_dir / "scowl"

    print(f"Querying valid list: size {args.valid_size}, variant-level {args.valid_variant_level} ...")
    valid_words = run_word_list(scowl_bin, db_path, args.valid_size, args.valid_variant_level)
    print(f"Querying common list: size {args.common_size}, variant-level {args.common_variant_level} ...")
    common_words = run_word_list(scowl_bin, db_path, args.common_size, args.common_variant_level)

    valid_set = set(valid_words)
    common_set = set(common_words)
    orphaned = common_set - valid_set
    if orphaned:
        raise RuntimeError(
            f"{len(orphaned)} common-list words are missing from the valid list "
            f"(expected common to be a subset of valid) e.g. {sorted(orphaned)[:10]}"
        )

    print("Querying SCOWL-tagged offensive words ...")
    scowl_offensive_words = set(run_word_list(
        scowl_bin, db_path, args.valid_size, args.valid_variant_level,
        extra_args=["--usage-notes", f"{USAGE_NOTES_OFFENSIVE},no-default"],
    ))

    print("Fetching LDNOOBW profanity blocklist ...")
    ldnoobw_words = load_ldnoobw_blocklist(fetch_ldnoobw_wordlist())

    whitelist = load_whitelist(WHITELIST_PATH)
    blocklist = (scowl_offensive_words | ldnoobw_words) - whitelist
    blocked_words = blocklist & valid_set

    valid_set -= blocked_words
    common_set -= blocked_words

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    valid_path = OUTPUT_DIR / "valid.txt"
    valid_path.write_text("\n".join(sorted(valid_set)) + "\n", encoding="utf-8")

    common_path = OUTPUT_DIR / "common.txt"
    common_path.write_text("\n".join(sorted(common_set)) + "\n", encoding="utf-8")

    words_path = OUTPUT_DIR / "words.txt"
    lines = [
        f"{word}\t{'common' if word in common_set else 'rare'}"
        for word in sorted(valid_set)
    ]
    words_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    filtered_path = OUTPUT_DIR / "filtered-offensive.txt"
    filtered_path.write_text("\n".join(sorted(blocked_words)) + "\n", encoding="utf-8")
    print(f"Wrote {len(blocked_words)} filtered words to {filtered_path} for review")

    rare_count = len(valid_set) - len(common_set)
    common_pct = 100 * len(common_set) / len(valid_set) if valid_set else 0
    print(f"\nWrote {len(valid_set)} words to {valid_path}")
    print(f"Wrote {len(common_set)} words to {common_path}")
    print(f"Wrote {len(valid_set)} tagged entries to {words_path}")
    print(
        f"\n{len(common_set)} common / {rare_count} rare "
        f"({common_pct:.1f}% common) of {len(valid_set)} total words"
    )


if __name__ == "__main__":
    main()
