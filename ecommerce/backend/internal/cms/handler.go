package cms

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/ecommerce/internal/models"
	"github.com/gonext/ecommerce/internal/utils"
	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

// GetCarousel returns the active carousel slides
func (h *Handler) GetCarousel(c *fiber.Ctx) error {
	var setting models.WebsiteSetting
	err := h.db.Where("key = ? AND is_active = ?", "carousel", true).First(&setting).Error
	if err != nil {
		// Return default slides if none configured
		return utils.SuccessResponse(c, []models.CarouselSlide{})
	}

	var slides []models.CarouselSlide
	if err := json.Unmarshal([]byte(setting.Value), &slides); err != nil {
		return utils.InternalErrorResponse(c, "Failed to parse carousel data")
	}

	// Filter active slides
	active := make([]models.CarouselSlide, 0)
	for _, s := range slides {
		if s.IsActive {
			active = append(active, s)
		}
	}

	return utils.SuccessResponse(c, active)
}

// UpsertCarousel creates or updates the carousel slides
func (h *Handler) UpsertCarousel(c *fiber.Ctx) error {
	var slides []models.CarouselSlide
	if err := c.BodyParser(&slides); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	data, err := json.Marshal(slides)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to serialize carousel data")
	}

	var setting models.WebsiteSetting
	result := h.db.Where("key = ?", "carousel").First(&setting)
	if result.Error != nil {
		// Create new
		setting = models.WebsiteSetting{
			Key:      "carousel",
			Value:    string(data),
			IsActive: true,
		}
		if err := h.db.Create(&setting).Error; err != nil {
			return utils.InternalErrorResponse(c, "Failed to save carousel")
		}
	} else {
		// Update existing
		h.db.Model(&setting).Updates(map[string]interface{}{
			"value":     string(data),
			"is_active": true,
		})
	}

	return utils.SuccessResponse(c, setting, "Carousel updated")
}

// GetSetting returns a website setting by key
func (h *Handler) GetSetting(c *fiber.Ctx) error {
	key := c.Params("key")

	var setting models.WebsiteSetting
	if err := h.db.Where("key = ? AND is_active = ?", key, true).First(&setting).Error; err != nil {
		return utils.NotFoundResponse(c, "Setting not found")
	}

	return utils.SuccessResponse(c, setting)
}

// UpsertSetting creates or updates a website setting
func (h *Handler) UpsertSetting(c *fiber.Ctx) error {
	var req struct {
		Key      string `json:"key"`
		Value    string `json:"value"`
		IsActive bool   `json:"is_active"`
		Metadata string `json:"metadata"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if req.Key == "" {
		return utils.BadRequestResponse(c, "Key is required")
	}

	var setting models.WebsiteSetting
	result := h.db.Where("key = ?", req.Key).First(&setting)
	if result.Error != nil {
		setting = models.WebsiteSetting{
			Key:      req.Key,
			Value:    req.Value,
			IsActive: req.IsActive,
			Metadata: req.Metadata,
		}
		if err := h.db.Create(&setting).Error; err != nil {
			return utils.InternalErrorResponse(c, "Failed to create setting")
		}
	} else {
		h.db.Model(&setting).Updates(map[string]interface{}{
			"value":     req.Value,
			"is_active": req.IsActive,
			"metadata":  req.Metadata,
		})
		h.db.First(&setting, "key = ?", req.Key)
	}

	return utils.SuccessResponse(c, setting, "Setting saved")
}

// ListSettings returns all website settings
func (h *Handler) ListSettings(c *fiber.Ctx) error {
	var settings []models.WebsiteSetting
	h.db.Order("key ASC").Find(&settings)
	return utils.SuccessResponse(c, settings)
}

func (h *Handler) RegisterPublicRoutes(api fiber.Router) {
	cms := api.Group("/store/cms")
	cms.Get("/carousel", h.GetCarousel)
	cms.Get("/settings/:key", h.GetSetting)
}

func (h *Handler) RegisterProtectedRoutes(api fiber.Router) {
	cms := api.Group("/store/cms")
	cms.Get("/settings", h.ListSettings)
	cms.Post("/settings", h.UpsertSetting)
	cms.Put("/carousel", h.UpsertCarousel)
}
