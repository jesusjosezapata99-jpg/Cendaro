# Scripts — Skill Creator

Two utility scripts. Both require Python 3.9+ and PyYAML.

**One-time setup:**

```bash
pip install pyyaml
```

---

## package_skill.py — Package a skill for distribution

Bundles a skill directory into a `.skill` file that can be shared and installed.

**Must be run as a module from inside the `skill-creator/` directory:**

```bash
# Windows (PowerShell):
cd $env:USERPROFILE\.gemini\antigravity\skills\skill-creator
python -m scripts.package_skill [path-to-skill] [output-directory]

# Mac/Linux:
cd ~/.gemini/antigravity/skills/skill-creator
python -m scripts.package_skill ./my-skill ./dist
# → Creates dist/my-skill.skill
```

**Why `-m scripts.package_skill` not `python scripts/package_skill.py`**:
`package_skill.py` imports `from scripts.quick_validate import validate_skill` internally.
Running it as a module (`-m`) sets the correct Python path so this import resolves.
Running it as a script directly (`python scripts/package_skill.py`) fails with `ModuleNotFoundError`.

---

## quick_validate.py — Validate a SKILL.md file

Checks that a SKILL.md has the required frontmatter and structure.

```bash
# From inside the skill-creator/ directory:
python -m scripts.quick_validate [path-to-skill-directory]

# Example:
python -m scripts.quick_validate ./my-skill
# → ✅ Skill is valid  OR  ❌ Error: [description of problem]
```

**What it checks:**

- YAML frontmatter is valid and parseable
- `description` field is present (required for triggering)
- `name` field format is valid if present (lowercase, hyphens only)
- No obvious structural errors

---

## Requirements

- Python 3.9+
- PyYAML: `pip install pyyaml`
