# Guidelines for AI Coding Agents

## 1. Language & Documentation
- All documentation, guides, README files, architectural plans, code comments, and technical specifications must be written strictly in English.
- User-facing chat responses may be in the user's preferred language (e.g. French), but all repository artifacts, code, and documentation must remain entirely in English.

## 2. Commit & Push Policy
- NEVER create a git commit or push changes to remote branches without explicit user confirmation that the implementation has been tested and verified to work.
- Always present the proposed changes, test results, or instructions first, and wait for user approval before making a commit.
- Never publish automated releases without explicit user authorization.

## 3. Zero Emoji Policy
- Do not use emojis anywhere in the codebase.
- No emojis in git commit messages, code comments, console output, UI templates, documentation, or chat responses.

## 4. Production & Deployment Boundaries
- Never restart, deploy, or run destructive operations autonomously on live production hosts (such as debian@192.168.2.3).
- Propose migration or update steps clearly and wait for explicit user consent before performing server-level actions.

## 5. Architectural Principles
- Decouple persistent game data (/games) from container images and ephemeral configuration.
- Prevent regressions across updates by using self-healing startup routines and defensive defaults.
- Avoid hardcoding specific private IP addresses, personal credentials, or local environment paths in default configs.
