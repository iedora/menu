// Dev container orchestrator. One declarative source (OpenTofu) for
// dev AND prod — `infra/modules/services/*` are the building blocks,
// `infra/dev/tofu/` is the dev root, `infra/tofu/` is the prod root.
// No docker-compose.
//
// Default: bring everything up — `just dev`.
//
// Subset selection (each service is a `enable_*` TF input):
//   just dev -i                    interactive TUI per category
//   just dev --only menu           everything menu needs (zitadel + …)
//   just dev --only zitadel        zitadel + postgres only
//   just dev --except openobserve  everything else, deps preserved
//
// The host apps (Next dev for menu) are NOT launched by this script —
// each product owns its own `bun run dev`. The summary at the end
// points the user at the right URLs (always read from the canonical
// source: .env / `docker port`).

package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/huh"
)

// ── Service graph ───────────────────────────────────────────────────────────

type category string

const (
	catInfra    category = "infra"
	catProducts category = "products"
)

type service struct {
	name     string   // selection key + TF enable_* suffix + TUI label
	tfVar    string   // empty for products (they're presets, not TF gates)
	deps     []string // transitive selection deps (other service.name values)
	cat      category
	hostRun  bool // true if launched on the host (next dev), false if TF-managed
}

// Ordered for deterministic UI rendering.
var allServices = []service{
	{name: "postgres", tfVar: "enable_postgres", cat: catInfra},
	{name: "localstack", tfVar: "enable_localstack", cat: catInfra},
	{name: "zitadel", tfVar: "enable_zitadel", deps: []string{"postgres"}, cat: catInfra},
	{name: "openobserve", tfVar: "enable_openobserve", deps: []string{"localstack"}, cat: catInfra},
	{name: "house", tfVar: "enable_house", cat: catProducts},
	// `menu` is a preset — selecting it expands to its dep set. It
	// has no TF resource itself (menu runs host-side via `bun run
	// dev` in products/menu/, where HMR works).
	{name: "menu", deps: []string{"postgres", "localstack", "zitadel", "openobserve"}, cat: catProducts, hostRun: true},
}

func serviceByName(n string) (service, bool) {
	for _, s := range allServices {
		if s.name == n {
			return s, true
		}
	}
	return service{}, false
}

func defaultSelection() []string {
	out := make([]string, 0, len(allServices))
	for _, s := range allServices {
		out = append(out, s.name)
	}
	return out
}

// expandDeps closes `selected` over `service.deps`. Result is sorted.
func expandDeps(selected []string) []string {
	set := map[string]bool{}
	var dfs func(string)
	dfs = func(n string) {
		if set[n] {
			return
		}
		set[n] = true
		s, ok := serviceByName(n)
		if !ok {
			fail("unknown service %q", n)
		}
		for _, d := range s.deps {
			dfs(d)
		}
	}
	for _, n := range selected {
		dfs(n)
	}
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	interactive := flag.Bool("i", false, "interactive selection (TUI per category)")
	flag.BoolVar(interactive, "interactive", false, "alias for -i")
	only := flag.String("only", "", "comma-separated services to start (+ their deps); skips everything else")
	except := flag.String("except", "", "comma-separated services to skip; everything else (+ their deps) starts")
	flag.Parse()

	selected, err := resolveSelection(*interactive, *only, *except)
	if err != nil {
		fail("%v", err)
	}
	selected = expandDeps(selected)
	if *except != "" {
		blocked := map[string]bool{}
		for _, n := range splitCSV(*except) {
			blocked[n] = true
		}
		filtered := selected[:0]
		for _, n := range selected {
			if !blocked[n] {
				filtered = append(filtered, n)
			}
		}
		selected = filtered
	}
	if len(selected) == 0 {
		fail("empty selection — pick at least one service")
	}

	repoRoot := findRepoRoot()
	devTofuDir := filepath.Join(repoRoot, "infra/dev/tofu")
	menuDir := filepath.Join(repoRoot, "products/menu")

	fmt.Printf("[dev] selection: %s\n", strings.Join(selected, ", "))

	// Build the -var flags for the enable_* toggles. Anything not in
	// `selected` defaults to false; selected items pass true.
	enableVars := []string{}
	for _, s := range allServices {
		if s.tfVar == "" {
			continue
		}
		enableVars = append(enableVars,
			"-var", fmt.Sprintf("%s=%t", s.tfVar, contains(selected, s.name)))
	}

	step(1, "tofu init")
	runIn(devTofuDir, "tofu", "init", "-upgrade", "-input=false")

	step(2, "tofu apply -target=... (containers — first pass)")
	// First pass targets the docker resources only. zitadel_* /
	// random_password / module.menu_env need the runtime PAT and
	// aren't part of this pass; targeting keeps stale state from
	// previous failed runs from tripping the apply.
	applyArgs := []string{
		"apply", "-auto-approve", "-input=false",
		"-target=docker_network.dev",
		"-target=docker_volume.postgres_data",
		"-target=docker_volume.localstack_data",
		"-target=docker_volume.openobserve_data",
		"-target=docker_container.zitadel_bootstrap_chmod",
		"-target=module.postgres",
		"-target=module.localstack",
		"-target=module.zitadel",
		"-target=module.zitadel_login",
		"-target=module.openobserve",
		"-target=docker_image.house",
		"-target=module.house",
		"-var", "zitadel_pat=",
	}
	applyArgs = append(applyArgs, enableVars...)
	runIn(devTofuDir, "tofu", applyArgs...)

	if contains(selected, "zitadel") {
		step(3, "wait for FirstInstance PAT + Zitadel API ready")
		patPath := filepath.Join(repoRoot, "infra/dev/.zitadel-bootstrap/menu-sa.pat")
		if err := waitForFile(patPath, 60*time.Second); err != nil {
			fail("%v\nhint: docker logs infra-zitadel", err)
		}
		// PAT existing means FirstInstance ran but the HTTP/gRPC server
		// may still be coming up. Block on /debug/ready (Zitadel's
		// readiness probe) before the seed apply.
		if err := waitForHTTPOK("http://localhost:8080/debug/ready", 60*time.Second); err != nil {
			fail("%v\nhint: docker logs infra-zitadel", err)
		}
		patBytes, _ := os.ReadFile(patPath)
		pat := strings.TrimSpace(string(patBytes))

		step(4, "tofu apply (seed Zitadel + emit env files)")
		seedArgs := append([]string{"apply", "-auto-approve", "-input=false"}, enableVars...)
		seedArgs = append(seedArgs, "-var", "zitadel_pat="+pat)
		runIn(devTofuDir, "tofu", seedArgs...)

		// Write the two env files from TF outputs.
		writeEnvFile(filepath.Join(menuDir, ".env"),
			captureIn(devTofuDir, "tofu", "output", "-raw", "env_committable_file"),
			false, 0o644)
		writeEnvFile(filepath.Join(menuDir, ".env.local"),
			captureIn(devTofuDir, "tofu", "output", "-raw", "env_dynamic_file"),
			true, 0o600)
	} else if contains(selected, "menu") {
		warn("zitadel opted out — products/menu/.env.local NOT updated. Provide ZITADEL_OAUTH_CLIENT_ID/SECRET/MANAGEMENT_TOKEN yourself or auth flows will 500.")
	}

	printNextSteps(selected, repoRoot, devTofuDir)
}

// ── Selection: flags + interactive ──────────────────────────────────────────

func resolveSelection(interactive bool, only, except string) ([]string, error) {
	if interactive {
		return runTUI()
	}
	if only != "" && except != "" {
		return nil, fmt.Errorf("--only and --except are mutually exclusive")
	}
	if only != "" {
		return splitCSV(only), nil
	}
	if except != "" {
		excluded := map[string]bool{}
		for _, n := range splitCSV(except) {
			excluded[n] = true
		}
		out := []string{}
		for _, s := range allServices {
			if !excluded[s.name] {
				out = append(out, s.name)
			}
		}
		return out, nil
	}
	return defaultSelection(), nil
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func runTUI() ([]string, error) {
	groups := map[category][]huh.Option[string]{}
	for _, s := range allServices {
		groups[s.cat] = append(groups[s.cat], huh.NewOption(s.name, s.name).Selected(true))
	}

	var infraSelected, productsSelected []string
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("infra").
				Description("Backing services. Postgres + LocalStack required for any menu work; Zitadel optional if pointing at a remote IdP; OpenObserve optional.").
				Options(groups[catInfra]...).
				Value(&infraSelected),
		),
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("products").
				Description("Pick what you'll be working on. `menu` boots host-side (cd products/menu && bun run dev). `house` runs in a container.").
				Options(groups[catProducts]...).
				Value(&productsSelected),
		),
	)
	if err := form.Run(); err != nil {
		return nil, err
	}
	return append(infraSelected, productsSelected...), nil
}

// ── Summary + file helpers ──────────────────────────────────────────────────

func printNextSteps(selected []string, repoRoot, tofuDir string) {
	fmt.Println()
	fmt.Println("[dev] infra is up.")
	if contains(selected, "menu") {
		url := readEnvVar(filepath.Join(repoRoot, "products/menu/.env"), "MENU_PUBLIC_URL")
		fmt.Printf("  host:      cd products/menu && bun run dev   # %s\n", url)
	}
	if contains(selected, "house") {
		fmt.Printf("  container: %s              # Astro static (busybox httpd)\n",
			composePort(tofuDir, "infra-house", "80"))
	}
	if !contains(selected, "menu") && !contains(selected, "house") {
		fmt.Println("  (no product selected — infra stays up for ad-hoc work)")
	}
}

func writeEnvFile(path, body string, dynamic bool, mode os.FileMode) {
	if body == "" {
		return // first-pass apply doesn't produce these outputs
	}
	header := envHeader(dynamic)
	if err := os.WriteFile(path, []byte(header+body+"\n"), mode); err != nil {
		fail("write %s: %v", path, err)
	}
}

func envHeader(dynamic bool) string {
	if dynamic {
		return "# AUTO-GENERATED by `bun run dev` (infra/modules/menu_env).\n" +
			"# Holds the dynamic dev secrets (Zitadel client + session key) —\n" +
			"# rewritten on every run. Hand-edits survive until the next run;\n" +
			"# permanent overrides go in `.env` (committed).\n\n"
	}
	return "# AUTO-GENERATED by `bun run dev` (infra/modules/menu_env).\n" +
		"# Static dev defaults + Zod-valid placeholders for the dynamic keys.\n" +
		"# Real values for the dynamic keys live in `.env.local` (gitignored,\n" +
		"# regenerated by every `bun run dev`).\n" +
		"# Commit changes here when the env schema evolves.\n\n"
}

func readEnvVar(path, key string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	prefix := key + "="
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, prefix) {
			return strings.TrimPrefix(line, prefix)
		}
	}
	return ""
}

// composePort returns the host port a container's internal port maps to.
// Replaces the compose-port lookup with a direct `docker port`.
func composePort(_ /*tofuDir*/, container, internal string) string {
	out, err := exec.Command("docker", "port", container, internal).Output()
	if err != nil {
		return "(docker port " + container + " " + internal + " failed)"
	}
	raw := strings.TrimSpace(string(out))
	// Multiple lines (IPv4 + IPv6); take the first.
	if idx := strings.IndexByte(raw, '\n'); idx >= 0 {
		raw = raw[:idx]
	}
	if idx := strings.LastIndex(raw, ":"); idx >= 0 {
		return "http://localhost" + raw[idx:]
	}
	return raw
}

// ── Process helpers ──────────────────────────────────────────────────────────

func findRepoRoot() string {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		fail("runtime.Caller failed")
	}
	return filepath.Dir(filepath.Dir(filepath.Dir(thisFile)))
}

func step(n int, msg string) {
	fmt.Printf("[dev] %d/4  %s\n", n, msg)
}

func warn(msg string) {
	fmt.Fprintf(os.Stderr, "[dev] WARN: %s\n", msg)
}

func runIn(dir, name string, args ...string) {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fail("%s %v: %v", name, args, err)
	}
}

func captureIn(dir, name string, args ...string) string {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stderr = os.Stderr
	out, err := cmd.Output()
	if err != nil {
		fail("%s %v: %v", name, args, err)
	}
	return strings.TrimSpace(string(out))
}

// waitForHTTPOK polls an HTTP endpoint until it returns a 2xx (or the
// timeout expires). Used to gate the Zitadel seed apply on the API
// actually being reachable — the PAT file existing only proves
// FirstInstance ran; the gRPC + HTTP servers take a couple more
// seconds to come up after that.
func waitForHTTPOK(url string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		out, _ := exec.Command("curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", url).Output()
		code := strings.TrimSpace(string(out))
		if strings.HasPrefix(code, "2") {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("timed out after %s waiting for %s", timeout, url)
}

func waitForFile(path string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		info, err := os.Stat(path)
		if err == nil && info.Size() > 0 {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("timed out after %s waiting for %s", timeout, path)
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[dev] "+format+"\n", args...)
	os.Exit(1)
}
