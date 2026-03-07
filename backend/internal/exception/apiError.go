package exception

import (
	"fmt"
	"github.com/google/uuid"
	"net/http"
)

type Code string

const (
	ErrApp                      Code = "ERR_APP"
	ErrClientBadRequest         Code = "ERR_CLIENT_BAD_REQUEST"
	ErrClientRequestValidation  Code = "ERR_CLIENT_REQUEST_VALIDATION"
	ErrClientAuth               Code = "ERR_CLIENT_AUTH"
	ErrClientEntityAlreadyExist Code = "ERR_CLIENT_ENTITY_ALREADY_EXIST"
	ErrClientEntityNotFound     Code = "ERR_CLIENT_ENTITY_NOT_FOUND"
)

type ApiError struct {
	Guid    string `json:"guid"`
	Message string `json:"message"`
	Code    Code   `json:"code"`
	Status  int    `json:"-"`
}

func InternalError(message string) *ApiError {
	return &ApiError{
		Guid:    uuid.NewString(),
		Message: message,
		Code:    ErrApp,
		Status:  http.StatusInternalServerError,
	}
}

func BadRequest(message string) *ApiError {
	return &ApiError{
		Guid:    uuid.NewString(),
		Message: message,
		Code:    ErrClientBadRequest,
		Status:  http.StatusBadRequest,
	}
}

func EntityAlreadyExistsError(entity string, data string) *ApiError {
	var message = fmt.Sprintf("Entity '%s' already exists. %s", entity, data)

	return &ApiError{
		Guid:    uuid.NewString(),
		Message: message,
		Code:    ErrClientEntityAlreadyExist,
		Status:  http.StatusConflict,
	}
}

func EntityNotFoundError(entity string, data string) *ApiError {
	var message = fmt.Sprintf("Entity '%s' not found. %s", entity, data)

	return &ApiError{
		Guid:    uuid.NewString(),
		Message: message,
		Code:    ErrClientEntityNotFound,
		Status:  http.StatusNotFound,
	}
}

func RequestValidationError(message string) *ApiError {
	return &ApiError{
		Guid:    uuid.NewString(),
		Message: message,
		Code:    ErrClientRequestValidation,
		Status:  http.StatusBadRequest,
	}
}

func AuthError(message string) *ApiError {
	return &ApiError{
		Guid:    uuid.NewString(),
		Message: message,
		Code:    ErrClientAuth,
		Status:  http.StatusUnauthorized,
	}
}
