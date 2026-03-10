package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	ecomHandlers "github.com/gonext/accounting-ecommerce/internal/ecommerce/handlers"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PurchaseInvoiceHandler struct {
	db             *gorm.DB
	autoNumService *autonumber.Service
}

func NewPurchaseInvoiceHandler(db *gorm.DB, autoNumService *autonumber.Service) *PurchaseInvoiceHandler {
	return &PurchaseInvoiceHandler{db: db, autoNumService: autoNumService}
}

type CreatePurchaseInvoiceRequest struct {
	SupplierID  *string                      `json:"supplier_id"`
	InvoiceDate string                       `json:"invoice_date"`
	DueDate     string                       `json:"due_date"`
	Notes       string                       `json:"notes"`
	Items       []PurchaseInvoiceItemRequest `json:"items"`
}

type PurchaseInvoiceItemRequest struct {
	ProductID   *string `json:"product_id"`
	VariantID   *string `json:"variant_id"`
	Description string  `json:"description"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	TaxRate     float64 `json:"tax_rate"`
}

func (h *PurchaseInvoiceHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var invoices []accModels.PurchaseInvoice
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("invoice_number ILIKE ? OR notes ILIKE ?", search, search)
	}

	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Model(&accModels.PurchaseInvoice{}).Count(&total)

	err := query.
		Preload("Items").
		Order("created_at desc").
		Scopes(utils.Paginate(params)).
		Find(&invoices).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch purchase invoices")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(invoices, total, params))
}

func (h *PurchaseInvoiceHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var invoice accModels.PurchaseInvoice
	if err := h.db.Preload("Items").Where("id = ? AND company_id = ?", id, companyID).First(&invoice).Error; err != nil {
		return utils.NotFoundResponse(c, "Purchase invoice not found")
	}

	return utils.SuccessResponse(c, invoice)
}

func (h *PurchaseInvoiceHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreatePurchaseInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if len(req.Items) == 0 {
		return utils.BadRequestResponse(c, "At least one item is required")
	}

	invoiceDate, err := time.Parse("2006-01-02", req.InvoiceDate)
	if err != nil {
		invoiceDate = time.Now()
	}
	dueDate, err := time.Parse("2006-01-02", req.DueDate)
	if err != nil {
		dueDate = invoiceDate.AddDate(0, 1, 0)
	}

	// Ensure sequence exists, then generate number
	_ = h.autoNumService.EnsureSequence(companyID, nil, "purchase_invoice", "PINV-", 6)
	invNumber, err := h.autoNumService.GenerateNumber(companyID, nil, "purchase_invoice")
	if err != nil {
		invNumber = fmt.Sprintf("PINV-%d", time.Now().UnixNano())
	}

	invoice := accModels.PurchaseInvoice{
		CompanyID:     companyID,
		InvoiceNumber: invNumber,
		InvoiceDate:   invoiceDate,
		DueDate:       dueDate,
		Status:        accModels.PurchaseInvoiceStatusDraft,
		CurrencyCode:  "USD",
		Notes:         req.Notes,
	}

	if req.SupplierID != nil && *req.SupplierID != "" {
		supUUID, err := uuid.Parse(*req.SupplierID)
		if err == nil {
			invoice.SupplierID = &supUUID
		}
	}

	tx := h.db.Begin()

	if err := tx.Create(&invoice).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create purchase invoice")
	}

	var subtotal, taxTotal float64
	for i, item := range req.Items {
		lineTotal := float64(item.Quantity) * item.UnitPrice
		taxAmt := lineTotal * item.TaxRate / 100

		invItem := accModels.PurchaseInvoiceItem{
			PurchaseInvoiceID: invoice.ID,
			Description:       item.Description,
			Quantity:          item.Quantity,
			UnitPrice:         item.UnitPrice,
			TaxRate:           item.TaxRate,
			TaxAmount:         taxAmt,
			TotalAmount:       lineTotal + taxAmt,
			LineNumber:        i + 1,
		}

		if item.ProductID != nil && *item.ProductID != "" {
			prodUUID, err := uuid.Parse(*item.ProductID)
			if err == nil {
				invItem.ProductID = &prodUUID
			}
		}

		if item.VariantID != nil && *item.VariantID != "" {
			varUUID, err := uuid.Parse(*item.VariantID)
			if err == nil {
				invItem.VariantID = &varUUID
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
	tx.Save(&invoice)

	tx.Commit()

	h.db.Preload("Items").First(&invoice, "id = ?", invoice.ID)
	return utils.CreatedResponse(c, invoice)
}

func (h *PurchaseInvoiceHandler) Confirm(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var invoice accModels.PurchaseInvoice
	if err := h.db.Preload("Items").Where("id = ? AND company_id = ?", id, companyID).First(&invoice).Error; err != nil {
		return utils.NotFoundResponse(c, "Purchase invoice not found")
	}

	if invoice.Status != accModels.PurchaseInvoiceStatusDraft {
		return utils.BadRequestResponse(c, "Only draft invoices can be confirmed")
	}

	tx := h.db.Begin()

	// Update status
	tx.Model(&invoice).Update("status", accModels.PurchaseInvoiceStatusConfirmed)

	// Create stock movements for each item with a product
	for _, item := range invoice.Items {
		if item.ProductID != nil {
			err := ecomHandlers.RecordStockMovement(
				tx, companyID, *item.ProductID, item.Quantity,
				ecomModels.StockMovementTypePurchase,
				"purchase_invoice", invoice.ID.String(),
				fmt.Sprintf("Purchase Invoice %s", invoice.InvoiceNumber),
			)
			if err != nil {
				tx.Rollback()
				return utils.InternalErrorResponse(c, "Failed to update stock: "+err.Error())
			}
		}
	}

	// Create journal entry: Debit Inventory (1300), Credit AP (2100)
	h.createJournalEntry(tx, companyID, invoice, "confirm")

	tx.Commit()

	h.db.Preload("Items").First(&invoice, "id = ?", invoice.ID)
	return utils.SuccessResponse(c, invoice, "Purchase invoice confirmed and stock updated")
}

func (h *PurchaseInvoiceHandler) Pay(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var req struct {
		Amount float64 `json:"amount"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	var invoice accModels.PurchaseInvoice
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&invoice).Error; err != nil {
		return utils.NotFoundResponse(c, "Purchase invoice not found")
	}

	if invoice.Status == accModels.PurchaseInvoiceStatusDraft || invoice.Status == accModels.PurchaseInvoiceStatusCancelled {
		return utils.BadRequestResponse(c, "Cannot pay a draft or cancelled invoice")
	}

	payAmount := req.Amount
	if payAmount <= 0 {
		payAmount = invoice.TotalAmount - invoice.PaidAmount
	}

	if payAmount <= 0 {
		return utils.BadRequestResponse(c, "Invoice is already fully paid")
	}

	tx := h.db.Begin()

	newPaid := invoice.PaidAmount + payAmount
	updates := map[string]interface{}{
		"paid_amount": newPaid,
	}
	if newPaid >= invoice.TotalAmount {
		updates["status"] = accModels.PurchaseInvoiceStatusPaid
	}
	tx.Model(&invoice).Updates(updates)

	// Create journal entry: Debit AP (2100), Credit Cash (1100)
	invoice.PaidAmount = payAmount // temporarily set for journal amount
	h.createJournalEntry(tx, companyID, invoice, "pay")

	tx.Commit()

	h.db.First(&invoice, "id = ?", invoice.ID)
	return utils.SuccessResponse(c, invoice, "Payment recorded")
}

func (h *PurchaseInvoiceHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var invoice accModels.PurchaseInvoice
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&invoice).Error; err != nil {
		return utils.NotFoundResponse(c, "Purchase invoice not found")
	}

	if invoice.Status != accModels.PurchaseInvoiceStatusDraft {
		return utils.BadRequestResponse(c, "Only draft invoices can be deleted")
	}

	h.db.Where("purchase_invoice_id = ?", invoice.ID).Delete(&accModels.PurchaseInvoiceItem{})
	h.db.Delete(&invoice)

	return utils.SuccessResponse(c, nil, "Purchase invoice deleted")
}

func (h *PurchaseInvoiceHandler) createJournalEntry(tx *gorm.DB, companyID uuid.UUID, invoice accModels.PurchaseInvoice, action string) {
	var debitAccount, creditAccount accModels.Account
	var amount float64
	var desc string

	switch action {
	case "confirm":
		// Debit Inventory (1300), Credit AP (2100)
		tx.Where("company_id = ? AND code = ?", companyID, "1300").First(&debitAccount)
		tx.Where("company_id = ? AND code = ?", companyID, "2100").First(&creditAccount)
		amount = invoice.TotalAmount
		desc = fmt.Sprintf("Purchase Invoice %s - Inventory received", invoice.InvoiceNumber)
	case "pay":
		// Debit AP (2100), Credit Cash (1100)
		tx.Where("company_id = ? AND code = ?", companyID, "2100").First(&debitAccount)
		tx.Where("company_id = ? AND code = ?", companyID, "1100").First(&creditAccount)
		amount = invoice.PaidAmount
		desc = fmt.Sprintf("Purchase Invoice %s - Payment", invoice.InvoiceNumber)
	}

	if debitAccount.ID == uuid.Nil || creditAccount.ID == uuid.Nil || amount == 0 {
		return
	}

	// Find current financial year and period
	var fy accModels.FinancialYear
	tx.Where("company_id = ? AND is_active = ?", companyID, true).First(&fy)
	if fy.ID == uuid.Nil {
		return
	}

	var period accModels.FiscalPeriod
	now := time.Now()
	tx.Where("financial_year_id = ? AND start_date <= ? AND end_date >= ?", fy.ID, now, now).First(&period)

	jrnNumber := fmt.Sprintf("JRN-PI-%s", invoice.InvoiceNumber)
	postedAt := time.Now()

	journal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: fy.ID,
		Number:          jrnNumber,
		Date:            now,
		Reference:       invoice.InvoiceNumber,
		Description:     desc,
		Status:          accModels.JournalStatusPosted,
		TotalDebit:      amount,
		TotalCredit:     amount,
		CurrencyCode:    "USD",
		ExchangeRate:    1,
		PostedAt:        &postedAt,
	}
	if period.ID != uuid.Nil {
		journal.FiscalPeriodID = &period.ID
	}

	tx.Create(&journal)

	tx.Create(&accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    debitAccount.ID,
		Description:  desc,
		DebitAmount:  amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseDebit:    amount,
		LineNumber:   1,
	})

	tx.Create(&accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    creditAccount.ID,
		Description:  desc,
		CreditAmount: amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseCredit:   amount,
		LineNumber:   2,
	})

	// Update account balances
	tx.Model(&debitAccount).Update("current_balance", gorm.Expr("current_balance + ?", amount))
	if action == "pay" {
		tx.Model(&creditAccount).Update("current_balance", gorm.Expr("current_balance - ?", amount))
	} else {
		tx.Model(&creditAccount).Update("current_balance", gorm.Expr("current_balance + ?", amount))
	}
}

func (h *PurchaseInvoiceHandler) RegisterRoutes(api fiber.Router) {
	pi := api.Group("/accounting/purchase-invoices")
	pi.Get("/", h.List)
	pi.Get("/:id", h.Get)
	pi.Post("/", h.Create)
	pi.Put("/:id/confirm", h.Confirm)
	pi.Put("/:id/pay", h.Pay)
	pi.Delete("/:id", h.Delete)
}
