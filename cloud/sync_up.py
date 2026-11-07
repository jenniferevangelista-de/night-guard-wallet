"""Sends the repo's files (tracked + new, not ignored) to the Codespace. Runs on the PC."""
import hashlib, io, os, subprocess, sys, tarfile
CS = "miserable-coffin-65564545qg9h57q"
DEST = "/workspaces/claude-cloud-workspace/projects/night-guard-wallet"
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=root, capture_output=True, text=True, check=True).stdout.split("\n")
files = [f for f in files if f and os.path.isfile(os.path.join(root, f))]
out = os.path.join(os.environ.get("TEMP", "/tmp"), "ngw_sync.tar.gz")
with tarfile.open(out, "w:gz") as t:
    for f in files:
        ti = t.gettarinfo(os.path.join(root, f), arcname=f)
        ti.mode = 0o755 if f.endswith(".sh") else 0o644
        with open(os.path.join(root, f), "rb") as fh:
            t.addfile(ti, fh)
gh = r"C:\Program Files\GitHub CLI\gh.exe"
subprocess.run([gh, "codespace", "cp", "-c", CS, "-e", out, "remote:/workspaces/ngw_sync.tar.gz"], check=True)
cmd = f"mkdir -p {DEST} && cd {DEST} && python3 -c \"import tarfile; t=tarfile.open('/workspaces/ngw_sync.tar.gz'); t.extractall('.', filter='data')\" && echo synced {len(files)} files"
subprocess.run([gh, "codespace", "ssh", "-c", CS, "--", cmd], check=True)
os.remove(out)
