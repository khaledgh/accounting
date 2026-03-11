package database

import (
	"fmt"
	"log"

	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	intModels "github.com/gonext/accounting-ecommerce/internal/integration/models"
	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) {
	// Workaround for GORM catalog name bug: disable column type checking
	db = db.Session(&gorm.Session{
		SkipDefaultTransaction: true,
	})

	err := db.Set("gorm:table_options", "").AutoMigrate(
		&models.Company{},
		&models.Branch{},
		&models.User{},
		&models.Role{},
		&models.Permission{},
		&models.RolePermission{},
		&models.UserRole{},
		&models.AuditLog{},
		&models.AutoNumberSequence{},
		// &models.Setting{}, // Temporarily disabled due to constraint migration issue
		&models.InvoiceTemplate{},
		&models.Media{},
		// Accounting
		&accModels.FinancialYear{},
		&accModels.FiscalPeriod{},
		&accModels.Account{},
		&accModels.Currency{},
		&accModels.ExchangeRate{},
		&accModels.Journal{},
		&accModels.JournalEntry{},
		&accModels.CostCenter{},
		&accModels.PurchaseInvoice{},
		&accModels.PurchaseInvoiceItem{},
		&accModels.AccountingPayment{},
		// eCommerce
		&ecomModels.Category{},
		&ecomModels.Product{},
		&ecomModels.ProductVariant{},
		&ecomModels.Customer{},
		&ecomModels.Supplier{},
		&ecomModels.Order{},
		&ecomModels.OrderItem{},
		&ecomModels.Invoice{},
		&ecomModels.InvoiceItem{},
		&ecomModels.Payment{},
		&ecomModels.StockMovement{},
		&ecomModels.OrderStatusHistory{},
		// Integration
		&intModels.AccountMapping{},
		&intModels.IntegrationLog{},
	)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	fmt.Println("✓ Database migrations completed")
}
