# Contributing to Kyber Cloud Gaming

Thank you for your interest in contributing to Kyber Cloud Gaming. This document outlines guidelines and development practices for submitting bug reports, feature requests, and pull requests.

---

## Development Standards

### 1. Language & Documentation
- All code, comments, documentation, commit messages, and technical specifications must be written strictly in English.

### 2. Zero Emoji Policy
- Do not use emojis anywhere in the codebase.
- No emojis in git commit messages, code comments, console output, UI templates, documentation, or chat responses.

### 3. Architectural Principles
- Decouple persistent game data (`/games`) from container images and configuration.
- Prevent regressions across updates by using defensive defaults and self-healing startup routines.
- Avoid hardcoding specific private IP addresses, personal credentials, or local environment paths in default configs.

---

## Local Development & Testing

### Running Python Control Service Tests
```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```

### Building & Testing the Tauri Desktop Client
```bash
cd desktop-client/src-tauri
cargo test
cargo check
```

To run the desktop client with hot-reload in development:
```bash
cd desktop-client
cargo tauri dev
```

---

## Submitting Pull Requests

1. Fork the repository and create a descriptive feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Verify that all existing unit tests pass:
   ```bash
   python3 -m unittest discover tests
   cd desktop-client/src-tauri && cargo test
   ```
3. Commit your changes using conventional commit conventions (e.g. `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).
4. Ensure no temporary build files, `.env` files, or TLS certificates are staged.
5. Push your branch and open a Pull Request against `main`.
