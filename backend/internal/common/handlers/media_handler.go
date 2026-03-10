package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MediaHandler struct {
	db        *gorm.DB
	uploadDir string
}

func NewMediaHandler(db *gorm.DB) *MediaHandler {
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		fmt.Printf("Warning: could not create uploads directory: %v\n", err)
	}
	return &MediaHandler{db: db, uploadDir: uploadDir}
}

func (h *MediaHandler) Upload(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	file, err := c.FormFile("file")
	if err != nil {
		return utils.BadRequestResponse(c, "No file uploaded")
	}

	// Validate file type
	mime := file.Header.Get("Content-Type")
	allowedTypes := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/gif": true,
		"image/webp": true, "image/svg+xml": true, "image/bmp": true,
		"application/pdf": true,
	}
	if !allowedTypes[mime] {
		return utils.BadRequestResponse(c, "File type not allowed. Accepted: JPEG, PNG, GIF, WebP, SVG, BMP, PDF")
	}

	// Validate file size (max 10MB)
	if file.Size > 10*1024*1024 {
		return utils.BadRequestResponse(c, "File too large. Maximum size is 10MB")
	}

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().UnixNano(), ext)

	// Ensure company subdirectory exists
	companyDir := filepath.Join(h.uploadDir, companyID.String())
	if err := os.MkdirAll(companyDir, 0755); err != nil {
		return utils.InternalErrorResponse(c, "Failed to create upload directory")
	}

	savePath := filepath.Join(companyDir, filename)
	if err := c.SaveFile(file, savePath); err != nil {
		return utils.InternalErrorResponse(c, "Failed to save file")
	}

	// Build URL path
	url := fmt.Sprintf("/uploads/%s/%s", companyID.String(), filename)

	alt := c.FormValue("alt", "")

	media := models.Media{
		CompanyID:    companyID,
		CreatedByID:  &userID,
		Filename:     filename,
		OriginalName: file.Filename,
		MimeType:     mime,
		Size:         file.Size,
		URL:          url,
		Alt:          alt,
	}

	if err := h.db.Create(&media).Error; err != nil {
		// Clean up file on DB error
		os.Remove(savePath)
		return utils.InternalErrorResponse(c, "Failed to save media record")
	}

	return utils.CreatedResponse(c, media)
}

func (h *MediaHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var media []models.Media
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("original_name ILIKE ? OR alt ILIKE ?", search, search)
	}

	mimeFilter := c.Query("mime_type")
	if mimeFilter != "" {
		query = query.Where("mime_type LIKE ?", mimeFilter+"%")
	}

	query.Model(&models.Media{}).Count(&total)

	err := query.
		Order("created_at desc").
		Scopes(utils.Paginate(params)).
		Find(&media).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch media")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(media, total, params))
}

func (h *MediaHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var media models.Media
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&media).Error; err != nil {
		return utils.NotFoundResponse(c, "Media not found")
	}

	// Delete file from disk
	filePath := filepath.Join(h.uploadDir, companyID.String(), media.Filename)
	os.Remove(filePath)

	if err := h.db.Delete(&media).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete media")
	}

	return utils.SuccessResponse(c, nil, "Media deleted successfully")
}

func (h *MediaHandler) BulkDelete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if len(req.IDs) == 0 {
		return utils.BadRequestResponse(c, "No IDs provided")
	}

	var mediaList []models.Media
	h.db.Where("id IN ? AND company_id = ?", req.IDs, companyID).Find(&mediaList)

	for _, media := range mediaList {
		filePath := filepath.Join(h.uploadDir, companyID.String(), media.Filename)
		os.Remove(filePath)
	}

	h.db.Where("id IN ? AND company_id = ?", req.IDs, companyID).Delete(&models.Media{})

	return utils.SuccessResponse(c, nil, "Media deleted successfully")
}

func (h *MediaHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var media models.Media
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&media).Error; err != nil {
		return utils.NotFoundResponse(c, "Media not found")
	}

	var req struct {
		Alt string `json:"alt"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	media.Alt = strings.TrimSpace(req.Alt)
	h.db.Save(&media)

	return utils.SuccessResponse(c, media)
}

func (h *MediaHandler) RegisterRoutes(api fiber.Router) {
	media := api.Group("/media")
	media.Get("/", h.List)
	media.Post("/upload", h.Upload)
	media.Put("/:id", h.Update)
	media.Delete("/:id", h.Delete)
	media.Post("/bulk-delete", h.BulkDelete)
}
