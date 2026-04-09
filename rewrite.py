import sys
lines = sys.stdin.readlines()
cleaned = [l for l in lines if 'Co-Authored-By' not in l and 'co-authored-by' not in l.lower()]
sys.stdout.writelines(cleaned)
