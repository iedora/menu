package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Custom HTTP Client with strict timeout to avoid dangling connections
var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

// getCloudflareAccountID queries the Cloudflare API to discover the first account ID
func getCloudflareAccountID(cfToken string) (string, error) {
	req, err := http.NewRequest("GET", "https://api.cloudflare.com/client/v4/accounts", nil)
	if err != nil {
		return "", fmt.Errorf("failed to create Cloudflare API request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+cfToken)

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to query Cloudflare accounts API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Cloudflare API returned non-OK status: %d, body: %s", resp.StatusCode, string(body))
	}

	var cfResp struct {
		Result []struct {
			ID string `json:"id"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&cfResp); err != nil {
		return "", fmt.Errorf("failed to decode Cloudflare API response: %w", err)
	}

	if len(cfResp.Result) == 0 {
		return "", fmt.Errorf("Cloudflare /accounts API returned no accounts — check INFRA_CLOUDFLARE_API_TOKEN")
	}

	return cfResp.Result[0].ID, nil
}
