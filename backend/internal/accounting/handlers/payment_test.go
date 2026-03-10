package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/gofiber/fiber/v2"
	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
)

func setupPaymentApp(tc *testContext) *fiber.App {
	h := NewAccountingPaymentHandler(tc.db)
	return tc.setupFiberApp(func(api fiber.Router) {
		h.RegisterRoutes(api)
	})
}

func TestPayment_ReceiveUpdatesBalancesCorrectly(t *testing.T) {
	tc := setupTestDB(t)

	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 10000)
	_ = tc.seedAccount("1200", "Accounts Receivable", accModels.AccountTypeAsset, "debit", 5000)

	app := setupPaymentApp(tc)

	rec := doRequest(t, app, http.MethodPost, "/api/accounting/payments", map[string]interface{}{
		"bank_account_id": bank.ID.String(),
		"contact_type":    "customer",
		"payment_type":    "receive",
		"amount":          1000,
		"payment_date":    "2025-01-15",
		"method":          "bank_transfer",
		"reference":       "RCV-001",
	})

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify bank balance increased by 1000
	var bankAfter accModels.Account
	tc.db.Where("id = ?", bank.ID).First(&bankAfter)
	if bankAfter.CurrentBalance != 11000 {
		t.Errorf("bank balance: expected 11000, got %f", bankAfter.CurrentBalance)
	}

	// Verify AR balance decreased by 1000
	var arAfter accModels.Account
	tc.db.Where("code = ? AND company_id = ?", "1200", tc.companyID).First(&arAfter)
	if arAfter.CurrentBalance != 4000 {
		t.Errorf("AR balance: expected 4000, got %f", arAfter.CurrentBalance)
	}
}

func TestPayment_MakeUpdatesBalancesCorrectly(t *testing.T) {
	tc := setupTestDB(t)

	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 10000)
	_ = tc.seedAccount("2100", "Accounts Payable", accModels.AccountTypeLiability, "credit", 3000)

	app := setupPaymentApp(tc)

	rec := doRequest(t, app, http.MethodPost, "/api/accounting/payments", map[string]interface{}{
		"bank_account_id": bank.ID.String(),
		"contact_type":    "supplier",
		"payment_type":    "make",
		"amount":          500,
		"payment_date":    "2025-01-15",
		"method":          "bank_transfer",
		"reference":       "PAY-001",
	})

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify bank balance decreased by 500
	var bankAfter accModels.Account
	tc.db.Where("id = ?", bank.ID).First(&bankAfter)
	if bankAfter.CurrentBalance != 9500 {
		t.Errorf("bank balance: expected 9500, got %f", bankAfter.CurrentBalance)
	}

	// Verify AP balance decreased by 500 (AP is credit-normal, debiting it decreases)
	var apAfter accModels.Account
	tc.db.Where("code = ? AND company_id = ?", "2100", tc.companyID).First(&apAfter)
	if apAfter.CurrentBalance != 2500 {
		t.Errorf("AP balance: expected 2500, got %f", apAfter.CurrentBalance)
	}
}

func TestPayment_CreatesJournalEntries(t *testing.T) {
	tc := setupTestDB(t)

	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 10000)
	ar := tc.seedAccount("1200", "Accounts Receivable", accModels.AccountTypeAsset, "debit", 5000)

	app := setupPaymentApp(tc)

	doRequest(t, app, http.MethodPost, "/api/accounting/payments", map[string]interface{}{
		"bank_account_id": bank.ID.String(),
		"contact_type":    "customer",
		"payment_type":    "receive",
		"amount":          750,
		"payment_date":    "2025-01-15",
		"method":          "cash",
		"reference":       "RCV-002",
	})

	// Verify journal was created
	var journals []accModels.Journal
	tc.db.Where("company_id = ? AND status = ?", tc.companyID, accModels.JournalStatusPosted).Find(&journals)
	if len(journals) != 1 {
		t.Fatalf("expected 1 journal, got %d", len(journals))
	}

	j := journals[0]
	if j.TotalDebit != 750 || j.TotalCredit != 750 {
		t.Errorf("journal totals: debit=%f credit=%f, expected 750 each", j.TotalDebit, j.TotalCredit)
	}

	// Verify journal entries (2 lines: debit bank, credit AR)
	var entries []accModels.JournalEntry
	tc.db.Where("journal_id = ?", j.ID).Order("line_number ASC").Find(&entries)
	if len(entries) != 2 {
		t.Fatalf("expected 2 journal entries, got %d", len(entries))
	}

	// Line 1: Debit bank
	if entries[0].AccountID != bank.ID || entries[0].DebitAmount != 750 || entries[0].CreditAmount != 0 {
		t.Errorf("entry 1: expected debit bank %s for 750, got account=%s debit=%f credit=%f",
			bank.ID, entries[0].AccountID, entries[0].DebitAmount, entries[0].CreditAmount)
	}
	// Line 2: Credit AR
	if entries[1].AccountID != ar.ID || entries[1].CreditAmount != 750 || entries[1].DebitAmount != 0 {
		t.Errorf("entry 2: expected credit AR %s for 750, got account=%s debit=%f credit=%f",
			ar.ID, entries[1].AccountID, entries[1].DebitAmount, entries[1].CreditAmount)
	}
}

func TestPayment_ValidationErrors(t *testing.T) {
	tc := setupTestDB(t)
	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 10000)
	_ = tc.seedAccount("1200", "Accounts Receivable", accModels.AccountTypeAsset, "debit", 0)
	app := setupPaymentApp(tc)

	tests := []struct {
		name string
		body map[string]interface{}
		code int
	}{
		{
			name: "zero amount",
			body: map[string]interface{}{
				"bank_account_id": bank.ID.String(), "contact_type": "customer",
				"payment_type": "receive", "amount": 0, "payment_date": "2025-01-15",
			},
			code: http.StatusBadRequest,
		},
		{
			name: "invalid payment type",
			body: map[string]interface{}{
				"bank_account_id": bank.ID.String(), "contact_type": "customer",
				"payment_type": "invalid", "amount": 100, "payment_date": "2025-01-15",
			},
			code: http.StatusBadRequest,
		},
		{
			name: "invalid contact type",
			body: map[string]interface{}{
				"bank_account_id": bank.ID.String(), "contact_type": "invalid",
				"payment_type": "receive", "amount": 100, "payment_date": "2025-01-15",
			},
			code: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, app, http.MethodPost, "/api/accounting/payments", tt.body)
			if rec.Code != tt.code {
				t.Errorf("expected %d, got %d: %s", tt.code, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestPayment_SummaryEndpoint(t *testing.T) {
	tc := setupTestDB(t)

	bank := tc.seedAccount("1101", "Main Bank", accModels.AccountTypeAsset, "debit", 50000)
	_ = tc.seedAccount("1200", "Accounts Receivable", accModels.AccountTypeAsset, "debit", 10000)
	_ = tc.seedAccount("2100", "Accounts Payable", accModels.AccountTypeLiability, "credit", 10000)

	app := setupPaymentApp(tc)

	// Create 2 receive payments
	for i := 0; i < 2; i++ {
		doRequest(t, app, http.MethodPost, "/api/accounting/payments", map[string]interface{}{
			"bank_account_id": bank.ID.String(), "contact_type": "customer",
			"payment_type": "receive", "amount": 1000, "payment_date": "2025-01-15",
			"reference": fmt.Sprintf("RCV-%d", i),
		})
	}
	// Create 1 make payment
	doRequest(t, app, http.MethodPost, "/api/accounting/payments", map[string]interface{}{
		"bank_account_id": bank.ID.String(), "contact_type": "supplier",
		"payment_type": "make", "amount": 500, "payment_date": "2025-01-15",
		"reference": "PAY-1",
	})

	rec := doRequest(t, app, http.MethodGet, "/api/accounting/payments/summary", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	resp := parseResponse(t, rec)
	var summary map[string]float64
	json.Unmarshal(resp.Data, &summary)

	if summary["total_received"] != 2000 {
		t.Errorf("total_received: expected 2000, got %f", summary["total_received"])
	}
	if summary["total_made"] != 500 {
		t.Errorf("total_made: expected 500, got %f", summary["total_made"])
	}
	if summary["net"] != 1500 {
		t.Errorf("net: expected 1500, got %f", summary["net"])
	}
}

func TestPayment_MultipleBankAccounts(t *testing.T) {
	tc := setupTestDB(t)

	bank1 := tc.seedAccount("1101", "Checking Account", accModels.AccountTypeAsset, "debit", 20000)
	bank2 := tc.seedAccount("1102", "Savings Account", accModels.AccountTypeAsset, "debit", 30000)
	_ = tc.seedAccount("1200", "Accounts Receivable", accModels.AccountTypeAsset, "debit", 10000)
	_ = tc.seedAccount("2100", "Accounts Payable", accModels.AccountTypeLiability, "credit", 10000)

	app := setupPaymentApp(tc)

	// Receive into bank1
	rec := doRequest(t, app, http.MethodPost, "/api/accounting/payments", map[string]interface{}{
		"bank_account_id": bank1.ID.String(), "contact_type": "customer",
		"payment_type": "receive", "amount": 2000, "payment_date": "2025-01-15",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("receive to bank1: expected 201, got %d", rec.Code)
	}

	// Pay from bank2
	rec = doRequest(t, app, http.MethodPost, "/api/accounting/payments", map[string]interface{}{
		"bank_account_id": bank2.ID.String(), "contact_type": "supplier",
		"payment_type": "make", "amount": 1000, "payment_date": "2025-01-15",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("make from bank2: expected 201, got %d", rec.Code)
	}

	// Verify bank1 balance: 20000 + 2000 = 22000
	var b1 accModels.Account
	tc.db.Where("id = ?", bank1.ID).First(&b1)
	if b1.CurrentBalance != 22000 {
		t.Errorf("bank1 balance: expected 22000, got %f", b1.CurrentBalance)
	}

	// Verify bank2 balance: 30000 - 1000 = 29000
	var b2 accModels.Account
	tc.db.Where("id = ?", bank2.ID).First(&b2)
	if b2.CurrentBalance != 29000 {
		t.Errorf("bank2 balance: expected 29000, got %f", b2.CurrentBalance)
	}
}
