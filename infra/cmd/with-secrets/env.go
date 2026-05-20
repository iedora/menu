package main

import (
	"fmt"
	"strings"
)

// buildEnvironment constructs the final key=value environment slice for the command execution
func buildEnvironment(secrets []BwsSecret, bwsAccessToken, projectID string, currentEnv []string) ([]string, error) {
	envMap := make(map[string]string)

	// Populate environment map with the current environment
	for _, e := range currentEnv {
		parts := strings.SplitN(e, "=", 2)
		if len(parts) == 2 {
			envMap[parts[0]] = parts[1]
		}
	}

	// Override/Inject BWS secrets
	for _, s := range secrets {
		envMap[s.Key] = s.Value
	}

	// Ensure BWS metadata variables are set
	envMap["BWS_ACCESS_TOKEN"] = bwsAccessToken
	envMap["BWS_PROJECT_ID"] = projectID

	// Helper to validate and fetch a required key
	requireKey := func(key string) (string, error) {
		val := envMap[key]
		if val == "" {
			return "", fmt.Errorf("%s missing in environment or BWS secrets", key)
		}
		return val, nil
	}

	// Resolve Cloudflare Account ID if not already present
	cfAccountID := envMap["CLOUDFLARE_ACCOUNT_ID"]
	if cfAccountID == "" {
		cfToken, err := requireKey("INFRA_CLOUDFLARE_API_TOKEN")
		if err != nil {
			return nil, err
		}

		discoveredID, err := getCloudflareAccountID(cfToken)
		if err != nil {
			return nil, fmt.Errorf("cloudflare discovery failed: %w", err)
		}
		cfAccountID = discoveredID
		envMap["CLOUDFLARE_ACCOUNT_ID"] = cfAccountID
	}

	// Map required TF_VAR_* fields
	tfVars := map[string]string{
		"TF_VAR_cloudflare_api_token":              "INFRA_CLOUDFLARE_API_TOKEN",
		"TF_VAR_state_passphrase":                  "INFRA_STATE_PASSPHRASE",
		"TF_VAR_github_token":                      "INFRA_GITHUB_API_TOKEN",
		"TF_VAR_infra_ssh_private_key":             "INFRA_SSH_PRIVATE_KEY",
		"TF_VAR_claude_code_oauth_token":           "INFRA_CLAUDE_CODE_OAUTH_TOKEN",
		"TF_VAR_infra_hcloud_token":                "INFRA_HCLOUD_TOKEN",
		"TF_VAR_infra_ghcr_token":                  "INFRA_GHCR_TOKEN",
		"TF_VAR_infra_openobserve_root_user_email": "INFRA_OPENOBSERVE_ROOT_USER_EMAIL",
	}

	for tfKey, sourceKey := range tfVars {
		val, err := requireKey(sourceKey)
		if err != nil {
			return nil, err
		}
		envMap[tfKey] = val
	}

	envMap["TF_VAR_account_id"] = cfAccountID

	// Inject other non-required mapped keys
	envMap["TF_VAR_bws_access_token"] = bwsAccessToken
	envMap["TF_VAR_bws_project_id"] = projectID
	envMap["TF_VAR_infra_zitadel_sa_key_json"] = envMap["INFRA_ZITADEL_SA_KEY_JSON"]

	// Compile map back to string slice
	envSlice := make([]string, 0, len(envMap))
	for k, v := range envMap {
		envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
	}

	return envSlice, nil
}
