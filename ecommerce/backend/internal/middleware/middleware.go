package middleware

import (
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gonext/ecommerce/internal/auth"
	"github.com/gonext/ecommerce/internal/config"
	"github.com/gonext/ecommerce/internal/utils"
)

func SetupMiddleware(app *fiber.App, cfg *config.Config) {
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.Store.StorefrontURL,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))

	app.Use(SecureHeaders())
}

func SecureHeaders() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		return c.Next()
	}
}

func AuthMiddleware(cfg *config.JWTConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.UnauthorizedResponse(c, "Missing authorization header")
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return utils.UnauthorizedResponse(c, "Invalid authorization header format")
		}

		claims, err := auth.ValidateToken(cfg, parts[1])
		if err != nil {
			return utils.UnauthorizedResponse(c, "Invalid or expired token")
		}

		c.Locals("customer_id", claims.CustomerID)
		c.Locals("email", claims.Email)

		return c.Next()
	}
}

// Simple in-memory rate limiter
type rateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
}

var limiter = &rateLimiter{requests: make(map[string][]time.Time)}

func RateLimit(maxRequests int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		now := time.Now()

		limiter.mu.Lock()
		defer limiter.mu.Unlock()

		// Clean old entries
		var valid []time.Time
		for _, t := range limiter.requests[ip] {
			if now.Sub(t) < window {
				valid = append(valid, t)
			}
		}

		if len(valid) >= maxRequests {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"error":   "Too many requests. Please try again later.",
			})
		}

		valid = append(valid, now)
		limiter.requests[ip] = valid

		return c.Next()
	}
}
