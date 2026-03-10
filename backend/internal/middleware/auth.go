package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/auth"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/gonext/accounting-ecommerce/internal/config"
)

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

		c.Locals("user_id", claims.UserID)
		c.Locals("company_id", claims.CompanyID)
		c.Locals("email", claims.Email)
		c.Locals("is_super_admin", claims.IsSuperAdmin)

		return c.Next()
	}
}

func RBACMiddleware(module, action, resource string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		isSuperAdmin, ok := c.Locals("is_super_admin").(bool)
		if ok && isSuperAdmin {
			return c.Next()
		}

		// TODO: Check user permissions from database/cache
		// For now, allow all authenticated users
		return c.Next()
	}
}
