package handlers

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
)

func setupBankApp(tc *testContext) *fiber.App {
	h := NewBankHandler(tc.db)
	return tc.setupFiberApp(func(api fiber.Router) {
		h.RegisterRoutes(api)
	})
}

func TestBank_TransferBetweenAccounts(t *testing.T) {
	tc := setupTestDB(t)

	from := tc.seedAccount("1101", "Checking", accModels.AccountTypeAsset, "debit", 20000)
	to := tc.seedAccount("1102", "Savings", accModels.AccountTypeAsset, "debit", 5000)

	app := setupBankApp(tc)

	rec := doRequest(t, app, http.MethodPost, "/api/accounting/bank-accounts/transfer", map[string]interface{}{
		"from_account_id": from.ID.String(),
		"to_account_id":   to.ID.String(),
		"amount":          3000,
		"date":            "2025-01-15",
		"reference":       "TRF-001",
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// From: 20000 - 3000 = 17000
	var fromAfter accModels.Account
	tc.db.Where("id = ?", from.ID).First(&fromAfter)
	if fromAfter.CurrentBalance != 17000 {
		t.Errorf("from balance: expected 17000, got %f", fromAfter.CurrentBalance)
	}

	// To: 5000 + 3000 = 8000
	var toAfter accModels.Account
	tc.db.Where("id = ?", to.ID).First(&toAfter)
	if toAfter.CurrentBalance != 8000 {
		t.Errorf("to balance: expected 8000, got %f", toAfter.CurrentBalance)
	}

	// Verify journal created
	var journals []accModels.Journal
	tc.db.Where("company_id = ?", tc.companyID).Find(&journals)
	if len(journals) != 1 {
		t.Fatalf("expected 1 journal, got %d", len(journals))
	}
	if journals[0].TotalDebit != 3000 || journals[0].TotalCredit != 3000 {
		t.Errorf("journal not balanced: debit=%f credit=%f", journals[0].TotalDebit, journals[0].TotalCredit)
	}
}

func TestBank_Deposit(t *testing.T) {
	tc := setupTestDB(t)

	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 10000)
	revenue := tc.seedAccount("4000", "Sales Revenue", accModels.AccountTypeRevenue, "credit", 0)

	app := setupBankApp(tc)

	rec := doRequest(t, app, http.MethodPost, "/api/accounting/bank-accounts/deposit", map[string]interface{}{
		"account_id":         bank.ID.String(),
		"counter_account_id": revenue.ID.String(),
		"amount":             2000,
		"date":               "2025-01-15",
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Bank: 10000 + 2000 = 12000
	var bankAfter accModels.Account
	tc.db.Where("id = ?", bank.ID).First(&bankAfter)
	if bankAfter.CurrentBalance != 12000 {
		t.Errorf("bank balance: expected 12000, got %f", bankAfter.CurrentBalance)
	}

	// Revenue (credit-normal): credited increases, so 0 + 2000 = 2000
	var revAfter accModels.Account
	tc.db.Where("id = ?", revenue.ID).First(&revAfter)
	if revAfter.CurrentBalance != 2000 {
		t.Errorf("revenue balance: expected 2000, got %f", revAfter.CurrentBalance)
	}
}

func TestBank_Withdrawal(t *testing.T) {
	tc := setupTestDB(t)

	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 15000)
	expense := tc.seedAccount("5000", "Office Expense", accModels.AccountTypeExpense, "debit", 0)

	app := setupBankApp(tc)

	rec := doRequest(t, app, http.MethodPost, "/api/accounting/bank-accounts/withdrawal", map[string]interface{}{
		"account_id":         bank.ID.String(),
		"counter_account_id": expense.ID.String(),
		"amount":             1500,
		"date":               "2025-01-15",
	})

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Bank: 15000 - 1500 = 13500
	var bankAfter accModels.Account
	tc.db.Where("id = ?", bank.ID).First(&bankAfter)
	if bankAfter.CurrentBalance != 13500 {
		t.Errorf("bank balance: expected 13500, got %f", bankAfter.CurrentBalance)
	}

	// Expense (debit-normal): debited increases, so 0 + 1500 = 1500
	var expAfter accModels.Account
	tc.db.Where("id = ?", expense.ID).First(&expAfter)
	if expAfter.CurrentBalance != 1500 {
		t.Errorf("expense balance: expected 1500, got %f", expAfter.CurrentBalance)
	}
}

func TestBank_TransferValidation(t *testing.T) {
	tc := setupTestDB(t)

	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 10000)
	app := setupBankApp(tc)

	// Zero amount
	rec := doRequest(t, app, http.MethodPost, "/api/accounting/bank-accounts/transfer", map[string]interface{}{
		"from_account_id": bank.ID.String(),
		"to_account_id":   bank.ID.String(),
		"amount":          0,
		"date":            "2025-01-15",
	})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("zero amount: expected 400, got %d", rec.Code)
	}

	// Invalid from ID
	rec = doRequest(t, app, http.MethodPost, "/api/accounting/bank-accounts/transfer", map[string]interface{}{
		"from_account_id": "invalid-uuid",
		"to_account_id":   bank.ID.String(),
		"amount":          100,
		"date":            "2025-01-15",
	})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("invalid from: expected 400, got %d", rec.Code)
	}
}

func TestBank_ListBankAccounts(t *testing.T) {
	tc := setupTestDB(t)

	tc.seedAccount("1101", "Checking", accModels.AccountTypeAsset, "debit", 10000)
	tc.seedAccount("1102", "Savings", accModels.AccountTypeAsset, "debit", 20000)
	tc.seedAccount("2100", "AP", accModels.AccountTypeLiability, "credit", 5000) // not a bank account

	app := setupBankApp(tc)

	rec := doRequest(t, app, http.MethodGet, "/api/accounting/bank-accounts", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	var accounts []BankAccountResponse
	if err := json.Unmarshal(resp.Data, &accounts); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// Should return only 11xx accounts (2 bank accounts, not AP)
	if len(accounts) != 2 {
		t.Errorf("expected 2 bank accounts, got %d", len(accounts))
	}
}
