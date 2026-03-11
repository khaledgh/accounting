package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockHandler struct {
	db *gorm.DB
}

func NewStockHandler(db *gorm.DB) *StockHandler {
	return &StockHandler{db: db}
}

type StockAdjustmentRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	Type      string `json:"type"`
	Notes     string `json:"notes"`
}

func (h *StockHandler) ListMovements(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var movements []ecomModels.StockMovement
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	productID := c.Query("product_id")
	if productID != "" {
		query = query.Where("product_id = ?", productID)
	}

	movType := c.Query("type")
	if movType != "" {
		query = query.Where("type = ?", movType)
	}

	query.Model(&ecomModels.StockMovement{}).Count(&total)

	err := query.
		Preload("Product").
		Order("created_at desc").
		Scopes(utils.Paginate(params)).
		Find(&movements).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch stock movements")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(movements, total, params))
}

func (h *StockHandler) Adjust(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	var req StockAdjustmentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.ProductID == "" || req.Quantity == 0 {
		return utils.BadRequestResponse(c, "Product ID and quantity are required")
	}

	productUUID, err := uuid.Parse(req.ProductID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid product ID")
	}

	var product ecomModels.Product
	if err := h.db.Where("id = ? AND company_id = ?", productUUID, companyID).First(&product).Error; err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	if req.Type == "" {
		req.Type = ecomModels.StockMovementTypeAdjustment
	}

	movement := ecomModels.StockMovement{
		CompanyID:     companyID,
		ProductID:     productUUID,
		Quantity:      req.Quantity,
		Type:          req.Type,
		ReferenceType: "manual",
		Notes:         req.Notes,
		CreatedByID:   &userID,
	}

	tx := h.db.Begin()

	if err := tx.Create(&movement).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create stock movement")
	}

	newQty := product.StockQuantity + req.Quantity
	if newQty < 0 {
		newQty = 0
	}

	if err := tx.Model(&product).Update("stock_quantity", newQty).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to update stock")
	}

	tx.Commit()

	return utils.CreatedResponse(c, movement)
}

func (h *StockHandler) RegisterRoutes(api fiber.Router) {
	stock := api.Group("/ecommerce/stock-movements")
	stock.Get("/", h.ListMovements)
	stock.Post("/adjust", h.Adjust)
}

// RecordStockMovement is a helper for other handlers to record stock changes
// Note: This function expects to be called within an existing transaction (db should be *gorm.DB from tx.Begin())
func RecordStockMovement(db *gorm.DB, companyID, productID uuid.UUID, quantity int, movType, refType, refID, notes string) error {
	movement := ecomModels.StockMovement{
		CompanyID:     companyID,
		ProductID:     productID,
		Quantity:      quantity,
		Type:          movType,
		ReferenceType: refType,
		ReferenceID:   refID,
		Notes:         notes,
	}

	if err := db.Create(&movement).Error; err != nil {
		return err
	}

	var product ecomModels.Product
	if err := db.Where("id = ?", productID).First(&product).Error; err != nil {
		return err
	}

	newQty := product.StockQuantity + quantity
	if newQty < 0 {
		newQty = 0
	}

	if err := db.Model(&product).Update("stock_quantity", newQty).Error; err != nil {
		return err
	}

	return nil
}
