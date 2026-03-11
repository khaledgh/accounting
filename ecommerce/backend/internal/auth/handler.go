package auth

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gonext/ecommerce/internal/config"
	"github.com/gonext/ecommerce/internal/models"
	"github.com/gonext/ecommerce/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewHandler(db *gorm.DB, cfg *config.Config) *Handler {
	return &Handler{db: db, cfg: cfg}
}

type RegisterRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		return utils.BadRequestResponse(c, "Email, password, first name and last name are required")
	}
	if len(req.Password) < 8 {
		return utils.BadRequestResponse(c, "Password must be at least 8 characters")
	}

	var existing models.StoreCustomer
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		return utils.BadRequestResponse(c, "Email already registered")
	}

	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to process registration")
	}

	verifyToken := generateToken()

	customer := models.StoreCustomer{
		Email:            req.Email,
		Password:         hashedPassword,
		FirstName:        req.FirstName,
		LastName:         req.LastName,
		Phone:            req.Phone,
		IsActive:         true,
		EmailVerified:    false,
		EmailVerifyToken: verifyToken,
	}

	if err := h.db.Create(&customer).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to create account")
	}

	tokens, err := GenerateTokens(&h.cfg.JWT, customer.ID, customer.Email)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate tokens")
	}

	return utils.CreatedResponse(c, fiber.Map{
		"customer": customer,
		"tokens":   tokens,
	})
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return utils.BadRequestResponse(c, "Email and password are required")
	}

	var customer models.StoreCustomer
	if err := h.db.Where("email = ? AND is_active = ?", req.Email, true).First(&customer).Error; err != nil {
		return utils.UnauthorizedResponse(c, "Invalid email or password")
	}

	if !CheckPassword(req.Password, customer.Password) {
		return utils.UnauthorizedResponse(c, "Invalid email or password")
	}

	now := time.Now()
	h.db.Model(&customer).Update("last_login_at", now)

	tokens, err := GenerateTokens(&h.cfg.JWT, customer.ID, customer.Email)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate tokens")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"customer": customer,
		"tokens":   tokens,
	})
}

func (h *Handler) Refresh(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.RefreshToken == "" {
		return utils.BadRequestResponse(c, "Refresh token is required")
	}

	claims, err := ValidateToken(&h.cfg.JWT, req.RefreshToken)
	if err != nil {
		return utils.UnauthorizedResponse(c, "Invalid or expired refresh token")
	}

	var customer models.StoreCustomer
	if err := h.db.Where("id = ? AND is_active = ?", claims.CustomerID, true).First(&customer).Error; err != nil {
		return utils.UnauthorizedResponse(c, "Customer not found")
	}

	tokens, err := GenerateTokens(&h.cfg.JWT, customer.ID, customer.Email)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate tokens")
	}

	return utils.SuccessResponse(c, fiber.Map{"tokens": tokens})
}

func (h *Handler) ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var customer models.StoreCustomer
	if err := h.db.Where("email = ?", req.Email).First(&customer).Error; err != nil {
		return utils.SuccessResponse(c, nil, "If the email exists, a reset link has been sent")
	}

	resetToken := generateToken()
	expiry := time.Now().Add(1 * time.Hour)
	h.db.Model(&customer).Updates(map[string]interface{}{
		"reset_token":     resetToken,
		"reset_token_exp": expiry,
	})

	// TODO: Send email with reset link containing resetToken
	return utils.SuccessResponse(c, nil, "If the email exists, a reset link has been sent")
}

func (h *Handler) ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Token == "" || len(req.Password) < 8 {
		return utils.BadRequestResponse(c, "Valid token and password (min 8 chars) are required")
	}

	var customer models.StoreCustomer
	if err := h.db.Where("reset_token = ? AND reset_token_exp > ?", req.Token, time.Now()).First(&customer).Error; err != nil {
		return utils.BadRequestResponse(c, "Invalid or expired reset token")
	}

	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to process password")
	}

	h.db.Model(&customer).Updates(map[string]interface{}{
		"password":        hashedPassword,
		"reset_token":     "",
		"reset_token_exp": nil,
	})

	return utils.SuccessResponse(c, nil, "Password has been reset successfully")
}

func (h *Handler) VerifyEmail(c *fiber.Ctx) error {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}
	if req.Token == "" {
		return utils.BadRequestResponse(c, "Verification token is required")
	}

	var customer models.StoreCustomer
	if err := h.db.Where("email_verify_token = ?", req.Token).First(&customer).Error; err != nil {
		return utils.BadRequestResponse(c, "Invalid or expired verification token")
	}

	if customer.EmailVerified {
		return utils.SuccessResponse(c, nil, "Email already verified")
	}

	h.db.Model(&customer).Updates(map[string]interface{}{
		"email_verified":     true,
		"email_verify_token": "",
	})

	return utils.SuccessResponse(c, nil, "Email verified successfully")
}

func (h *Handler) ResendVerification(c *fiber.Ctx) error {
	customerID, ok := c.Locals("customer_id").(uuid.UUID)
	if !ok {
		// fallback: accept email in body for unauthenticated resend
		var req struct {
			Email string `json:"email"`
		}
		if err := c.BodyParser(&req); err != nil || req.Email == "" {
			return utils.BadRequestResponse(c, "Email is required")
		}
		var customer models.StoreCustomer
		if err := h.db.Where("email = ?", strings.TrimSpace(strings.ToLower(req.Email))).First(&customer).Error; err != nil {
			// Always return success to prevent email enumeration
			return utils.SuccessResponse(c, nil, "If the email exists, a verification link has been sent")
		}
		if customer.EmailVerified {
			return utils.SuccessResponse(c, nil, "Email already verified")
		}
		newToken := generateToken()
		h.db.Model(&customer).Update("email_verify_token", newToken)
		// TODO: Send email with verification link containing newToken
		return utils.SuccessResponse(c, nil, "Verification email sent")
	}

	var customer models.StoreCustomer
	if err := h.db.First(&customer, "id = ?", customerID).Error; err != nil {
		return utils.NotFoundResponse(c, "Customer not found")
	}
	if customer.EmailVerified {
		return utils.SuccessResponse(c, nil, "Email already verified")
	}

	newToken := generateToken()
	h.db.Model(&customer).Update("email_verify_token", newToken)
	// TODO: Send email with verification link containing newToken

	return utils.SuccessResponse(c, nil, "Verification email sent")
}

func (h *Handler) RegisterRoutes(app *fiber.App) {
	auth := app.Group("/api/store/auth")
	auth.Post("/register", h.Register)
	auth.Post("/login", h.Login)
	auth.Post("/refresh", h.Refresh)
	auth.Post("/forgot-password", h.ForgotPassword)
	auth.Post("/reset-password", h.ResetPassword)
	auth.Post("/verify-email", h.VerifyEmail)
	auth.Post("/resend-verification", h.ResendVerification)
}

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
