package scud

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type CommonHttpRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`
}

type CommonHttpResponse struct {
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       string            `json:"body"`
	DurationMs int64             `json:"durationMs"`
	Error      string            `json:"error,omitempty"`
}

type IntegrationResult struct {
	Request  CommonHttpRequest  `json:"request"`
	Response CommonHttpResponse `json:"response"`
}

type Client struct {
	displayURL string
	stubURL    string
	httpClient *http.Client
}

func NewClient(displayURL, stubURL string) *Client {
	return &Client{
		displayURL: strings.TrimRight(displayURL, "/"),
		stubURL:    strings.TrimRight(stubURL, "/"),
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Client) NotifyAccess(
	ctx context.Context,
	plateNumber string,
	accessPointId *int,
	granted bool,
	overrideURL string,
) IntegrationResult {
	start := time.Now()
	apID := 0
	if accessPointId != nil {
		apID = *accessPointId
	}

	reqBody, _ := json.Marshal(map[string]any{
		"plateNumber":   plateNumber,
		"accessPointId": apID,
		"granted":       granted,
		"action":        accessAction(granted),
	})

	displayURL := c.buildDisplayURL(apID, granted, overrideURL)
	req := CommonHttpRequest{
		Method: "POST",
		URL:    displayURL,
		Headers: map[string]string{
			"Content-Type": "application/json",
			"Accept":       "application/json",
		},
		Body: string(reqBody),
	}

	resp := c.executeStub(ctx, req)
	resp.DurationMs = time.Since(start).Milliseconds()

	return IntegrationResult{
		Request:  req,
		Response: resp,
	}
}

func (c *Client) buildDisplayURL(accessPointId int, granted bool, overrideURL string) string {
	if overrideURL != "" {
		return strings.TrimRight(overrideURL, "/")
	}
	base := c.displayURL
	if base == "" {
		base = "http://scud-system.local/api/v1/access"
	}
	action := "deny"
	if granted {
		action = "open"
	}
	if accessPointId > 0 {
		return fmt.Sprintf("%s/%s?accessPointId=%d", base, action, accessPointId)
	}
	return fmt.Sprintf("%s/%s", base, action)
}

func accessAction(granted bool) string {
	if granted {
		return "open"
	}
	return "deny"
}

func (c *Client) executeStub(ctx context.Context, req CommonHttpRequest) CommonHttpResponse {
	stubURL := c.stubURL
	if stubURL == "" {
		stubURL = "http://127.0.0.1:8080/internal/common-http-request"
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, stubURL, bytes.NewReader([]byte(req.Body)))
	if err != nil {
		return CommonHttpResponse{
			StatusCode: 0,
			Error:      err.Error(),
		}
	}
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}
	httpReq.Header.Set("X-Scud-Target-Url", req.URL)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return CommonHttpResponse{
			StatusCode: 0,
			Error:      err.Error(),
		}
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			respHeaders[k] = v[0]
		}
	}

	return CommonHttpResponse{
		StatusCode: resp.StatusCode,
		Headers:    respHeaders,
		Body:       string(bodyBytes),
	}
}
