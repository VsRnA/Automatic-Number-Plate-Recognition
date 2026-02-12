package infrastructure

import (
	"context"
	"fmt"

	pb "github.com/VsRnA/Automatic-Number-Plate-Recognition/pkg/grpc/recognition"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type RecognitionClient struct {
	client pb.RecognitionServiceClient
	conn   *grpc.ClientConn
}

func NewRecognitionClient(host, port string) (*RecognitionClient, error) {
	addr := fmt.Sprintf("%s:%s", host, port)

	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to recognition service: %w", err)
	}

	client := pb.NewRecognitionServiceClient(conn)

	return &RecognitionClient{
		client: client,
		conn:   conn,
	}, nil
}

func (c *RecognitionClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *RecognitionClient) HealthCheck(ctx context.Context) (*pb.HealthResponse, error) {
	return c.client.HealthCheck(ctx, &pb.Empty{})
}

func (c *RecognitionClient) Ping(ctx context.Context, message string) (*pb.PingResponse, error) {
	return c.client.Ping(ctx, &pb.PingRequest{Message: message})
}

func (c *RecognitionClient) TestRecognize(ctx context.Context, imageBase64 string, useSampleImage bool) (*pb.TestRecognizeResponse, error) {
	return c.client.TestRecognize(ctx, &pb.TestRecognizeRequest{
		ImageBase64:    imageBase64,
		UseSampleImage: useSampleImage,
	})
}

func (c *RecognitionClient) StartWorker(ctx context.Context, cameraID, rtspUrl string) (*pb.StartWorkerResponse, error) {
	return c.client.StartWorker(ctx, &pb.StartWorkerRequest{
		CameraId: cameraID,
		RtspUrl:  rtspUrl,
	})
}

func (c *RecognitionClient) StopWorker(ctx context.Context, cameraID string) (*pb.StopWorkerResponse, error) {
	return c.client.StopWorker(ctx, &pb.StopWorkerRequest{
		CameraId: cameraID,
	})
}

func (c *RecognitionClient) GetWorkerStatus(ctx context.Context, cameraID string) (*pb.GetWorkerStatusResponse, error) {
	return c.client.GetWorkerStatus(ctx, &pb.GetWorkerStatusRequest{
		CameraId: cameraID,
	})
}
