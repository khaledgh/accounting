package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PayableHandler struct {
	db *gorm.DB
}

func NewPayableHandler(db *gorm.DB) *PayableHandler {
	return &PayableHandler{db: db}
}

type SupplierPayable struct {
	SupplierID   string  `json:"supplier_id"`
	SupplierName string  `json:"supplier_name"`
	TotalAmount  float64 `json:"total_amount"`
	PaidAmount   float64 `json:"paid_amount"`
	Outstanding  float64 `json:"outstanding"`
	Current      float64 `json:"current"`
	Days30       float64 `json:"days_30"`
	Days60       float64 `json:"days_60"`
	Days90Plus   float64 `json:"days_90_plus"`
	InvoiceCount int     `json:"invoice_count"`
}

type PayableSummary struct {
	TotalPayable float64           `json:"total_payable"`
	TotalOverdue float64           `json:"total_overdue"`
	TotalCurrent float64           `json:"total_current"`
	Suppliers    []SupplierPayable `json:"suppliers"`
}

func (h *PayableHandler) GetPayables(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	// Purchase invoices will be added in Phase 4. For now return empty summary.
	// Once purchase_invoices table exists, this will query it with aging buckets.
	summary := PayableSummary{
		TotalPayable: 0,
		TotalOverdue: 0,
		TotalCurrent: 0,
		Suppliers:    []SupplierPayable{},
	}

	_ = companyID // will be used when purchase invoices are implemented

	return utils.SuccessResponse(c, summary)
}

func (h *PayableHandler) RegisterRoutes(api fiber.Router) {
	api.Get("/accounting/payables", h.GetPayables)
}
