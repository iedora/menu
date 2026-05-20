package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
)

// BwsProject represents a project in Bitwarden Secrets Manager
type BwsProject struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// BwsSecret represents a secret fetched from Bitwarden Secrets Manager
type BwsSecret struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// getBwsProjectID resolves the target project ID (pinned or auto-discovered)
func getBwsProjectID(accessToken string) (string, error) {
	if projectID := os.Getenv("BWS_PROJECT_ID"); projectID != "" {
		return projectID, nil
	}

	cmd := exec.Command("bws", "project", "list", "-o", "json")
	cmd.Stderr = os.Stderr
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to list BWS projects: %w", err)
	}

	var projects []BwsProject
	if err := json.Unmarshal(out, &projects); err != nil {
		return "", fmt.Errorf("failed to parse BWS projects JSON: %w", err)
	}

	for _, p := range projects {
		if p.Name == "iedora-deploy" {
			return p.ID, nil
		}
	}

	return "", fmt.Errorf("bws project list returned no iedora-deploy project — check BWS_ACCESS_TOKEN scope")
}

// getBwsSecrets fetches all secret key-values for a given project ID
func getBwsSecrets(projectID string) ([]BwsSecret, error) {
	cmd := exec.Command("bws", "secret", "list", projectID, "-o", "json")
	cmd.Stderr = os.Stderr
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list BWS secrets: %w", err)
	}

	var secrets []BwsSecret
	if err := json.Unmarshal(out, &secrets); err != nil {
		return nil, fmt.Errorf("failed to parse BWS secrets JSON: %w", err)
	}

	return secrets, nil
}
