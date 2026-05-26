// Package ssh wraps the system `ssh` binary for the pipeline binaries
// that talk to the Hetzner box (Stage 3 configurators, Stage 4
// dockerOnHetzner runtime). One canonical implementation so every
// caller shares the same timeout + host-key policy.
//
// Host-key check is intentionally OFF — same strategy Tofu's own SSH
// library uses for `terraform_data` connection blocks. Rationale:
//
//   - Every SSH target is a Tofu-provisioned VPS whose lifecycle is
//     controlled by the same repo. Hetzner can recycle the IP across
//     destroy/apply cycles, which used to trip "REMOTE HOST
//     IDENTIFICATION HAS CHANGED" and break Stage 3 mid-flight.
//   - The MITM threat the check defends against is "someone has
//     hijacked the path between operator and box". For private CI
//     runners + operator laptops on managed networks, that's not the
//     plausible attack vector. Authentication via the SSH key already
//     covers identity.
//   - Multi-machine / multi-agent setups should never accumulate
//     known_hosts state — each agent gets a clean run, no shared
//     keychain.
//
// If a future operator wants strict checking, set Client.StrictHostKey
// to "accept-new" or "yes" and provide a known_hosts file out-of-band.
package ssh

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
)

// Client wires the few options every SSH call we make actually needs.
// Zero value streams to terminal with a 10s connect timeout and
// host-key checking disabled.
type Client struct {
	// Stdout receives the remote process's stdout while Exec runs.
	// nil → os.Stdout. Reconcilers (no interactive operator) typically
	// set this to os.Stderr so structured log lines and remote output
	// share one channel.
	Stdout io.Writer

	// Stderr receives the remote process's stderr. nil → os.Stderr.
	Stderr io.Writer

	// ConnectTimeout in seconds. Zero → 10.
	ConnectTimeout int

	// StrictHostKey is the value passed to `-o StrictHostKeyChecking=…`.
	// Empty → "no" (don't check, don't persist). See the package
	// comment for why.
	StrictHostKey string
}

func (c *Client) stdout() io.Writer {
	if c.Stdout != nil {
		return c.Stdout
	}
	return os.Stdout
}

func (c *Client) stderr() io.Writer {
	if c.Stderr != nil {
		return c.Stderr
	}
	return os.Stderr
}

func (c *Client) cmd(ctx context.Context, host, remoteCmd string) *exec.Cmd {
	timeout := c.ConnectTimeout
	if timeout <= 0 {
		timeout = 10
	}
	policy := c.StrictHostKey
	if policy == "" {
		policy = "no"
	}
	return exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking="+policy,
		// Don't read or write the operator's ~/.ssh/known_hosts.
		// /dev/null is portable and the standard way to opt out.
		"-o", "UserKnownHostsFile=/dev/null",
		"-o", "ConnectTimeout="+strconv.Itoa(timeout),
		// LogLevel=ERROR drops the "Warning: Permanently added
		// 'host' to known hosts" noise that StrictHostKey=no still
		// emits without this.
		"-o", "LogLevel=ERROR",
		"root@"+host, remoteCmd)
}

// Exec runs an SSH command on root@host. Stdout/Stderr stream to the
// configured writers — useful when the caller wants the operator (or a
// log file) to see remote progress live.
//
// Errors are wrapped with host + the remote command so callers don't
// need to redundantly add context.
func (c *Client) Exec(ctx context.Context, host, remoteCmd string) error {
	cmd := c.cmd(ctx, host, remoteCmd)
	cmd.Stdout = c.stdout()
	cmd.Stderr = c.stderr()
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ssh root@%s %q: %w", host, remoteCmd, err)
	}
	return nil
}

// Capture runs an SSH command and returns stdout. Stderr still streams
// to the configured writer (Stderr) so a hung command or a remote error
// is still visible. Use for `/up` probes, single-line outputs, etc.
func (c *Client) Capture(ctx context.Context, host, remoteCmd string) (string, error) {
	cmd := c.cmd(ctx, host, remoteCmd)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = c.stderr()
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("ssh root@%s %q: %w", host, remoteCmd, err)
	}
	return out.String(), nil
}
