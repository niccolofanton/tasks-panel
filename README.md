# tasks-panel

A pane beside the chat listing running tasks: description, percent, time left, end time, machine and status.
Each session shows only its own tasks: the CLI tags them with `$CLAUDE_CODE_SESSION_ID` (or `--session`).
Data comes from `~/.claude/tasks-panel/tasks.json` (override with `TASKS_PANEL_FILE`), polled every 2 s.
Percent and ETA come from step/total and the time elapsed since the first update. A running task with no
update for `--stale-after` seconds (default 60) shows as `stalled`. Open it with `/tasks-panel`.

```sh
bin/tasks-panel set build --desc "Bake lighting for the main hall scene" --step 4 --total 20 --machine gpu-box
bin/tasks-panel done build
bin/tasks-panel clear
```

`bin/demo.sh` runs a demo task that advances every 10 s.

## Install

From GitHub:

```sh
claude plugin marketplace add niccolofanton/tasks-panel
claude plugin install tasks-panel@tasks-panel
ln -s ~/.claude/plugins/marketplaces/tasks-panel/bin/tasks-panel ~/.local/bin/tasks-panel
```

Locally, from this folder: `claude plugin marketplace add <this folder>` then `claude plugin install tasks-panel@tasks-panel`.
