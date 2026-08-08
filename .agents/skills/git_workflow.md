# Git Workflow

**Layer 2 - Knowledge Layer**

This document specifies the branching and commit conventions for the O.D.I.N. project.

## Conventions
- **Branching Strategy:**
  - The `main` branch holds the stable, functional code.
  - Create one feature branch per milestone (e.g., `feature/milestone-1-scaffold`).
  - No direct commits to `main` are allowed by any automated agent or human.
- **Committing:**
  - A pre-commit secret scan (`gitleaks`) MUST pass before any commit is finalized.
  - Write clear, descriptive commit messages.
- **Merging:**
  - Pull requests to `main` require a human review (the Product Owner).
  - "Accept all" auto-merging is strictly prohibited.
