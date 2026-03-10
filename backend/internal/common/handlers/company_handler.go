package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CompanyHandler struct {
	db *gorm.DB
}

func NewCompanyHandler(db *gorm.DB) *CompanyHandler {
	return &CompanyHandler{db: db}
}

type UpdateCompanyRequest struct {
	Name       *string `json:"name"`
	Code       *string `json:"code"`
	TaxID      *string `json:"tax_id"`
	Email      *string `json:"email"`
	Phone      *string `json:"phone"`
	Address    *string `json:"address"`
	City       *string `json:"city"`
	Country    *string `json:"country"`
	PostalCode *string `json:"postal_code"`
	Website    *string `json:"website"`
	Logo       *string `json:"logo"`
}

type CreateCompanyRequest struct {
	Name         string `json:"name"`
	Code         string `json:"code"`
	TaxID        string `json:"tax_id"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Address      string `json:"address"`
	City         string `json:"city"`
	Country      string `json:"country"`
	PostalCode   string `json:"postal_code"`
	Website      string `json:"website"`
	CurrencyCode string `json:"currency_code"`
}

func (h *CompanyHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var company models.Company
	err := h.db.Preload("Branches").Where("id = ?", companyID).First(&company).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Company not found")
	}

	return utils.SuccessResponse(c, company)
}

func (h *CompanyHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var company models.Company
	if err := h.db.Where("id = ?", companyID).First(&company).Error; err != nil {
		return utils.NotFoundResponse(c, "Company not found")
	}

	var req UpdateCompanyRequest
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
	if req.TaxID != nil {
		updates["tax_id"] = *req.TaxID
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
	if req.PostalCode != nil {
		updates["postal_code"] = *req.PostalCode
	}
	if req.Website != nil {
		updates["website"] = *req.Website
	}
	if req.Logo != nil {
		updates["logo"] = *req.Logo
	}

	if err := h.db.Model(&company).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update company")
	}

	h.db.Preload("Branches").First(&company, "id = ?", companyID)
	return utils.SuccessResponse(c, company, "Company updated successfully")
}

// ── /companies list CRUD (admin) ────────────────────────────────────

func (h *CompanyHandler) List(c *fiber.Ctx) error {
	params := utils.GetPaginationParams(c)

	var companies []models.Company
	var total int64

	query := h.db.Model(&models.Company{})

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR code ILIKE ? OR email ILIKE ?", search, search, search)
	}

	query.Count(&total)

	err := query.
		Preload("Branches").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&companies).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch companies")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(companies, total, params))
}

func (h *CompanyHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")

	var company models.Company
	if err := h.db.Preload("Branches").Where("id = ?", id).First(&company).Error; err != nil {
		return utils.NotFoundResponse(c, "Company not found")
	}

	return utils.SuccessResponse(c, company)
}

func (h *CompanyHandler) Create(c *fiber.Ctx) error {
	var req CreateCompanyRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Name == "" {
		return utils.BadRequestResponse(c, "Company name is required")
	}

	code := req.Code
	if code == "" {
		code = req.Name[:min(len(req.Name), 10)]
	}

	var existing models.Company
	if err := h.db.Where("code = ?", code).First(&existing).Error; err == nil {
		return utils.BadRequestResponse(c, "Company code already exists")
	}

	company := models.Company{
		Name:       req.Name,
		Code:       code,
		TaxID:      req.TaxID,
		Email:      req.Email,
		Phone:      req.Phone,
		Address:    req.Address,
		City:       req.City,
		Country:    req.Country,
		PostalCode: req.PostalCode,
		Website:    req.Website,
		IsActive:   true,
	}

	tx := h.db.Begin()
	if err := tx.Create(&company).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create company")
	}

	branch := models.Branch{
		CompanyID: company.ID,
		Name:      "Main Branch",
		Code:      "MAIN",
		IsActive:  true,
		IsMain:    true,
	}
	if err := tx.Create(&branch).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create main branch")
	}

	tx.Commit()

	h.db.Preload("Branches").First(&company, "id = ?", company.ID)
	return utils.CreatedResponse(c, company)
}

func (h *CompanyHandler) UpdateByID(c *fiber.Ctx) error {
	id := c.Params("id")

	var company models.Company
	if err := h.db.Where("id = ?", id).First(&company).Error; err != nil {
		return utils.NotFoundResponse(c, "Company not found")
	}

	var req UpdateCompanyRequest
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
	if req.TaxID != nil {
		updates["tax_id"] = *req.TaxID
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
	if req.PostalCode != nil {
		updates["postal_code"] = *req.PostalCode
	}
	if req.Website != nil {
		updates["website"] = *req.Website
	}
	if req.Logo != nil {
		updates["logo"] = *req.Logo
	}

	if err := h.db.Model(&company).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update company")
	}

	h.db.Preload("Branches").First(&company, "id = ?", id)
	return utils.SuccessResponse(c, company, "Company updated successfully")
}

func (h *CompanyHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	var company models.Company
	if err := h.db.Where("id = ?", id).First(&company).Error; err != nil {
		return utils.NotFoundResponse(c, "Company not found")
	}

	if err := h.db.Delete(&company).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete company")
	}

	return utils.SuccessResponse(c, nil, "Company deleted successfully")
}

func (h *CompanyHandler) Export(c *fiber.Ctx) error {
	var companies []models.Company
	query := h.db.Model(&models.Company{})
	if s := c.Query("search"); s != "" {
		search := "%" + s + "%"
		query = query.Where("name ILIKE ? OR code ILIKE ?", search, search)
	}
	query.Order("created_at desc").Find(&companies)
	cols := []export.Column{
		{Header: "Name", Field: "Name", Width: 25},
		{Header: "Code", Field: "Code", Width: 12},
		{Header: "Email", Field: "Email", Width: 25},
		{Header: "City", Field: "City", Width: 15},
		{Header: "Country", Field: "Country", Width: 15},
		{Header: "Active", Field: "IsActive", Width: 10},
	}
	return export.HandleExport(c, "Companies", cols, companies)
}

func (h *CompanyHandler) RegisterRoutes(api fiber.Router) {
	company := api.Group("/company")
	company.Get("/", h.Get)
	company.Put("/", h.Update)

	companies := api.Group("/companies")
	companies.Get("/", h.List)
	companies.Get("/export", h.Export)
	companies.Get("/:id", h.GetByID)
	companies.Post("/", h.Create)
	companies.Put("/:id", h.UpdateByID)
	companies.Delete("/:id", h.Delete)
}
