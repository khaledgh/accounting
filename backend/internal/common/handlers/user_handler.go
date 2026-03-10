package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gonext/accounting-ecommerce/internal/common/auth"
	"github.com/gonext/accounting-ecommerce/internal/common/export"
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/gonext/accounting-ecommerce/internal/common/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserHandler struct {
	db *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{db: db}
}

type CreateUserRequest struct {
	Email     string  `json:"email"`
	Password  string  `json:"password"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Phone     string  `json:"phone"`
	BranchID  *string `json:"branch_id"`
	RoleID    *string `json:"role_id"`
	IsActive  bool    `json:"is_active"`
}

type UpdateUserRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Phone     *string `json:"phone"`
	Email     *string `json:"email"`
	BranchID  *string `json:"branch_id"`
	IsActive  *bool   `json:"is_active"`
}

func (h *UserHandler) List(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	params := utils.GetPaginationParams(c)

	var users []models.User
	var total int64

	query := h.db.Where("company_id = ?", companyID)

	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?", search, search, search)
	}

	query.Model(&models.User{}).Count(&total)

	err := query.
		Preload("Branch").
		Preload("UserRoles.Role").
		Order(params.SortBy + " " + params.SortOrder).
		Scopes(utils.Paginate(params)).
		Find(&users).Error

	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to fetch users")
	}

	return utils.SuccessResponse(c, utils.CreatePaginatedResponse(users, total, params))
}

func (h *UserHandler) Get(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var user models.User
	err := h.db.
		Preload("Branch").
		Preload("UserRoles.Role").
		Where("id = ? AND company_id = ?", id, companyID).
		First(&user).Error

	if err != nil {
		return utils.NotFoundResponse(c, "User not found")
	}

	return utils.SuccessResponse(c, user)
}

func (h *UserHandler) Create(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)

	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		return utils.BadRequestResponse(c, "Email, password, first name and last name are required")
	}

	var existing models.User
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		return utils.BadRequestResponse(c, "Email already in use")
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return utils.InternalErrorResponse(c, "Failed to hash password")
	}

	user := models.User{
		CompanyID: companyID,
		Email:     req.Email,
		Password:  hashedPassword,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Phone:     req.Phone,
		IsActive:  req.IsActive,
	}

	if req.BranchID != nil {
		branchUUID, err := uuid.Parse(*req.BranchID)
		if err == nil {
			user.BranchID = &branchUUID
		}
	}

	tx := h.db.Begin()
	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return utils.InternalErrorResponse(c, "Failed to create user")
	}

	if req.RoleID != nil {
		roleUUID, err := uuid.Parse(*req.RoleID)
		if err == nil {
			userRole := models.UserRole{
				UserID:   user.ID,
				RoleID:   roleUUID,
				BranchID: user.BranchID,
			}
			if err := tx.Create(&userRole).Error; err != nil {
				tx.Rollback()
				return utils.InternalErrorResponse(c, "Failed to assign role")
			}
		}
	}

	tx.Commit()
	return utils.CreatedResponse(c, user)
}

func (h *UserHandler) Update(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var user models.User
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&user).Error; err != nil {
		return utils.NotFoundResponse(c, "User not found")
	}

	var req UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequestResponse(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.FirstName != nil {
		updates["first_name"] = *req.FirstName
	}
	if req.LastName != nil {
		updates["last_name"] = *req.LastName
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.Email != nil {
		var existing models.User
		if err := h.db.Where("email = ? AND id != ?", *req.Email, id).First(&existing).Error; err == nil {
			return utils.BadRequestResponse(c, "Email already in use")
		}
		updates["email"] = *req.Email
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.BranchID != nil {
		branchUUID, err := uuid.Parse(*req.BranchID)
		if err == nil {
			updates["branch_id"] = branchUUID
		}
	}

	if err := h.db.Model(&user).Updates(updates).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to update user")
	}

	h.db.Preload("Branch").Preload("UserRoles.Role").First(&user, "id = ?", id)
	return utils.SuccessResponse(c, user, "User updated successfully")
}

func (h *UserHandler) Delete(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	id := c.Params("id")

	var user models.User
	if err := h.db.Where("id = ? AND company_id = ?", id, companyID).First(&user).Error; err != nil {
		return utils.NotFoundResponse(c, "User not found")
	}

	currentUserID := c.Locals("user_id").(uuid.UUID)
	if user.ID == currentUserID {
		return utils.BadRequestResponse(c, "Cannot delete your own account")
	}

	if err := h.db.Delete(&user).Error; err != nil {
		return utils.InternalErrorResponse(c, "Failed to delete user")
	}

	return utils.SuccessResponse(c, nil, "User deleted successfully")
}

func (h *UserHandler) Export(c *fiber.Ctx) error {
	companyID := c.Locals("company_id").(uuid.UUID)
	var users []models.User
	query := h.db.Where("company_id = ?", companyID)
	if s := c.Query("search"); s != "" {
		search := "%" + s + "%"
		query = query.Where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?", search, search, search)
	}
	query.Order("created_at desc").Find(&users)
	cols := []export.Column{
		{Header: "First Name", Field: "FirstName", Width: 20},
		{Header: "Last Name", Field: "LastName", Width: 20},
		{Header: "Email", Field: "Email", Width: 30},
		{Header: "Active", Field: "IsActive", Width: 10},
	}
	return export.HandleExport(c, "Users", cols, users)
}

func (h *UserHandler) RegisterRoutes(api fiber.Router) {
	users := api.Group("/users")
	users.Get("/", h.List)
	users.Get("/export", h.Export)
	users.Get("/:id", h.Get)
	users.Post("/", h.Create)
	users.Put("/:id", h.Update)
	users.Delete("/:id", h.Delete)
}
