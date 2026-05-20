package main

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: with-secrets <command> [args...]")
		os.Exit(1)
	}

	bwsAccessToken := os.Getenv("BWS_ACCESS_TOKEN")
	if bwsAccessToken == "" {
		fmt.Fprintln(os.Stderr, "with-secrets error: BWS_ACCESS_TOKEN missing — export it in your shell (e.g. source ~/.secrets)")
		os.Exit(1)
	}

	// 1. Discover BWS_PROJECT_ID
	projectID, err := getBwsProjectID(bwsAccessToken)
	if err != nil {
		fmt.Fprintf(os.Stderr, "with-secrets error: %v\n", err)
		os.Exit(1)
	}

	// 2. Fetch secrets from BWS
	secrets, err := getBwsSecrets(projectID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "with-secrets error: %v\n", err)
		os.Exit(1)
	}

	// 3. Assemble environment variables
	envSlice, err := buildEnvironment(secrets, bwsAccessToken, projectID, os.Environ())
	if err != nil {
		fmt.Fprintf(os.Stderr, "with-secrets error: %v\n", err)
		os.Exit(1)
	}

	// 4. Look up target binary path
	binaryPath, err := exec.LookPath(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "with-secrets error: command %q not found: %v\n", os.Args[1], err)
		os.Exit(1)
	}

	// 5. In-place process replacement via syscall.Exec
	err = syscall.Exec(binaryPath, os.Args[1:], envSlice)
	if err != nil {
		fmt.Fprintf(os.Stderr, "with-secrets exec failed: %v\n", err)
		os.Exit(1)
	}
}
