package handlers

import (
	"fmt"
	"math"
	"time"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JournalHandler struct {
	db      *gorm.DB
	autoNum *autonumber.Service
}

func NewJournalHandler(db *gorm.DB, autoNum *autonumber.Service) *JournalHandler {
	return &JournalHandler{db: db, autoNum: autoNum}
}

type CreateJournalRequest struct {
	FinancialYearID string                `json:"financial_year_id"`
	Date            string                `json:"date"`
	Reference       string                `json:"reference"`
	Description     string                `json:"description"`
	CurrencyCode    string                `json:"currency_code"`
	ExchangeRate    float64               `json:"exchange_rate"`
	Entries         []JournalEntryRequest `json:"entries"`
}

type JournalEntryRequest struct {
	AccountID    string  `json:"account_id"`
	Description  string  `json:"description"`
	DebitAmount  float64 `json:"debit_amount"`
	CreditAmount float64 `json:"credit_amount"`
}

func (h *JournalHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var journals []accModels.Journal
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("number ILIKE ? OR reference ILIKE ? OR description ILIKE ?", search, search, search)
	}

	fyID := c.Query("financial_year_id")
	if fyID != "" {
		query = query.Where("financial_year_id = ?", fyID)
	}

	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	dateFrom := c.Query("date_from")
	if dateFrom != "" {
		query = query.Where("date >= ?", dateFrom)
	}
	dateTo := c.Query("date_to")
	if dateTo != "" {
		query = query.Where("date <= ?", dateTo)
	}

	query.Model(&accModels.Journal{}).Count(&total)

	err := query.
		Preload("Entries.Account").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&journals).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch journals")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(journals, total, params))
}

func (h *JournalHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var journal accModels.Journal
	err := h.db.
		Preload("Entries.Account").
		Where("id = ? AND company_id = ?", id, companyID).
		First(&journal).Error

	if err != nil {
		return utils.NotFoundResponse(c, "Journal not found")
	}

	return utils.SuccessResponse(c, journal)
}

func (h *JournalHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)

	var req CreateJournalRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.FinancialYearID == "" || req.Date == "" || len(req.Entries) < 2 {
		return utils.BadRequestResponse(c, "Financial year, date, and at least 2 entries are required")
	}

	fyUUID, err := uuid.Parse(req.FinancialYearID)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid financial year ID")
	}

	var fy accModels.FinancialYear
	if err := h.db.Where("id = ? AND company_id = ?", fyUUID, companyID).First(&fy).Error; err != nil {
		return utils.NotFoundResponse(c, "Financial year not found")
	}
	if fy.IsClosed {
		return utils.BadRequestResponse(c, "Financial year is closed")
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return utils.BadRequestResponse(c, "Invalid date format (use YYYY-MM-DD)")
	}

	if date.Before(fy.StartDate) || date.After(fy.EndDate) {
		return utils.BadRequestResponse(c, "Date is outside the financial year range")
	}

	var totalDebit, totalCredit float64
	for _, entry := range req.Entries {
		totalDebit += entry.DebitAmount
		totalCredit += entry.CreditAmount
	}

	if math.Abs(totalDebit-totalCredit) > 0.001 {
		return utils.BadRequestResponse(c, fmt.Sprintf("Journal is not balanced. Debit: %.4f, Credit: %.4f", totalDebit, totalCredit))
	}

	number, err := h.autoNum.GenerateNumber(companyID, nil, "journal")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate journal number")
	}

	currencyCode := req.CurrencyCode
	if currencyCode == "" {
		currencyCode = "USD"
	}
	exchangeRate := req.ExchangeRate
	if exchangeRate == 0 {
		exchangeRate = 1
	}

	tx := h.db.Begin()

	journal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: fyUUID,
		Number:          number,
		Date:            date,
		Reference:       req.Reference,
		Description:     req.Description,
		Status:          accModels.JournalStatusDraft,
		TotalDebit:      totalDebit,
		TotalCredit:     totalCredit,
		CurrencyCode:    currencyCode,
		ExchangeRate:    exchangeRate,
		CreatedByID:     &userID,
	}

	// Find fiscal period
	var period accModels.FiscalPeriod
	if err := h.db.Where("financial_year_id = ? AND start_date <= ? AND end_date >= ?", fyUUID, date, date).First(&period).Error; err == nil {
		journal.FiscalPeriodID = &period.ID
	}

	if err := tx.Create(&journal).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create journal")
	}

	for i, entry := range req.Entries {
		accUUID, err := uuid.Parse(entry.AccountID)
		if err != nil {
			tx.Rollback()
			return utils.BadRequestResponse(c, fmt.Sprintf("Invalid account ID on line %d", i+1))
		}

		je := accModels.JournalEntry{
			JournalID:    journal.ID,
			AccountID:    accUUID,
			Description:  entry.Description,
			DebitAmount:  entry.DebitAmount,
			CreditAmount: entry.CreditAmount,
			CurrencyCode: currencyCode,
			ExchangeRate: exchangeRate,
			BaseDebit:    entry.DebitAmount * exchangeRate,
			BaseCredit:   entry.CreditAmount * exchangeRate,
			LineNumber:   i + 1,
		}

		if err := tx.Create(&je).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Failed to create journal entry")
		}
	}

	tx.Commit()

	h.db.Preload("Entries.Account").First(&journal, "id = ?", journal.ID)
	return utils.CreatedResponse(c, journal)
}

func (h *JournalHandler) Post(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)
	id := c.Params("id")

	var journal accModels.Journal
	if err := h.db.Preload("Entries").Where("id = ? AND company_id = ?", id, companyID).First(&journal).Error; err != nil {
		return utils.NotFoundResponse(c, "Journal not found")
	}

	if journal.Status != accModels.JournalStatusDraft {
		return utils.BadRequestResponse(c, "Only draft journals can be posted")
	}

	tx := h.db.Begin()

	now := time.Now()
	journal.Status = accModels.JournalStatusPosted
	journal.PostedByID = &userID
	journal.PostedAt = &now

	if err := tx.Save(&journal).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to post journal")
	}

	// Update account balances
	for _, entry := range journal.Entries {
		var account accModels.Account
		if err := tx.Where("id = ?", entry.AccountID).First(&account).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Account not found for entry")
		}

		if account.NormalBalance == "debit" {
			account.CurrentBalance += entry.BaseDebit - entry.BaseCredit
		} else {
			account.CurrentBalance += entry.BaseCredit - entry.BaseDebit
		}

		if err := tx.Save(&account).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Failed to update account balance")
		}
	}

	tx.Commit()

	h.db.Preload("Entries.Account").First(&journal, "id = ?", journal.ID)
	return utils.SuccessResponse(c, journal, "Journal posted successfully")
}

func (h *JournalHandler) Reverse(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	userID := c.Locals("user_id").(uuid.UUID)
	id := c.Params("id")

	var original accModels.Journal
	if err := h.db.Preload("Entries").Where("id = ? AND company_id = ?", id, companyID).First(&original).Error; err != nil {
		return utils.NotFoundResponse(c, "Journal not found")
	}

	if original.Status != accModels.JournalStatusPosted {
		return utils.BadRequestResponse(c, "Only posted journals can be reversed")
	}

	number, err := h.autoNum.GenerateNumber(companyID, nil, "journal")
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate journal number")
	}

	tx := h.db.Begin()

	reversal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: original.FinancialYearID,
		FiscalPeriodID:  original.FiscalPeriodID,
		Number:          number,
		Date:            time.Now(),
		Reference:       "REV-" + original.Number,
		Description:     "Reversal of " + original.Number,
		Status:          accModels.JournalStatusPosted,
		TotalDebit:      original.TotalCredit,
		TotalCredit:     original.TotalDebit,
		CurrencyCode:    original.CurrencyCode,
		ExchangeRate:    original.ExchangeRate,
		ReversalOfID:    &original.ID,
		CreatedByID:     &userID,
		PostedByID:      &userID,
	}
	now := time.Now()
	reversal.PostedAt = &now

	if err := tx.Create(&reversal).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create reversal journal")
	}

	for i, entry := range original.Entries {
		je := accModels.JournalEntry{
			JournalID:    reversal.ID,
			AccountID:    entry.AccountID,
			Description:  "Reversal: " + entry.Description,
			DebitAmount:  entry.CreditAmount,
			CreditAmount: entry.DebitAmount,
			CurrencyCode: entry.CurrencyCode,
			ExchangeRate: entry.ExchangeRate,
			BaseDebit:    entry.BaseCredit,
			BaseCredit:   entry.BaseDebit,
			LineNumber:   i + 1,
		}

		if err := tx.Create(&je).Error; err != nil {
			tx.Rollback()
			return utils.InternalErrorResponse(c, "Failed to create reversal entry")
		}

		// Reverse account balance
		var account accModels.Account
		if err := tx.Where("id = ?", entry.AccountID).First(&account).Error; err == nil {
			if account.NormalBalance == "debit" {
				account.CurrentBalance += entry.BaseCredit - entry.BaseDebit
			} else {
				account.CurrentBalance += entry.BaseDebit - entry.BaseCredit
			}
			tx.Save(&account)
		}
	}

	original.Status = accModels.JournalStatusReversed
	original.ReversedByID = &reversal.ID
	tx.Save(&original)

	tx.Commit()

	h.db.Preload("Entries.Account").First(&reversal, "id = ?", reversal.ID)
	return utils.SuccessResponse(c, reversal, "Journal reversed successfully")
}

func (h *JournalHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var journal accModels.Journal
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&journal).Error; err != nil {
		return utils.NotFoundResponse(c, "Journal not found")
	}

	if journal.Status != accModels.JournalStatusDraft {
		return utils.BadRequestResponse(c, "Only draft journals can be deleted")
	}

	h.db.Where("journal_id = ?", id).Delete(&accModels.JournalEntry{})
	if err := h.db.Delete(&journal).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete journal")
	}

	return utils.SuccessResponse(c, nil, "Journal deleted successfully")
}

func (h *JournalHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var journals []accModels.Journal
	query := h.db.Where("company_id = ?", companyID)
	if s := c.Query("search"); s != "" {
		query = query.Where("number ILIKE ? OR description ILIKE ?", "%"+s+"%", "%"+s+"%")
	}
	query.Order("date desc").Find(&journals)
	cols := []export.Column{
		{Header: "Number", Field: "Number", Width: 15},
		{Header: "Date", Field: "Date", Width: 15},
		{Header: "Description", Field: "Description", Width: 35},
		{Header: "Debit", Field: "TotalDebit", Width: 12},
		{Header: "Credit", Field: "TotalCredit", Width: 12},
		{Header: "Status", Field: "Status", Width: 12},
	}
	return export.HandleExport(c, "Journals", cols, journals)
}

func (h *JournalHandler) RegisterRoutes(api fiber.Router) {
	journals := api.Group("/accounting/journals")
	journals.Get("/", h.List)
	journals.Get("/export", h.Export)
	journals.Get("/:id", h.Get)
	journals.Post("/", h.Create)
	journals.Post("/:id/post", h.Post)
	journals.Post("/:id/reverse", h.Reverse)
	journals.Delete("/:id", h.Delete)
}
