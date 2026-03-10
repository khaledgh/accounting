package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductHandler struct {
	db *gorm.DB
}

func NewProductHandler(db *gorm.DB) *ProductHandler {
	return &ProductHandler{db: db}
}

type CreateProductRequest struct {
	CategoryID      *string `json:"category_id"`
	SKU             string  `json:"sku"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	ShortDesc       string  `json:"short_desc"`
	Price           float64 `json:"price"`
	CostPrice       float64 `json:"cost_price"`
	ComparePrice    float64 `json:"compare_price"`
	CurrencyCode    string  `json:"currency_code"`
	TaxRate         float64 `json:"tax_rate"`
	Weight          float64 `json:"weight"`
	Unit            string  `json:"unit"`
	Barcode         string  `json:"barcode"`
	ImageURL        string  `json:"image_url"`
	Slug            string  `json:"slug"`
	MetaTitle       string  `json:"meta_title"`
	MetaDescription string  `json:"meta_description"`
	IsDigital       bool    `json:"is_digital"`
	TrackStock      bool    `json:"track_stock"`
	StockQuantity   int     `json:"stock_quantity"`
	LowStockAlert   int     `json:"low_stock_alert"`
}

type UpdateProductRequest struct {
	Name            *string  `json:"name"`
	Description     *string  `json:"description"`
	ShortDesc       *string  `json:"short_desc"`
	Price           *float64 `json:"price"`
	CostPrice       *float64 `json:"cost_price"`
	ComparePrice    *float64 `json:"compare_price"`
	TaxRate         *float64 `json:"tax_rate"`
	Weight          *float64 `json:"weight"`
	ImageURL        *string  `json:"image_url"`
	Slug            *string  `json:"slug"`
	MetaTitle       *string  `json:"meta_title"`
	MetaDescription *string  `json:"meta_description"`
	IsActive        *bool    `json:"is_active"`
	StockQuantity   *int     `json:"stock_quantity"`
	LowStockAlert   *int     `json:"low_stock_alert"`
	CategoryID      *string  `json:"category_id"`
}

func (h *ProductHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var products []ecomModels.Product
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR sku ILIKE ? OR barcode ILIKE ?", search, search, search)
	}

	categoryID := c.Query("category_id")
	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	isActive := c.Query("is_active")
	if isActive == "true" {
		query = query.Where("is_active = ?", true)
	} else if isActive == "false" {
		query = query.Where("is_active = ?", false)
	}

	query.Model(&ecomModels.Product{}).Count(&total)

	err := query.
		Preload("Category").
		Preload("Variants").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&products).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch products")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(products, total, params))
}

func (h *ProductHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var product ecomModels.Product
	err := h.db.Preload("Category").Preload("Variants").
		Where("id = ? AND company_id = ?", id, companyID).First(&product).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	return utils.SuccessResponse(c, product)
}

func (h *ProductHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.SKU == "" || req.Name == "" {
		return utils.BadRequestResponse(c, "SKU and name are required")
	}

	product := ecomModels.Product{
		CompanyID:       companyID,
		SKU:             req.SKU,
		Name:            req.Name,
		Description:     req.Description,
		ShortDesc:       req.ShortDesc,
		Price:           req.Price,
		CostPrice:       req.CostPrice,
		ComparePrice:    req.ComparePrice,
		CurrencyCode:    req.CurrencyCode,
		TaxRate:         req.TaxRate,
		Weight:          req.Weight,
		Unit:            req.Unit,
		Barcode:         req.Barcode,
		ImageURL:        req.ImageURL,
		Slug:            req.Slug,
		MetaTitle:       req.MetaTitle,
		MetaDescription: req.MetaDescription,
		IsActive:        true,
		IsDigital:       req.IsDigital,
		TrackStock:      req.TrackStock,
		StockQuantity:   req.StockQuantity,
		LowStockAlert:   req.LowStockAlert,
	}

	if req.CurrencyCode == "" {
		product.CurrencyCode = "USD"
	}
	if req.Unit == "" {
		product.Unit = "pc"
	}
	if req.LowStockAlert == 0 {
		product.LowStockAlert = 5
	}

	if req.CategoryID != nil && *req.CategoryID != "" {
		catUUID, err := uuid.Parse(*req.CategoryID)
		if err == nil {
			product.CategoryID = &catUUID
		}
	}

	if err := h.db.Create(&product).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create product")
	}

	return utils.CreatedResponse(c, product)
}

func (h *ProductHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var product ecomModels.Product
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&product).Error; err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	var req UpdateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.ShortDesc != nil {
		updates["short_desc"] = *req.ShortDesc
	}
	if req.Price != nil {
		updates["price"] = *req.Price
	}
	if req.CostPrice != nil {
		updates["cost_price"] = *req.CostPrice
	}
	if req.ComparePrice != nil {
		updates["compare_price"] = *req.ComparePrice
	}
	if req.TaxRate != nil {
		updates["tax_rate"] = *req.TaxRate
	}
	if req.Weight != nil {
		updates["weight"] = *req.Weight
	}
	if req.ImageURL != nil {
		updates["image_url"] = *req.ImageURL
	}
	if req.Slug != nil {
		updates["slug"] = *req.Slug
	}
	if req.MetaTitle != nil {
		updates["meta_title"] = *req.MetaTitle
	}
	if req.MetaDescription != nil {
		updates["meta_description"] = *req.MetaDescription
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.StockQuantity != nil {
		updates["stock_quantity"] = *req.StockQuantity
	}
	if req.LowStockAlert != nil {
		updates["low_stock_alert"] = *req.LowStockAlert
	}
	if req.CategoryID != nil {
		if *req.CategoryID == "" {
			updates["category_id"] = nil
		} else {
			catUUID, err := uuid.Parse(*req.CategoryID)
			if err == nil {
				updates["category_id"] = catUUID
			}
		}
	}

	if err := h.db.Model(&product).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update product")
	}

	h.db.Preload("Category").First(&product, "id = ?", id)
	return utils.SuccessResponse(c, product, "Product updated successfully")
}

func (h *ProductHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var product ecomModels.Product
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&product).Error; err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	if err := h.db.Delete(&product).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete product")
	}

	return utils.SuccessResponse(c, nil, "Product deleted successfully")
}

func (h *ProductHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var products []ecomModels.Product
	query := h.db.Where("company_id = ?", companyID).Preload("Category")
	if s := c.Query("search"); s != "" {
		search := "%" + s + "%"
		query = query.Where("name ILIKE ? OR sku ILIKE ?", search, search)
	}
	query.Order("created_at desc").Find(&products)

	cols := []export.Column{
		{Header: "SKU", Field: "SKU", Width: 15},
		{Header: "Name", Field: "Name", Width: 30},
		{Header: "Price", Field: "Price", Width: 12},
		{Header: "Cost", Field: "CostPrice", Width: 12},
		{Header: "Stock", Field: "StockQuantity", Width: 10},
		{Header: "Active", Field: "IsActive", Width: 10},
	}
	return export.HandleExport(c, "Products", cols, products)
}

// ── Variant CRUD ────────────────────────────────────────────────────

type VariantRequest struct {
	SKU           string  `json:"sku"`
	Name          string  `json:"name"`
	Price         float64 `json:"price"`
	CostPrice     float64 `json:"cost_price"`
	StockQuantity int     `json:"stock_quantity"`
	ImageURL      string  `json:"image_url"`
	IsActive      *bool   `json:"is_active"`
}

func (h *ProductHandler) CreateVariant(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	productID := c.Params("id")

	var product ecomModels.Product
	if err := h.db.Where("id = ? AND company_id = ?", productID, companyID).First(&product).Error; err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	var req VariantRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.SKU == "" || req.Name == "" {
		return utils.BadRequestResponse(c, "SKU and name are required")
	}

	variant := ecomModels.ProductVariant{
		ProductID:     product.ID,
		SKU:           req.SKU,
		Name:          req.Name,
		Price:         req.Price,
		CostPrice:     req.CostPrice,
		StockQuantity: req.StockQuantity,
		ImageURL:      req.ImageURL,
		IsActive:      true,
	}
	if req.IsActive != nil {
		variant.IsActive = *req.IsActive
	}

	if err := h.db.Create(&variant).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create variant")
	}

	return utils.CreatedResponse(c, variant)
}

func (h *ProductHandler) UpdateVariant(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	productID := c.Params("id")
	variantID := c.Params("vid")

	var product ecomModels.Product
	if err := h.db.Where("id = ? AND company_id = ?", productID, companyID).First(&product).Error; err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	var variant ecomModels.ProductVariant
	if err := h.db.Where("id = ? AND product_id = ?", variantID, product.ID).First(&variant).Error; err != nil {
		return utils.NotFoundResponse(c, "Variant not found")
	}

	var req VariantRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.SKU != "" {
		updates["sku"] = req.SKU
	}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	updates["price"] = req.Price
	updates["cost_price"] = req.CostPrice
	updates["stock_quantity"] = req.StockQuantity
	updates["image_url"] = req.ImageURL
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	h.db.Model(&variant).Updates(updates)
	return utils.SuccessResponse(c, variant)
}

func (h *ProductHandler) DeleteVariant(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	productID := c.Params("id")
	variantID := c.Params("vid")

	var product ecomModels.Product
	if err := h.db.Where("id = ? AND company_id = ?", productID, companyID).First(&product).Error; err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	var variant ecomModels.ProductVariant
	if err := h.db.Where("id = ? AND product_id = ?", variantID, product.ID).First(&variant).Error; err != nil {
		return utils.NotFoundResponse(c, "Variant not found")
	}

	h.db.Delete(&variant)
	return utils.SuccessResponse(c, nil, "Variant deleted")
}

func (h *ProductHandler) RegisterRoutes(api fiber.Router) {
	products := api.Group("/ecommerce/products")
	products.Get("/", h.List)
	products.Get("/export", h.Export)
	products.Get("/:id", h.Get)
	products.Post("/", h.Create)
	products.Put("/:id", h.Update)
	products.Delete("/:id", h.Delete)

	products.Post("/:id/variants", h.CreateVariant)
	products.Put("/:id/variants/:vid", h.UpdateVariant)
	products.Delete("/:id/variants/:vid", h.DeleteVariant)
}
