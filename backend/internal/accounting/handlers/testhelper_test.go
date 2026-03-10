package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type testContext struct {
	db        *gorm.DB
	app       *fiber.App
	companyID uuid.UUID
	fy        accModels.FinancialYear
}

func setupTestDB(t *testing.T) *testContext {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Silent),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	// Create tables with SQLite-compatible SQL (avoids PostgreSQL-specific type tags like decimal(18,4))
	sqlDB, _ := db.DB()
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS accounts (
			id TEXT PRIMARY KEY, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME,
			company_id TEXT NOT NULL, parent_id TEXT, code TEXT NOT NULL, name TEXT NOT NULL,
			account_type TEXT NOT NULL, description TEXT, currency_code TEXT DEFAULT 'USD',
			is_active INTEGER DEFAULT 1, is_system INTEGER DEFAULT 0, is_control_account INTEGER DEFAULT 0,
			control_type TEXT, level INTEGER DEFAULT 0, full_path TEXT,
			normal_balance TEXT DEFAULT 'debit', opening_balance REAL DEFAULT 0, current_balance REAL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS financial_years (
			id TEXT PRIMARY KEY, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME,
			company_id TEXT NOT NULL, name TEXT NOT NULL, code TEXT NOT NULL,
			start_date DATETIME NOT NULL, end_date DATETIME NOT NULL,
			is_closed INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS fiscal_periods (
			id TEXT PRIMARY KEY, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME,
			financial_year_id TEXT NOT NULL, name TEXT NOT NULL, number INTEGER NOT NULL,
			start_date DATETIME NOT NULL, end_date DATETIME NOT NULL, is_closed INTEGER DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS journals (
			id TEXT PRIMARY KEY, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME,
			company_id TEXT NOT NULL, branch_id TEXT, financial_year_id TEXT NOT NULL,
			fiscal_period_id TEXT, number TEXT NOT NULL, date DATETIME NOT NULL,
			reference TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'draft',
			total_debit REAL DEFAULT 0, total_credit REAL DEFAULT 0,
			currency_code TEXT DEFAULT 'USD', exchange_rate REAL DEFAULT 1,
			reversed_by_id TEXT, reversal_of_id TEXT, source TEXT, source_id TEXT,
			created_by_id TEXT, posted_by_id TEXT, posted_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS journal_entries (
			id TEXT PRIMARY KEY, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME,
			journal_id TEXT NOT NULL, account_id TEXT NOT NULL, description TEXT,
			debit_amount REAL DEFAULT 0, credit_amount REAL DEFAULT 0,
			currency_code TEXT DEFAULT 'USD', exchange_rate REAL DEFAULT 1,
			base_debit REAL DEFAULT 0, base_credit REAL DEFAULT 0,
			cost_center_id TEXT, line_number INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS accounting_payments (
			id TEXT PRIMARY KEY, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME,
			company_id TEXT NOT NULL, bank_account_id TEXT NOT NULL,
			contact_type TEXT NOT NULL, contact_id TEXT,
			payment_type TEXT NOT NULL, amount REAL NOT NULL,
			currency_code TEXT DEFAULT 'USD', payment_date DATETIME NOT NULL,
			reference TEXT, method TEXT DEFAULT 'bank_transfer',
			journal_id TEXT, notes TEXT, status TEXT DEFAULT 'completed'
		)`,
	}
	for _, s := range stmts {
		if _, err := sqlDB.Exec(s); err != nil {
			t.Fatalf("failed to create table: %v\nSQL: %s", err, s)
		}
	}

	companyID := uuid.New()

	// Seed: Financial Year
	fy := accModels.FinancialYear{
		CompanyID: companyID,
		Name:      "FY 2025",
		Code:      "FY2025",
		StartDate: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:   time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		IsActive:  true,
	}
	db.Create(&fy)

	period := accModels.FiscalPeriod{
		FinancialYearID: fy.ID,
		Name:            "January 2025",
		Number:          1,
		StartDate:       time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:         time.Date(2025, 1, 31, 0, 0, 0, 0, time.UTC),
	}
	db.Create(&period)

	return &testContext{
		db:        db,
		companyID: companyID,
		fy:        fy,
	}
}

func (tc *testContext) seedAccount(code, name string, accType accModels.AccountType, normalBalance string, balance float64) accModels.Account {
	a := accModels.Account{
		CompanyID:      tc.companyID,
		Code:           code,
		Name:           name,
		AccountType:    accType,
		NormalBalance:  normalBalance,
		IsActive:       true,
		CurrencyCode:   "USD",
		CurrentBalance: balance,
	}
	tc.db.Create(&a)
	return a
}

func (tc *testContext) setupFiberApp(handler func(fiber.Router)) *fiber.App {
	app := fiber.New()
	api := app.Group("/api", func(c *fiber.Ctx) error {
		c.Locals("company_id", tc.companyID)
		return c.Next()
	})
	handler(api)
	tc.app = app
	return app
}

func doRequest(t *testing.T, app *fiber.App, method, url string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var bodyReader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, url, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	rec := httptest.NewRecorder()
	rec.WriteHeader(resp.StatusCode)
	io.Copy(rec.Body, resp.Body)
	resp.Body.Close()
	return rec
}

type apiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
}

func parseResponse(t *testing.T, rec *httptest.ResponseRecorder) apiResponse {
	t.Helper()
	var resp apiResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v\nbody: %s", err, rec.Body.String())
	}
	return resp
}
