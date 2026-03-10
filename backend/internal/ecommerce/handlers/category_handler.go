package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CategoryHandler struct {
	db *gorm.DB
}

func NewCategoryHandler(db *gorm.DB) *CategoryHandler {
	return &CategoryHandler{db: db}
}

type CreateCategoryRequest struct {
	ParentID    *string `json:"parent_id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	ImageURL    string  `json:"image_url"`
	SortOrder   int     `json:"sort_order"`
}

func (h *CategoryHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var categories []ecomModels.Category
	var total int64

	query := h.db.Where("company_id = ?", companyID)
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR slug ILIKE ?", search, search)
	}

	query.Model(&ecomModels.Category{}).Count(&total)
	err := query.Order("sort_order ASC, name ASC").Scopes(utils.Paginate(params)).Find(&categories).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch categories")
	}
	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(categories, total, params))
}

func (h *CategoryHandler) Tree(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var categories []ecomModels.Category
	err := h.db.Where("company_id = ? AND is_active = ?", companyID, true).
		Order("sort_order ASC, name ASC").Find(&categories).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch categories")
	}

	tree := buildCategoryTree(categories, nil)
	return utils.SuccessResponse(c, tree)
}

func buildCategoryTree(categories []ecomModels.Category, parentID *uuid.UUID) []ecomModels.Category {
	var tree []ecomModels.Category
	for _, cat := range categories {
		if (parentID == nil && cat.ParentID == nil) || (parentID != nil && cat.ParentID != nil && *cat.ParentID == *parentID) {
			children := buildCategoryTree(categories, &cat.ID)
			cat.Children = children
			tree = append(tree, cat)
		}
	}
	return tree
}

func (h *CategoryHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var category ecomModels.Category
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&category).Error; err != nil {
		return utils.NotFoundResponse(c, "Category not found")
	}
	return utils.SuccessResponse(c, category)
}

func (h *CategoryHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var req CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if req.Name == "" {
		return utils.BadRequestResponse(c, "Name is required")
	}

	slug := req.Slug
	if slug == "" {
		slug = strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
	}

	category := ecomModels.Category{
		CompanyID:   companyID,
		Name:        req.Name,
		Slug:        slug,
		Description: req.Description,
		ImageURL:    req.ImageURL,
		SortOrder:   req.SortOrder,
		IsActive:    true,
	}

	if req.ParentID != nil && *req.ParentID != "" {
		parentUUID, err := uuid.Parse(*req.ParentID)
		if err == nil {
			category.ParentID = &parentUUID
		}
	}

	if err := h.db.Create(&category).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create category")
	}
	return utils.CreatedResponse(c, category)
}

func (h *CategoryHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var category ecomModels.Category
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&category).Error; err != nil {
		return utils.NotFoundResponse(c, "Category not found")
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := h.db.Model(&category).Updates(body).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update category")
	}
	h.db.First(&category, "id = ?", id)
	return utils.SuccessResponse(c, category, "Category updated successfully")
}

func (h *CategoryHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var category ecomModels.Category
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&category).Error; err != nil {
		return utils.NotFoundResponse(c, "Category not found")
	}

	var childCount int64
	h.db.Model(&ecomModels.Category{}).Where("parent_id = ?", id).Count(&childCount)
	if childCount > 0 {
		return utils.BadRequestResponse(c, "Cannot delete category with children")
	}

	if err := h.db.Delete(&category).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete category")
	}
	return utils.SuccessResponse(c, nil, "Category deleted successfully")
}

func (h *CategoryHandler) RegisterRoutes(api fiber.Router) {
	categories := api.Group("/ecommerce/categories")
	categories.Get("/", h.List)
	categories.Get("/tree", h.Tree)
	categories.Get("/:id", h.Get)
	categories.Post("/", h.Create)
	categories.Put("/:id", h.Update)
	categories.Delete("/:id", h.Delete)
}
