# first_pass.py -- nearest-team-to-ball baseline. Run from the repo root.
import numpy as np
import pandas as pd
from kloppy import metrica
from games import asset_paths, half_video_blocks

N = 199_319
PITCH_L, PITCH_W = 105.3, 68.0
GAP = 25       # interpolate ball gaps up to 1 s
WINDOW = 75    # smoothing window in frames (3 s) -- tune this

p = asset_paths()
ds = metrica.load_tracking_epts(meta_data=p["atd_meta"], raw_data=p["atd_raw"])
df = ds.to_df()
df.index = df["frame_id"].astype(int) - 1       # ATD frame_id -> video frame
df = df.reindex(range(N))                        # missing frames become NaN

# which track slot belongs to which team (from the metadata)
team_of = {}
for team in ds.metadata.teams:
    for pl in team.players:
        team_of[str(pl.player_id)] = "H" if team.ground.name == "HOME" else "A"

slots = [c[:-2] for c in df.columns if c.endswith("_x") and c != "ball_x"]
home = [s for s in slots if team_of.get(s) == "H"]
away = [s for s in slots if team_of.get(s) == "A"]
print(f"{len(home)} home slots, {len(away)} away slots")   # sanity check

# ball in metres, short gaps interpolated
bx = (df["ball_x"] * PITCH_L).interpolate(limit=GAP)
by = (df["ball_y"] * PITCH_W).interpolate(limit=GAP)

def nearest(group):
    d = np.full((N, len(group)), np.nan)
    for i, s in enumerate(group):
        d[:, i] = np.hypot(df[f"{s}_x"] * PITCH_L - bx, df[f"{s}_y"] * PITCH_W - by)
    with np.errstate(all="ignore"):
        return np.nanmin(d, axis=1)

dH, dA = nearest(home), nearest(away)

# positive = home closer; smooth, then hold the last value through ball gaps
score = pd.Series(dA - dH)
score = score.rolling(WINDOW, center=True, min_periods=WINDOW // 3).median()
score = score.ffill(limit=75)

label = np.where(score > 0, "H", np.where(score < 0, "A", "X")).astype(object)
label[score.isna().values] = "X"

# only the graded halves count; X everywhere else
graded = np.zeros(N, dtype=bool)
for _, a, b in half_video_blocks("BAR-ATH"):
    graded[a:b + 1] = True
label[~graded] = "X"

out = pd.DataFrame({"frame": np.arange(N), "label": label})
out.to_csv("evaluation/results/mine_v1.csv", index=False)
print(out["label"].value_counts())
