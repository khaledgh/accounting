package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AccountingPaymentHandler struct {
	db *gorm.DB
}

func NewAccountingPaymentHandler(db *gorm.DB) *AccountingPaymentHandler {
	return &AccountingPaymentHandler{db: db}
}

type CreatePaymentRequest struct {
	BankAccountID string  `json:"bank_account_id"`
	ContactType   string  `json:"contact_type"` // customer or supplier
	ContactID     string  `json:"contact_id"`
	PaymentType   string  `json:"payment_type"` // receive or make
	Amount        float64 `json:"amount"`
	PaymentDate   string  `json:"payment_date"`
	Reference     string  `json:"reference"`
	Method        string  `json:"method"`
	Notes         string  `json:"notes"`
}

func (h *AccountingPaymentHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var payments []accModels.AccountingPayment
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	paymentType := c.Query("payment_type")
	if paymentType != "" {
		query = query.Where("payment_type = ?", paymentType)
	}

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("reference ILIKE ? OR notes ILIKE ? OR method ILIKE ?", search, search, search)
	}

	query.Model(&accModels.AccountingPayment{}).Count(&total)

	err := query.
		Preload("BankAccount").
		Order("payment_date DESC, created_at DESC").
		Scopes(utils.Paginate(params)).
		Find(&payments).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch payments")
	}

	// Populate contact names
	for i := range payments {
		if payments[i].ContactID != nil {
			if payments[i].ContactType == "customer" {
				var name string
				h.db.Table("customers").Where("id = ?", payments[i].ContactID).Select("CONCAT(first_name, ' ', last_name)").Row().Scan(&name)
				payments[i].ContactName = name
			} else if payments[i].ContactType == "supplier" {
				var name string
				h.db.Table("suppliers").Where("id = ?", payments[i].ContactID).Select("name").Row().Scan(&name)
				payments[i].ContactName = name
			}
		}
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(payments, total, params))
}

func (h *AccountingPaymentHandler) GetSummary(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var totalReceived, totalMade float64
	h.db.Model(&accModels.AccountingPayment{}).
		Where("company_id = ? AND payment_type = ? AND status = ?", companyID, "receive", "completed").
		Select("COALESCE(SUM(amount), 0)").Row().Scan(&totalReceived)
	h.db.Model(&accModels.AccountingPayment{}).
		Where("company_id = ? AND payment_type = ? AND status = ?", companyID, "make", "completed").
		Select("COALESCE(SUM(amount), 0)").Row().Scan(&totalMade)

	return utils.SuccessResponse(c, map[string]interface{}{
		"total_received": totalReceived,
		"total_made":     totalMade,
		"net":            totalReceived - totalMade,
	})
}

func (h *AccountingPaymentHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreatePaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Amount <= 0 {
		return utils.BadRequestResponse(c, "Amount must be greater than 0")
	}
	if req.PaymentType != "receive" && req.PaymentType != "make" {
		return utils.BadRequestResponse(c, "Payment type must be 'receive' or 'make'")
	}
	if req.ContactType != "customer" && req.ContactType != "supplier" {
		return utils.BadRequestResponse(c, "Contact type must be 'customer' or 'supplier'")
	}

	bankUUID, err := uuid.Parse(req.BankAccountID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid bank account ID")
	}

	var bankAccount accModels.Account
	if err := h.db.Where("id = ? AND company_id = ?", bankUUID, companyID).First(&bankAccount).Error; err != nil {
		return utils.NotFoundResponse(c, "Bank account not found")
	}

	payDate, err := time.Parse("2006-01-02", req.PaymentDate)
	if err != nil {
		payDate = time.Now()
	}

	method := req.Method
	if method == "" {
		method = "bank_transfer"
	}

	payment := accModels.AccountingPayment{
		CompanyID:     companyID,
		BankAccountID: bankUUID,
		ContactType:   req.ContactType,
		PaymentType:   accModels.PaymentType(req.PaymentType),
		Amount:        req.Amount,
		CurrencyCode:  "USD",
		PaymentDate:   payDate,
		Reference:     req.Reference,
		Method:        method,
		Notes:         req.Notes,
		Status:        "completed",
	}

	if req.ContactID != "" {
		contactUUID, err := uuid.Parse(req.ContactID)
		if err == nil {
			payment.ContactID = &contactUUID
		}
	}

	tx := h.db.Begin()

	// Create journal entry
	// Receive: Debit Bank, Credit AR (1200)
	// Make: Debit AP (2100), Credit Bank
	var debitAccountID, creditAccountID uuid.UUID
	var desc string

	if req.PaymentType == "receive" {
		debitAccountID = bankUUID
		var arAccount accModels.Account
		tx.Where("company_id = ? AND code = ?", companyID, "1200").First(&arAccount)
		if arAccount.ID == uuid.Nil {
			tx.Rollback()
			return utils.BadRequestResponse(c, "Accounts Receivable account (1200) not found")
		}
		creditAccountID = arAccount.ID
		desc = fmt.Sprintf("Payment received - %s", req.Reference)
	} else {
		var apAccount accModels.Account
		tx.Where("company_id = ? AND code = ?", companyID, "2100").First(&apAccount)
		if apAccount.ID == uuid.Nil {
			tx.Rollback()
			return utils.BadRequestResponse(c, "Accounts Payable account (2100) not found")
		}
		debitAccountID = apAccount.ID
		creditAccountID = bankUUID
		desc = fmt.Sprintf("Payment made - %s", req.Reference)
	}

	if req.Notes != "" {
		desc = req.Notes
	}

	// Find financial year and period
	var fy accModels.FinancialYear
	tx.Where("company_id = ? AND is_active = ?", companyID, true).First(&fy)
	if fy.ID == uuid.Nil {
		tx.Rollback()
		return utils.BadRequestResponse(c, "No active financial year")
	}

	var period accModels.FiscalPeriod
	tx.Where("financial_year_id = ? AND start_date <= ? AND end_date >= ?", fy.ID, payDate, payDate).First(&period)

	postedAt := time.Now()
	journal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: fy.ID,
		Number:          fmt.Sprintf("JRN-PAY-%d", time.Now().UnixNano()%1000000),
		Date:            payDate,
		Reference:       req.Reference,
		Description:     desc,
		Status:          accModels.JournalStatusPosted,
		TotalDebit:      req.Amount,
		TotalCredit:     req.Amount,
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
		AccountID:    debitAccountID,
		Description:  desc,
		DebitAmount:  req.Amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseDebit:    req.Amount,
		LineNumber:   1,
	})
	tx.Create(&accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    creditAccountID,
		Description:  desc,
		CreditAmount: req.Amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseCredit:   req.Amount,
		LineNumber:   2,
	})

	// Update balances respecting normal balance direction
	// Debit-normal accounts (assets/expenses): debit increases, credit decreases
	// Credit-normal accounts (liabilities/equity/revenue): credit increases, debit decreases
	var debitAccount, creditAccount accModels.Account
	tx.Where("id = ?", debitAccountID).First(&debitAccount)
	tx.Where("id = ?", creditAccountID).First(&creditAccount)

	if debitAccount.NormalBalance == "debit" {
		tx.Model(&accModels.Account{}).Where("id = ?", debitAccountID).Update("current_balance", gorm.Expr("current_balance + ?", req.Amount))
	} else {
		tx.Model(&accModels.Account{}).Where("id = ?", debitAccountID).Update("current_balance", gorm.Expr("current_balance - ?", req.Amount))
	}
	if creditAccount.NormalBalance == "credit" {
		tx.Model(&accModels.Account{}).Where("id = ?", creditAccountID).Update("current_balance", gorm.Expr("current_balance + ?", req.Amount))
	} else {
		tx.Model(&accModels.Account{}).Where("id = ?", creditAccountID).Update("current_balance", gorm.Expr("current_balance - ?", req.Amount))
	}

	payment.JournalID = &journal.ID
	tx.Create(&payment)

	tx.Commit()

	return utils.CreatedResponse(c, payment)
}

func (h *AccountingPaymentHandler) RegisterRoutes(api fiber.Router) {
	p := api.Group("/accounting/payments")
	p.Get("/", h.List)
	p.Get("/summary", h.GetSummary)
	p.Post("/", h.Create)
}
