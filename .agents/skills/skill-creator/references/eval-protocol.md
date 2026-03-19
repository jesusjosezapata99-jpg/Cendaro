# In-Agent Evaluation Protocol

## Native Antigravity Protocol — Opus 4.6 In-Context Evaluation

Evaluation runs entirely inside Opus 4.6's context. No external scripts, no API calls.
Results appear directly in the Antigravity chat.

---

## When to Run Evaluation

Run evaluation after:

- Writing a new skill (before presenting to user)
- Making significant changes to an existing skill
- When the user asks "does this skill work?" or "test this skill"

Skip evaluation for:

- Trivial changes (typo fixes, formatting)
- Pure Reference Loader skills with static content (accuracy is verifiable by reading)

---

## Step 1 — Define Test Cases

Generate 4-6 test prompts covering:

| Case type             | Purpose                             | Example                                          |
| --------------------- | ----------------------------------- | ------------------------------------------------ |
| **Direct match**      | Skill description matches perfectly | Exactly what the description says                |
| **Paraphrased match** | User says it differently            | Same intent, different words                     |
| **Edge case**         | Boundary condition                  | Ambiguous or minimal request                     |
| **Negative case**     | Should NOT trigger this skill       | Adjacent topic that belongs to a different skill |
| **Complex case**      | Realistic real-world prompt         | Multi-part or detailed request                   |

---

## Step 2 — Simulate Execution

For each test case, reason through:

1. **Would this skill trigger?** Given the `description` frontmatter, would Opus semantic-match this prompt to the skill? (Yes / No / Maybe)
2. **What would Opus do?** With the skill body loaded, trace the agent's likely execution path
3. **Does the output match expected?** Does the skill give enough guidance to produce correct output?
4. **What's missing or wrong?** Identify specific gaps in the skill body

---

## Step 3 — Report in Chat

Output the evaluation as a structured table:

```markdown
## Skill Evaluation — [skill-name]

| #   | Test Prompt | Triggers? | Output Quality | Issue                                   |
| --- | ----------- | --------- | -------------- | --------------------------------------- |
| 1   | "[prompt]"  | ✅ Yes    | ✅ Correct     | —                                       |
| 2   | "[prompt]"  | ✅ Yes    | ⚠️ Partial     | Missing constraint for edge case X      |
| 3   | "[prompt]"  | ❌ No     | ❌ N/A         | Description doesn't match this phrasing |
| 4   | "[prompt]"  | ❌ No     | ✅ Correct     | Correctly NOT triggered (negative case) |
| 5   | "[prompt]"  | ✅ Yes    | ✅ Correct     | —                                       |

**Pass rate**: 4/5 (80%)
**Issues found**:

1. [Issue 1 — specific, with proposed fix]
2. [Issue 2 — specific, with proposed fix]

**Recommendation**: [Iterate on X / Ready to package]
```

---

## Step 4 — Iterate

If pass rate < 80% or any direct/paraphrased match case fails:

1. Identify the root cause (description too vague? body missing a constraint? wrong pattern?)
2. Apply the fix directly
3. Re-run the affected test cases
4. Repeat until pass rate ≥ 80% and all direct match cases pass

---

## Step 5 — Description Trigger Optimization

After the body is stable, optimize the `description` field specifically for triggering accuracy.

Test the description against this checklist:

| Question                                                   | Required answer |
| ---------------------------------------------------------- | --------------- |
| Does it match when the user says the most obvious thing?   | Yes             |
| Does it match when the user paraphrases?                   | Yes             |
| Does it avoid matching unrelated skills?                   | Yes             |
| Does it include at least 2 concrete trigger phrases?       | Yes             |
| Is it free of vague words ("helps", "various", "general")? | Yes             |

Read `references/description-guide.md` for rewriting patterns if the description fails this check.

---

## Evaluation Anti-Patterns

These indicate a skill needs work — catch them during evaluation:

| Anti-pattern                                        | Root cause                                         | Fix                                            |
| --------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| Skill triggers but agent ignores its instructions   | Body is too procedural — Opus overrides step lists | Rewrite as goal + constraints                  |
| Skill never triggers despite matching prompts       | Description too narrow or uses wrong vocabulary    | Add paraphrased trigger phrases                |
| Skill triggers on wrong prompts                     | Description too broad                              | Add explicit "do NOT use for X" to description |
| Agent asks too many clarifying questions            | Body doesn't resolve common ambiguities            | Add default assumptions to body                |
| Agent produces inconsistent output                  | Missing constraints or examples                    | Add few-shot examples (Pattern 3)              |
| Skill works for simple cases but fails complex ones | Single-task skill trying to do too much            | Split into Pattern 6 (Composite)               |
