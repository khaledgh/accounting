package storefront

import (
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/ecommerce/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	db *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

// Product mirrors the real products table including BaseModel fields
type Product struct {
	ID              uuid.UUID        `json:"id" gorm:"type:uuid;primaryKey"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
	DeletedAt       gorm.DeletedAt   `json:"-" gorm:"index"`
	CompanyID       uuid.UUID        `json:"-" gorm:"type:uuid"`
	CategoryID      *uuid.UUID       `json:"category_id" gorm:"type:uuid"`
	Category        *Category        `json:"category,omitempty" gorm:"foreignKey:CategoryID"`
	SKU             string           `json:"sku"`
	Name            string           `json:"name"`
	Description     string           `json:"description"`
	ShortDesc       string           `json:"short_desc"`
	Price           float64          `json:"price"`
	CostPrice       float64          `json:"-"`
	ComparePrice    float64          `json:"compare_price"`
	CurrencyCode    string           `json:"currency_code"`
	TaxRate         float64          `json:"tax_rate"`
	Weight          float64          `json:"weight"`
	Unit            string           `json:"unit"`
	Barcode         string           `json:"barcode"`
	ImageURL        string           `json:"image_url"`
	Slug            string           `json:"slug"`
	MetaTitle       string           `json:"meta_title"`
	MetaDescription string           `json:"meta_description" gorm:"column:meta_description"`
	IsActive        bool             `json:"is_active"`
	IsDigital       bool             `json:"is_digital"`
	TrackStock      bool             `json:"track_stock"`
	StockQuantity   int              `json:"stock_quantity"`
	LowStockAlert   int              `json:"-"`
	Variants        []ProductVariant `json:"variants,omitempty" gorm:"foreignKey:ProductID"`
}

func (Product) TableName() string { return "products" }

type ProductVariant struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
	ProductID     uuid.UUID      `json:"product_id" gorm:"type:uuid"`
	SKU           string         `json:"sku"`
	Name          string         `json:"name"`
	Price         float64        `json:"price"`
	StockQuantity int            `json:"stock_quantity"`
	ImageURL      string         `json:"image_url"`
	IsActive      bool           `json:"is_active"`
}

func (ProductVariant) TableName() string { return "product_variants" }

type Category struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	CompanyID   uuid.UUID      `json:"-" gorm:"type:uuid"`
	ParentID    *uuid.UUID     `json:"parent_id" gorm:"type:uuid"`
	Name        string         `json:"name"`
	Slug        string         `json:"slug"`
	Description string         `json:"description"`
	ImageURL    string         `json:"image_url"`
	SortOrder   int            `json:"sort_order"`
	IsActive    bool           `json:"is_active"`
	Children    []Category     `json:"children,omitempty" gorm:"foreignKey:ParentID"`
}

func (Category) TableName() string { return "categories" }

// ProductResponse enriches Product with computed discount fields
type ProductResponse struct {
	Product
	OriginalPrice      float64 `json:"original_price"`
	DiscountPercentage float64 `json:"discount_percentage"`
	OnSale             bool    `json:"on_sale"`
}

func enrichProduct(p Product) ProductResponse {
	resp := ProductResponse{Product: p}
	if p.ComparePrice > 0 && p.ComparePrice > p.Price {
		resp.OriginalPrice = p.ComparePrice
		resp.DiscountPercentage = math.Round((1 - p.Price/p.ComparePrice) * 100)
		resp.OnSale = true
	} else {
		resp.OriginalPrice = p.Price
	}
	return resp
}

func enrichProducts(products []Product) []ProductResponse {
	result := make([]ProductResponse, len(products))
	for i, p := range products {
		result[i] = enrichProduct(p)
	}
	return result
}

func (h *Handler) ListProducts(c *fiber.Ctx) error {
	params := utils.GetPaginationParams(c)
	var products []Product
	var total int64

	query := h.db.Where("is_active = ?", true)

	if catID := c.Query("category_id"); catID != "" {
		var childIDs []uuid.UUID
		h.db.Model(&Category{}).Where("parent_id = ? AND is_active = ?", catID, true).Pluck("id", &childIDs)
		allIDs := append(childIDs, uuid.MustParse(catID))
		query = query.Where("category_id IN ?", allIDs)
	}
	if minPrice := c.Query("min_price"); minPrice != "" {
		if p, err := strconv.ParseFloat(minPrice, 64); err == nil {
			query = query.Where("price >= ?", p)
		}
	}
	if maxPrice := c.Query("max_price"); maxPrice != "" {
		if p, err := strconv.ParseFloat(maxPrice, 64); err == nil {
			query = query.Where("price <= ?", p)
		}
	}
	if search := c.Query("search"); search != "" {
		s := fmt.Sprintf("%%%s%%", search)
		query = query.Where("(name ILIKE ? OR description ILIKE ? OR sku ILIKE ?)", s, s, s)
	}
	if c.Query("on_sale") == "true" {
		query = query.Where("compare_price > 0 AND compare_price > price")
	}

	query.Model(&Product{}).Count(&total)

	sort := c.Query("sort", "created_at")
	order := c.Query("order", "desc")
	allowedSorts := map[string]bool{"name": true, "price": true, "created_at": true}
	if !allowedSorts[sort] {
		sort = "created_at"
	}
	if order != "asc" && order != "desc" {
		order = "desc"
	}

	offset := (params.Page - 1) * params.PageSize
	err := query.Preload("Category").Preload("Variants", "is_active = ? AND deleted_at IS NULL", true).
		Order(sort + " " + order).
		Offset(offset).Limit(params.PageSize).
		Find(&products).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch products")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(enrichProducts(products), total, params))
}

func (h *Handler) GetProduct(c *fiber.Ctx) error {
	identifier := c.Params("slug")

	var product Product
	err := h.db.Where("(slug = ? OR id::text = ?) AND is_active = ?", identifier, identifier, true).
		Preload("Category").
		Preload("Variants", "is_active = ? AND deleted_at IS NULL", true).
		First(&product).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Product not found")
	}

	type ReviewSummary struct {
		AverageRating float64 `json:"average_rating"`
		TotalReviews  int64   `json:"total_reviews"`
	}
	var summary ReviewSummary
	h.db.Table("store_reviews").
		Select("COALESCE(AVG(rating), 0) as average_rating, COUNT(*) as total_reviews").
		Where("product_id = ? AND is_approved = ?", product.ID, true).
		Scan(&summary)

	return utils.SuccessResponse(c, fiber.Map{
		"product": enrichProduct(product),
		"reviews": summary,
	})
}

func (h *Handler) ListCategories(c *fiber.Ctx) error {
	var categories []Category
	err := h.db.Where("is_active = ? AND parent_id IS NULL", true).
		Preload("Children", "is_active = ?", true).
		Order("sort_order ASC, name ASC").
		Find(&categories).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch categories")
	}
	return utils.SuccessResponse(c, categories)
}

func (h *Handler) Search(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return utils.BadRequestResponse(c, "Search query is required")
	}

	params := utils.GetPaginationParams(c)
	var products []Product
	var total int64

	s := fmt.Sprintf("%%%s%%", q)
	query := h.db.Where("is_active = ? AND (name ILIKE ? OR description ILIKE ? OR sku ILIKE ?)", true, s, s, s)
	query.Model(&Product{}).Count(&total)

	offset := (params.Page - 1) * params.PageSize
	err := query.Preload("Category").
		Order("name ASC").
		Offset(offset).Limit(params.PageSize).
		Find(&products).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to search products")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(enrichProducts(products), total, params))
}

func (h *Handler) FeaturedProducts(c *fiber.Ctx) error {
	var products []Product
	err := h.db.Where("is_active = ?", true).
		Preload("Category").
		Order("price DESC").
		Limit(8).
		Find(&products).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch featured products")
	}
	return utils.SuccessResponse(c, enrichProducts(products))
}

func (h *Handler) NewArrivals(c *fiber.Ctx) error {
	var products []Product
	err := h.db.Where("is_active = ?", true).
		Preload("Category").
		Order("created_at DESC").
		Limit(8).
		Find(&products).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch new arrivals")
	}
	return utils.SuccessResponse(c, enrichProducts(products))
}

// PriceRange returns min/max prices for filter UI
func (h *Handler) PriceRange(c *fiber.Ctx) error {
	var result struct {
		MinPrice float64 `json:"min_price"`
		MaxPrice float64 `json:"max_price"`
	}
	h.db.Model(&Product{}).Where("is_active = ?", true).
		Select("COALESCE(MIN(price), 0) as min_price, COALESCE(MAX(price), 0) as max_price").
		Scan(&result)
	return utils.SuccessResponse(c, result)
}

func (h *Handler) RegisterRoutes(api fiber.Router) {
	store := api.Group("/store")
	store.Get("/products", h.ListProducts)
	store.Get("/products/:slug", h.GetProduct)
	store.Get("/categories", h.ListCategories)
	store.Get("/search", h.Search)
	store.Get("/featured", h.FeaturedProducts)
	store.Get("/new-arrivals", h.NewArrivals)
	store.Get("/price-range", h.PriceRange)
}
