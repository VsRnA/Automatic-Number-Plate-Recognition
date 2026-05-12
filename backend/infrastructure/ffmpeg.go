package infrastructure

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

func GrabSnapshot(stream string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-rtsp_transport", "tcp",
		"-i", stream,
		"-vframes", "1",
		"-f", "image2",
		"-vcodec", "mjpeg",
		"-loglevel", "quiet",
		"pipe:1",
	)

	return cmd.Output()
}

type streamInfo struct {
	cmd       *exec.Cmd
	startedAt time.Time
	status    string 
	errMsg    string
}

type FFmpegManager struct {
	mu      sync.Mutex
	dir     string
	streams map[string]*streamInfo
}

func NewFFmpegManager(dir string) *FFmpegManager {
	return &FFmpegManager{
		dir:     dir,
		streams: make(map[string]*streamInfo),
	}
}

func (m *FFmpegManager) Start(cameraID, stream string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if info, ok := m.streams[cameraID]; ok && info.status == "running" {
		return nil
	}

	outDir := filepath.Join(m.dir, cameraID)
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return fmt.Errorf("failed to create hls dir: %w", err)
	}

	playlist := filepath.Join(outDir, "index.m3u8")
	segPattern := filepath.Join(outDir, "seg%05d.ts")

	cmd := exec.Command("ffmpeg",
		"-rtsp_transport", "tcp",
		"-i", stream,
		"-c:v", "copy",
		"-an",
		"-f", "hls",
		"-hls_time", "2",
		"-hls_list_size", "5",
		"-hls_flags", "delete_segments+append_list",
		"-hls_segment_filename", segPattern,
		playlist,
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	info := &streamInfo{
		cmd:       cmd,
		startedAt: time.Now(),
		status:    "running",
	}
	m.streams[cameraID] = info

	go func() {
		err := cmd.Wait()
		m.mu.Lock()
		defer m.mu.Unlock()
		if s, ok := m.streams[cameraID]; ok && s.cmd == cmd {
			if err != nil {
				s.status = "error"
				s.errMsg = err.Error()
				slog.Error("ffmpeg exited with error", "camera_id", cameraID, "error", err)
			} else {
				s.status = "stopped"
			}
		}
	}()

	return nil
}

func (m *FFmpegManager) Stop(cameraID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	info, ok := m.streams[cameraID]
	if !ok || info.status != "running" {
		return nil
	}

	if err := info.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill ffmpeg: %w", err)
	}
	info.status = "stopped"
	return nil
}

type FFmpegStatus struct {
	Status    string
	StartedAt time.Time
	Error     string
}

func (m *FFmpegManager) Status(cameraID string) FFmpegStatus {
	m.mu.Lock()
	defer m.mu.Unlock()

	info, ok := m.streams[cameraID]
	if !ok {
		return FFmpegStatus{Status: "idle"}
	}
	return FFmpegStatus{
		Status:    info.status,
		StartedAt: info.startedAt,
		Error:     info.errMsg,
	}
}

func (m *FFmpegManager) HLSDir() string {
	return m.dir
}

func (m *FFmpegManager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, info := range m.streams {
		if info.status == "running" {
			if err := info.cmd.Process.Kill(); err != nil {
				slog.Error("failed to kill ffmpeg", "camera_id", id, "error", err)
			}
			info.status = "stopped"
		}
	}
}
