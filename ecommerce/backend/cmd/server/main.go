package main

import (
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/ecommerce/internal/auth"
	"github.com/gonext/ecommerce/internal/cart"
	"github.com/gonext/ecommerce/internal/checkout"
	"github.com/gonext/ecommerce/internal/cms"
	"github.com/gonext/ecommerce/internal/config"
	"github.com/gonext/ecommerce/internal/customer"
	"github.com/gonext/ecommerce/internal/database"
	"github.com/gonext/ecommerce/internal/middleware"
	"github.com/gonext/ecommerce/internal/orders"
	"github.com/gonext/ecommerce/internal/storefront"
)

func main() {
	cfg := config.Load()

	db := database.Connect(&cfg.DB)
	database.Migrate(db)

	app := fiber.New(fiber.Config{
		AppName:      cfg.App.Name,
		BodyLimit:    10 * 1024 * 1024,
		ErrorHandler: customErrorHandler,
	})

	middleware.SetupMiddleware(app, cfg)

	// Public auth routes (with rate limiting on auth endpoints)
	authHandler := auth.NewHandler(db, cfg)
	authRateLimited := app.Group("/api/store/auth", middleware.RateLimit(10, 1*time.Minute))
	authRateLimited.Post("/register", authHandler.Register)
	authRateLimited.Post("/login", authHandler.Login)
	authRateLimited.Post("/refresh", authHandler.Refresh)
	authRateLimited.Post("/forgot-password", authHandler.ForgotPassword)
	authRateLimited.Post("/reset-password", authHandler.ResetPassword)

	// Public storefront routes (no auth required)
	publicAPI := app.Group("/api")
	storefrontHandler := storefront.NewHandler(db)
	storefrontHandler.RegisterRoutes(publicAPI)

	cmsHandler := cms.NewHandler(db)
	cmsHandler.RegisterPublicRoutes(publicAPI)

	// Protected routes (auth required)
	protectedAPI := app.Group("/api", middleware.AuthMiddleware(&cfg.JWT))

	cmsHandler.RegisterProtectedRoutes(protectedAPI)

	cartHandler := cart.NewHandler(db)
	cartHandler.RegisterRoutes(protectedAPI)

	customerHandler := customer.NewHandler(db)
	customerHandler.RegisterRoutes(protectedAPI)

	ordersHandler := orders.NewHandler(db)
	ordersHandler.RegisterRoutes(protectedAPI)

	checkoutHandler := checkout.NewHandler(db)
	checkoutHandler.RegisterRoutes(protectedAPI)

	// Health check
	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": cfg.App.Name,
		})
	})

	addr := fmt.Sprintf(":%s", cfg.App.Port)
	fmt.Printf("✓ Storefront API starting on %s\n", addr)
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
