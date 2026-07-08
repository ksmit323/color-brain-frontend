# Color Brain Frontend

This repo contains two independent Dioxus 0.7 projects, each its own Cargo project (no shared
workspace — they share zero code):

| Directory       | What it is                                                      | Deploys to           |
| ---------------- | ---------------------------------------------------------------- | --------------------- |
| [`app/`](./app)         | The operator-facing first-attempt recommendation app | `app.colorbrain.co` |
| [`landing/`](./landing) | The public marketing site                            | `colorbrain.co`      |

`AGENTS.md` (Dioxus 0.7 reference) and `CODING_RULES.md` (engineering principles) at this level
apply to both projects. See each directory's own `README.md` for setup, architecture, and
development instructions specific to that project.
