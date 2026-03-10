package database

import (
	"fmt"
	"log"
	"time"

	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/auth"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	intModels "github.com/gonext/accounting-ecommerce/internal/integration/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func Seed(db *gorm.DB) {
	var count int64
	db.Model(&models.Company{}).Count(&count)
	if count > 0 {
		fmt.Println("⏭ Database already seeded, skipping")
		return
	}

	fmt.Println("🌱 Seeding database...")

	tx := db.Begin()

	// ── Company & Branches ──────────────────────────────────────────
	company := models.Company{
		Name:     "Acme Corporation",
		Code:     "ACME",
		TaxID:    "TAX-123456789",
		Email:    "info@acme.com",
		Phone:    "+1-555-100-0000",
		Address:  "100 Innovation Drive",
		City:     "San Francisco",
		Country:  "United States",
		IsActive: true,
	}
	must(tx.Create(&company))

	mainBranch := models.Branch{CompanyID: company.ID, Name: "Head Office", Code: "HQ", City: "San Francisco", Country: "United States", IsActive: true, IsMain: true}
	eastBranch := models.Branch{CompanyID: company.ID, Name: "East Branch", Code: "EAST", City: "New York", Country: "United States", IsActive: true}
	must(tx.Create(&mainBranch))
	must(tx.Create(&eastBranch))

	// ── Roles ───────────────────────────────────────────────────────
	adminRole := models.Role{CompanyID: company.ID, Name: "Administrator", Code: "admin", Description: "Full system access", IsSystem: true, IsActive: true}
	accountantRole := models.Role{CompanyID: company.ID, Name: "Accountant", Code: "accountant", Description: "Accounting module access", IsActive: true}
	salesRole := models.Role{CompanyID: company.ID, Name: "Sales Manager", Code: "sales", Description: "eCommerce module access", IsActive: true}
	must(tx.Create(&adminRole))
	must(tx.Create(&accountantRole))
	must(tx.Create(&salesRole))

	// ── Users ───────────────────────────────────────────────────────
	adminPwd, _ := auth.HashPassword("admin123")
	accPwd, _ := auth.HashPassword("accountant123")
	salesPwd, _ := auth.HashPassword("sales123")

	adminUser := models.User{CompanyID: company.ID, BranchID: &mainBranch.ID, Email: "admin@acme.com", Password: adminPwd, FirstName: "John", LastName: "Admin", Phone: "+1-555-100-0001", IsActive: true, IsSuperAdmin: true}
	accUser := models.User{CompanyID: company.ID, BranchID: &mainBranch.ID, Email: "accountant@acme.com", Password: accPwd, FirstName: "Sarah", LastName: "Finance", Phone: "+1-555-100-0002", IsActive: true}
	salesUser := models.User{CompanyID: company.ID, BranchID: &eastBranch.ID, Email: "sales@acme.com", Password: salesPwd, FirstName: "Mike", LastName: "Sales", Phone: "+1-555-100-0003", IsActive: true}
	must(tx.Create(&adminUser))
	must(tx.Create(&accUser))
	must(tx.Create(&salesUser))

	must(tx.Create(&models.UserRole{UserID: adminUser.ID, RoleID: adminRole.ID, BranchID: &mainBranch.ID}))
	must(tx.Create(&models.UserRole{UserID: accUser.ID, RoleID: accountantRole.ID, BranchID: &mainBranch.ID}))
	must(tx.Create(&models.UserRole{UserID: salesUser.ID, RoleID: salesRole.ID, BranchID: &eastBranch.ID}))

	// ── Auto-number sequences ───────────────────────────────────────
	seqTypes := []string{"journal", "order", "invoice", "payment", "customer", "supplier"}
	prefixes := []string{"JRN", "ORD", "INV", "PAY", "CUS", "SUP"}
	for i, st := range seqTypes {
		must(tx.Create(&models.AutoNumberSequence{
			CompanyID:  company.ID,
			EntityType: st,
			Prefix:     prefixes[i],
			NextNumber: 1,
			Padding:    6,
			IsActive:   true,
		}))
	}

	// ── Currencies & Exchange Rates ─────────────────────────────────
	usd := accModels.Currency{Code: "USD", Name: "US Dollar", Symbol: "$", DecimalPlaces: 2, IsActive: true, IsDefault: true}
	eur := accModels.Currency{Code: "EUR", Name: "Euro", Symbol: "€", DecimalPlaces: 2, IsActive: true}
	gbp := accModels.Currency{Code: "GBP", Name: "British Pound", Symbol: "£", DecimalPlaces: 2, IsActive: true}
	jpy := accModels.Currency{Code: "JPY", Name: "Japanese Yen", Symbol: "¥", DecimalPlaces: 0, IsActive: true}
	must(tx.Create(&usd))
	must(tx.Create(&eur))
	must(tx.Create(&gbp))
	must(tx.Create(&jpy))

	today := time.Now().Format("2006-01-02")
	must(tx.Create(&accModels.ExchangeRate{CompanyID: company.ID, FromCurrency: "EUR", ToCurrency: "USD", Rate: 1.0850, EffectiveDate: today}))
	must(tx.Create(&accModels.ExchangeRate{CompanyID: company.ID, FromCurrency: "GBP", ToCurrency: "USD", Rate: 1.2650, EffectiveDate: today}))
	must(tx.Create(&accModels.ExchangeRate{CompanyID: company.ID, FromCurrency: "JPY", ToCurrency: "USD", Rate: 0.0067, EffectiveDate: today}))

	// ── Financial Year & Fiscal Periods ─────────────────────────────
	now := time.Now()
	fyStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	fyEnd := time.Date(now.Year(), 12, 31, 23, 59, 59, 0, time.UTC)

	fy := accModels.FinancialYear{
		CompanyID: company.ID,
		Name:      fmt.Sprintf("FY %d", now.Year()),
		Code:      fmt.Sprintf("FY%d", now.Year()),
		StartDate: fyStart,
		EndDate:   fyEnd,
		IsActive:  true,
	}
	must(tx.Create(&fy))

	var periods []accModels.FiscalPeriod
	for m := 1; m <= 12; m++ {
		pStart := time.Date(now.Year(), time.Month(m), 1, 0, 0, 0, 0, time.UTC)
		pEnd := pStart.AddDate(0, 1, -1)
		periods = append(periods, accModels.FiscalPeriod{
			FinancialYearID: fy.ID,
			Name:            pStart.Format("January 2006"),
			Number:          m,
			StartDate:       pStart,
			EndDate:         pEnd,
		})
	}
	for i := range periods {
		must(tx.Create(&periods[i]))
	}

	// determine current period
	var currentPeriod accModels.FiscalPeriod
	tx.Where("financial_year_id = ? AND start_date <= ? AND end_date >= ?", fy.ID, now, now).First(&currentPeriod)

	// ── Chart of Accounts ───────────────────────────────────────────
	accts := seedAccounts(tx, company.ID)

	// ── Categories ──────────────────────────────────────────────────
	catElectronics := ecomModels.Category{CompanyID: company.ID, Name: "Electronics", Slug: "electronics", Description: "Electronic devices and accessories", SortOrder: 1, IsActive: true}
	catClothing := ecomModels.Category{CompanyID: company.ID, Name: "Clothing", Slug: "clothing", Description: "Apparel and fashion items", SortOrder: 2, IsActive: true}
	catBooks := ecomModels.Category{CompanyID: company.ID, Name: "Books", Slug: "books", Description: "Books and publications", SortOrder: 3, IsActive: true}
	catHome := ecomModels.Category{CompanyID: company.ID, Name: "Home & Garden", Slug: "home-garden", Description: "Home and garden supplies", SortOrder: 4, IsActive: true}
	must(tx.Create(&catElectronics))
	must(tx.Create(&catClothing))
	must(tx.Create(&catBooks))
	must(tx.Create(&catHome))

	catPhones := ecomModels.Category{CompanyID: company.ID, ParentID: &catElectronics.ID, Name: "Smartphones", Slug: "smartphones", SortOrder: 1, IsActive: true}
	catLaptops := ecomModels.Category{CompanyID: company.ID, ParentID: &catElectronics.ID, Name: "Laptops", Slug: "laptops", SortOrder: 2, IsActive: true}
	catAccessories := ecomModels.Category{CompanyID: company.ID, ParentID: &catElectronics.ID, Name: "Accessories", Slug: "accessories", SortOrder: 3, IsActive: true}
	must(tx.Create(&catPhones))
	must(tx.Create(&catLaptops))
	must(tx.Create(&catAccessories))

	// ── Products ────────────────────────────────────────────────────
	products := []ecomModels.Product{
		{CompanyID: company.ID, CategoryID: &catPhones.ID, SKU: "PHN-001", Name: "iPhone 15 Pro", Description: "Latest Apple smartphone", Price: 999.00, CostPrice: 750.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 50, LowStockAlert: 10, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catPhones.ID, SKU: "PHN-002", Name: "Samsung Galaxy S24", Description: "Flagship Samsung phone", Price: 849.00, CostPrice: 620.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 35, LowStockAlert: 8, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catPhones.ID, SKU: "PHN-003", Name: "Google Pixel 8", Description: "Google's AI-powered phone", Price: 699.00, CostPrice: 480.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 25, LowStockAlert: 5, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catLaptops.ID, SKU: "LAP-001", Name: "MacBook Pro 16\"", Description: "Apple M3 Pro laptop", Price: 2499.00, CostPrice: 1900.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 15, LowStockAlert: 3, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catLaptops.ID, SKU: "LAP-002", Name: "Dell XPS 15", Description: "Premium Windows laptop", Price: 1799.00, CostPrice: 1350.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 20, LowStockAlert: 5, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catLaptops.ID, SKU: "LAP-003", Name: "ThinkPad X1 Carbon", Description: "Lenovo business laptop", Price: 1549.00, CostPrice: 1100.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 18, LowStockAlert: 4, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catAccessories.ID, SKU: "ACC-001", Name: "AirPods Pro", Description: "Apple wireless earbuds", Price: 249.00, CostPrice: 170.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 100, LowStockAlert: 20, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catAccessories.ID, SKU: "ACC-002", Name: "USB-C Hub 7-in-1", Description: "Multi-port USB-C adapter", Price: 59.99, CostPrice: 25.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 200, LowStockAlert: 30, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catClothing.ID, SKU: "CLT-001", Name: "Classic Polo Shirt", Description: "Cotton polo shirt", Price: 39.99, CostPrice: 15.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 150, LowStockAlert: 25, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catClothing.ID, SKU: "CLT-002", Name: "Slim Fit Jeans", Description: "Premium denim jeans", Price: 79.99, CostPrice: 32.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 80, LowStockAlert: 15, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catBooks.ID, SKU: "BK-001", Name: "Clean Code", Description: "Robert C. Martin - Software craftsmanship", Price: 34.99, CostPrice: 12.00, CurrencyCode: "USD", TaxRate: 0, Unit: "pc", TrackStock: true, StockQuantity: 60, LowStockAlert: 10, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catBooks.ID, SKU: "BK-002", Name: "System Design Interview", Description: "Alex Xu - Insider's guide", Price: 39.99, CostPrice: 14.00, CurrencyCode: "USD", TaxRate: 0, Unit: "pc", TrackStock: true, StockQuantity: 45, LowStockAlert: 8, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catHome.ID, SKU: "HM-001", Name: "Standing Desk", Description: "Electric adjustable standing desk", Price: 499.00, CostPrice: 280.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 12, LowStockAlert: 3, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catHome.ID, SKU: "HM-002", Name: "Ergonomic Chair", Description: "Mesh back office chair", Price: 349.00, CostPrice: 180.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 8, LowStockAlert: 2, IsActive: true},
		{CompanyID: company.ID, CategoryID: &catHome.ID, SKU: "HM-003", Name: "LED Desk Lamp", Description: "Adjustable LED lamp with USB", Price: 49.99, CostPrice: 18.00, CurrencyCode: "USD", TaxRate: 8.25, Unit: "pc", TrackStock: true, StockQuantity: 75, LowStockAlert: 15, IsActive: true},
	}
	for i := range products {
		must(tx.Create(&products[i]))
	}

	// ── Customers ───────────────────────────────────────────────────
	customers := []ecomModels.Customer{
		{CompanyID: company.ID, BranchID: &mainBranch.ID, Code: "CUS-000001", FirstName: "Alice", LastName: "Johnson", CompanyName: "TechStart Inc", Email: "alice@techstart.com", Phone: "+1-555-200-0001", Address: "200 Market St", City: "San Francisco", Country: "United States", CreditLimit: 50000, IsActive: true},
		{CompanyID: company.ID, BranchID: &mainBranch.ID, Code: "CUS-000002", FirstName: "Bob", LastName: "Williams", CompanyName: "Digital Solutions", Email: "bob@digisol.com", Phone: "+1-555-200-0002", Address: "350 Broadway", City: "New York", Country: "United States", CreditLimit: 30000, IsActive: true},
		{CompanyID: company.ID, BranchID: &eastBranch.ID, Code: "CUS-000003", FirstName: "Carol", LastName: "Davis", Email: "carol.davis@gmail.com", Phone: "+1-555-200-0003", City: "Boston", Country: "United States", CreditLimit: 10000, IsActive: true},
		{CompanyID: company.ID, BranchID: &eastBranch.ID, Code: "CUS-000004", FirstName: "David", LastName: "Chen", CompanyName: "Chen Enterprises", Email: "david@chenent.com", Phone: "+1-555-200-0004", City: "Chicago", Country: "United States", CreditLimit: 75000, IsActive: true},
		{CompanyID: company.ID, BranchID: &mainBranch.ID, Code: "CUS-000005", FirstName: "Emma", LastName: "Rodriguez", Email: "emma.r@outlook.com", Phone: "+1-555-200-0005", City: "Miami", Country: "United States", CreditLimit: 15000, IsActive: true},
	}
	for i := range customers {
		must(tx.Create(&customers[i]))
	}

	// ── Suppliers ───────────────────────────────────────────────────
	suppliers := []ecomModels.Supplier{
		{CompanyID: company.ID, Code: "SUP-000001", Name: "TechDistro Global", ContactName: "James Lee", Email: "orders@techdistro.com", Phone: "+1-555-300-0001", City: "Shenzhen", Country: "China", PaymentTerms: "Net 30", IsActive: true},
		{CompanyID: company.ID, Code: "SUP-000002", Name: "Fashion Hub Ltd", ContactName: "Maria Garcia", Email: "supply@fashionhub.com", Phone: "+1-555-300-0002", City: "Los Angeles", Country: "United States", PaymentTerms: "Net 15", IsActive: true},
		{CompanyID: company.ID, Code: "SUP-000003", Name: "BookWholesale Co", ContactName: "Peter Brown", Email: "orders@bookwholesale.com", Phone: "+1-555-300-0003", City: "Portland", Country: "United States", PaymentTerms: "Net 45", IsActive: true},
		{CompanyID: company.ID, Code: "SUP-000004", Name: "Office Furniture Direct", ContactName: "Linda Park", Email: "sales@ofdirect.com", Phone: "+1-555-300-0004", City: "Dallas", Country: "United States", PaymentTerms: "Net 30", IsActive: true},
	}
	for i := range suppliers {
		must(tx.Create(&suppliers[i]))
	}

	// ── Orders ──────────────────────────────────────────────────────
	order1 := seedOrder(tx, company.ID, &mainBranch.ID, &customers[0].ID, "ORD-000001", now.AddDate(0, 0, -15), ecomModels.OrderStatusDelivered, ecomModels.PaymentStatusPaid, []orderLine{
		{Product: &products[0], Qty: 2},
		{Product: &products[6], Qty: 2},
	})
	order2 := seedOrder(tx, company.ID, &eastBranch.ID, &customers[1].ID, "ORD-000002", now.AddDate(0, 0, -10), ecomModels.OrderStatusShipped, ecomModels.PaymentStatusPaid, []orderLine{
		{Product: &products[3], Qty: 1},
		{Product: &products[7], Qty: 3},
	})
	order3 := seedOrder(tx, company.ID, &mainBranch.ID, &customers[2].ID, "ORD-000003", now.AddDate(0, 0, -5), ecomModels.OrderStatusConfirmed, ecomModels.PaymentStatusUnpaid, []orderLine{
		{Product: &products[8], Qty: 5},
		{Product: &products[9], Qty: 3},
	})
	order4 := seedOrder(tx, company.ID, &eastBranch.ID, &customers[3].ID, "ORD-000004", now.AddDate(0, 0, -2), ecomModels.OrderStatusProcessing, ecomModels.PaymentStatusPartial, []orderLine{
		{Product: &products[4], Qty: 2},
		{Product: &products[12], Qty: 1},
	})
	seedOrder(tx, company.ID, &mainBranch.ID, &customers[4].ID, "ORD-000005", now, ecomModels.OrderStatusPending, ecomModels.PaymentStatusUnpaid, []orderLine{
		{Product: &products[10], Qty: 3},
		{Product: &products[11], Qty: 2},
		{Product: &products[14], Qty: 1},
	})

	// ── Payments ────────────────────────────────────────────────────
	must(tx.Create(&ecomModels.Payment{CompanyID: company.ID, OrderID: &order1.ID, CustomerID: &customers[0].ID, PaymentNumber: "PAY-000001", PaymentDate: now.AddDate(0, 0, -14), Amount: order1.TotalAmount, CurrencyCode: "USD", Method: "credit_card", Reference: "CC-TXN-98765", Status: "completed"}))
	must(tx.Create(&ecomModels.Payment{CompanyID: company.ID, OrderID: &order2.ID, CustomerID: &customers[1].ID, PaymentNumber: "PAY-000002", PaymentDate: now.AddDate(0, 0, -9), Amount: order2.TotalAmount, CurrencyCode: "USD", Method: "bank_transfer", Reference: "BT-2024-001", Status: "completed"}))
	must(tx.Create(&ecomModels.Payment{CompanyID: company.ID, OrderID: &order4.ID, CustomerID: &customers[3].ID, PaymentNumber: "PAY-000003", PaymentDate: now.AddDate(0, 0, -1), Amount: 2000, CurrencyCode: "USD", Method: "bank_transfer", Reference: "BT-2024-002", Status: "completed"}))

	// update paid amounts
	tx.Model(&ecomModels.Order{}).Where("id = ?", order1.ID).Update("paid_amount", order1.TotalAmount)
	tx.Model(&ecomModels.Order{}).Where("id = ?", order2.ID).Update("paid_amount", order2.TotalAmount)
	tx.Model(&ecomModels.Order{}).Where("id = ?", order4.ID).Update("paid_amount", 2000)

	// ── Invoices ────────────────────────────────────────────────────
	inv1 := seedInvoice(tx, company.ID, &order1.ID, &customers[0].ID, "INV-000001", now.AddDate(0, 0, -15), now.AddDate(0, 0, 15), "paid", order1)
	seedInvoice(tx, company.ID, &order2.ID, &customers[1].ID, "INV-000002", now.AddDate(0, 0, -10), now.AddDate(0, 0, 20), "paid", order2)
	seedInvoice(tx, company.ID, &order3.ID, &customers[2].ID, "INV-000003", now.AddDate(0, 0, -5), now.AddDate(0, 0, 25), "sent", order3)
	_ = inv1

	// ── Journal Entries (sample accounting transactions) ─────────────
	seedJournals(tx, company.ID, fy.ID, &currentPeriod.ID, accts, now)

	// ── Integration Mappings ────────────────────────────────────────
	if arID, ok := accts["1200"]; ok {
		if revID, ok2 := accts["4100"]; ok2 {
			must(tx.Create(&intModels.AccountMapping{CompanyID: company.ID, EventType: intModels.EventOrderConfirmed, DebitAccountID: arID, CreditAccountID: revID, Description: "Revenue recognition on order confirmation", IsActive: true}))
		}
	}
	if cashID, ok := accts["1100"]; ok {
		if arID, ok2 := accts["1200"]; ok2 {
			must(tx.Create(&intModels.AccountMapping{CompanyID: company.ID, EventType: intModels.EventPaymentReceived, DebitAccountID: cashID, CreditAccountID: arID, Description: "Cash received from customer", IsActive: true}))
		}
	}
	if cogsID, ok := accts["5100"]; ok {
		if invID, ok2 := accts["1300"]; ok2 {
			must(tx.Create(&intModels.AccountMapping{CompanyID: company.ID, EventType: intModels.EventOrderShipped, DebitAccountID: cogsID, CreditAccountID: invID, Description: "COGS on order shipment", IsActive: true}))
		}
	}

	tx.Commit()
	fmt.Println("✅ Seed data created successfully!")
	fmt.Println("   📧 Admin login: admin@acme.com / admin123")
	fmt.Println("   📧 Accountant:  accountant@acme.com / accountant123")
	fmt.Println("   📧 Sales:       sales@acme.com / sales123")
}

// ── Helper types & functions ────────────────────────────────────────

type orderLine struct {
	Product *ecomModels.Product
	Qty     int
}

func seedOrder(tx *gorm.DB, companyID uuid.UUID, branchID *uuid.UUID, customerID *uuid.UUID, number string, date time.Time, status ecomModels.OrderStatus, payStatus ecomModels.PaymentStatus, lines []orderLine) ecomModels.Order {
	order := ecomModels.Order{
		CompanyID:     companyID,
		BranchID:      branchID,
		CustomerID:    customerID,
		OrderNumber:   number,
		OrderDate:     date,
		Status:        status,
		PaymentStatus: payStatus,
		CurrencyCode:  "USD",
	}
	must(tx.Create(&order))

	var subtotal, taxTotal float64
	for i, line := range lines {
		lineTotal := float64(line.Qty) * line.Product.Price
		taxAmt := lineTotal * line.Product.TaxRate / 100
		item := ecomModels.OrderItem{
			OrderID:     order.ID,
			ProductID:   line.Product.ID,
			SKU:         line.Product.SKU,
			Name:        line.Product.Name,
			Quantity:    line.Qty,
			UnitPrice:   line.Product.Price,
			CostPrice:   line.Product.CostPrice,
			TaxRate:     line.Product.TaxRate,
			TaxAmount:   taxAmt,
			Discount:    0,
			TotalAmount: lineTotal + taxAmt,
			LineNumber:  i + 1,
		}
		must(tx.Create(&item))
		subtotal += lineTotal
		taxTotal += taxAmt
	}

	order.Subtotal = subtotal
	order.TaxAmount = taxTotal
	order.TotalAmount = subtotal + taxTotal
	tx.Save(&order)
	return order
}

func seedInvoice(tx *gorm.DB, companyID uuid.UUID, orderID *uuid.UUID, customerID *uuid.UUID, number string, invDate, dueDate time.Time, status string, order ecomModels.Order) ecomModels.Invoice {
	inv := ecomModels.Invoice{
		CompanyID:     companyID,
		OrderID:       orderID,
		CustomerID:    customerID,
		InvoiceNumber: number,
		InvoiceDate:   invDate,
		DueDate:       dueDate,
		Status:        status,
		Subtotal:      order.Subtotal,
		TaxAmount:     order.TaxAmount,
		TotalAmount:   order.TotalAmount,
		CurrencyCode:  "USD",
	}
	if status == "paid" {
		inv.PaidAmount = order.TotalAmount
	}
	must(tx.Create(&inv))

	must(tx.Create(&ecomModels.InvoiceItem{
		InvoiceID:   inv.ID,
		Description: "Order " + order.OrderNumber,
		Quantity:    1,
		UnitPrice:   order.Subtotal,
		TaxRate:     0,
		TaxAmount:   order.TaxAmount,
		TotalAmount: order.TotalAmount,
		LineNumber:  1,
	}))
	return inv
}

func seedJournals(tx *gorm.DB, companyID, fyID uuid.UUID, periodID *uuid.UUID, accts map[string]uuid.UUID, now time.Time) {
	cashID := accts["1100"]
	arID := accts["1200"]
	invID := accts["1300"]
	apID := accts["2100"]
	revenueID := accts["4100"]
	cogsID := accts["5100"]
	rentID := accts["6200"]
	salaryID := accts["6100"]
	capitalID := accts["3100"]

	entries := []struct {
		num    string
		date   time.Time
		ref    string
		desc   string
		debit  uuid.UUID
		credit uuid.UUID
		amount float64
	}{
		{"JRN-000001", now.AddDate(0, -2, 0), "OPEN", "Owner capital contribution", cashID, capitalID, 100000},
		{"JRN-000002", now.AddDate(0, -1, -20), "PUR-001", "Inventory purchase from supplier", invID, apID, 25000},
		{"JRN-000003", now.AddDate(0, -1, -15), "SAL-001", "Sales revenue - batch 1", arID, revenueID, 15000},
		{"JRN-000004", now.AddDate(0, -1, -15), "COGS-001", "Cost of goods sold - batch 1", cogsID, invID, 9000},
		{"JRN-000005", now.AddDate(0, -1, -10), "PMT-001", "Customer payment received", cashID, arID, 15000},
		{"JRN-000006", now.AddDate(0, -1, 0), "RENT-01", "Monthly office rent", rentID, cashID, 5000},
		{"JRN-000007", now.AddDate(0, -1, 0), "SAL-EXP", "Monthly salaries", salaryID, cashID, 35000},
		{"JRN-000008", now.AddDate(0, 0, -20), "SAL-002", "Sales revenue - batch 2", arID, revenueID, 22000},
		{"JRN-000009", now.AddDate(0, 0, -20), "COGS-002", "Cost of goods sold - batch 2", cogsID, invID, 13200},
		{"JRN-000010", now.AddDate(0, 0, -15), "PMT-002", "Customer payment received", cashID, arID, 22000},
		{"JRN-000011", now.AddDate(0, 0, -5), "RENT-02", "Monthly office rent", rentID, cashID, 5000},
		{"JRN-000012", now.AddDate(0, 0, -5), "SAL-EXP2", "Monthly salaries", salaryID, cashID, 35000},
		{"JRN-000013", now.AddDate(0, 0, -3), "PUR-002", "Supplier payment", apID, cashID, 25000},
		{"JRN-000014", now.AddDate(0, 0, -1), "SAL-003", "Sales revenue - batch 3", arID, revenueID, 18500},
		{"JRN-000015", now.AddDate(0, 0, -1), "COGS-003", "Cost of goods sold - batch 3", cogsID, invID, 11100},
	}

	postedAt := now
	for _, e := range entries {
		journal := accModels.Journal{
			CompanyID:       companyID,
			FinancialYearID: fyID,
			FiscalPeriodID:  periodID,
			Number:          e.num,
			Date:            e.date,
			Reference:       e.ref,
			Description:     e.desc,
			Status:          accModels.JournalStatusPosted,
			TotalDebit:      e.amount,
			TotalCredit:     e.amount,
			CurrencyCode:    "USD",
			ExchangeRate:    1,
			PostedAt:        &postedAt,
		}
		must(tx.Create(&journal))

		must(tx.Create(&accModels.JournalEntry{JournalID: journal.ID, AccountID: e.debit, Description: e.desc, DebitAmount: e.amount, CurrencyCode: "USD", ExchangeRate: 1, BaseDebit: e.amount, LineNumber: 1}))
		must(tx.Create(&accModels.JournalEntry{JournalID: journal.ID, AccountID: e.credit, Description: e.desc, CreditAmount: e.amount, CurrencyCode: "USD", ExchangeRate: 1, BaseCredit: e.amount, LineNumber: 2}))
	}

	// Update account balances based on journal entries
	updateAccountBalance(tx, cashID, "debit")     // Cash
	updateAccountBalance(tx, arID, "debit")       // AR
	updateAccountBalance(tx, invID, "debit")      // Inventory
	updateAccountBalance(tx, apID, "credit")      // AP
	updateAccountBalance(tx, revenueID, "credit") // Revenue
	updateAccountBalance(tx, cogsID, "debit")     // COGS
	updateAccountBalance(tx, rentID, "debit")     // Rent
	updateAccountBalance(tx, salaryID, "debit")   // Salary
	updateAccountBalance(tx, capitalID, "credit") // Capital
}

func updateAccountBalance(tx *gorm.DB, accountID uuid.UUID, normalBalance string) {
	var totalDebit, totalCredit float64
	tx.Model(&accModels.JournalEntry{}).Where("account_id = ?", accountID).Select("COALESCE(SUM(debit_amount),0)").Row().Scan(&totalDebit)
	tx.Model(&accModels.JournalEntry{}).Where("account_id = ?", accountID).Select("COALESCE(SUM(credit_amount),0)").Row().Scan(&totalCredit)

	var balance float64
	if normalBalance == "debit" {
		balance = totalDebit - totalCredit
	} else {
		balance = totalCredit - totalDebit
	}
	tx.Model(&accModels.Account{}).Where("id = ?", accountID).Update("current_balance", balance)
}

func seedAccounts(tx *gorm.DB, companyID uuid.UUID) map[string]uuid.UUID {
	accts := make(map[string]uuid.UUID)

	type acctDef struct {
		code, name  string
		acctType    accModels.AccountType
		normal      string
		parentCode  string
		isControl   bool
		controlType string
	}

	defs := []acctDef{
		// Assets
		{"1000", "Assets", accModels.AccountTypeAsset, "debit", "", false, ""},
		{"1100", "Cash and Bank", accModels.AccountTypeAsset, "debit", "1000", false, ""},
		{"1110", "Petty Cash", accModels.AccountTypeAsset, "debit", "1100", false, ""},
		{"1120", "Checking Account", accModels.AccountTypeAsset, "debit", "1100", false, ""},
		{"1130", "Savings Account", accModels.AccountTypeAsset, "debit", "1100", false, ""},
		{"1200", "Accounts Receivable", accModels.AccountTypeAsset, "debit", "1000", true, "receivable"},
		{"1300", "Inventory", accModels.AccountTypeAsset, "debit", "1000", true, "inventory"},
		{"1400", "Prepaid Expenses", accModels.AccountTypeAsset, "debit", "1000", false, ""},
		{"1500", "Fixed Assets", accModels.AccountTypeAsset, "debit", "1000", false, ""},
		{"1510", "Furniture & Equipment", accModels.AccountTypeAsset, "debit", "1500", false, ""},
		{"1520", "Vehicles", accModels.AccountTypeAsset, "debit", "1500", false, ""},
		{"1590", "Accumulated Depreciation", accModels.AccountTypeAsset, "credit", "1500", false, ""},
		// Liabilities
		{"2000", "Liabilities", accModels.AccountTypeLiability, "credit", "", false, ""},
		{"2100", "Accounts Payable", accModels.AccountTypeLiability, "credit", "2000", true, "payable"},
		{"2200", "Accrued Expenses", accModels.AccountTypeLiability, "credit", "2000", false, ""},
		{"2300", "Sales Tax Payable", accModels.AccountTypeLiability, "credit", "2000", false, ""},
		{"2400", "Short-term Loans", accModels.AccountTypeLiability, "credit", "2000", false, ""},
		{"2500", "Long-term Debt", accModels.AccountTypeLiability, "credit", "2000", false, ""},
		// Equity
		{"3000", "Equity", accModels.AccountTypeEquity, "credit", "", false, ""},
		{"3100", "Owner's Capital", accModels.AccountTypeEquity, "credit", "3000", false, ""},
		{"3200", "Retained Earnings", accModels.AccountTypeEquity, "credit", "3000", false, ""},
		{"3300", "Dividends", accModels.AccountTypeEquity, "debit", "3000", false, ""},
		// Revenue
		{"4000", "Revenue", accModels.AccountTypeRevenue, "credit", "", false, ""},
		{"4100", "Sales Revenue", accModels.AccountTypeRevenue, "credit", "4000", false, ""},
		{"4200", "Service Revenue", accModels.AccountTypeRevenue, "credit", "4000", false, ""},
		{"4300", "Interest Income", accModels.AccountTypeRevenue, "credit", "4000", false, ""},
		{"4400", "Other Income", accModels.AccountTypeRevenue, "credit", "4000", false, ""},
		{"4900", "Sales Returns & Allowances", accModels.AccountTypeRevenue, "debit", "4000", false, ""},
		// Expenses
		{"5000", "Expenses", accModels.AccountTypeExpense, "debit", "", false, ""},
		{"5100", "Cost of Goods Sold", accModels.AccountTypeExpense, "debit", "5000", false, ""},
		{"6000", "Operating Expenses", accModels.AccountTypeExpense, "debit", "5000", false, ""},
		{"6100", "Salaries & Wages", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6200", "Rent Expense", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6300", "Utilities", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6400", "Insurance", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6500", "Marketing & Advertising", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6600", "Office Supplies", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6700", "Depreciation Expense", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6800", "Bank Charges", accModels.AccountTypeExpense, "debit", "6000", false, ""},
		{"6900", "Miscellaneous Expense", accModels.AccountTypeExpense, "debit", "6000", false, ""},
	}

	for _, d := range defs {
		var parentID *uuid.UUID
		level := 0
		fullPath := d.name
		if d.parentCode != "" {
			if pid, ok := accts[d.parentCode]; ok {
				parentID = &pid
				level = 1
				// get parent for path
				var parent accModels.Account
				if tx.Where("id = ?", pid).First(&parent).Error == nil {
					level = parent.Level + 1
					fullPath = parent.FullPath + " > " + d.name
				}
			}
		}
		acc := accModels.Account{
			CompanyID:        companyID,
			ParentID:         parentID,
			Code:             d.code,
			Name:             d.name,
			AccountType:      d.acctType,
			NormalBalance:    d.normal,
			CurrencyCode:     "USD",
			IsActive:         true,
			IsSystem:         true,
			IsControlAccount: d.isControl,
			ControlType:      d.controlType,
			Level:            level,
			FullPath:         fullPath,
		}
		must(tx.Create(&acc))
		accts[d.code] = acc.ID
	}

	return accts
}

func must(result *gorm.DB) {
	if result.Error != nil {
		log.Fatalf("Seed error: %v", result.Error)
	}
}
