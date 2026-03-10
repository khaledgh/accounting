package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	accHandlers "github.com/gonext/accounting-ecommerce/internal/accounting/handlers"
	"github.com/gonext/accounting-ecommerce/internal/common/auth"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	"github.com/gonext/accounting-ecommerce/internal/common/handlers"
	"github.com/gonext/accounting-ecommerce/internal/config"
	"github.com/gonext/accounting-ecommerce/internal/database"
	ecomHandlers "github.com/gonext/accounting-ecommerce/internal/ecommerce/handlers"
	intHandlers "github.com/gonext/accounting-ecommerce/internal/integration/handlers"
	intService "github.com/gonext/accounting-ecommerce/internal/integration/service"
	"github.com/gonext/accounting-ecommerce/internal/middleware"
)

func main() {
	cfg := config.Load()

	db := database.Connect(&cfg.DB)
	database.ConnectRedis(&cfg.Redis)
	database.Migrate(db)

	// Run seed if --seed flag is passed
	for _, arg := range os.Args[1:] {
		if arg == "--seed" {
			database.Seed(db)
			break
		}
	}

	app := fiber.New(fiber.Config{
		AppName:      cfg.App.Name,
		BodyLimit:    50 * 1024 * 1024,
		ErrorHandler: customErrorHandler,
	})

	middleware.SetupMiddleware(app)

	// Serve uploaded media files
	app.Static("/uploads", "./uploads")

	authHandler := auth.NewHandler(db, cfg)
	authHandler.RegisterRoutes(app)

	protectedAPI := app.Group("/api", middleware.AuthMiddleware(&cfg.JWT))

	protectedAPI.Get("/profile", authHandler.GetProfile)

	userHandler := handlers.NewUserHandler(db)
	userHandler.RegisterRoutes(protectedAPI)

	companyHandler := handlers.NewCompanyHandler(db)
	companyHandler.RegisterRoutes(protectedAPI)

	branchHandler := handlers.NewBranchHandler(db)
	branchHandler.RegisterRoutes(protectedAPI)

	// Accounting handlers
	autoNumService := autonumber.NewService(db)

	accountHandler := accHandlers.NewAccountHandler(db)
	accountHandler.RegisterRoutes(protectedAPI)

	fyHandler := accHandlers.NewFinancialYearHandler(db)
	fyHandler.RegisterRoutes(protectedAPI)

	journalHandler := accHandlers.NewJournalHandler(db, autoNumService)
	journalHandler.RegisterRoutes(protectedAPI)

	reportHandler := accHandlers.NewReportHandler(db)
	reportHandler.RegisterRoutes(protectedAPI)

	currencyHandler := accHandlers.NewCurrencyHandler(db)
	currencyHandler.RegisterRoutes(protectedAPI)

	receivableHandler := accHandlers.NewReceivableHandler(db)
	receivableHandler.RegisterRoutes(protectedAPI)

	payableHandler := accHandlers.NewPayableHandler(db)
	payableHandler.RegisterRoutes(protectedAPI)

	purchaseInvoiceHandler := accHandlers.NewPurchaseInvoiceHandler(db, autoNumService)
	purchaseInvoiceHandler.RegisterRoutes(protectedAPI)

	bankHandler := accHandlers.NewBankHandler(db)
	bankHandler.RegisterRoutes(protectedAPI)

	accPaymentHandler := accHandlers.NewAccountingPaymentHandler(db)
	accPaymentHandler.RegisterRoutes(protectedAPI)

	// eCommerce handlers
	productHandler := ecomHandlers.NewProductHandler(db)
	productHandler.RegisterRoutes(protectedAPI)

	customerHandler := ecomHandlers.NewCustomerHandler(db, autoNumService)
	customerHandler.RegisterRoutes(protectedAPI)

	supplierHandler := ecomHandlers.NewSupplierHandler(db, autoNumService)
	supplierHandler.RegisterRoutes(protectedAPI)

	categoryHandler := ecomHandlers.NewCategoryHandler(db)
	categoryHandler.RegisterRoutes(protectedAPI)

	integrationService := intService.NewIntegrationService(db, autoNumService)

	orderHandler := ecomHandlers.NewOrderHandler(db, autoNumService, integrationService)
	orderHandler.RegisterRoutes(protectedAPI)

	invoiceHandler := ecomHandlers.NewInvoiceHandler(db, autoNumService)
	invoiceHandler.RegisterRoutes(protectedAPI)

	paymentHandler := ecomHandlers.NewPaymentHandler(db, autoNumService, integrationService)
	paymentHandler.RegisterRoutes(protectedAPI)

	stockHandler := ecomHandlers.NewStockHandler(db)
	stockHandler.RegisterRoutes(protectedAPI)

	// Media handler
	mediaHandler := handlers.NewMediaHandler(db)
	mediaHandler.RegisterRoutes(protectedAPI)

	// Dashboard & notifications
	dashboardHandler := handlers.NewDashboardHandler(db)
	dashboardHandler.RegisterRoutes(protectedAPI)

	// Invoice templates
	invoiceTemplateHandler := handlers.NewInvoiceTemplateHandler(db)
	invoiceTemplateHandler.RegisterRoutes(protectedAPI)

	// Integration handlers
	integrationHandler := intHandlers.NewIntegrationHandler(db)
	integrationHandler.RegisterRoutes(protectedAPI)

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": cfg.App.Name,
		})
	})

	addr := fmt.Sprintf(":%s", cfg.App.Port)
	fmt.Printf("✓ Server starting on %s\n", addr)
	log.Fatal(app.Listen(addr))
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"success": false,
		"error":   err.Error(),
	})
}
