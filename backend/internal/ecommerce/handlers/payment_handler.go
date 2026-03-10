package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	intModels "github.com/gonext/accounting-ecommerce/internal/integration/models"
	intService "github.com/gonext/accounting-ecommerce/internal/integration/service"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentHandler struct {
	db          *gorm.DB
	autoNum     *autonumber.Service
	integration *intService.IntegrationService
}

func NewPaymentHandler(db *gorm.DB, autoNum *autonumber.Service, integration *intService.IntegrationService) *PaymentHandler {
	return &PaymentHandler{db: db, autoNum: autoNum, integration: integration}
}

type CreatePaymentRequest struct {
	OrderID      *string `json:"order_id"`
	CustomerID   *string `json:"customer_id"`
	PaymentDate  string  `json:"payment_date"`
	Amount       float64 `json:"amount"`
	CurrencyCode string  `json:"currency_code"`
	Method       string  `json:"method"`
	Reference    string  `json:"reference"`
	Notes        string  `json:"notes"`
}

func (h *PaymentHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var payments []ecomModels.Payment
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("payment_number ILIKE ? OR reference ILIKE ?", search, search)
	}

	method := c.Query("method")
	if method != "" {
		query = query.Where("method = ?", method)
	}

	orderID := c.Query("order_id")
	if orderID != "" {
		query = query.Where("order_id = ?", orderID)
	}

	query.Model(&ecomModels.Payment{}).Count(&total)

	err := query.
		Preload("Order").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&payments).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch payments")
	}
	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(payments, total, params))
}

func (h *PaymentHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var payment ecomModels.Payment
	err := h.db.Preload("Order").Where("id = ? AND company_id = ?", id, companyID).First(&payment).Error
	if err != nil {
		return utils.NotFoundResponse(c, "Payment not found")
	}
	return utils.SuccessResponse(c, payment)
}

func (h *PaymentHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreatePaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Amount <= 0 {
		return utils.BadRequestResponse(c, "Amount must be greater than zero")
	}
	if req.Method == "" {
		return utils.BadRequestResponse(c, "Payment method is required")
	}

	paymentDate := time.Now()
	if req.PaymentDate != "" {
		if parsed, err := time.Parse("2006-01-02", req.PaymentDate); err == nil {
			paymentDate = parsed
		}
	}

	number, err := h.autoNum.GenerateNumber(companyID, nil, "payment")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate payment number")
	}

	currencyCode := req.CurrencyCode
	if currencyCode == "" {
		currencyCode = "USD"
	}

	payment := ecomModels.Payment{
		CompanyID:     companyID,
		PaymentNumber: number,
		PaymentDate:   paymentDate,
		Amount:        req.Amount,
		CurrencyCode:  currencyCode,
		Method:        req.Method,
		Reference:     req.Reference,
		Notes:         req.Notes,
		Status:        "completed",
	}

	if req.OrderID != nil && *req.OrderID != "" {
		orderUUID, err := uuid.Parse(*req.OrderID)
		if err == nil {
			payment.OrderID = &orderUUID
		}
	}

	if req.CustomerID != nil && *req.CustomerID != "" {
		custUUID, err := uuid.Parse(*req.CustomerID)
		if err == nil {
			payment.CustomerID = &custUUID
		}
	}

	if err := h.db.Create(&payment).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create payment")
	}

	// Update order paid amount & payment status
	if payment.OrderID != nil {
		var order ecomModels.Order
		if err := h.db.Where("id = ?", *payment.OrderID).First(&order).Error; err == nil {
			order.PaidAmount += payment.Amount
			if order.PaidAmount >= order.TotalAmount {
				order.PaymentStatus = ecomModels.PaymentStatusPaid
			} else {
				order.PaymentStatus = ecomModels.PaymentStatusPartial
			}
			h.db.Save(&order)
		}
	}

	// Trigger integration for payment received
	if h.integration != nil {
		_ = h.integration.ProcessPaymentEvent(companyID, &payment)
	}

	// Also trigger invoice payment update
	if payment.OrderID != nil {
		var invoice ecomModels.Invoice
		if err := h.db.Where("order_id = ? AND company_id = ?", *payment.OrderID, companyID).First(&invoice).Error; err == nil {
			invoice.PaidAmount += payment.Amount
			if invoice.PaidAmount >= invoice.TotalAmount {
				invoice.Status = "paid"
			} else if invoice.PaidAmount > 0 {
				invoice.Status = "partial"
			}
			h.db.Save(&invoice)
		}
	}

	return utils.CreatedResponse(c, payment)
}

func (h *PaymentHandler) Refund(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var original ecomModels.Payment
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&original).Error; err != nil {
		return utils.NotFoundResponse(c, "Payment not found")
	}

	if original.Status == "refunded" {
		return utils.BadRequestResponse(c, "Payment already refunded")
	}

	number, err := h.autoNum.GenerateNumber(companyID, nil, "payment")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate refund number")
	}

	refund := ecomModels.Payment{
		CompanyID:     companyID,
		OrderID:       original.OrderID,
		CustomerID:    original.CustomerID,
		PaymentNumber: number,
		PaymentDate:   time.Now(),
		Amount:        -original.Amount,
		CurrencyCode:  original.CurrencyCode,
		Method:        original.Method,
		Reference:     "REFUND-" + original.PaymentNumber,
		Notes:         "Refund of " + original.PaymentNumber,
		Status:        "refunded",
	}

	if err := h.db.Create(&refund).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create refund")
	}

	original.Status = "refunded"
	h.db.Save(&original)

	// Update order
	if original.OrderID != nil {
		var order ecomModels.Order
		if err := h.db.Where("id = ?", *original.OrderID).First(&order).Error; err == nil {
			order.PaidAmount -= original.Amount
			if order.PaidAmount <= 0 {
				order.PaymentStatus = ecomModels.PaymentStatusRefunded
			} else {
				order.PaymentStatus = ecomModels.PaymentStatusPartial
			}
			h.db.Save(&order)
		}
	}

	// Trigger integration
	if h.integration != nil {
		refundPayment := refund
		refundPayment.Amount = original.Amount
		_ = h.integration.ProcessPaymentEvent(companyID, &refundPayment)
		_ = func() error { return nil }() // placeholder for refund-specific event
		_ = h.db.Model(&ecomModels.Payment{}).Where("id = ?", refund.ID).First(&refund).Error
	}

	return utils.SuccessResponse(c, refund, "Payment refunded successfully")
}

// SeedPaymentMethods is unused but kept for reference
var _ = intModels.EventPaymentRefunded

func (h *PaymentHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var payments []ecomModels.Payment
	query := h.db.Where("company_id = ?", companyID).Preload("Order")
	if s := c.Query("search"); s != "" {
		query = query.Where("payment_number ILIKE ?", "%"+s+"%")
	}
	query.Order("created_at desc").Find(&payments)
	cols := []export.Column{
		{Header: "Payment #", Field: "PaymentNumber", Width: 15},
		{Header: "Date", Field: "PaymentDate", Width: 15},
		{Header: "Amount", Field: "Amount", Width: 12},
		{Header: "Method", Field: "Method", Width: 15},
		{Header: "Status", Field: "Status", Width: 12},
		{Header: "Reference", Field: "Reference", Width: 20},
	}
	return export.HandleExport(c, "Payments", cols, payments)
}

func (h *PaymentHandler) RegisterRoutes(api fiber.Router) {
	payments := api.Group("/ecommerce/payments")
	payments.Get("/", h.List)
	payments.Get("/export", h.Export)
	payments.Get("/:id", h.Get)
	payments.Post("/", h.Create)
	payments.Post("/:id/refund", h.Refund)
}
