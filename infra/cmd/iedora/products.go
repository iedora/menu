package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// product describes one deployable Tofu root + (optional) build step
// alongside the central infra. Each entry in `products` becomes one
// fan-out goroutine in runDeploy / runDestroy. Deliberately explicit
// (not filesystem-discovered) so deploy order + ownership is legible.
//
// Adding a product:
//  1. mkdir products/<name>/infra/tofu/ + drop in your Tofu root.
//  2. Append one entry to `products` below.
//  3. (If it'll be deployed independently via its own CI workflow,
//     also add the workflow under .github/workflows/.)
//
// The orchestrator does the rest.
type product struct {
	// name is the human-readable label, surfaced in stderr lines like
	// "  - house deploy complete". Lowercase, no spaces.
	name string

	// infraRel is the path to the product's Tofu root, relative to
	// the repo root (e.g. "products/house/infra"). The directory
	// must contain a `tofu/` subdir that `tofu -chdir=tofu …` enters.
	infraRel string

	// siteRel is the directory the build step runs in, relative to
	// the repo root. Empty when there's no build step (Tofu-only
	// product). For house, this is "products/house" so Astro reads
	// its config from there.
	siteRel string

	// build is the command vector to exec in siteRel before `tofu
	// apply`. nil to skip the build phase entirely. Example:
	// []string{"bun", "run", "build"}. The command inherits the
	// orchestrator's env (which carries BWS-hydrated TF_VAR_*).
	build []string

	// dependsOnCentral gates when the product is deployed/destroyed:
	//   false → run in parallel with central (no resource deps).
	//   true  → on deploy, wait until central succeeds; on destroy,
	//           run BEFORE central so the product's destroy can still
	//           reference central-side outputs (Postgres URL, etc).
	dependsOnCentral bool
}

// products is the explicit registry. Order is irrelevant — fan-out
// happens in goroutines and dependsOnCentral controls phase.
var products = []product{
	{
		name:             "house",
		infraRel:         "products/house/infra",
		siteRel:          "products/house",
		build:            []string{"bun", "run", "build"},
		dependsOnCentral: false, // pure Cloudflare; no Hetzner/Zitadel deps
	},
}

// productResult is what each fan-out goroutine pushes onto its channel
// — name+err pair so the collector can keep error messages attached
// to the product they're from.
type productResult struct {
	name string
	err  error
}

// repoRoot is `<infraDir>/..` — same resolution every product path
// here is built on.
func repoRoot() string { return filepath.Dir(infraDir()) }

func (p product) absInfraDir() string { return filepath.Join(repoRoot(), p.infraRel) }
func (p product) absSiteDir() string {
	if p.siteRel == "" {
		return ""
	}
	return filepath.Join(repoRoot(), p.siteRel)
}

// deployProduct: optional build → tofu init → tofu apply. Inherits the
// caller's env (parent already hydrated TF_VAR_* via bin/with-secrets).
//
// Recognizes the known Cloudflare assets-upload-session transient
// (workers-sdk#11153) and substitutes a friendly retry message; any
// other apply failure propagates as-is.
func deployProduct(ctx context.Context, p product) error {
	infra := p.absInfraDir()
	if _, err := os.Stat(infra); err != nil {
		return fmt.Errorf("%s infra dir %s not found: %w", p.name, infra, err)
	}

	// 1. Build (optional). Astro / Bun / equivalent — runs in siteRel,
	//    emits dist/ (or whatever) that tofu apply picks up via a
	//    relative-path asset directory in the .tf.
	if site := p.absSiteDir(); site != "" && len(p.build) > 0 {
		buildCmd := exec.CommandContext(ctx, p.build[0], p.build[1:]...)
		buildCmd.Dir = site
		buildCmd.Env = os.Environ()
		buildCmd.Stdout = stderr
		buildCmd.Stderr = stderr
		if err := buildCmd.Run(); err != nil {
			return fmt.Errorf("%s build (%s): %w", p.name, strings.Join(p.build, " "), err)
		}
	}

	// 2. Provider download/upgrade. -upgrade so a freshly-bumped CF
	//    provider in versions.tf is picked up without a manual init.
	initCmd := exec.CommandContext(ctx, "tofu", "-chdir=tofu", "init", "-upgrade", "-input=false")
	initCmd.Dir = infra
	initCmd.Env = os.Environ()
	initCmd.Stdout = io.Discard // chatty, suppress
	initCmd.Stderr = stderr
	if err := initCmd.Run(); err != nil {
		return fmt.Errorf("%s tofu init: %w", p.name, err)
	}

	// 3. Apply. Capture stderr so we can recognize the CF
	//    assets-upload-session 500 ("entitlements.not_available" — a
	//    misleading server-side label, see cloudflare/workers-sdk#11153)
	//    and surface an actionable hint instead of the raw 500 body.
	var stderrBuf bytes.Buffer
	applyCmd := exec.CommandContext(ctx, "tofu", "-chdir=tofu", "apply", "-auto-approve")
	applyCmd.Dir = infra
	applyCmd.Env = os.Environ()
	applyCmd.Stdout = stderr
	applyCmd.Stderr = io.MultiWriter(stderr, &stderrBuf)
	if err := applyCmd.Run(); err != nil {
		out := stderrBuf.String()
		if strings.Contains(out, "assets-upload-session") && strings.Contains(out, "entitlements.not_available") {
			return fmt.Errorf("%s tofu apply: known Cloudflare transient (10007 on assets-upload-session — see cloudflare/workers-sdk#11153). Retry in 15–30 min; nothing to fix on your end", p.name)
		}
		return fmt.Errorf("%s tofu apply: %w", p.name, err)
	}
	return nil
}

// destroyProduct: tofu init (in case provider cache is cold) → tofu
// destroy. Always returns its own error; the caller decides whether
// to fail-fast or collect-and-continue.
func destroyProduct(ctx context.Context, p product) error {
	infra := p.absInfraDir()
	if _, err := os.Stat(infra); err != nil {
		return fmt.Errorf("%s infra dir %s not found: %w", p.name, infra, err)
	}

	initCmd := exec.CommandContext(ctx, "tofu", "-chdir=tofu", "init", "-input=false")
	initCmd.Dir = infra
	initCmd.Env = os.Environ()
	initCmd.Stdout = io.Discard
	initCmd.Stderr = stderr
	if err := initCmd.Run(); err != nil {
		return fmt.Errorf("%s tofu init: %w", p.name, err)
	}

	destroyCmd := exec.CommandContext(ctx, "tofu", "-chdir=tofu", "destroy", "-auto-approve")
	destroyCmd.Dir = infra
	destroyCmd.Env = os.Environ()
	destroyCmd.Stdout = stderr
	destroyCmd.Stderr = stderr
	if err := destroyCmd.Run(); err != nil {
		return fmt.Errorf("%s tofu destroy: %w", p.name, err)
	}
	return nil
}

// fanOutDeploy launches a deployProduct goroutine for every product
// whose dependsOnCentral matches the given filter. Returns a channel
// the caller drains (one result per launched product) plus the count
// so the drain loop knows how many to expect.
func fanOutDeploy(ctx context.Context, dependsOnCentral bool) (<-chan productResult, int) {
	ch := make(chan productResult, len(products))
	count := 0
	for _, p := range products {
		if p.dependsOnCentral != dependsOnCentral {
			continue
		}
		count++
		go func(p product) {
			fmt.Fprintf(stderr, "→ %s: build + tofu apply (parallel)\n", p.name)
			ch <- productResult{name: p.name, err: deployProduct(ctx, p)}
		}(p)
	}
	return ch, count
}

// fanOutDestroy is the destroy-side counterpart. Same filter
// semantics, same return shape.
func fanOutDestroy(ctx context.Context, dependsOnCentral bool) (<-chan productResult, int) {
	ch := make(chan productResult, len(products))
	count := 0
	for _, p := range products {
		if p.dependsOnCentral != dependsOnCentral {
			continue
		}
		count++
		go func(p product) {
			fmt.Fprintf(stderr, "→ %s: tofu destroy (parallel)\n", p.name)
			ch <- productResult{name: p.name, err: destroyProduct(ctx, p)}
		}(p)
	}
	return ch, count
}
