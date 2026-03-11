package utils

import (
	"math"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

func SuccessResponse(c *fiber.Ctx, data interface{}, messages ...string) error {
	resp := fiber.Map{"success": true, "data": data}
	if len(messages) > 0 {
		resp["message"] = messages[0]
	}
	return c.JSON(resp)
}

func CreatedResponse(c *fiber.Ctx, data interface{}) error {
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": data})
}

func BadRequestResponse(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": message})
}

func UnauthorizedResponse(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": message})
}

func NotFoundResponse(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": message})
}

func InternalErrorResponse(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": message})
}

type PaginationParams struct {
	Page     int
	PageSize int
}

func GetPaginationParams(c *fiber.Ctx) PaginationParams {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return PaginationParams{Page: page, PageSize: pageSize}
}

func CreatePaginatedResponse(data interface{}, total int64, params PaginationParams) fiber.Map {
	totalPages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return fiber.Map{
		"items":       data,
		"total":       total,
		"page":        params.Page,
		"page_size":   params.PageSize,
		"total_pages": totalPages,
	}
}
