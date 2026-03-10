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

type CustomerHandler struct {
	db      *gorm.DB
	autoNum *autonumber.Service
}

func NewCustomerHandler(db *gorm.DB, autoNum *autonumber.Service) *CustomerHandler {
	return &CustomerHandler{db: db, autoNum: autoNum}
}

type CreateCustomerRequest struct {
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	CompanyName string  `json:"company_name"`
	Email       string  `json:"email"`
	Phone       string  `json:"phone"`
	TaxID       string  `json:"tax_id"`
	Address     string  `json:"address"`
	City        string  `json:"city"`
	State       string  `json:"state"`
	PostalCode  string  `json:"postal_code"`
	Country     string  `json:"country"`
	Notes       string  `json:"notes"`
	CreditLimit float64 `json:"credit_limit"`
}

func (h *CustomerHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var customers []ecomModels.Customer
	var total int64

	query := h.db.Where("company_id = ?", companyID)
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ? OR code ILIKE ? OR company_name ILIKE ?", search, search, search, search, search)
	}

	query.Model(&ecomModels.Customer{}).Count(&total)
	err := query.Order(params.SortBy + " " + params.SortOrder).Scopes(utils.Paginate(params)).Find(&customers).Error
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch customers")
	}
	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(customers, total, params))
}

func (h *CustomerHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var customer ecomModels.Customer
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&customer).Error; err != nil {
		return utils.NotFoundResponse(c, "Customer not found")
	}
	return utils.SuccessResponse(c, customer)
}

func (h *CustomerHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var req CreateCustomerRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if req.FirstName == "" || req.LastName == "" {
		return utils.BadRequestResponse(c, "First name and last name are required")
	}

	code, err := h.autoNum.GenerateNumber(companyID, nil, "customer")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate customer code")
	}

	customer := ecomModels.Customer{
		CompanyID:   companyID,
		Code:        code,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		CompanyName: req.CompanyName,
		Email:       req.Email,
		Phone:       req.Phone,
		TaxID:       req.TaxID,
		Address:     req.Address,
		City:        req.City,
		State:       req.State,
		PostalCode:  req.PostalCode,
		Country:     req.Country,
		Notes:       req.Notes,
		CreditLimit: req.CreditLimit,
		IsActive:    true,
	}

	if err := h.db.Create(&customer).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create customer")
	}
	return utils.CreatedResponse(c, customer)
}

func (h *CustomerHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var customer ecomModels.Customer
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&customer).Error; err != nil {
		return utils.NotFoundResponse(c, "Customer not found")
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if err := h.db.Model(&customer).Updates(body).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update customer")
	}
	h.db.First(&customer, "id = ?", id)
	return utils.SuccessResponse(c, customer, "Customer updated successfully")
}

func (h *CustomerHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")
	var customer ecomModels.Customer
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&customer).Error; err != nil {
		return utils.NotFoundResponse(c, "Customer not found")
	}
	if err := h.db.Delete(&customer).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete customer")
	}
	return utils.SuccessResponse(c, nil, "Customer deleted successfully")
}

func (h *CustomerHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var customers []ecomModels.Customer
	query := h.db.Where("company_id = ?", companyID)
	if s := c.Query("search"); s != "" {
		search := "%" + s + "%"
		query = query.Where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?", search, search, search)
	}
	query.Order("created_at desc").Find(&customers)
	cols := []export.Column{
		{Header: "Code", Field: "Code", Width: 12},
		{Header: "First Name", Field: "FirstName", Width: 20},
		{Header: "Last Name", Field: "LastName", Width: 20},
		{Header: "Email", Field: "Email", Width: 25},
		{Header: "Phone", Field: "Phone", Width: 15},
		{Header: "Active", Field: "IsActive", Width: 10},
	}
	return export.HandleExport(c, "Customers", cols, customers)
}

func (h *CustomerHandler) RegisterRoutes(api fiber.Router) {
	customers := api.Group("/ecommerce/customers")
	customers.Get("/", h.List)
	customers.Get("/export", h.Export)
	customers.Get("/:id", h.Get)
	customers.Post("/", h.Create)
	customers.Put("/:id", h.Update)
	customers.Delete("/:id", h.Delete)
}
