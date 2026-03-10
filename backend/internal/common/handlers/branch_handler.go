package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BranchHandler struct {
	db *gorm.DB
}

func NewBranchHandler(db *gorm.DB) *BranchHandler {
	return &BranchHandler{db: db}
}

type CreateBranchRequest struct {
	Name    string `json:"name"`
	Code    string `json:"code"`
	Email   string `json:"email"`
	Phone   string `json:"phone"`
	Address string `json:"address"`
	City    string `json:"city"`
	Country string `json:"country"`
}

type UpdateBranchRequest struct {
	Name     *string `json:"name"`
	Code     *string `json:"code"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
	Address  *string `json:"address"`
	City     *string `json:"city"`
	Country  *string `json:"country"`
	IsActive *bool   `json:"is_active"`
}

func (h *BranchHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var branches []models.Branch
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR code ILIKE ?", search, search)
	}

	query.Model(&models.Branch{}).Count(&total)

	err := query.
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&branches).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch branches")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(branches, total, params))
}

func (h *BranchHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var branch models.Branch
	err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&branch).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Branch not found")
	}

	return utils.SuccessResponse(c, branch)
}

func (h *BranchHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Name == "" || req.Code == "" {
		return utils.BadRequestResponse(c, "Name and code are required")
	}

	branch := models.Branch{
		CompanyID: companyID,
		Name:      req.Name,
		Code:      req.Code,
		Email:     req.Email,
		Phone:     req.Phone,
		Address:   req.Address,
		City:      req.City,
		Country:   req.Country,
		IsActive:  true,
	}

	if err := h.db.Create(&branch).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create branch")
	}

	return utils.CreatedResponse(c, branch)
}

func (h *BranchHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var branch models.Branch
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&branch).Error; err != nil {
		return utils.NotFoundResponse(c, "Branch not found")
	}

	var req UpdateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Code != nil {
		updates["code"] = *req.Code
	}
	if req.Email != nil {
		updates["email"] = *req.Email
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.Address != nil {
		updates["address"] = *req.Address
	}
	if req.City != nil {
		updates["city"] = *req.City
	}
	if req.Country != nil {
		updates["country"] = *req.Country
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if err := h.db.Model(&branch).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update branch")
	}

	h.db.First(&branch, "id = ?", id)
	return utils.SuccessResponse(c, branch, "Branch updated successfully")
}

func (h *BranchHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var branch models.Branch
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&branch).Error; err != nil {
		return utils.NotFoundResponse(c, "Branch not found")
	}

	if branch.IsMain {
		return utils.BadRequestResponse(c, "Cannot delete the main branch")
	}

	if err := h.db.Delete(&branch).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete branch")
	}

	return utils.SuccessResponse(c, nil, "Branch deleted successfully")
}

func (h *BranchHandler) RegisterRoutes(api fiber.Router) {
	branches := api.Group("/branches")
	branches.Get("/", h.List)
	branches.Get("/:id", h.Get)
	branches.Post("/", h.Create)
	branches.Put("/:id", h.Update)
	branches.Delete("/:id", h.Delete)
}
