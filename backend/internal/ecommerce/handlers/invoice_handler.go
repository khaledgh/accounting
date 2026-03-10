package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InvoiceHandler struct {
	db      *gorm.DB
	autoNum *autonumber.Service
}

func NewInvoiceHandler(db *gorm.DB, autoNum *autonumber.Service) *InvoiceHandler {
	return &InvoiceHandler{db: db, autoNum: autoNum}
}

type CreateInvoiceRequest struct {
	CustomerID   *string              `json:"customer_id"`
	OrderID      *string              `json:"order_id"`
	InvoiceDate  string               `json:"invoice_date"`
	DueDate      string               `json:"due_date"`
	CurrencyCode string               `json:"currency_code"`
	Notes        string               `json:"notes"`
	Items        []InvoiceItemRequest `json:"items"`
}

type InvoiceItemRequest struct {
	ProductID   *string `json:"product_id"`
	Description string  `json:"description"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	TaxRate     float64 `json:"tax_rate"`
}

func (h *InvoiceHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var invoices []ecomModels.Invoice
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("invoice_number ILIKE ?", search)
	}

	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Model(&ecomModels.Invoice{}).Count(&total)

	err := query.
		Preload("Customer").
		Preload("Items").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&invoices).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch invoices")
	}
	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(invoices, total, params))
}

func (h *InvoiceHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var invoice ecomModels.Invoice
	err := h.db.Preload("Customer").Preload("Items").
		Where("id = ? AND company_id = ?", id, companyID).First(&invoice).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Invoice not found")
	}
	return utils.SuccessResponse(c, invoice)
}

func (h *InvoiceHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if len(req.Items) == 0 {
		return utils.BadRequestResponse(c, "At least one item is required")
	}

	invoiceDate := time.Now()
	if req.InvoiceDate != "" {
		if parsed, err := time.Parse("2006-01-02", req.InvoiceDate); err == nil {
			invoiceDate = parsed
		}
	}

	dueDate := invoiceDate.AddDate(0, 0, 30)
	if req.DueDate != "" {
		if parsed, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			dueDate = parsed
		}
	}

	number, err := h.autoNum.GenerateNumber(companyID, nil, "invoice")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate invoice number")
	}

	currencyCode := req.CurrencyCode
	if currencyCode == "" {
		currencyCode = "USD"
	}

	tx := h.db.Begin()

	invoice := ecomModels.Invoice{
		CompanyID:     companyID,
		InvoiceNumber: number,
		InvoiceDate:   invoiceDate,
		DueDate:       dueDate,
		Status:        "draft",
		CurrencyCode:  currencyCode,
		Notes:         req.Notes,
	}

	if req.CustomerID != nil && *req.CustomerID != "" {
		custUUID, err := uuid.Parse(*req.CustomerID)
		if err == nil {
			invoice.CustomerID = &custUUID
		}
	}

	if req.OrderID != nil && *req.OrderID != "" {
		orderUUID, err := uuid.Parse(*req.OrderID)
		if err == nil {
			invoice.OrderID = &orderUUID
		}
	}

	if err := tx.Create(&invoice).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create invoice")
	}

	var subtotal, taxTotal float64
	for i, item := range req.Items {
		if item.Description == "" {
			tx.Rollback()
			return utils.BadRequestResponse(c, fmt.Sprintf("Description required on line %d", i+1))
		}

		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}

		lineTotal := float64(qty) * item.UnitPrice
		taxAmt := lineTotal * item.TaxRate / 100

		invItem := ecomModels.InvoiceItem{
			InvoiceID:   invoice.ID,
			Description: item.Description,
			Quantity:    qty,
			UnitPrice:   item.UnitPrice,
			TaxRate:     item.TaxRate,
			TaxAmount:   taxAmt,
			TotalAmount: lineTotal + taxAmt,
			LineNumber:  i + 1,
		}

		if item.ProductID != nil && *item.ProductID != "" {
			prodUUID, err := uuid.Parse(*item.ProductID)
			if err == nil {
				invItem.ProductID = &prodUUID
			}
		}

		if err := tx.Create(&invItem).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Failed to create invoice item")
		}

		subtotal += lineTotal
		taxTotal += taxAmt
	}

	invoice.Subtotal = subtotal
	invoice.TaxAmount = taxTotal
	invoice.TotalAmount = subtotal + taxTotal

	if err := tx.Save(&invoice).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to update invoice totals")
	}

	tx.Commit()

	h.db.Preload("Customer").Preload("Items").First(&invoice, "id = ?", invoice.ID)
	return utils.CreatedResponse(c, invoice)
}

func (h *InvoiceHandler) UpdateStatus(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var invoice ecomModels.Invoice
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&invoice).Error; err != nil {
		return utils.NotFoundResponse(c, "Invoice not found")
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	invoice.Status = body.Status
	if err := h.db.Save(&invoice).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update invoice status")
	}

	return utils.SuccessResponse(c, invoice, "Invoice status updated")
}

func (h *InvoiceHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var invoice ecomModels.Invoice
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&invoice).Error; err != nil {
		return utils.NotFoundResponse(c, "Invoice not found")
	}

	if invoice.Status != "draft" {
		return utils.BadRequestResponse(c, "Only draft invoices can be deleted")
	}

	h.db.Where("invoice_id = ?", id).Delete(&ecomModels.InvoiceItem{})
	if err := h.db.Delete(&invoice).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete invoice")
	}
	return utils.SuccessResponse(c, nil, "Invoice deleted successfully")
}

func (h *InvoiceHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var invoices []ecomModels.Invoice
	query := h.db.Where("company_id = ?", companyID).Preload("Customer")
	if s := c.Query("search"); s != "" {
		query = query.Where("invoice_number ILIKE ?", "%"+s+"%")
	}
	query.Order("created_at desc").Find(&invoices)
	cols := []export.Column{
		{Header: "Invoice #", Field: "InvoiceNumber", Width: 15},
		{Header: "Date", Field: "InvoiceDate", Width: 15},
		{Header: "Due Date", Field: "DueDate", Width: 15},
		{Header: "Status", Field: "Status", Width: 12},
		{Header: "Total", Field: "TotalAmount", Width: 12},
		{Header: "Paid", Field: "PaidAmount", Width: 12},
	}
	return export.HandleExport(c, "Invoices", cols, invoices)
}

func (h *InvoiceHandler) RegisterRoutes(api fiber.Router) {
	invoices := api.Group("/ecommerce/invoices")
	invoices.Get("/", h.List)
	invoices.Get("/export", h.Export)
	invoices.Get("/:id", h.Get)
	invoices.Post("/", h.Create)
	invoices.Put("/:id/status", h.UpdateStatus)
	invoices.Delete("/:id", h.Delete)
}
