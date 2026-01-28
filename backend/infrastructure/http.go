package infrastructure

import (
	"context"
	"net/http"
	"time"
)

type HttpServer struct {
	httpServer *http.Server
}

func NewHttpServer(port string, handler http.Handler) *HttpServer {
	return &HttpServer{
		httpServer: &http.Server{
			Addr:         ":" + port,
			Handler:      handler,
			ReadTimeout:  10 * time.Second,
			WriteTimeout: 10 * time.Second,
		},
	}
}

func (server *HttpServer) Run() error {
	return server.httpServer.ListenAndServe()
}

func (server *HttpServer) Shutdown(context context.Context) error {
	return server.httpServer.Shutdown(context)
}
