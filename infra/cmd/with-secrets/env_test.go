package main

import (
	"strings"
	"testing"
)

func TestBuildEnvironment(t *testing.T) {
	// Sample mock secrets retrieved from BWS
	mockSecrets := []BwsSecret{
		{Key: "INFRA_CLOUDFLARE_API_TOKEN", Value: "cf-token-123"},
		{Key: "INFRA_STATE_PASSPHRASE", Value: "passphrase-abc"},
		{Key: "INFRA_GITHUB_API_TOKEN", Value: "github-token-456"},
		{Key: "INFRA_SSH_PRIVATE_KEY", Value: "ssh-key-789"},
		{Key: "INFRA_CLAUDE_CODE_OAUTH_TOKEN", Value: "claude-token-xyz"},
		{Key: "INFRA_HCLOUD_TOKEN", Value: "hcloud-token-uvw"},
		{Key: "INFRA_GHCR_TOKEN", Value: "ghcr-token-qrs"},
		{Key: "INFRA_OPENOBSERVE_ROOT_USER_EMAIL", Value: "test@example.com"},
	}

	// Mock initial environment containing a pinned Cloudflare account ID
	mockEnv := []string{
		"PATH=/usr/bin:/bin",
		"CLOUDFLARE_ACCOUNT_ID=cf-account-abc",
		"INFRA_ZITADEL_SA_KEY_JSON=sa-key-json-string",
	}

	bwsAccessToken := "token-bws-123"
	projectID := "project-id-456"

	envSlice, err := buildEnvironment(mockSecrets, bwsAccessToken, projectID, mockEnv)
	if err != nil {
		t.Fatalf("buildEnvironment failed unexpectedly: %v", err)
	}

	// Helper to find env value in slice
	getVal := func(key string) string {
		prefix := key + "="
		for _, env := range envSlice {
			if strings.HasPrefix(env, prefix) {
				return strings.TrimPrefix(env, prefix)
			}
		}
		return ""
	}

	// 1. Verify standard injected metadata
	if getVal("BWS_ACCESS_TOKEN") != bwsAccessToken {
		t.Errorf("Expected BWS_ACCESS_TOKEN=%s, got %s", bwsAccessToken, getVal("BWS_ACCESS_TOKEN"))
	}
	if getVal("BWS_PROJECT_ID") != projectID {
		t.Errorf("Expected BWS_PROJECT_ID=%s, got %s", projectID, getVal("BWS_PROJECT_ID"))
	}

	// 2. Verify TF_VAR variables mapping
	expectedTFVars := map[string]string{
		"TF_VAR_account_id":                        "cf-account-abc",
		"TF_VAR_cloudflare_api_token":              "cf-token-123",
		"TF_VAR_state_passphrase":                  "passphrase-abc",
		"TF_VAR_github_token":                      "github-token-456",
		"TF_VAR_infra_ssh_private_key":             "ssh-key-789",
		"TF_VAR_claude_code_oauth_token":           "claude-token-xyz",
		"TF_VAR_infra_hcloud_token":                "hcloud-token-uvw",
		"TF_VAR_infra_ghcr_token":                  "ghcr-token-qrs",
		"TF_VAR_infra_openobserve_root_user_email": "test@example.com",
		"TF_VAR_infra_zitadel_sa_key_json":         "sa-key-json-string",
	}

	for key, expectedVal := range expectedTFVars {
		if gotVal := getVal(key); gotVal != expectedVal {
			t.Errorf("Expected variable %s to have value %q, got %q", key, expectedVal, gotVal)
		}
	}
}

func TestBuildEnvironment_MissingSecret(t *testing.T) {
	// Mock secrets with one required key missing (e.g. INFRA_STATE_PASSPHRASE)
	mockSecrets := []BwsSecret{
		{Key: "INFRA_CLOUDFLARE_API_TOKEN", Value: "cf-token-123"},
		{Key: "INFRA_GITHUB_API_TOKEN", Value: "github-token-456"},
		{Key: "INFRA_SSH_PRIVATE_KEY", Value: "ssh-key-789"},
		{Key: "INFRA_CLAUDE_CODE_OAUTH_TOKEN", Value: "claude-token-xyz"},
		{Key: "INFRA_HCLOUD_TOKEN", Value: "hcloud-token-uvw"},
		{Key: "INFRA_GHCR_TOKEN", Value: "ghcr-token-qrs"},
		{Key: "INFRA_OPENOBSERVE_ROOT_USER_EMAIL", Value: "test@example.com"},
	}

	mockEnv := []string{
		"CLOUDFLARE_ACCOUNT_ID=cf-account-abc",
	}

	_, err := buildEnvironment(mockSecrets, "token-123", "proj-123", mockEnv)
	if err == nil {
		t.Fatal("Expected buildEnvironment to fail due to missing INFRA_STATE_PASSPHRASE, but it succeeded")
	}

	if !strings.Contains(err.Error(), "INFRA_STATE_PASSPHRASE missing") {
		t.Errorf("Expected error to mention INFRA_STATE_PASSPHRASE missing, got: %v", err)
	}
}
