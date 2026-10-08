# ML-Relay site

Task pages for the ML-Relay research tasks: the research question, the task
as the agent receives it, a viewer over each task's source code, the published
baselines with their code, the evaluation settings, the scoring and the results.

Served at https://imbernoulli.github.io/ml-relay-site/.

`src/data/` is generated, never edited by hand: the ML-Relay repository runs
its site generator in public mode on every update of its main branch, checks
the output for environment-building material (Dockerfiles, compose files,
`task.toml`, install and data-preparation scripts, dependency pins, test
harness), and pushes the JSON (`src/data/`) and the task images
(`public/task-images/`, WebP) here. Pushing to `main` rebuilds the site with
GitHub Pages.

Local preview:

    npm ci
    npm run dev
