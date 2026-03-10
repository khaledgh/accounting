package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SupplierHandler struct {
	db      *gorm.DB
	autoNum *autonumber.Service
}

func NewSupplierHandler(db *gorm.DB, autoNum *autonumber.Service) *SupplierHandler {
	return &SupplierHandler{db: db, autoNum: autoNum}
}

type CreateSupplierRequest struct {
	Name         string `json:"name"`
	ContactName  string `json:"contact_name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	TaxID        string `json:"tax_id"`
	Address      string `json:"address"`
	City         string `json:"city"`
	State        string `json:"state"`
	PostalCode   string `json:"postal_code"`
	Country      string `json:"country"`
	Website      string `json:"website"`
	Notes        string `json:"notes"`
	PaymentTerms string `json:"payment_terms"`
}

func (h *SupplierHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var suppliers []ecomModels.Supplier
	var total int64

	query := h.db.Where("company_id = ?", companyID)
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR code ILIKE ? OR email ILIKE ? OR contact_name ILIKE ?", search, search, search, search)
	}

	query.Model(&ecomModels.Supplier{}).Count(&total)
	err := query.Order(params.SortBy + " " + params.SortOrder).Scopes(utils.Paginate(params)).Find(&suppliers).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch suppliers")
	}
	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(suppliers, total, params))
}

func (h *SupplierHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var supplier ecomModels.Supplier
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&supplier).Error; err != nil {
		return utils.NotFoundResponse(c, "Supplier not found")
	}
	return utils.SuccessResponse(c, supplier)
}

func (h *SupplierHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var req CreateSupplierRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if req.Name == "" {
		return utils.BadRequestResponse(c, "Name is required")
	}

	code, err := h.autoNum.GenerateNumber(companyID, nil, "supplier")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate supplier code")
	}

	supplier := ecomModels.Supplier{
		CompanyID:    companyID,
		Code:         code,
		Name:         req.Name,
		ContactName:  req.ContactName,
		Email:        req.Email,
		Phone:        req.Phone,
		TaxID:        req.TaxID,
		Address:      req.Address,
		City:         req.City,
		State:        req.State,
		PostalCode:   req.PostalCode,
		Country:      req.Country,
		Website:      req.Website,
		Notes:        req.Notes,
		PaymentTerms: req.PaymentTerms,
		IsActive:     true,
	}

	if err := h.db.Create(&supplier).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create supplier")
	}
	return utils.CreatedResponse(c, supplier)
}

func (h *SupplierHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var supplier ecomModels.Supplier
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&supplier).Error; err != nil {
		return utils.NotFoundResponse(c, "Supplier not found")
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := h.db.Model(&supplier).Updates(body).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update supplier")
	}
	h.db.First(&supplier, "id = ?", id)
	return utils.SuccessResponse(c, supplier, "Supplier updated successfully")
}

func (h *SupplierHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var supplier ecomModels.Supplier
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&supplier).Error; err != nil {
		return utils.NotFoundResponse(c, "Supplier not found")
	}
	if err := h.db.Delete(&supplier).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete supplier")
	}
	return utils.SuccessResponse(c, nil, "Supplier deleted successfully")
}

func (h *SupplierHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var suppliers []ecomModels.Supplier
	query := h.db.Where("company_id = ?", companyID)
	if s := c.Query("search"); s != "" {
		search := "%" + s + "%"
		query = query.Where("name ILIKE ? OR email ILIKE ?", search, search)
	}
	query.Order("created_at desc").Find(&suppliers)
	cols := []export.Column{
		{Header: "Code", Field: "Code", Width: 12},
		{Header: "Name", Field: "Name", Width: 25},
		{Header: "Email", Field: "Email", Width: 25},
		{Header: "Phone", Field: "Phone", Width: 15},
		{Header: "Active", Field: "IsActive", Width: 10},
	}
	return export.HandleExport(c, "Suppliers", cols, suppliers)
}

func (h *SupplierHandler) RegisterRoutes(api fiber.Router) {
	suppliers := api.Group("/ecommerce/suppliers")
	suppliers.Get("/", h.List)
	suppliers.Get("/export", h.Export)
	suppliers.Get("/:id", h.Get)
	suppliers.Post("/", h.Create)
	suppliers.Put("/:id", h.Update)
	suppliers.Delete("/:id", h.Delete)
}
