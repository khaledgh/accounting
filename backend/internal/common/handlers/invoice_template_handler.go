package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InvoiceTemplateHandler struct {
	db *gorm.DB
}

func NewInvoiceTemplateHandler(db *gorm.DB) *InvoiceTemplateHandler {
	return &InvoiceTemplateHandler{db: db}
}

func (h *InvoiceTemplateHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var templates []models.InvoiceTemplate
	h.db.Where("company_id = ?", companyID).Order("is_default desc, name asc").Find(&templates)
	return utils.SuccessResponse(c, templates)
}

func (h *InvoiceTemplateHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid template ID")
	}
	var tmpl models.InvoiceTemplate
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&tmpl).Error; err != nil {
		return utils.NotFoundResponse(c, "Template not found")
	}
	return utils.SuccessResponse(c, tmpl)
}

type CreateTemplateRequest struct {
	Name             string `json:"name"`
	LogoURL          string `json:"logo_url"`
	HeaderText       string `json:"header_text"`
	FooterText       string `json:"footer_text"`
	PaymentTerms     string `json:"payment_terms"`
	NotesTemplate    string `json:"notes_template"`
	ShowTaxBreakdown *bool  `json:"show_tax_breakdown"`
	CurrencyFormat   string `json:"currency_format"`
	IsDefault        bool   `json:"is_default"`
}

func (h *InvoiceTemplateHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var req CreateTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if req.Name == "" {
		return utils.BadRequestResponse(c, "Template name is required")
	}

	if req.IsDefault {
		h.db.Model(&models.InvoiceTemplate{}).Where("company_id = ?", companyID).Update("is_default", false)
	}

	showTax := true
	if req.ShowTaxBreakdown != nil {
		showTax = *req.ShowTaxBreakdown
	}

	tmpl := models.InvoiceTemplate{
		CompanyID:        companyID,
		Name:             req.Name,
		LogoURL:          req.LogoURL,
		HeaderText:       req.HeaderText,
		FooterText:       req.FooterText,
		PaymentTerms:     req.PaymentTerms,
		NotesTemplate:    req.NotesTemplate,
		ShowTaxBreakdown: showTax,
		CurrencyFormat:   req.CurrencyFormat,
		IsDefault:        req.IsDefault,
	}

	if err := h.db.Create(&tmpl).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create template")
	}
	return utils.CreatedResponse(c, tmpl)
}

func (h *InvoiceTemplateHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid template ID")
	}

	var tmpl models.InvoiceTemplate
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&tmpl).Error; err != nil {
		return utils.NotFoundResponse(c, "Template not found")
	}

	var req CreateTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.IsDefault {
		h.db.Model(&models.InvoiceTemplate{}).Where("company_id = ? AND id != ?", companyID, id).Update("is_default", false)
	}

	updates := map[string]interface{}{
		"name":              req.Name,
		"logo_url":          req.LogoURL,
		"header_text":       req.HeaderText,
		"footer_text":       req.FooterText,
		"payment_terms":     req.PaymentTerms,
		"notes_template":    req.NotesTemplate,
		"currency_format":   req.CurrencyFormat,
		"is_default":        req.IsDefault,
	}
	if req.ShowTaxBreakdown != nil {
		updates["show_tax_breakdown"] = *req.ShowTaxBreakdown
	}

	h.db.Model(&tmpl).Updates(updates)
	h.db.First(&tmpl, id)
	return utils.SuccessResponse(c, tmpl, "Template updated successfully")
}

func (h *InvoiceTemplateHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid template ID")
	}

	var tmpl models.InvoiceTemplate
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&tmpl).Error; err != nil {
		return utils.NotFoundResponse(c, "Template not found")
	}

	if err := h.db.Delete(&tmpl).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete template")
	}
	return utils.SuccessResponse(c, nil, "Template deleted successfully")
}

func (h *InvoiceTemplateHandler) RegisterRoutes(api fiber.Router) {
	templates := api.Group("/settings/invoice-templates")
	templates.Get("/", h.List)
	templates.Get("/:id", h.Get)
	templates.Post("/", h.Create)
	templates.Put("/:id", h.Update)
	templates.Delete("/:id", h.Delete)
}
