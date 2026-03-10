package handlers

import (
	"bytes"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ReportHandler struct {
	db *gorm.DB
}

func NewReportHandler(db *gorm.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

type TrialBalanceRow struct {
	AccountID     uuid.UUID `json:"account_id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	AccountType   string    `json:"account_type"`
	DebitBalance  float64   `json:"debit_balance"`
	CreditBalance float64   `json:"credit_balance"`
}

type BalanceSheetSection struct {
	Title    string            `json:"title"`
	Accounts []BalanceSheetRow `json:"accounts"`
	Total    float64           `json:"total"`
}

type BalanceSheetRow struct {
	Code    string  `json:"code"`
	Name    string  `json:"name"`
	Balance float64 `json:"balance"`
}

type ProfitLossSection struct {
	Title    string          `json:"title"`
	Accounts []ProfitLossRow `json:"accounts"`
	Total    float64         `json:"total"`
}

type ProfitLossRow struct {
	Code    string  `json:"code"`
	Name    string  `json:"name"`
	Balance float64 `json:"balance"`
}

func (h *ReportHandler) TrialBalance(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	fyID := c.Query("financial_year_id")

	var accounts []accModels.Account
	query := h.db.Where("company_id = ? AND is_active = ?", companyID, true).Order("code ASC")

	if fyID != "" {
		// Get accounts with journal entry totals for the given financial year
		query.Find(&accounts)
	} else {
		query.Find(&accounts)
	}

	var rows []TrialBalanceRow
	var totalDebit, totalCredit float64

	for _, acc := range accounts {
		var debitSum, creditSum float64

		entryQuery := h.db.Model(&accModels.JournalEntry{}).
			Joins("JOIN journals ON journals.id = journal_entries.journal_id").
			Where("journal_entries.account_id = ? AND journals.company_id = ? AND journals.status = ?",
				acc.ID, companyID, accModels.JournalStatusPosted)

		if fyID != "" {
			entryQuery = entryQuery.Where("journals.financial_year_id = ?", fyID)
		}

		entryQuery.Select("COALESCE(SUM(journal_entries.base_debit), 0)").Scan(&debitSum)

		entryQuery2 := h.db.Model(&accModels.JournalEntry{}).
			Joins("JOIN journals ON journals.id = journal_entries.journal_id").
			Where("journal_entries.account_id = ? AND journals.company_id = ? AND journals.status = ?",
				acc.ID, companyID, accModels.JournalStatusPosted)

		if fyID != "" {
			entryQuery2 = entryQuery2.Where("journals.financial_year_id = ?", fyID)
		}

		entryQuery2.Select("COALESCE(SUM(journal_entries.base_credit), 0)").Scan(&creditSum)

		debitSum += acc.OpeningBalance
		if debitSum == 0 && creditSum == 0 {
			continue
		}

		row := TrialBalanceRow{
			AccountID:   acc.ID,
			Code:        acc.Code,
			Name:        acc.Name,
			AccountType: string(acc.AccountType),
		}

		net := debitSum - creditSum
		if net > 0 {
			row.DebitBalance = net
		} else {
			row.CreditBalance = -net
		}

		totalDebit += row.DebitBalance
		totalCredit += row.CreditBalance
		rows = append(rows, row)
	}

	format := c.Query("format")
	if format == "excel" {
		return h.exportTrialBalanceExcel(c, rows, totalDebit, totalCredit)
	}
	if format == "pdf" {
		return h.exportTrialBalancePDF(c, rows, totalDebit, totalCredit)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"rows":         rows,
		"total_debit":  totalDebit,
		"total_credit": totalCredit,
	})
}

func (h *ReportHandler) BalanceSheet(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var accounts []accModels.Account
	h.db.Where("company_id = ? AND is_active = ?", companyID, true).Order("code ASC").Find(&accounts)

	assets := BalanceSheetSection{Title: "Assets"}
	liabilities := BalanceSheetSection{Title: "Liabilities"}
	equity := BalanceSheetSection{Title: "Equity"}

	for _, acc := range accounts {
		if acc.CurrentBalance == 0 && acc.OpeningBalance == 0 {
			continue
		}
		balance := acc.CurrentBalance + acc.OpeningBalance
		row := BalanceSheetRow{Code: acc.Code, Name: acc.Name, Balance: balance}

		switch acc.AccountType {
		case accModels.AccountTypeAsset:
			assets.Accounts = append(assets.Accounts, row)
			assets.Total += balance
		case accModels.AccountTypeLiability:
			liabilities.Accounts = append(liabilities.Accounts, row)
			liabilities.Total += balance
		case accModels.AccountTypeEquity:
			equity.Accounts = append(equity.Accounts, row)
			equity.Total += balance
		}
	}

	return utils.SuccessResponse(c, fiber.Map{
		"assets":      assets,
		"liabilities": liabilities,
		"equity":      equity,
	})
}

func (h *ReportHandler) ProfitAndLoss(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var accounts []accModels.Account
	h.db.Where("company_id = ? AND is_active = ? AND account_type IN ?",
		companyID, true, []string{"revenue", "expense"}).
		Order("code ASC").Find(&accounts)

	revenue := ProfitLossSection{Title: "Revenue"}
	expenses := ProfitLossSection{Title: "Expenses"}

	for _, acc := range accounts {
		if acc.CurrentBalance == 0 {
			continue
		}
		row := ProfitLossRow{Code: acc.Code, Name: acc.Name, Balance: acc.CurrentBalance}

		switch acc.AccountType {
		case accModels.AccountTypeRevenue:
			revenue.Accounts = append(revenue.Accounts, row)
			revenue.Total += acc.CurrentBalance
		case accModels.AccountTypeExpense:
			expenses.Accounts = append(expenses.Accounts, row)
			expenses.Total += acc.CurrentBalance
		}
	}

	netProfit := revenue.Total - expenses.Total

	return utils.SuccessResponse(c, fiber.Map{
		"revenue":    revenue,
		"expenses":   expenses,
		"net_profit": netProfit,
	})
}

type GeneralLedgerEntry struct {
	Date           string  `json:"date"`
	JournalNumber  string  `json:"journal_number"`
	Description    string  `json:"description"`
	DebitAmount    float64 `json:"debit_amount"`
	CreditAmount   float64 `json:"credit_amount"`
	RunningBalance float64 `json:"running_balance"`
}

func (h *ReportHandler) GeneralLedger(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	accountID := c.Query("account_id")
	fyID := c.Query("financial_year_id")

	if accountID == "" {
		return utils.BadRequestResponse(c, "account_id is required")
	}

	// Fetch all matching entries ordered by date ascending (no pagination — ledger needs running balance)
	var rawEntries []struct {
		Date         string  `gorm:"column:date"`
		Number       string  `gorm:"column:number"`
		Description  string  `gorm:"column:description"`
		DebitAmount  float64 `gorm:"column:debit_amount"`
		CreditAmount float64 `gorm:"column:credit_amount"`
	}

	query := h.db.Table("journal_entries je").
		Select("j.date, j.number, je.description, je.debit_amount, je.credit_amount").
		Joins("JOIN journals j ON j.id = je.journal_id").
		Where("je.account_id = ? AND j.company_id = ? AND j.status = ? AND j.deleted_at IS NULL AND je.deleted_at IS NULL",
			accountID, companyID, accModels.JournalStatusPosted)

	if fyID != "" {
		query = query.Where("j.financial_year_id = ?", fyID)
	}

	query.Order("j.date ASC, je.line_number ASC").Scan(&rawEntries)

	// Get account opening balance
	var account accModels.Account
	h.db.Where("id = ?", accountID).First(&account)

	// Build entries with running balance
	entries := make([]GeneralLedgerEntry, 0, len(rawEntries))
	balance := account.OpeningBalance
	for _, e := range rawEntries {
		balance += e.DebitAmount - e.CreditAmount
		entries = append(entries, GeneralLedgerEntry{
			Date:           e.Date,
			JournalNumber:  e.Number,
			Description:    e.Description,
			DebitAmount:    e.DebitAmount,
			CreditAmount:   e.CreditAmount,
			RunningBalance: balance,
		})
	}

	return utils.SuccessResponse(c, fiber.Map{
		"entries":         entries,
		"opening_balance": account.OpeningBalance,
		"closing_balance": balance,
		"total_entries":   len(entries),
	})
}

func (h *ReportHandler) exportTrialBalanceExcel(c *fiber.Ctx, rows []TrialBalanceRow, totalDebit, totalCredit float64) error {
	columns := []export.ExcelColumn{
		{Header: "Code", Field: "Code", Width: 15},
		{Header: "Account Name", Field: "Name", Width: 35},
		{Header: "Type", Field: "AccountType", Width: 15},
		{Header: "Debit", Field: "DebitBalance", Width: 18},
		{Header: "Credit", Field: "CreditBalance", Width: 18},
	}

	f, err := export.GenerateExcel("Trial Balance", columns, rows)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate Excel")
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return utils.InternalErrorResponse(c, "Failed to write Excel")
	}

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=trial-balance.xlsx")
	return c.Send(buf.Bytes())
}

func (h *ReportHandler) exportTrialBalancePDF(c *fiber.Ctx, rows []TrialBalanceRow, totalDebit, totalCredit float64) error {
	columns := []export.PDFColumn{
		{Header: "Code", Field: "Code", Width: 30},
		{Header: "Account Name", Field: "Name", Width: 80},
		{Header: "Type", Field: "AccountType", Width: 30},
		{Header: "Debit", Field: "DebitBalance", Width: 40},
		{Header: "Credit", Field: "CreditBalance", Width: 40},
	}

	pdf, err := export.GeneratePDF(export.PDFOptions{Title: "Trial Balance"}, columns, rows)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate PDF")
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return utils.InternalErrorResponse(c, "Failed to write PDF")
	}

	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", "attachment; filename=trial-balance.pdf")
	return c.Send(buf.Bytes())
}

func (h *ReportHandler) RegisterRoutes(api fiber.Router) {
	reports := api.Group("/accounting/reports")
	reports.Get("/trial-balance", h.TrialBalance)
	reports.Get("/balance-sheet", h.BalanceSheet)
	reports.Get("/profit-loss", h.ProfitAndLoss)
	reports.Get("/general-ledger", h.GeneralLedger)
}
