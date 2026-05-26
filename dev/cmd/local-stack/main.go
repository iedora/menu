// Local stack orchestrator. Thin shim over `docker compose` —
// translates --only/--except into compose profiles, brings the stack
// up, runs the `core` product's drizzle migrations against the local
// `core` DB, composes products/menu/.env, then starts the menu
// container.
//
// All paths resolve relative to the repo root (the `go run` working
// directory is the repo root for `go run ./dev/cmd/local-stack`).
package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/eduvhc/iedora/internal/mode"
)

// currentMode pins this binary to Local. The orchestrator never touches
// BWS, real cloud APIs, or the live infra — see docs/deploy.md
// § Environment guardrails (Rule 1).
var currentMode = mode.Local

func main() {
	currentMode.Require(mode.Local)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	cli := parseFlags()

	repoRoot := findRepoRoot()
	composeDir := filepath.Join(repoRoot, "dev")
	menuDir := filepath.Join(repoRoot, "products/menu")
	envPath := filepath.Join(menuDir, ".env")
	envLocalPath := filepath.Join(menuDir, ".env.local")

	switch {
	case cli.destroy:
		runDestroy(ctx, composeDir, envLocalPath)
		return
	case cli.resetDB != "":
		runResetDB(ctx, cli.resetDB)
		return
	}

	selected, err := cli.resolveSelection()
	if err != nil {
		fail("%v", err)
	}
	fmt.Printf("%s selection: %v\n", logPrefix, selected)

	warnEnvLocalState(envLocalPath, selected)

	// 1. compose up everything EXCEPT menu — menu needs .env which
	//    we compose after migrations land.
	step(1, "docker compose up — infra services")
	composeUp(ctx, composeDir, withoutMenu(selected))

	// 2. Run the `core` product's drizzle migrations against the local
	//    `core` DB. Replaces the old bin/zitadel-apply step — better-auth
	//    lives in-process inside each product container, but the schema
	//    lives in the shared Postgres and must exist before menu boots.
	if contains(selected, "postgres") {
		step(2, "core migration — drizzle-kit migrate against the core DB")
		runCoreMigrations(ctx, repoRoot)
	}

	// 3. Compose menu's .env from local statics.
	step(3, "compose products/menu/.env + .env.local")
	writeMenuEnvFiles(envPath, envLocalPath, selected)

	// 4. Start menu now that .env exists.
	if contains(selected, "menu") {
		step(4, "docker compose up — menu")
		composeUp(ctx, composeDir, []string{"menu"})
	}

	printNextSteps(selected)
}

// runCoreMigrations execs `bun run --cwd packages/auth db:migrate`
// against the local Postgres `core` DB. The migrations are owned by
// the `core` product (packages/auth ships the schema today; future
// audit/admin tables land in the same drizzle folder). Idempotent —
// drizzle's tracker table skips applied migrations on warm runs.
func runCoreMigrations(ctx context.Context, repoRoot string) {
	cmd := exec.CommandContext(ctx, "bun", "run", "--cwd", "packages/auth", "db:migrate")
	cmd.Dir = repoRoot
	cmd.Env = append(os.Environ(),
		"CORE_DATABASE_URL=postgresql://postgres:Password1!@localhost:5432/core",
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fail("auth migrations failed: %v\nhint: docker logs infra-postgres", err)
	}
}
