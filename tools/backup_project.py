#!/usr/bin/env python3
"""Export source without local state, dependencies, or embedded credentials."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import zipfile


ARCHIVE_NAME = "Masiyatunda-MilkyWay-BETA-BACKUP.zip"
EXCLUDED_DIRS = {
    ".git", "node_modules", "dist", "build", "coverage",
    ".cache", ".next", ".nuxt", ".output", "__pycache__", ".venv", "venv",
}
EXCLUDED_FILES = {".npmrc", ".pypirc", ".netrc", "credentials", "credentials.json"}
PROVIDER_KEY = re.compile(
    r"\b(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{12,}"
    r"|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+"
    r"|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]+)"
)
JWT = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
PRIVATE_KEY = re.compile(
    r"-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----.*?-----END (?:[A-Z ]*PRIVATE KEY)-----",
    re.DOTALL,
)
CREDENTIAL_LITERAL = re.compile(
    r"(?P<prefix>[\"']?\b[\w$]*(?:api_?key|anon_?key|service_role_?key|"
    r"api_?secret|password|passwd|access_?token|auth_?token|client_?secret|"
    r"secret_?key)[\w$]*[\"']?\s*[:=]\s*)(?P<quote>[\"'`])"
    r"(?P<value>[^\"'`\r\n]*)(?P=quote)",
    re.IGNORECASE,
)
URL_CREDENTIAL = re.compile(r"(?P<prefix>[a-z][a-z0-9+.-]*://)[^/\s\"'<>]+:[^/\s\"'<>]+@", re.IGNORECASE)
PLACEHOLDER = "BACKUP_RESTORE_CREDENTIAL"


def sanitize(text, preserve_test_fixtures=False):
    cleaned = text
    for pattern in (PRIVATE_KEY, PROVIDER_KEY, JWT):
        cleaned = pattern.sub(PLACEHOLDER, cleaned)

    def replace_literal(match):
        value = match.group("value")
        if not value or value.startswith("BACKUP_RESTORE_"):
            return match.group(0)
        if preserve_test_fixtures and value.strip() in {"test-only", "fixture-only", "fixture-public", "ephemeral-fixture-key", "ephemeral-fixture-signing"}:
            return match.group(0)
        return match.group("prefix") + match.group("quote") + PLACEHOLDER + match.group("quote")

    cleaned = CREDENTIAL_LITERAL.sub(replace_literal, cleaned)
    return URL_CREDENTIAL.sub(lambda match: match.group("prefix") + PLACEHOLDER + "@", cleaned)


def excluded_file(path):
    name = path.name.lower()
    return (
        name.startswith(".env") or name in EXCLUDED_FILES
        or name.startswith(("id_rsa", "id_ed25519", "service-account", "service_account"))
        or name.endswith((".pem", ".key", ".p12", ".pfx", ".keystore", ".pyc", ".zip", ".log", ".tmp", ".bak", ".tsbuildinfo"))
    )


def source_paths(root):
    for directory, directories, filenames in os.walk(root, followlinks=False):
        directories[:] = sorted(
            name for name in directories
            if name not in EXCLUDED_DIRS and not (Path(directory) / name).is_symlink()
        )
        for filename in sorted(filenames):
            path = Path(directory) / filename
            if not path.is_symlink() and not excluded_file(path):
                yield path


def export_backup(root, output):
    if output.is_relative_to(root):
        raise ValueError("Choose a private output location outside the website repository.")
    if output.exists():
        raise FileExistsError("The requested archive already exists; it was not overwritten.")
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    originals = {}
    sanitized_paths = []
    entries = []
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".zip", delete=False) as temporary:
            temporary_path = Path(temporary.name)
        with zipfile.ZipFile(temporary_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in source_paths(root):
                relative = path.relative_to(root).as_posix()
                original = path.read_bytes()
                originals[relative] = hashlib.sha256(original).hexdigest()
                try:
                    text = original.decode("utf-8")
                except UnicodeDecodeError:
                    if sanitize(original.decode("latin-1")) != original.decode("latin-1"):
                        raise ValueError(f"Potential credential in binary file: {relative}")
                    payload = original
                else:
                    cleaned = sanitize(text, preserve_test_fixtures=relative.endswith(".test.mjs"))
                    payload = cleaned.encode("utf-8")
                    if cleaned != text:
                        sanitized_paths.append(relative)
                archive.writestr(relative, payload)
                entries.append(relative)
            manifest = {
                "source_files": len(entries),
                "files": entries,
                "sanitized_files": sanitized_paths,
                "credential_placeholder": PLACEHOLDER,
                "excluded_directories": sorted(EXCLUDED_DIRS),
                "excluded_files": "Environment files, credential files, private keys, symlinks, ZIPs, logs and temporary files.",
                "restore": "Restore credentials privately before running. Configure Supabase/LiveKit server secrets in their deployment environments, never browser source. This is a source backup, not a database or hosted-media export.",
            }
            archive.writestr("BACKUP-MANIFEST.json", json.dumps(manifest, indent=2) + "\n")
        with zipfile.ZipFile(temporary_path) as archive:
            if archive.testzip() is not None:
                raise ValueError("ZIP integrity check failed.")
            if set(archive.namelist()) != set(entries + ["BACKUP-MANIFEST.json"]):
                raise ValueError("ZIP completeness check failed.")
            for entry in entries:
                content = archive.read(entry).decode("utf-8", errors="replace")
                if sanitize(content, preserve_test_fixtures=entry.endswith(".test.mjs")) != content:
                    raise ValueError(f"Credential audit failed: {entry}")
        for relative, digest in originals.items():
            if hashlib.sha256((root / relative).read_bytes()).hexdigest() != digest:
                raise ValueError(f"Source changed during export: {relative}")
        os.link(temporary_path, output)
        print(json.dumps({
            "archive": str(output), "source_files": len(entries),
            "sanitized_files": sanitized_paths, "bytes": output.stat().st_size,
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "checks": "ZIP integrity, completeness, credential-pattern audit, originals unchanged",
        }, indent=2))
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="ZIP path outside the repository")
    arguments = parser.parse_args()
    export_backup(Path(__file__).resolve().parent.parent, arguments.output.expanduser().resolve())


if __name__ == "__main__":
    main()
