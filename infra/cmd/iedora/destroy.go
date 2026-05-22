package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/eduvhc/iedora/infra/internal/bws"
	"github.com/eduvhc/iedora/infra/internal/cloudflare"
	"github.com/eduvhc/iedora/infra/internal/r2"
)

// runDestroy is the Go port of the `just infra::destroy` bash recipe.
// Four steps:
//
//  1. state-rm every zitadel_*, docker_*, and provisioner null_resource
//     they depend on. Why: `tofu destroy` refreshes resources first, and
//     refreshing a zitadel_* hits the zitadel API — which is in the
//     process of being torn down. The docker_* resources hit the box's
//     dockerd over SSH; tearing them down individually before the VPS
//     dies is wasted SSH round-trips, and `docker_network.iedora` in
//     particular hits the kreuzwerker provider's hardcoded 30s
//     `wait_for_state` on network removal (#460-class issue). State-rm
//     first; the live objects vanish with the VPS anyway.
//  2. Empty every R2 bucket still in state. The Cloudflare TF provider
//     calls DELETE bucket which 409s if the bucket is non-empty (the
//     `iedora-data` bucket has nightly pg_dumps under `pg/`; the
//     `iedora-assets` bucket has user uploads). It also waits 30s for
//     state=removed before giving up, so a non-empty bucket adds
//     `30s × buckets` of wall time before the operator sees the
//     409. We pre-empty via the S3 API using INFRA_CLOUDFLARE_API_TOKEN
//     as the access key (works post-partial-destroy too — the per-
//     bucket tokens are leaf resources Tofu destroys first).
//  3. tofu destroy with placeholder Zitadel mode + masterkey-rotation
//     override.
//  4. Scrub instance-bound BWS keys + the prior IP from ~/.ssh/known_hosts.
func runDestroy(ctx context.Context, argv []string) error {
	fs := flag.NewFlagSet("destroy", flag.ContinueOnError)
	if err := fs.Parse(argv); err != nil {
		return err
	}

	fmt.Fprintln(stderr, "→ tofu init")
	if err := initIfNeeded(ctx, false); err != nil {
		return fmt.Errorf("tofu init: %w", err)
	}

	// Products that depend on central must be destroyed FIRST (while
	// central is still up — their `tofu destroy` may reference
	// central-side outputs like Postgres URL). None today, but the
	// shape is here for when menu lands its own Tofu root.
	depCh, depCount := fanOutDestroy(ctx, true)
	for i := 0; i < depCount; i++ {
		r := <-depCh
		if r.err != nil {
			fmt.Fprintf(stderr, "  ! %s destroy failed (central still up — fix + rerun): %v\n", r.name, r.err)
			return fmt.Errorf("dependent product %s destroy failed before central: %w", r.name, r.err)
		}
		fmt.Fprintf(stderr, "  - %s destroy complete\n", r.name)
	}

	// Independent products (today: house) run in parallel with the
	// central VPS teardown — pure CF API calls finish well under the
	// minute+ central destroy takes.
	indepCh, indepCount := fanOutDestroy(ctx, false)

	// Grab the current IP BEFORE the destroy nukes the output — we
	// scrub its known_hosts entry as the last step.
	priorIP, _ := runTofuOutput(ctx, nil, "output", "-raw", "hetzner_ipv4")

	// ── Step 1: state-rm Zitadel + provisioners ─────────────────────────
	resources, err := runTofuList(ctx, nil)
	if err != nil {
		return fmt.Errorf("state list: %w", err)
	}

	var toRemove []string
	for _, r := range resources {
		if strings.HasPrefix(r, "zitadel_") || strings.HasPrefix(r, "data.zitadel_") {
			toRemove = append(toRemove, r)
			continue
		}
		// Every docker_* resource lives on the Hetzner VPS. The VPS is
		// going away in this same destroy plan, so individual `docker
		// rm` / `docker network rm` SSH calls are wasted work — and
		// `docker_network.iedora` in particular times out at the
		// kreuzwerker provider's 30s wait_for_state on removal.
		if strings.HasPrefix(r, "docker_") {
			toRemove = append(toRemove, r)
			continue
		}
		switch r {
		case "null_resource.iedora_admin_grants",
			"null_resource.iedora_admin_grants[0]",
			"null_resource.menu_permissions_router_touch",
			"null_resource.menu_permissions_router_touch[0]",
			// docker_ready gates the docker provider on cloud-init
			// finishing; pointless to "destroy" once we're skipping
			// docker_* entirely.
			"null_resource.docker_ready",
			"null_resource.docker_ready[0]":
			toRemove = append(toRemove, r)
		}
	}

	if len(toRemove) > 0 {
		fmt.Fprintf(stderr, "→ Step 1/4: state-rm %d VPS-coupled resources (zitadel + docker)\n", len(toRemove))
		// Best-effort — a state-rm on an unknown address is non-fatal.
		// We don't want a partial state-rm to abort the destroy that
		// would clean up the rest.
		for _, addr := range toRemove {
			if err := runTofu(ctx, nil, "state", "rm", addr); err != nil {
				fmt.Fprintf(stderr, "  ! state rm %q failed (continuing): %v\n", addr, err)
			}
		}
	} else {
		fmt.Fprintln(stderr, "→ Step 1/4: no VPS-coupled resources in state to state-rm")
	}

	// ── Step 2: empty R2 buckets still in state ─────────────────────────
	fmt.Fprintln(stderr, "→ Step 2/4: empty R2 buckets")
	if err := emptyR2BucketsInState(ctx); err != nil {
		// Don't abort: if emptying fails (missing aws CLI, network
		// blip, perm issue) the operator can rerun, or fall back to
		// emptying manually via the dashboard. We surface the error
		// loudly so the failed destroy that follows is interpretable.
		fmt.Fprintf(stderr, "  ! R2 empty failed (continuing — destroy will likely 409 on non-empty buckets): %v\n", err)
	}

	// ── Step 3: tofu destroy ────────────────────────────────────────────
	fmt.Fprintln(stderr, "→ Step 3/4: tofu destroy")
	if err := runTofu(ctx, nil, "destroy", "-auto-approve",
		"-var", "allow_masterkey_rotation=true",
		"-var", "infra_zitadel_sa_key_json=",
	); err != nil {
		return fmt.Errorf("destroy: %w", err)
	}

	// ── Step 4: scrub instance-bound BWS keys + known_hosts ─────────────
	fmt.Fprintln(stderr, "→ Step 4/4: scrub instance-bound BWS secrets + known_hosts")
	projectID, err := bws.ProjectID(ctx)
	if err != nil {
		return fmt.Errorf("bws project id: %w", err)
	}
	for _, key := range []string{"INFRA_ZITADEL_SA_KEY_JSON", "INFRA_HOST_IP"} {
		if err := bws.Delete(ctx, projectID, key); err != nil {
			fmt.Fprintf(stderr, "  ! bws delete %s failed (continuing): %v\n", key, err)
			continue
		}
		fmt.Fprintf(stderr, "  - %s scrubbed\n", key)
	}

	if priorIP != "" {
		rotateKnownHosts(ctx, priorIP)
		fmt.Fprintf(stderr, "  - known_hosts entry for %s removed\n", priorIP)
	}

	// Drain the indep products fan-out we kicked off before central
	// destroy. Log-but-continue (don't fail the overall destroy): the
	// central teardown is already done so there's nothing to undo;
	// operator can retry any stuck product via its own `cd … && just
	// destroy`.
	for i := 0; i < indepCount; i++ {
		r := <-indepCh
		if r.err != nil {
			fmt.Fprintf(stderr, "  ! %s destroy failed (retry via `cd %s && just destroy`): %v\n",
				r.name, productByName(r.name).infraRel, r.err)
		} else {
			fmt.Fprintf(stderr, "  - %s destroy complete\n", r.name)
		}
	}

	fmt.Fprintln(stderr, "✓ destroy complete")
	return nil
}

// productByName returns the product entry matching name, or a zero
// product if not found. Used only for surfacing infraRel in error
// messages — the caller already trusts the name came from products[].
func productByName(name string) product {
	for _, p := range products {
		if p.name == name {
			return p
		}
	}
	return product{}
}

// emptyR2BucketsInState lists every cloudflare_r2_bucket.* in current
// state and empties each one (in parallel) via the R2 S3 API. We
// authenticate with INFRA_CLOUDFLARE_API_TOKEN derived into an S3 access
// key pair — that token survives partial-destroy reruns where the
// per-bucket minted tokens are already gone.
//
// Required because the CF TF provider's bucket-delete call 409s on a
// non-empty bucket (and burns 30s of wait_for_state before surfacing
// the error). No external CLI dep — pure Go in internal/r2.
func emptyR2BucketsInState(ctx context.Context) error {
	buckets, err := bucketsFromState(ctx)
	if err != nil {
		return fmt.Errorf("list R2 buckets in state: %w", err)
	}
	if len(buckets) == 0 {
		fmt.Fprintln(stderr, "  - no R2 buckets in state, nothing to empty")
		return nil
	}

	cfToken := os.Getenv("INFRA_CLOUDFLARE_API_TOKEN")
	if cfToken == "" {
		return fmt.Errorf("INFRA_CLOUDFLARE_API_TOKEN missing from environment (bin/with-secrets should inject it)")
	}
	accountID := os.Getenv("CLOUDFLARE_ACCOUNT_ID")
	if accountID == "" {
		return fmt.Errorf("CLOUDFLARE_ACCOUNT_ID missing from environment (bin/with-secrets should inject it)")
	}

	accessKey, secretKey, err := cloudflare.R2S3Credentials(ctx, cfToken)
	if err != nil {
		return fmt.Errorf("derive R2 S3 credentials: %w", err)
	}
	client, err := r2.New(accountID, accessKey, secretKey)
	if err != nil {
		return err
	}

	var wg sync.WaitGroup
	errs := make(chan error, len(buckets))
	for _, b := range buckets {
		wg.Add(1)
		go func(bucket string) {
			defer wg.Done()
			fmt.Fprintf(stderr, "  - emptying %s …\n", bucket)
			if err := client.EmptyBucket(ctx, bucket); err != nil {
				errs <- fmt.Errorf("empty %s: %w", bucket, err)
				return
			}
			fmt.Fprintf(stderr, "  - %s emptied\n", bucket)
		}(b)
	}
	wg.Wait()
	close(errs)

	var combined []string
	for e := range errs {
		combined = append(combined, e.Error())
	}
	if len(combined) > 0 {
		return fmt.Errorf("%s", strings.Join(combined, "; "))
	}
	return nil
}

// bucketsFromState reads `tofu state list` and pulls out every
// cloudflare_r2_bucket.* address, returning the underlying bucket name.
func bucketsFromState(ctx context.Context) ([]string, error) {
	resources, err := runTofuList(ctx, nil)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, r := range resources {
		if !strings.HasPrefix(r, "cloudflare_r2_bucket.") {
			continue
		}
		// Read the bucket's actual name from state — the resource-
		// address suffix (`.data` / `.assets`) is not the bucket name.
		out, err := runTofuOutput(ctx, nil, "state", "show", r)
		if err != nil {
			return nil, fmt.Errorf("state show %s: %w", r, err)
		}
		for line := range strings.SplitSeq(out, "\n") {
			line = strings.TrimSpace(line)
			if !strings.HasPrefix(line, "name") {
				continue
			}
			// Lines look like:  name        = "iedora-data"
			if idx := strings.Index(line, "="); idx > 0 {
				val := strings.TrimSpace(line[idx+1:])
				val = strings.Trim(val, `"`)
				if val != "" {
					names = append(names, val)
					break
				}
			}
		}
	}
	return names, nil
}
