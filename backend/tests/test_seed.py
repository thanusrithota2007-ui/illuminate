"""Keeps the three copies of the synthetic data (JSON used offline, SQL seed, and the similarity rule) consistent."""
import json, pathlib, re, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "frontend/src/data"
SQL = ROOT / "supabase/migrations/20261101000003_seed_demo_data.sql"

def comm(): return json.loads((DATA / "demo_community.json").read_text())

def test_generator_is_deterministic_and_in_sync(tmp_path):
    before = (DATA / "demo_community.json").read_text(), SQL.read_text()
    subprocess.run([sys.executable, str(ROOT / "scripts/generate_seed.py")], check=True, capture_output=True)
    assert before == ((DATA / "demo_community.json").read_text(), SQL.read_text()), "committed seed files are stale: re-run scripts/generate_seed.py"

def test_sql_seed_matches_json_and_is_idempotent():
    sql, c = SQL.read_text(), comm()
    assert len(re.findall(r"\('DEMO-\d{4}', true, (?:true|false)\)", sql)) == len(c["profiles"]) == 120
    assert sql.count("on conflict") >= 5 and not re.search(r"delete\s+from|drop\s+(table|schema|view)|truncate", sql.lower())   # additive and idempotent
    assert all("is_demo_content" in sql for _ in [0]) and sql.count("'published', true, true") == len(json.loads((DATA / "demo_stories.json").read_text()))

def test_dataset_is_flagged_synthetic():
    c = comm(); assert "Synthetic" in c["label"] and "Not real" in c["label"]
    assert sum(p["eligible"] for p in c["profiles"]) == 100
