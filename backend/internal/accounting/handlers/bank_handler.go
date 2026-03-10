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

type BankHandler struct {
	db *gorm.DB
}

func NewBankHandler(db *gorm.DB) *BankHandler {
	return &BankHandler{db: db}
}

type BankAccountResponse struct {
	ID             uuid.UUID `json:"id"`
	Code           string    `json:"code"`
	Name           string    `json:"name"`
	CurrentBalance float64   `json:"current_balance"`
	CurrencyCode   string    `json:"currency_code"`
	IsActive       bool      `json:"is_active"`
}

type TransactionRow struct {
	ID          uuid.UUID `json:"id"`
	Date        time.Time `json:"date"`
	Number      string    `json:"number"`
	Reference   string    `json:"reference"`
	Description string    `json:"description"`
	Debit       float64   `json:"debit"`
	Credit      float64   `json:"credit"`
	Balance     float64   `json:"balance"`
}

func (h *BankHandler) ListBankAccounts(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var accounts []accModels.Account
	// Get all accounts under "Cash and Bank" (code starts with 11) that are leaf accounts
	h.db.Where("company_id = ? AND code LIKE ? AND is_active = ?", companyID, "11%", true).
		Order("code ASC").
		Find(&accounts)

	// Filter to leaf-level accounts only (skip parent "1100" if it has children)
	parentCodes := map[string]bool{}
	for _, a := range accounts {
		if a.ParentID != nil {
			// find parent code
			for _, p := range accounts {
				if p.ID == *a.ParentID {
					parentCodes[p.Code] = true
				}
			}
		}
	}

	result := []BankAccountResponse{}
	for _, a := range accounts {
		if parentCodes[a.Code] {
			continue // skip parent accounts
		}
		result = append(result, BankAccountResponse{
			ID:             a.ID,
			Code:           a.Code,
			Name:           a.Name,
			CurrentBalance: a.CurrentBalance,
			CurrencyCode:   a.CurrencyCode,
			IsActive:       a.IsActive,
		})
	}

	return utils.SuccessResponse(c, result)
}

func (h *BankHandler) GetTransactions(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	accountID := c.Params("id")
	params := utils.GetPaginationParams(c)

	// Verify account belongs to company
	var account accModels.Account
	if err := h.db.Where("id = ? AND company_id = ?", accountID, companyID).First(&account).Error; err != nil {
		return utils.NotFoundResponse(c, "Account not found")
	}

	// Get journal entries for this account
	var entries []struct {
		ID           uuid.UUID `gorm:"column:id"`
		JournalDate  time.Time `gorm:"column:date"`
		Number       string    `gorm:"column:number"`
		Reference    string    `gorm:"column:reference"`
		Description  string    `gorm:"column:description"`
		DebitAmount  float64   `gorm:"column:debit_amount"`
		CreditAmount float64   `gorm:"column:credit_amount"`
	}

	var total int64
	baseQuery := h.db.Table("journal_entries je").
		Joins("JOIN journals j ON j.id = je.journal_id").
		Where("je.account_id = ? AND j.company_id = ? AND j.status = ? AND j.deleted_at IS NULL AND je.deleted_at IS NULL",
			accountID, companyID, "posted")

	if params.Search != "" {
		search := "%" + params.Search + "%"
		baseQuery = baseQuery.Where("j.description ILIKE ? OR j.reference ILIKE ? OR j.number ILIKE ?", search, search, search)
	}

	baseQuery.Count(&total)

	h.db.Table("journal_entries je").
		Select("je.id, j.date, j.number, j.reference, je.description, je.debit_amount, je.credit_amount").
		Joins("JOIN journals j ON j.id = je.journal_id").
		Where("je.account_id = ? AND j.company_id = ? AND j.status = ? AND j.deleted_at IS NULL AND je.deleted_at IS NULL",
			accountID, companyID, "posted").
		Order("j.date DESC, j.created_at DESC").
		Scopes(utils.Paginate(params)).
		Scan(&entries)

	// Calculate running balance (from newest to oldest on current page)
	rows := make([]TransactionRow, len(entries))
	for i, e := range entries {
		rows[i] = TransactionRow{
			ID:          e.ID,
			Date:        e.JournalDate,
			Number:      e.Number,
			Reference:   e.Reference,
			Description: e.Description,
			Debit:       e.DebitAmount,
			Credit:      e.CreditAmount,
		}
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(rows, total, params))
}

type TransferRequest struct {
	FromAccountID string  `json:"from_account_id"`
	ToAccountID   string  `json:"to_account_id"`
	Amount        float64 `json:"amount"`
	Date          string  `json:"date"`
	Reference     string  `json:"reference"`
	Notes         string  `json:"notes"`
}

func (h *BankHandler) Transfer(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req TransferRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Amount <= 0 {
		return utils.BadRequestResponse(c, "Amount must be greater than 0")
	}

	fromUUID, err := uuid.Parse(req.FromAccountID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid from account ID")
	}
	toUUID, err := uuid.Parse(req.ToAccountID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid to account ID")
	}

	var fromAccount, toAccount accModels.Account
	if err := h.db.Where("id = ? AND company_id = ?", fromUUID, companyID).First(&fromAccount).Error; err != nil {
		return utils.NotFoundResponse(c, "Source account not found")
	}
	if err := h.db.Where("id = ? AND company_id = ?", toUUID, companyID).First(&toAccount).Error; err != nil {
		return utils.NotFoundResponse(c, "Destination account not found")
	}

	txDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		txDate = time.Now()
	}

	tx := h.db.Begin()

	var fy accModels.FinancialYear
	tx.Where("company_id = ? AND is_active = ?", companyID, true).First(&fy)
	if fy.ID == uuid.Nil {
		tx.Rollback()
		return utils.BadRequestResponse(c, "No active financial year")
	}

	var period accModels.FiscalPeriod
	tx.Where("financial_year_id = ? AND start_date <= ? AND end_date >= ?", fy.ID, txDate, txDate).First(&period)

	ref := req.Reference
	if ref == "" {
		ref = fmt.Sprintf("TRF-%d", time.Now().Unix())
	}

	postedAt := time.Now()
	desc := fmt.Sprintf("Transfer from %s to %s", fromAccount.Name, toAccount.Name)
	if req.Notes != "" {
		desc = req.Notes
	}

	journal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: fy.ID,
		Number:          fmt.Sprintf("JRN-TRF-%d", time.Now().UnixNano()%1000000),
		Date:            txDate,
		Reference:       ref,
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
		AccountID:    toUUID,
		Description:  desc,
		DebitAmount:  req.Amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseDebit:    req.Amount,
		LineNumber:   1,
	})
	tx.Create(&accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    fromUUID,
		Description:  desc,
		CreditAmount: req.Amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseCredit:   req.Amount,
		LineNumber:   2,
	})

	// Update balances
	tx.Model(&fromAccount).Update("current_balance", gorm.Expr("current_balance - ?", req.Amount))
	tx.Model(&toAccount).Update("current_balance", gorm.Expr("current_balance + ?", req.Amount))

	tx.Commit()
	return utils.SuccessResponse(c, journal, "Transfer completed")
}

type DepositWithdrawRequest struct {
	AccountID      string  `json:"account_id"`
	CounterAccount string  `json:"counter_account_id"`
	Amount         float64 `json:"amount"`
	Date           string  `json:"date"`
	Reference      string  `json:"reference"`
	Notes          string  `json:"notes"`
}

func (h *BankHandler) Deposit(c *fiber.Ctx) error {
	return h.recordTransaction(c, "deposit")
}

func (h *BankHandler) Withdrawal(c *fiber.Ctx) error {
	return h.recordTransaction(c, "withdrawal")
}

func (h *BankHandler) recordTransaction(c *fiber.Ctx, txType string) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req DepositWithdrawRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Amount <= 0 {
		return utils.BadRequestResponse(c, "Amount must be greater than 0")
	}

	bankUUID, err := uuid.Parse(req.AccountID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid bank account ID")
	}
	counterUUID, err := uuid.Parse(req.CounterAccount)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid counter account ID")
	}

	var bankAccount, counterAccount accModels.Account
	if err := h.db.Where("id = ? AND company_id = ?", bankUUID, companyID).First(&bankAccount).Error; err != nil {
		return utils.NotFoundResponse(c, "Bank account not found")
	}
	if err := h.db.Where("id = ? AND company_id = ?", counterUUID, companyID).First(&counterAccount).Error; err != nil {
		return utils.NotFoundResponse(c, "Counter account not found")
	}

	txDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		txDate = time.Now()
	}

	tx := h.db.Begin()

	var fy accModels.FinancialYear
	tx.Where("company_id = ? AND is_active = ?", companyID, true).First(&fy)
	if fy.ID == uuid.Nil {
		tx.Rollback()
		return utils.BadRequestResponse(c, "No active financial year")
	}

	var period accModels.FiscalPeriod
	tx.Where("financial_year_id = ? AND start_date <= ? AND end_date >= ?", fy.ID, txDate, txDate).First(&period)

	ref := req.Reference
	if ref == "" {
		ref = fmt.Sprintf("%s-%d", txType[:3], time.Now().Unix())
	}

	desc := req.Notes
	if desc == "" {
		if txType == "deposit" {
			desc = fmt.Sprintf("Deposit to %s", bankAccount.Name)
		} else {
			desc = fmt.Sprintf("Withdrawal from %s", bankAccount.Name)
		}
	}

	postedAt := time.Now()
	journal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: fy.ID,
		Number:          fmt.Sprintf("JRN-%s-%d", txType[:3], time.Now().UnixNano()%1000000),
		Date:            txDate,
		Reference:       ref,
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

	var debitID, creditID uuid.UUID
	if txType == "deposit" {
		debitID = bankUUID
		creditID = counterUUID
	} else {
		debitID = counterUUID
		creditID = bankUUID
	}

	tx.Create(&accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    debitID,
		Description:  desc,
		DebitAmount:  req.Amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseDebit:    req.Amount,
		LineNumber:   1,
	})
	tx.Create(&accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    creditID,
		Description:  desc,
		CreditAmount: req.Amount,
		CurrencyCode: "USD",
		ExchangeRate: 1,
		BaseCredit:   req.Amount,
		LineNumber:   2,
	})

	// Update balances based on normal balance direction
	if txType == "deposit" {
		tx.Model(&bankAccount).Update("current_balance", gorm.Expr("current_balance + ?", req.Amount))
		// Counter account: if it's a debit-normal (asset), decrease; if credit-normal (revenue/liability), decrease
		if counterAccount.NormalBalance == "debit" {
			tx.Model(&counterAccount).Update("current_balance", gorm.Expr("current_balance - ?", req.Amount))
		} else {
			tx.Model(&counterAccount).Update("current_balance", gorm.Expr("current_balance + ?", req.Amount))
		}
	} else {
		tx.Model(&bankAccount).Update("current_balance", gorm.Expr("current_balance - ?", req.Amount))
		if counterAccount.NormalBalance == "debit" {
			tx.Model(&counterAccount).Update("current_balance", gorm.Expr("current_balance + ?", req.Amount))
		} else {
			tx.Model(&counterAccount).Update("current_balance", gorm.Expr("current_balance - ?", req.Amount))
		}
	}

	tx.Commit()
	return utils.SuccessResponse(c, journal, fmt.Sprintf("%s recorded", txType))
}

func (h *BankHandler) RegisterRoutes(api fiber.Router) {
	bank := api.Group("/accounting/bank-accounts")
	bank.Get("/", h.ListBankAccounts)
	bank.Get("/:id/transactions", h.GetTransactions)
	bank.Post("/transfer", h.Transfer)
	bank.Post("/deposit", h.Deposit)
	bank.Post("/withdrawal", h.Withdrawal)
}
