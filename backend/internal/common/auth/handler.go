package auth

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/gonext/accounting-ecommerce/internal/config"
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

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type RegisterRequest struct {
	Email       string `json:"email" validate:"required,email"`
	Password    string `json:"password" validate:"required,min=8"`
	FirstName   string `json:"first_name" validate:"required"`
	LastName    string `json:"last_name" validate:"required"`
	CompanyName string `json:"company_name" validate:"required"`
	CompanyCode string `json:"company_code" validate:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Email == "" || req.Password == "" {
		return utils.BadRequestResponse(c, "Email and password are required")
	}

	var user models.User
	if err := h.db.Where("email = ? AND is_active = ?", req.Email, true).First(&user).Error; err != nil {
		return utils.UnauthorizedResponse(c, "Invalid email or password")
	}

	if !CheckPassword(req.Password, user.Password) {
		return utils.UnauthorizedResponse(c, "Invalid email or password")
	}

	tokens, err := GenerateTokens(&h.cfg.JWT, user.ID, user.CompanyID, user.Email, user.IsSuperAdmin)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate tokens")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"user":   user,
		"tokens": tokens,
	}, "Login successful")
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" || req.CompanyName == "" {
		return utils.BadRequestResponse(c, "All fields are required")
	}

	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return utils.BadRequestResponse(c, "Email already registered")
	}

	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to hash password")
	}

	tx := h.db.Begin()

	company := models.Company{
		Name:     req.CompanyName,
		Code:     req.CompanyCode,
		IsActive: true,
	}
	if err := tx.Create(&company).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create company")
	}

	branch := models.Branch{
		CompanyID: company.ID,
		Name:      "Main Branch",
		Code:      "MAIN",
		IsActive:  true,
		IsMain:    true,
	}
	if err := tx.Create(&branch).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create branch")
	}

	user := models.User{
		CompanyID:    company.ID,
		BranchID:     &branch.ID,
		Email:        req.Email,
		Password:     hashedPassword,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		IsActive:     true,
		IsSuperAdmin: true,
	}
	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create user")
	}

	adminRole := models.Role{
		CompanyID:   company.ID,
		Name:        "Administrator",
		Code:        "admin",
		Description: "Full system access",
		IsSystem:    true,
		IsActive:    true,
	}
	if err := tx.Create(&adminRole).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create role")
	}

	userRole := models.UserRole{
		UserID:   user.ID,
		RoleID:   adminRole.ID,
		BranchID: &branch.ID,
	}
	if err := tx.Create(&userRole).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to assign role")
	}

	if err := seedDefaultSequences(tx, company.ID); err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create auto-number sequences")
	}

	tx.Commit()

	tokens, err := GenerateTokens(&h.cfg.JWT, user.ID, company.ID, user.Email, user.IsSuperAdmin)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate tokens")
	}

	return utils.CreatedResponse(c, fiber.Map{
		"user":    user,
		"company": company,
		"branch":  branch,
		"tokens":  tokens,
	})
}

func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	claims, err := ValidateToken(&h.cfg.JWT, req.RefreshToken)
	if err != nil {
		return utils.UnauthorizedResponse(c, "Invalid refresh token")
	}

	var user models.User
	if err := h.db.Where("id = ? AND is_active = ?", claims.UserID, true).First(&user).Error; err != nil {
		return utils.UnauthorizedResponse(c, "User not found")
	}

	tokens, err := GenerateTokens(&h.cfg.JWT, user.ID, user.CompanyID, user.Email, user.IsSuperAdmin)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to generate tokens")
	}

	return utils.SuccessResponse(c, tokens, "Token refreshed")
}

func (h *Handler) GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uuid.UUID)

	var user models.User
	if err := h.db.Preload("Company").Preload("Branch").Preload("UserRoles.Role").
		Where("id = ?", userID).First(&user).Error; err != nil {
		return utils.NotFoundResponse(c, "User not found")
	}

	return utils.SuccessResponse(c, user)
}

func seedDefaultSequences(tx *gorm.DB, companyID uuid.UUID) error {
	sequences := []models.AutoNumberSequence{
		{CompanyID: companyID, EntityType: "customer", Prefix: "CUST-", NextNumber: 1, Padding: 6, IsActive: true},
		{CompanyID: companyID, EntityType: "supplier", Prefix: "SUP-", NextNumber: 1, Padding: 6, IsActive: true},
		{CompanyID: companyID, EntityType: "invoice", Prefix: "INV-", NextNumber: 1, Padding: 6, IsActive: true},
		{CompanyID: companyID, EntityType: "journal", Prefix: "JRN-", NextNumber: 1, Padding: 6, IsActive: true},
		{CompanyID: companyID, EntityType: "purchase_order", Prefix: "PO-", NextNumber: 1, Padding: 6, IsActive: true},
		{CompanyID: companyID, EntityType: "order", Prefix: "ORD-", NextNumber: 1, Padding: 6, IsActive: true},
		{CompanyID: companyID, EntityType: "payment", Prefix: "PAY-", NextNumber: 1, Padding: 6, IsActive: true},
		{CompanyID: companyID, EntityType: "account", Prefix: "ACC-", NextNumber: 1, Padding: 6, IsActive: true},
	}

	for _, seq := range sequences {
		if err := tx.Create(&seq).Error; err != nil {
			return err
		}
	}
	return nil
}

func (h *Handler) RegisterRoutes(app *fiber.App) {
	auth := app.Group("/api/auth")
	auth.Post("/login", h.Login)
	auth.Post("/register", h.Register)
	auth.Post("/refresh", h.RefreshToken)
}
