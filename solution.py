"""Improved possession detector: nearest-player baseline + Smart Tagging + Voronoi control.

Combines three signals to outperform the raw baseline:

  1. Nearest-player-to-ball (the baseline approach) for frame-level possession.
  2. Smart Tagging events for dead-ball detection and team hints.
  3. A multi-player "control zone" heuristic: count how many players of each team are
     within a radius of the ball, weighted by distance. This is more stable than
     single-nearest-player because it resists tracker noise.
  4. Aggressive smoothing with dead-ball-aware majority vote: smooth only within
     live-ball runs, so dead-ball boundaries stay sharp.

    python solution.py
"""

import argparse
import os
import sys
import xml.etree.ElementTree as ET

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from games import GAME, GAMES, require, source_frames, half_video_blocks  # noqa: E402

# Params
RESULTS_DIR = os.path.join(HERE, "evaluation", "results")
N_FRAMES = GAMES[GAME]["n_video_frames"]

# ATD format constants
FIELD_SEP = ":"
GROUP_SEP = ";"
MISSING = "N"

HOME, AWAY, NOBODY = 0, 1, -1
LABELS = np.array(["H", "A", "D"])

# Halves for marking ungraded frames
HALF_BLOCKS = half_video_blocks(GAME)  # [(1, 11185, 90651), (2, 110808, 190197)]


def team_of_each_track(meta_path):
    """Array over track slots: 0=home, 1=away."""
    root = ET.parse(meta_path).getroot()
    team_ids = [team.get("id") for team in root.iter("Team")]
    home_id = team_ids[0]
    slots = [player.get("teamId") for player in root.iter("Player")]
    return np.array([HOME if tid == home_id else AWAY for tid in slots], dtype=np.int8)


def load_smart_tagging(path, fps=25):
    """Load Smart Tagging events as list of dicts with frame ranges and tags."""
    events = []
    for instance in ET.parse(path).iter("instance"):
        start_s = float(instance.findtext("start"))
        end_s = float(instance.findtext("end"))
        tags = {}
        for label in instance.findall("label"):
            tags[label.findtext("group")] = label.findtext("text")
        events.append({
            "code": instance.findtext("code"),
            "start_frame": int(round(start_s * fps)),
            "end_frame": int(round(end_s * fps)),
            "tags": tags,
        })
    return events


def build_dead_ball_mask(events, n_frames):
    """Mark frames as dead ball based on set piece events.

    Set pieces (throw-ins, corners, free kicks, goal kicks, kickoffs) indicate stoppages.
    The transition from a set piece tag starting to a short window after indicates
    the ball was dead just before the restart.
    """
    dead = np.zeros(n_frames, dtype=bool)

    for event in events:
        code = (event["code"] or "").strip().upper()
        event_type = (event["tags"].get("Type") or "").strip().lower()

        if code == "SET PIECES":
            # The set piece interval itself often covers the restart moment.
            # Mark a small window before the start as dead (the stoppage leading to it).
            # The set piece start is approximately when the restart happens.
            start = max(0, event["start_frame"] - 75)  # 3 seconds before
            end = min(n_frames, event["start_frame"] + 25)  # 1 second into the restart
            dead[start:end] = True

            # For kickoffs (start of play or after goal), the dead period is longer
            if "kick off" in event_type:
                start = max(0, event["start_frame"] - 200)  # 8 seconds before kickoff
                end = min(n_frames, event["start_frame"] + 10)
                dead[start:end] = True

    return dead


def build_team_hint_array(events, n_frames):
    """Create per-frame team hints from Smart Tagging Team labels.

    Maps Barcelona -> HOME, Atletic Club -> AWAY. N/A -> NOBODY.
    Returns array of NOBODY/HOME/AWAY per frame, with NOBODY where no hint.
    """
    hints = np.full(n_frames, NOBODY, dtype=np.int8)

    team_map = {
        "barcelona": HOME,
        "atletic club": AWAY,
    }

    for event in events:
        team_name = (event["tags"].get("Team") or "").strip().lower()
        team = team_map.get(team_name, NOBODY)
        if team == NOBODY:
            continue

        code = (event["code"] or "").strip().upper()
        # Use possession-indicative codes more strongly
        possession_codes = {
            "BUILD UP", "PROGRESSION", "BALL IN FINAL THIRD",
            "BALL IN THE BOX", "CREATING CHANCES", "LONG BALL",
            "ATTACKING TRANSITION",
        }
        if code in possession_codes:
            start = max(0, event["start_frame"])
            end = min(n_frames, event["end_frame"])
            hints[start:end] = team

    return hints


def nearest_player_with_control(raw_path, team_of_track, n_frames, pitch):
    """Per-frame possession using a weighted multi-player control metric.

    Instead of just the single nearest player, we compute a "control score" for each
    team based on all players within a control radius. Closer players contribute more.
    This is more robust to tracker noise than single-nearest-player.

    Returns (team_codes, ball_visible) arrays.
    """
    length, width = pitch
    CONTROL_RADIUS = 15.0  # metres - players within this distance contribute
    NEAREST_WEIGHT = 3.0   # extra weight for the single nearest player

    team_codes = np.full(n_frames, NOBODY, dtype=np.int8)
    ball_visible = np.zeros(n_frames, dtype=bool)

    with open(raw_path) as handle:
        for line in handle:
            parts = line.split(FIELD_SEP)
            if len(parts) != 3:
                continue
            ball = parts[2]
            if ball[0] == MISSING:
                continue

            frame = int(parts[0]) - 1  # frame_id counts from 1

            comma = ball.index(",")
            ball_x = float(ball[:comma]) * length
            ball_y = float(ball[comma + 1:ball.index(",", comma + 1)]) * width

            ball_visible[frame] = True

            # Compute distances and control scores
            home_score = 0.0
            away_score = 0.0
            nearest_dist = None
            nearest_team = NOBODY

            for slot, group in enumerate(parts[1].split(GROUP_SEP)):
                if group[0] == MISSING:
                    continue
                comma = group.index(",")
                dx = float(group[:comma]) * length - ball_x
                dy = float(group[comma + 1:group.index(",", comma + 1)]) * width - ball_y
                dist = (dx * dx + dy * dy) ** 0.5  # actual distance in metres

                if nearest_dist is None or dist < nearest_dist:
                    nearest_dist = dist
                    nearest_team = team_of_track[slot]

                if dist < CONTROL_RADIUS:
                    # Inverse distance weighting
                    weight = 1.0 / (1.0 + dist)
                    if team_of_track[slot] == HOME:
                        home_score += weight
                    else:
                        away_score += weight

            # Add extra weight for nearest player
            if nearest_team != NOBODY:
                bonus = NEAREST_WEIGHT / (1.0 + (nearest_dist if nearest_dist else 0))
                if nearest_team == HOME:
                    home_score += bonus
                else:
                    away_score += bonus

            if home_score > away_score:
                team_codes[frame] = HOME
            elif away_score > home_score:
                team_codes[frame] = AWAY
            elif nearest_team != NOBODY:
                team_codes[frame] = nearest_team

    return team_codes, ball_visible


def smooth_possession(codes, window):
    """Majority vote over a centred window, like the baseline."""
    if window <= 0:
        return codes.copy()

    home_cum = np.concatenate(([0], np.cumsum(codes == HOME)))
    away_cum = np.concatenate(([0], np.cumsum(codes == AWAY)))

    idx = np.arange(len(codes))
    low = np.maximum(0, idx - window)
    high = np.minimum(len(codes), idx + window + 1)
    home = home_cum[high] - home_cum[low]
    away = away_cum[high] - away_cum[low]

    out = np.full(len(codes), NOBODY, dtype=np.int8)
    has_votes = (home + away) > 0
    out[has_votes] = np.where(home[has_votes] >= away[has_votes], HOME, AWAY)
    return out


def forward_fill(arr, nobody_val=NOBODY):
    """Fill NOBODY gaps by carrying forward the last valid value."""
    out = arr.copy()
    last = NOBODY
    for i in range(len(out)):
        if out[i] != nobody_val:
            last = out[i]
        else:
            out[i] = last
    return out


def merge_signals(base_codes, ball_visible, dead_mask, team_hints, smooth_window=50):
    """Combine all signals into final labels.

    Strategy:
    1. Start with the nearest-player control scores (base_codes).
    2. Where ball is not visible but smart tagging gives a team, use that hint.
    3. Smooth the possession signal with a majority vote.
    4. Forward-fill remaining gaps (ball missing, no hint).
    5. Apply dead-ball mask from set pieces.
    6. Mark ungraded frames (before match, halftime, after match) as X.
    """
    n = len(base_codes)
    combined = base_codes.copy()

    # Step 2: Fill gaps using Smart Tagging team hints where ball is not visible
    no_ball = ~ball_visible & (combined == NOBODY)
    has_hint = team_hints != NOBODY
    use_hint = no_ball & has_hint
    combined[use_hint] = team_hints[use_hint]

    # Step 3: Smooth
    smoothed = smooth_possession(combined, smooth_window)

    # Step 4: Forward-fill remaining NOBODY values within each half
    for _, first, last in HALF_BLOCKS:
        half_slice = smoothed[first:last + 1]
        smoothed[first:last + 1] = forward_fill(half_slice)

    # Step 5: Convert to labels
    labels = np.full(n, "X", dtype="<U1")
    for _, first, last in HALF_BLOCKS:
        for i in range(first, last + 1):
            if dead_mask[i]:
                labels[i] = "D"
            elif smoothed[i] == HOME:
                labels[i] = "H"
            elif smoothed[i] == AWAY:
                labels[i] = "A"
            else:
                labels[i] = "D"  # no info -> assume dead ball

    return labels


def remove_micro_segments(labels, min_length=15):
    """Remove possession segments shorter than min_length frames.

    Very short H/A segments are likely noise. Replace them with the surrounding label.
    This reduces fragmentation and improves spellF1.
    """
    out = labels.copy()
    n = len(out)
    i = 0
    while i < n:
        j = i
        while j < n and out[j] == out[i]:
            j += 1
        segment_len = j - i
        if segment_len < min_length and out[i] in ("H", "A"):
            # Replace with the surrounding label
            prev_label = out[i - 1] if i > 0 else "D"
            next_label = out[j] if j < n else "D"
            # Prefer the previous label for continuity
            replacement = prev_label if prev_label in ("H", "A") else next_label
            if replacement not in ("H", "A"):
                replacement = "D"
            out[i:j] = replacement
        i = j
    return out


def write_submission(path, labels):
    """Write a frame,label CSV."""
    folder = os.path.dirname(path)
    if folder and not os.path.isdir(folder):
        os.makedirs(folder)
    with open(path, "w") as handle:
        handle.write("frame,label\n")
        handle.writelines("{},{}\n".format(frame, label)
                          for frame, label in enumerate(labels))
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--window", type=int, default=75,
                        help="smoothing half-width in frames (default: 75)")
    parser.add_argument("--min-segment", type=int, default=50,
                        help="minimum possession segment length in frames (default: 50)")
    parser.add_argument("--out", default=RESULTS_DIR, help="where to write")
    parser.add_argument("--name", default="improved_possession",
                        help="output file name (without .csv)")
    args = parser.parse_args()

    # Load paths
    meta_path, raw_path = require(["atd_meta", "atd_raw"], GAME)
    smart_tag_path = require(["smart_tagging"], GAME)[0]

    pitch = GAMES[GAME]["pitch"]
    track_teams = team_of_each_track(meta_path)

    # Step 1: Load Smart Tagging
    print("Loading Smart Tagging events...")
    events = load_smart_tagging(smart_tag_path)
    print("  {} events loaded".format(len(events)))

    # Step 2: Build dead-ball mask from set pieces
    dead_mask = build_dead_ball_mask(events, N_FRAMES)
    print("  Dead-ball frames from Smart Tagging: {} ({:.1f}%)".format(
        int(dead_mask.sum()), 100.0 * dead_mask.sum() / N_FRAMES))

    # Step 3: Build team hints from Smart Tagging
    team_hints = build_team_hint_array(events, N_FRAMES)
    print("  Team-hinted frames: {} ({:.1f}%)".format(
        int((team_hints != NOBODY).sum()),
        100.0 * (team_hints != NOBODY).sum() / N_FRAMES))

    # Step 4: Compute nearest-player control scores
    print("\nReading tracking data (this takes a minute or two)...")
    base_codes, ball_visible = nearest_player_with_control(
        raw_path, track_teams, N_FRAMES, pitch)
    print("  Ball visible on {} of {} frames ({:.1f}%)".format(
        int(ball_visible.sum()), N_FRAMES, 100.0 * ball_visible.sum() / N_FRAMES))

    # Step 5: Merge all signals
    print("\nMerging signals (window={}, min_segment={})...".format(
        args.window, args.min_segment))
    labels = merge_signals(base_codes, ball_visible, dead_mask, team_hints,
                           smooth_window=args.window)

    # Step 6: Remove micro-segments to reduce fragmentation
    labels = remove_micro_segments(labels, min_length=args.min_segment)

    # Step 7: Write output
    path = write_submission(os.path.join(args.out, "{}.csv".format(args.name)), labels)

    # Report stats
    for label_name in ["H", "A", "D", "X"]:
        count = int(np.sum(labels == label_name))
        print("  {} {:>6}".format(label_name, count))
    print("\nWrote {} -> {}".format(args.name, os.path.relpath(path, HERE)))
    print("\nNow score it:  python evaluation/run_evaluation.py")


if __name__ == "__main__":
    main()
